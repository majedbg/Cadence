import type { WordToken } from '../lib/types';
import type { RSVPTickState } from './rsvp';
import { RUNWAY_LENGTH } from '../lib/constants';
import { formatMultiplier } from './speed';

const STYLE_ID = 'cadence-reader-style';

const CSS = `
[data-cadence="overlay"] {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  background: rgba(20, 20, 22, 0.96);
  color: #f5f5f5;
  border-radius: 14px;
  padding: 18px 28px 14px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06);
  backdrop-filter: blur(8px);
  user-select: none;
  width: 480px;
  box-sizing: border-box;
  text-align: center;
  cursor: grab;
}
[data-cadence="overlay"].dragging { cursor: grabbing; }
[data-cadence="word"] {
  position: relative;
  font-size: 38px;
  line-height: 1.1;
  font-weight: 600;
  letter-spacing: -0.01em;
  height: 1.1em;
  overflow: hidden;
}
[data-cadence="word-slot"] {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 0;
  white-space: nowrap;
}
[data-cadence="word-text"] {
  display: inline-block;
  opacity: 0;
  transition: opacity var(--cadence-fade-ms, 60ms) ease;
  will-change: opacity;
}
[data-cadence="word"] .pivot { color: var(--cadence-accent, #FF6B00); }
[data-cadence="runway"] {
  margin-top: 10px;
  font-size: 13px;
  color: rgba(245,245,245,0.5);
  min-height: 1.2em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
[data-cadence="progress"] {
  position: relative;
  margin-top: 10px;
  height: 3px;
  background: rgba(255,255,255,0.08);
  border-radius: 2px;
  overflow: hidden;
}
[data-cadence="progress-segment"] {
  position: absolute;
  top: 0;
  height: 100%;
  background: var(--cadence-accent, #FF6B00);
  opacity: 0.5;
  width: 50%;
}
[data-cadence="progress-segment"][data-side="left"] { right: 50%; }
[data-cadence="progress-segment"][data-side="right"] { left: 50%; }
[data-cadence="speed"] {
  margin-top: 6px;
  font-size: 11px;
  color: rgba(245,245,245,0.45);
  text-align: center;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
[data-cadence="controls"] {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center;
  font-size: 11px;
  color: rgba(245,245,245,0.45);
}
[data-cadence="controls"] kbd {
  font-family: inherit;
  background: rgba(255,255,255,0.08);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
}
[data-cadence="close"] {
  position: absolute;
  top: 8px;
  right: 10px;
  background: none;
  border: none;
  color: rgba(245,245,245,0.45);
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
}
[data-cadence="close"]:hover { color: #fff; }
[data-cadence="done"] {
  margin-top: 12px;
  display: none;
  flex-direction: column;
  gap: 8px;
}
[data-cadence="overlay"].is-done [data-cadence="done"] { display: flex; }
[data-cadence="overlay"].is-done [data-cadence="word"] { opacity: 0.4; }
[data-cadence="done-label"] {
  font-size: 12px;
  color: rgba(245,245,245,0.65);
  text-align: center;
}
[data-cadence="done-buttons"] {
  display: flex;
  gap: 6px;
}
[data-cadence="done"] button {
  flex: 1;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.04);
  color: #f5f5f5;
  border-radius: 7px;
  padding: 7px 10px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
[data-cadence="done"] button:hover { background: rgba(255,255,255,0.1); }
[data-cadence="done"] button.primary {
  background: var(--cadence-accent, #FF6B00);
  border-color: var(--cadence-accent, #FF6B00);
  color: #fff;
}
[data-cadence="done"] button.primary:hover { filter: brightness(1.08); }
[data-cadence="done"] button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
`;

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/**
 * Find a vowel-anchored "optimal recognition point" for the word —
 * the letter where the reader's eye should fixate. Heuristic: roughly
 * 30% into the alphabetic portion of the word.
 */
function findPivotIndex(word: string): number {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 4) return 1;
  if (len <= 9) return 2;
  return Math.floor(len * 0.3);
}

export class Overlay {
  private el: HTMLDivElement;
  private wordEl: HTMLDivElement;
  private wordSlots: [HTMLDivElement, HTMLDivElement];
  private activeSlot: 0 | 1 = 0;
  private lastWordText: string | null = null;
  private runwayEl: HTMLDivElement;
  private progressLeftEl: HTMLDivElement;
  private progressRightEl: HTMLDivElement;
  private speedEl: HTMLDivElement;
  private tokens: WordToken[] = [];
  private doneEl: HTMLDivElement;
  private autoSelectBtn: HTMLButtonElement;
  private manualBtn: HTMLButtonElement;

  onClose: (() => void) | null = null;
  onAutoSelectNext: (() => void) | null = null;
  onManualSelectNext: (() => void) | null = null;

  constructor(accentColor: string) {
    ensureStyles();

    this.el = document.createElement('div');
    this.el.setAttribute('data-cadence', 'overlay');
    this.el.style.setProperty('--cadence-accent', accentColor);

    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('data-cadence', 'close');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.onClose?.());

    this.wordEl = document.createElement('div');
    this.wordEl.setAttribute('data-cadence', 'word');
    const slot0 = document.createElement('div');
    slot0.setAttribute('data-cadence', 'word-slot');
    const slot1 = document.createElement('div');
    slot1.setAttribute('data-cadence', 'word-slot');
    this.wordEl.append(slot0, slot1);
    this.wordSlots = [slot0, slot1];

    this.runwayEl = document.createElement('div');
    this.runwayEl.setAttribute('data-cadence', 'runway');

    const progress = document.createElement('div');
    progress.setAttribute('data-cadence', 'progress');
    this.progressLeftEl = document.createElement('div');
    this.progressLeftEl.setAttribute('data-cadence', 'progress-segment');
    this.progressLeftEl.setAttribute('data-side', 'left');
    this.progressRightEl = document.createElement('div');
    this.progressRightEl.setAttribute('data-cadence', 'progress-segment');
    this.progressRightEl.setAttribute('data-side', 'right');
    progress.append(this.progressLeftEl, this.progressRightEl);

    this.speedEl = document.createElement('div');
    this.speedEl.setAttribute('data-cadence', 'speed');
    this.speedEl.textContent = formatMultiplier(1.0);

    const controls = document.createElement('div');
    controls.setAttribute('data-cadence', 'controls');
    controls.innerHTML =
      '<kbd>Space</kbd> play/pause <kbd>←</kbd>/<kbd>→</kbd> step ' +
      '<kbd>Shift</kbd>+<kbd>&gt;</kbd>/<kbd>&lt;</kbd> speed <kbd>Esc</kbd> close';

    this.doneEl = document.createElement('div');
    this.doneEl.setAttribute('data-cadence', 'done');

    const doneLabel = document.createElement('div');
    doneLabel.setAttribute('data-cadence', 'done-label');
    doneLabel.textContent = 'End of selection';

    const doneButtons = document.createElement('div');
    doneButtons.setAttribute('data-cadence', 'done-buttons');

    this.autoSelectBtn = document.createElement('button');
    this.autoSelectBtn.className = 'primary';
    this.autoSelectBtn.textContent = 'Auto-select next';
    this.autoSelectBtn.addEventListener('click', () => this.onAutoSelectNext?.());

    this.manualBtn = document.createElement('button');
    this.manualBtn.textContent = 'Select manually';
    this.manualBtn.addEventListener('click', () => this.onManualSelectNext?.());

    doneButtons.append(this.autoSelectBtn, this.manualBtn);
    this.doneEl.append(doneLabel, doneButtons);

    this.el.append(
      closeBtn,
      this.wordEl,
      this.runwayEl,
      progress,
      this.speedEl,
      controls,
      this.doneEl,
    );
    document.documentElement.appendChild(this.el);

    this.attachDrag();
  }

  setDone(autoSelectAvailable: boolean): void {
    this.el.classList.add('is-done');
    this.autoSelectBtn.disabled = !autoSelectAvailable;
    if (!autoSelectAvailable) {
      this.autoSelectBtn.textContent = 'No next block found';
    } else {
      this.autoSelectBtn.textContent = 'Auto-select next';
    }
  }

  clearDone(): void {
    this.el.classList.remove('is-done');
  }

  setTokens(tokens: WordToken[]): void {
    this.tokens = tokens;
  }

  setAccentColor(color: string): void {
    this.el.style.setProperty('--cadence-accent', color);
  }

  update(state: RSVPTickState): void {
    const token = this.tokens[state.index];
    if (!token) {
      this.clearWord();
      this.runwayEl.textContent = '';
      this.setSegmentWidth(0);
      return;
    }
    this.renderWord(token.original);
    this.renderRunway(state.index);
    const progress =
      state.delayProgress !== null ? state.delayProgress : state.wordProgress;
    this.setSegmentWidth(progress);
  }

  setSpeedMultiplier(m: number): void {
    this.speedEl.textContent = formatMultiplier(m);
  }

  setWordFadeMs(ms: number): void {
    this.el.style.setProperty('--cadence-fade-ms', `${ms}ms`);
  }

  // Mirrored progress: both halves shrink inward as progress 0 → 1.
  // Each segment is half the track wide at p=0 (meeting in the middle, filling
  // the bar) and zero-width at p=1.
  private setSegmentWidth(progress: number): void {
    const clamped = Math.max(0, Math.min(1, progress));
    const widthPct = (1 - clamped) * 50;
    this.progressLeftEl.style.width = `${widthPct}%`;
    this.progressRightEl.style.width = `${widthPct}%`;
  }

  destroy(): void {
    this.el.remove();
  }

  private renderWord(word: string): void {
    // Skip when nothing changed — otherwise we'd retrigger the fade every tick.
    if (word === this.lastWordText) return;
    this.lastWordText = word;

    const incoming = this.activeSlot === 0 ? 1 : 0;
    const incomingEl = this.wordSlots[incoming];
    const outgoingEl = this.wordSlots[this.activeSlot];

    // Paint the incoming slot — opacity lives on the inner word-text span so
    // the transition tracks the word's intrinsic bounds, not the full-width slot.
    const incomingText = this.paintSlot(incomingEl, word);
    const outgoingText = outgoingEl.firstElementChild as HTMLSpanElement | null;
    // Force a reflow so the browser commits the text at opacity:0 BEFORE we
    // bump it to 1. Without this the change can be batched and the transition
    // is skipped. The `void` discards the read; it's there only for the side
    // effect on the layout engine.
    void incomingText.getBoundingClientRect();
    incomingText.style.opacity = '1';
    if (outgoingText) outgoingText.style.opacity = '0';
    this.activeSlot = incoming;
  }

  private paintSlot(slot: HTMLDivElement, word: string): HTMLSpanElement {
    const pivot = findPivotIndex(word);
    slot.innerHTML = '';
    const wrapper = document.createElement('span');
    wrapper.setAttribute('data-cadence', 'word-text');
    const before = document.createElement('span');
    before.textContent = word.slice(0, pivot);
    const pivotEl = document.createElement('span');
    pivotEl.className = 'pivot';
    pivotEl.textContent = word.slice(pivot, pivot + 1);
    const after = document.createElement('span');
    after.textContent = word.slice(pivot + 1);
    wrapper.append(before, pivotEl, after);
    slot.append(wrapper);
    return wrapper;
  }

  private clearWord(): void {
    this.wordSlots[0].innerHTML = '';
    this.wordSlots[1].innerHTML = '';
    this.lastWordText = null;
  }

  private renderRunway(index: number): void {
    const start = index + 1;
    const end = Math.min(start + RUNWAY_LENGTH, this.tokens.length);
    const words = this.tokens.slice(start, end).map((t) => t.original);
    this.runwayEl.textContent = words.join(' ');
  }

  private attachDrag(): void {
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;
    let dragging = false;

    const onDown = (e: MouseEvent) => {
      if ((e.target as Element).closest('[data-cadence="close"]')) return;
      dragging = true;
      this.el.classList.add('dragging');
      const rect = this.el.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      originLeft = rect.left;
      originTop = rect.top;
      // Pin transform so we can drive position via left/top.
      this.el.style.transform = 'none';
      this.el.style.left = `${rect.left}px`;
      this.el.style.top = `${rect.top}px`;
      e.preventDefault();
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      this.el.style.left = `${originLeft + (e.clientX - startX)}px`;
      this.el.style.top = `${originTop + (e.clientY - startY)}px`;
    };
    const onUp = () => {
      dragging = false;
      this.el.classList.remove('dragging');
    };

    this.el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }
}
