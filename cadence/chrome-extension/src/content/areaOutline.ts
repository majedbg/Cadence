/**
 * Draws a single SVG polygon that wraps the full selected reading area.
 * Multi-line selections naturally form a staircase shape — we compute it
 * by walking down the right edges of each line rect, then back up the left.
 * Repositions on scroll/resize like the highlighter does.
 */

const NS = 'http://www.w3.org/2000/svg';

export class AreaOutline {
  private svg: SVGSVGElement;
  private polygon: SVGPolygonElement;
  private range: Range | null = null;
  private color = '#FF6B00';
  private opacity = 0.12;

  constructor(color: string, opacity: number) {
    this.color = color;
    this.opacity = opacity;

    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('data-cadence', 'area-outline');
    Object.assign(this.svg.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: '2147483645', // below the word-highlighter (2147483646) and overlay
      overflow: 'visible',
    });

    this.polygon = document.createElementNS(NS, 'polygon');
    this.polygon.setAttribute('fill', this.color);
    this.polygon.setAttribute('fill-opacity', String(this.opacity));
    this.polygon.setAttribute('stroke', this.color);
    this.polygon.setAttribute('stroke-opacity', '0.5');
    this.polygon.setAttribute('stroke-width', '1');
    this.polygon.setAttribute('stroke-linejoin', 'round');
    this.polygon.style.transition = 'fill-opacity 200ms ease';

    this.svg.appendChild(this.polygon);
    document.documentElement.appendChild(this.svg);

    window.addEventListener('scroll', this.reposition, { passive: true, capture: true });
    window.addEventListener('resize', this.reposition);
  }

  setRange(range: Range): void {
    this.range = range;
    this.render();
  }

  setColor(color: string): void {
    this.color = color;
    this.polygon.setAttribute('fill', color);
    this.polygon.setAttribute('stroke', color);
  }

  setOpacity(opacity: number): void {
    // The outline sits behind the per-word rect, so make it ~half as visible.
    this.opacity = opacity * 0.5;
    this.polygon.setAttribute('fill-opacity', String(this.opacity));
  }

  destroy(): void {
    window.removeEventListener('scroll', this.reposition, { capture: true });
    window.removeEventListener('resize', this.reposition);
    this.svg.remove();
  }

  private reposition = (): void => {
    this.render();
  };

  private render(): void {
    if (!this.range) {
      this.polygon.setAttribute('points', '');
      return;
    }
    const lines = this.collectLineRects(this.range);
    if (lines.length === 0) {
      this.polygon.setAttribute('points', '');
      return;
    }
    this.polygon.setAttribute('points', buildStaircasePoints(lines));
  }

  /**
   * getClientRects() returns one rect per line for an inline-spanning range,
   * but sometimes returns thin sub-pixel duplicates. Coalesce by top/bottom.
   */
  private collectLineRects(range: Range): DOMRect[] {
    const raw = Array.from(range.getClientRects()).filter(
      (r) => r.width > 0 && r.height > 0,
    );
    if (raw.length === 0) return [];
    // Group by line (rects sharing approximately the same top).
    raw.sort((a, b) => a.top - b.top);
    const lines: DOMRect[] = [];
    const tolerance = 2;
    for (const r of raw) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(r.top - last.top) < tolerance) {
        // Same line — extend horizontally.
        const left = Math.min(last.left, r.left);
        const right = Math.max(last.right, r.right);
        const top = Math.min(last.top, r.top);
        const bottom = Math.max(last.bottom, r.bottom);
        lines[lines.length - 1] = new DOMRect(left, top, right - left, bottom - top);
      } else {
        lines.push(r);
      }
    }
    return lines;
  }
}

/**
 * Build a polygon points string for a staircase that hugs the selection:
 *   walk right edge top→bottom across all lines, then walk left edge bottom→top.
 * Padding gives the outline a little breathing room.
 */
function buildStaircasePoints(lines: DOMRect[], pad = 3): string {
  const right: Array<[number, number]> = [];
  const left: Array<[number, number]> = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    right.push([l.right + pad, l.top - pad]);
    right.push([l.right + pad, l.bottom + pad]);
    // Connector to next line's right edge: drop in horizontally at this line's bottom.
    if (i < lines.length - 1) {
      const next = lines[i + 1];
      right.push([next.right + pad, l.bottom + pad]);
    }
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    left.push([l.left - pad, l.bottom + pad]);
    left.push([l.left - pad, l.top - pad]);
    if (i > 0) {
      const prev = lines[i - 1];
      left.push([prev.left - pad, l.top - pad]);
    }
  }

  return [...right, ...left].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}
