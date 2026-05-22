import { RSVPEngine, type RSVPTickState } from './rsvp';
import { DOMHighlighter } from './highlighter';
import { AreaOutline } from './areaOutline';
import { Overlay } from './overlay';
import { tokeniseSelection, getActiveSelectionRange } from './selection';
import { findNextSection } from './nextSection';
import { DEFAULT_SETTINGS, STORAGE_KEY } from '../lib/constants';
import type { ReaderSettings, WordToken } from '../lib/types';

interface ExtensionMessage {
  type: 'start' | 'stop' | 'toggle' | 'updateSettings';
  settings?: ReaderSettings;
}

class CadenceReader {
  private engine: RSVPEngine | null = null;
  private overlay: Overlay | null = null;
  private highlighter: DOMHighlighter | null = null;
  private areaOutline: AreaOutline | null = null;
  private tokens: WordToken[] = [];
  private currentRange: Range | null = null;
  private settings: ReaderSettings = DEFAULT_SETTINGS;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private lastIndex = -1;

  async init(): Promise<void> {
    // Defensive PDF check: if the content script somehow ran on a PDF document,
    // refuse and tell the user. (Chrome's PDF viewer normally blocks injection.)
    if (document.contentType === 'application/pdf') return;

    const stored = await chrome.storage.local.get(STORAGE_KEY);
    if (stored[STORAGE_KEY]) {
      this.settings = { ...DEFAULT_SETTINGS, ...stored[STORAGE_KEY] };
    }
    chrome.storage.onChanged.addListener((changes) => {
      if (changes[STORAGE_KEY]) {
        this.applySettings(changes[STORAGE_KEY].newValue ?? DEFAULT_SETTINGS);
      }
    });
    chrome.runtime.onMessage.addListener((msg: ExtensionMessage, _sender, sendResponse) => {
      this.handleMessage(msg);
      sendResponse({ ok: true });
      return true;
    });
  }

  private handleMessage(msg: ExtensionMessage): void {
    switch (msg.type) {
      case 'start':
        this.startFromSelection();
        break;
      case 'stop':
        this.stop();
        break;
      case 'toggle':
        if (this.engine) this.engine.toggle();
        else this.startFromSelection();
        break;
      case 'updateSettings':
        if (msg.settings) this.applySettings(msg.settings);
        break;
    }
  }

  private applySettings(next: ReaderSettings): void {
    this.settings = { ...DEFAULT_SETTINGS, ...next };
    if (this.engine) this.engine.setWPM(this.settings.wpm);
    if (this.highlighter) {
      this.highlighter.setColor(this.settings.highlightColor);
      this.highlighter.setOpacity(this.settings.highlightOpacity);
    }
    if (this.areaOutline) {
      this.areaOutline.setColor(this.settings.highlightColor);
      this.areaOutline.setOpacity(this.settings.highlightOpacity);
    }
    if (this.overlay) this.overlay.setAccentColor(this.settings.highlightColor);
  }

  private startFromSelection(): void {
    const range = getActiveSelectionRange();
    if (!range) {
      this.flash('Select text on the page first');
      return;
    }
    this.startWithRange(range);
  }

  private startWithRange(range: Range): void {
    const tokens = tokeniseSelection(range);
    if (tokens.length === 0) {
      this.flash('No words in selection');
      return;
    }

    // Clean any prior session (engine, overlays, key handlers) but keep popup
    // settings in sync.
    this.cleanup();

    this.currentRange = range;
    this.tokens = tokens;
    this.lastIndex = -1;

    this.overlay = new Overlay(this.settings.highlightColor);
    this.overlay.setTokens(tokens);
    this.overlay.onClose = () => this.stop();
    this.overlay.onAutoSelectNext = () => this.autoSelectNext();
    this.overlay.onManualSelectNext = () => this.manualSelectPrompt();

    this.highlighter = new DOMHighlighter(
      this.settings.highlightColor,
      this.settings.highlightOpacity,
    );
    this.areaOutline = new AreaOutline(
      this.settings.highlightColor,
      this.settings.highlightOpacity,
    );
    this.areaOutline.setRange(range);

    this.engine = new RSVPEngine(this.settings.wpm, {
      onTick: (state) => this.onTick(state),
      onStatusChange: () => {},
      onDone: () => this.onDone(),
    });
    this.engine.load(tokens);

    this.attachKeys();
    window.getSelection()?.removeAllRanges();
    this.engine.play();
  }

  private stop(): void {
    this.cleanup();
  }

  private cleanup(): void {
    this.engine?.stop();
    this.overlay?.destroy();
    this.highlighter?.destroy();
    this.areaOutline?.destroy();
    this.detachKeys();
    this.engine = null;
    this.overlay = null;
    this.highlighter = null;
    this.areaOutline = null;
    this.tokens = [];
    this.currentRange = null;
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
    if (!this.overlay || !this.currentRange) return;
    const next = findNextSection(this.currentRange);
    this.overlay.setDone(next !== null);
  }

  private autoSelectNext(): void {
    if (!this.currentRange) return;
    const next = findNextSection(this.currentRange);
    if (!next) {
      this.flash('No next block of text found');
      return;
    }
    this.startWithRange(next);
  }

  private manualSelectPrompt(): void {
    this.cleanup();
    this.flash('Select the next text on the page, then press the keyboard shortcut');
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
      } else if (e.key === 'Escape') {
        this.stop();
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
    Object.assign(el.style, {
      position: 'fixed',
      top: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(20,20,22,0.96)',
      color: '#f5f5f5',
      padding: '10px 18px',
      borderRadius: '10px',
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      fontSize: '13px',
      zIndex: '2147483647',
      boxShadow: '0 6px 24px rgba(0,0,0,0.3)',
    });
    el.textContent = message;
    document.documentElement.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }
}

const reader = new CadenceReader();
reader.init();
