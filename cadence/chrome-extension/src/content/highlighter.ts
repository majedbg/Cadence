import type { WordToken } from '../lib/types';

const FADE_MS = 100;

interface TrailEntry {
  token: WordToken;
  rects: HTMLDivElement[];
  fading: boolean;
  removalTimer: number | null;
}

/**
 * Renders a trail of colored rectangles over recently-read words. The current
 * word's rect is at full opacity; when the reader advances, that rect fades
 * to 0 over FADE_MS and is then removed. Like a FIFO queue with a reverb tail.
 *
 * Multi-line words get one rect per client rect. Positions are fixed via
 * viewport coords; we re-measure all live entries on scroll/resize.
 */
export class DOMHighlighter {
  private host: HTMLDivElement;
  private color: string;
  private opacity: number;
  private trail: TrailEntry[] = [];
  private resizeObserver: ResizeObserver | null = null;

  constructor(color: string, opacity: number) {
    this.color = color;
    this.opacity = opacity;
    this.host = document.createElement('div');
    this.host.setAttribute('data-cadence', 'highlighter');
    Object.assign(this.host.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '0',
      height: '0',
      pointerEvents: 'none',
      zIndex: '2147483646',
    });
    document.documentElement.appendChild(this.host);

    window.addEventListener('scroll', this.reposition, { passive: true, capture: true });
    window.addEventListener('resize', this.reposition);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.reposition);
      this.resizeObserver.observe(document.documentElement);
    }
  }

  setColor(color: string): void {
    this.color = color;
    for (const entry of this.trail) {
      for (const el of entry.rects) el.style.background = color;
    }
  }

  setOpacity(opacity: number): void {
    this.opacity = opacity;
    // Only the live (non-fading) head reflects the current opacity setting;
    // fading entries are already animating toward 0.
    for (const entry of this.trail) {
      if (entry.fading) continue;
      for (const el of entry.rects) el.style.opacity = String(opacity);
    }
  }

  highlight(token: WordToken): void {
    this.scrollIntoViewIfNeeded(token);
    // Demote any currently-live entries to the fading tail.
    for (const entry of this.trail) {
      if (!entry.fading) this.startFade(entry);
    }
    // Spawn fresh rects for the new head.
    const entry: TrailEntry = {
      token,
      rects: [],
      fading: false,
      removalTimer: null,
    };
    this.trail.push(entry);
    this.renderEntry(entry);
  }

  clear(): void {
    for (const entry of this.trail) {
      if (entry.removalTimer !== null) window.clearTimeout(entry.removalTimer);
      for (const el of entry.rects) el.remove();
    }
    this.trail = [];
  }

  destroy(): void {
    this.clear();
    window.removeEventListener('scroll', this.reposition, { capture: true });
    window.removeEventListener('resize', this.reposition);
    this.resizeObserver?.disconnect();
    this.host.remove();
  }

  private startFade(entry: TrailEntry): void {
    entry.fading = true;
    for (const el of entry.rects) el.style.opacity = '0';
    entry.removalTimer = window.setTimeout(() => {
      for (const el of entry.rects) el.remove();
      const idx = this.trail.indexOf(entry);
      if (idx >= 0) this.trail.splice(idx, 1);
    }, FADE_MS);
  }

  private reposition = (): void => {
    for (const entry of this.trail) this.renderEntry(entry);
  };

  private renderEntry(entry: TrailEntry): void {
    const rects = entry.token.range.getClientRects();
    // Grow pool if needed.
    while (entry.rects.length < rects.length) {
      entry.rects.push(this.spawnRect());
    }
    // Shrink pool if needed (rare — only if the range now produces fewer rects).
    while (entry.rects.length > rects.length) {
      const el = entry.rects.pop();
      el?.remove();
    }
    const targetOpacity = entry.fading ? '0' : String(this.opacity);
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      const el = entry.rects[i];
      el.style.transform = `translate(${r.left}px, ${r.top}px)`;
      el.style.width = `${r.width}px`;
      el.style.height = `${r.height}px`;
      el.style.background = this.color;
      el.style.opacity = targetOpacity;
    }
  }

  /**
   * Create a rect with transitions disabled so the first paint at full opacity
   * is instantaneous (no fade-in flicker on every word swap). We re-enable
   * the opacity transition after a forced reflow so subsequent opacity changes
   * (the fade-to-0 when the entry gets demoted) animate.
   */
  private spawnRect(): HTMLDivElement {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      borderRadius: '3px',
      transition: 'none',
      willChange: 'opacity',
      opacity: String(this.opacity),
    });
    this.host.appendChild(el);
    void el.getBoundingClientRect();
    el.style.transition = `opacity ${FADE_MS}ms ease`;
    return el;
  }

  private scrollIntoViewIfNeeded(token: WordToken): void {
    const rect = token.range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    const margin = 80;
    const above = rect.top < margin;
    const below = rect.bottom > window.innerHeight - margin;
    if (above || below) {
      const target = rect.top + window.scrollY - window.innerHeight / 2 + rect.height / 2;
      window.scrollTo({ top: target, behavior: 'smooth' });
    }
  }
}
