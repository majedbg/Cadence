import type { WordToken } from '../lib/types';

/**
 * Renders a low-opacity colored rectangle over the active word in the page.
 * Multi-line words (rare) and words that wrap get one rect per client rect.
 * Position is fixed via viewport coords; we re-measure on every word change
 * and on scroll/resize.
 */
export class DOMHighlighter {
  private host: HTMLDivElement;
  private color: string;
  private opacity: number;
  private currentToken: WordToken | null = null;
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
    this.render();
  }

  setOpacity(opacity: number): void {
    this.opacity = opacity;
    this.render();
  }

  highlight(token: WordToken): void {
    this.currentToken = token;
    this.scrollIntoViewIfNeeded(token);
    this.render();
  }

  clear(): void {
    this.currentToken = null;
    this.host.innerHTML = '';
  }

  destroy(): void {
    window.removeEventListener('scroll', this.reposition, { capture: true });
    window.removeEventListener('resize', this.reposition);
    this.resizeObserver?.disconnect();
    this.host.remove();
  }

  private reposition = (): void => {
    this.render();
  };

  private render(): void {
    if (!this.currentToken) {
      this.host.innerHTML = '';
      return;
    }
    const rects = this.currentToken.range.getClientRects();
    const existing = Array.from(this.host.children) as HTMLDivElement[];
    // Reuse existing children where possible, create more if needed.
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      const el = existing[i] ?? this.createRect();
      Object.assign(el.style, {
        transform: `translate(${r.left}px, ${r.top}px)`,
        width: `${r.width}px`,
        height: `${r.height}px`,
        background: this.color,
        opacity: String(this.opacity),
      });
    }
    // Remove leftover rects.
    for (let i = rects.length; i < existing.length; i++) {
      existing[i].remove();
    }
  }

  private createRect(): HTMLDivElement {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      borderRadius: '3px',
      transition: 'transform 80ms ease, width 80ms ease, height 80ms ease',
      willChange: 'transform',
    });
    this.host.appendChild(el);
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
