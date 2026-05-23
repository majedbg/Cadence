/**
 * PDF.js-based Cadence viewer.
 *
 * Loads the PDF from `?src=` (cross-origin OK because manifest declares
 * `host_permissions: ["<all_urls>"]`), renders each page's canvas + text
 * layer, then lets the user RSVP either a selected range or the whole
 * document via the same engine/overlay/highlighter stack the content
 * script uses on regular web pages.
 */

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

import { RSVPEngine, type RSVPTickState } from '../content/rsvp';
import { DOMHighlighter } from '../content/highlighter';
import { Overlay } from '../content/overlay';
import { tokeniseSelection, getActiveSelectionRange } from '../content/selection';
import { stepMultiplier } from '../content/speed';
import { DEFAULT_SETTINGS, STORAGE_KEY } from '../lib/constants';
import { getSourceFromViewerUrl } from '../lib/viewerUrl';
import { fetchPdfBytes } from './fetchPdf';
import { SKIP_MARKER } from '../background/autoOpen';
import type { ReaderSettings, WordToken } from '../lib/types';

// PDF.js worker — must be set BEFORE getDocument(). Not bundled; copied into
// dist/viewer/pdf.worker.mjs by esbuild.config.mjs.
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('viewer/pdf.worker.mjs');

const RENDER_SCALE = 1.5;

class PdfLoadError extends Error {
  constructor(public kind: string, message: string, public src: string) {
    super(message);
    this.name = 'PdfLoadError';
  }
}

type Mode = 'selection' | 'page';

interface PageRecord {
  pageNumber: number;
  wrapper: HTMLDivElement;
  canvas: HTMLCanvasElement;
  textLayerDiv: HTMLDivElement;
  page: pdfjsLib.PDFPageProxy;
  viewport: pdfjsLib.PageViewport;
  canvasRendered: boolean;
  canvasRenderTask: pdfjsLib.RenderTask | null;
  textLayerReady: Promise<void>;
}

class CadenceViewer {
  private settings: ReaderSettings = DEFAULT_SETTINGS;
  private mode: Mode = 'selection';
  private pages: PageRecord[] = [];
  private intersectionObserver: IntersectionObserver | null = null;

  // RSVP session state (lifecycle mirrors src/content/main.ts).
  private engine: RSVPEngine | null = null;
  private overlay: Overlay | null = null;
  private highlighter: DOMHighlighter | null = null;
  private tokens: WordToken[] = [];
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private lastIndex = -1;

  // DOM
  private startBtn!: HTMLButtonElement;
  private backLink!: HTMLAnchorElement;
  private docNameEl!: HTMLDivElement;
  private statusEl!: HTMLDivElement;
  private pagesContainer!: HTMLDivElement;
  private flashContainer!: HTMLDivElement;

  async init(): Promise<void> {
    this.startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    this.backLink = document.getElementById('backLink') as HTMLAnchorElement;
    this.docNameEl = document.getElementById('docName') as HTMLDivElement;
    this.statusEl = document.getElementById('status') as HTMLDivElement;
    this.pagesContainer = document.getElementById('pagesContainer') as HTMLDivElement;
    this.flashContainer = document.getElementById('flashContainer') as HTMLDivElement;

    await this.loadSettings();

    const src = getSourceFromViewerUrl(window.location.href);
    if (!src) {
      this.setStatus('No PDF source provided (missing ?src= parameter).');
      return;
    }

    this.docNameEl.textContent = decodeURIComponent(src);
    this.docNameEl.title = decodeURIComponent(src);
    // Append the skip marker so the auto-open redirect doesn't pull the
    // user right back into the Cadence viewer.
    const backTarget = appendSkipMarker(src);
    this.backLink.href = backTarget;
    this.backLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.replace(backTarget);
    });

    this.wireModeToggle();
    this.wireStartButton();

    try {
      await this.loadDocument(src);
      this.setStatus('');
      this.startBtn.disabled = false;
    } catch (err) {
      console.error('[CadenceViewer] failed to load PDF', err);
      this.renderLoadError(err, src);
    }
  }

  private renderLoadError(err: unknown, src: string): void {
    this.statusEl.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'load-error-title';
    const detail = document.createElement('div');
    detail.className = 'load-error-detail';
    const fallback = document.createElement('a');
    fallback.className = 'load-error-fallback';
    fallback.href = appendSkipMarker(src);
    fallback.textContent = 'Open in default viewer instead';

    if (err instanceof PdfLoadError) {
      title.textContent = "Couldn't load this PDF in Cadence";
      detail.textContent = err.message;
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      title.textContent = "Couldn't load this PDF";
      detail.textContent = /invalid pdf structure/i.test(msg)
        ? 'The server returned something that isn\'t a valid PDF. The site may require login or block extension fetches.'
        : msg;
    }

    this.statusEl.append(title, detail, fallback);
    this.statusEl.style.display = 'block';
  }

  private async loadSettings(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      if (stored[STORAGE_KEY]) {
        this.settings = { ...DEFAULT_SETTINGS, ...stored[STORAGE_KEY] };
      }
    } catch {
      // ignore — fall back to defaults
    }
    chrome.storage.onChanged.addListener((changes) => {
      if (changes[STORAGE_KEY]) {
        this.applySettings(changes[STORAGE_KEY].newValue ?? DEFAULT_SETTINGS);
      }
    });
  }

  private applySettings(next: ReaderSettings): void {
    this.settings = { ...DEFAULT_SETTINGS, ...next };
    if (this.engine) this.engine.setWPM(this.settings.wpm);
    if (this.highlighter) {
      this.highlighter.setColor(this.settings.highlightColor);
      this.highlighter.setOpacity(this.settings.highlightOpacity);
    }
    if (this.overlay) {
      this.overlay.setAccentColor(this.settings.highlightColor);
      this.overlay.setWordFadeMs(this.settings.wordFadeMs);
    }
  }

  private setStatus(text: string): void {
    this.statusEl.textContent = text;
    this.statusEl.style.display = text ? 'block' : 'none';
  }

  private wireModeToggle(): void {
    const radios = document.querySelectorAll<HTMLInputElement>('input[name="mode"]');
    radios.forEach((r) => {
      r.addEventListener('change', () => {
        if (r.checked) this.mode = r.value as Mode;
      });
    });
  }

  private wireStartButton(): void {
    this.startBtn.addEventListener('click', () => {
      this.startBtn.blur(); // so Space doesn't re-fire the button while playing
      this.startSession();
    });
  }

  // ------------- PDF loading + rendering -------------

  private async loadDocument(src: string): Promise<void> {
    // Pre-fetch ourselves with credentials so site cookies are sent (paywalled
    // / signed-in PDFs), and so we can diagnose non-PDF responses with a clear
    // error instead of letting PDF.js fail with "Invalid PDF structure".
    this.setStatus('Fetching PDF…');
    const result = await fetchPdfBytes(src);
    if (result.kind !== 'ok') {
      throw new PdfLoadError(result.kind, result.message, src);
    }
    const loadingTask = pdfjsLib.getDocument({ data: result.data });
    const doc = await loadingTask.promise;

    this.setStatus(`Rendering ${doc.numPages} pages…`);
    this.setupCanvasObserver();

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const record = this.createPageRecord(page, pageNumber);
      this.pages.push(record);
      this.pagesContainer.appendChild(record.wrapper);
      this.intersectionObserver?.observe(record.wrapper);
    }

    // Render text layers EAGERLY for all pages (cheap — DOM only). This way
    // "Read whole page" can build a Range over the full document without
    // racing canvas rendering.
    await Promise.all(this.pages.map((p) => p.textLayerReady));
  }

  private createPageRecord(page: pdfjsLib.PDFPageProxy, pageNumber: number): PageRecord {
    const viewport = page.getViewport({ scale: RENDER_SCALE });

    const wrapper = document.createElement('div');
    wrapper.className = 'page-wrapper';
    wrapper.dataset.pageNumber = String(pageNumber);
    wrapper.style.width = `${viewport.width}px`;
    wrapper.style.height = `${viewport.height}px`;

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    textLayerDiv.style.setProperty('--scale-factor', String(viewport.scale));
    textLayerDiv.style.width = `${viewport.width}px`;
    textLayerDiv.style.height = `${viewport.height}px`;

    wrapper.appendChild(canvas);
    wrapper.appendChild(textLayerDiv);

    const record: PageRecord = {
      pageNumber,
      wrapper,
      canvas,
      textLayerDiv,
      page,
      viewport,
      canvasRendered: false,
      canvasRenderTask: null,
      textLayerReady: this.renderTextLayer(page, viewport, textLayerDiv),
    };
    return record;
  }

  private async renderTextLayer(
    page: pdfjsLib.PDFPageProxy,
    viewport: pdfjsLib.PageViewport,
    container: HTMLDivElement,
  ): Promise<void> {
    const textLayer = new pdfjsLib.TextLayer({
      textContentSource: page.streamTextContent({
        includeMarkedContent: true,
        disableNormalization: true,
      }),
      container,
      viewport,
    });
    await textLayer.render();
  }

  private setupCanvasObserver(): void {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const pageNumber = Number((entry.target as HTMLElement).dataset.pageNumber);
          const record = this.pages.find((p) => p.pageNumber === pageNumber);
          if (record && !record.canvasRendered && !record.canvasRenderTask) {
            this.renderCanvas(record);
          }
        }
      },
      { root: null, rootMargin: '400px 0px', threshold: 0.01 },
    );
  }

  private renderCanvas(record: PageRecord): void {
    const ctx = record.canvas.getContext('2d');
    if (!ctx) return;
    const task = record.page.render({
      canvasContext: ctx,
      canvas: record.canvas,
      viewport: record.viewport,
    });
    record.canvasRenderTask = task;
    task.promise
      .then(() => {
        record.canvasRendered = true;
        record.canvasRenderTask = null;
      })
      .catch((err: unknown) => {
        // RenderingCancelledException is benign (e.g. observer fired twice).
        record.canvasRenderTask = null;
        if (err && (err as { name?: string }).name !== 'RenderingCancelledException') {
          console.warn('[CadenceViewer] canvas render failed', err);
        }
      });
  }

  // ------------- RSVP session -------------

  private startSession(): void {
    const range = this.buildRange();
    if (!range) return; // buildRange has already flashed the error

    const tokens = tokeniseSelection(range);
    if (tokens.length === 0) {
      this.flash('No words in selection');
      return;
    }

    this.cleanupSession();

    this.tokens = tokens;
    this.lastIndex = -1;

    this.overlay = new Overlay(this.settings.highlightColor);
    this.overlay.setWordFadeMs(this.settings.wordFadeMs);
    this.overlay.setTokens(tokens);
    this.overlay.onClose = () => this.stopSession();
    // Auto-next-section doesn't apply inside a fixed PDF viewer surface.
    this.overlay.onAutoSelectNext = null;
    this.overlay.onManualSelectNext = null;

    this.highlighter = new DOMHighlighter(
      this.settings.highlightColor,
      this.settings.highlightOpacity,
    );

    this.engine = new RSVPEngine(this.settings.wpm, {
      onTick: (state) => this.onTick(state),
      onStatusChange: () => {},
      onDone: () => this.onDone(),
    });
    this.engine.load(tokens);
    // load() resets the multiplier to 1.0; mirror that in the overlay.
    this.overlay.setSpeedMultiplier(this.engine.getSpeedMultiplier());

    this.attachKeys();
    window.getSelection()?.removeAllRanges();
    this.engine.play();
  }

  private buildRange(): Range | null {
    if (this.mode === 'selection') {
      const r = getActiveSelectionRange();
      if (!r) {
        this.flash('Select text first');
        return null;
      }
      return r;
    }
    // Whole-page mode: span all rendered text layers.
    if (this.pages.length === 0) {
      this.flash('No pages rendered yet');
      return null;
    }
    const first = this.pages[0].textLayerDiv;
    const last = this.pages[this.pages.length - 1].textLayerDiv;
    if (!first.firstChild || !last.firstChild) {
      this.flash('Text layers not ready yet');
      return null;
    }
    const r = document.createRange();
    r.setStartBefore(first);
    r.setEndAfter(last);
    return r;
  }

  private stopSession(): void {
    this.cleanupSession();
  }

  private cleanupSession(): void {
    this.engine?.stop();
    this.overlay?.destroy();
    this.highlighter?.destroy();
    this.detachKeys();
    this.engine = null;
    this.overlay = null;
    this.highlighter = null;
    this.tokens = [];
    this.lastIndex = -1;
  }

  private onTick(state: RSVPTickState): void {
    this.overlay?.update(state);
    if (state.index !== this.lastIndex) {
      const token = this.tokens[state.index];
      if (token && this.highlighter) this.highlighter.highlight(token);
      this.lastIndex = state.index;
    }
  }

  private onDone(): void {
    if (!this.overlay) return;
    this.overlay.setDone(false);
  }

  private attachKeys(): void {
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        this.engine?.toggle();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.engine?.step(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.engine?.step(-1);
      } else if (e.shiftKey && (e.key === '>' || e.key === '<')) {
        // YouTube-style speed control: Shift+. → > (faster), Shift+, → < (slower).
        e.preventDefault();
        if (!this.engine || !this.overlay) return;
        const next = stepMultiplier(this.engine.getSpeedMultiplier(), e.key === '>' ? 1 : -1);
        this.engine.setSpeedMultiplier(next);
        this.overlay.setSpeedMultiplier(next);
      } else if (e.key === 'Escape') {
        this.stopSession();
      }
    };
    window.addEventListener('keydown', this.keyHandler, { capture: true });
  }

  private detachKeys(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler, { capture: true });
      this.keyHandler = null;
    }
  }

  private flash(message: string): void {
    const el = document.createElement('div');
    el.className = 'flash';
    el.textContent = message;
    this.flashContainer.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }
}

function appendSkipMarker(url: string): string {
  // Use a URL fragment so the marker is invisible to the server. Preserves
  // any existing fragment by replacing it (the user is leaving the viewer
  // anyway, so a prior fragment doesn't matter here).
  const hashIdx = url.indexOf('#');
  const base = hashIdx === -1 ? url : url.slice(0, hashIdx);
  return `${base}#${SKIP_MARKER}`;
}

const viewer = new CadenceViewer();
viewer.init();
