import type { WordToken, RSVPStatus, DelaySettings } from '../lib/types';
import { PUNCTUATION_DELAYS } from '../lib/constants';
import { computeDelayMs, computeWordDurations } from '../lib/textUtils';

interface RSVPEngineEvents {
  onTick: (state: RSVPTickState) => void;
  onStatusChange: (status: RSVPStatus) => void;
  onDone: () => void;
}

export interface RSVPTickState {
  index: number;
  status: RSVPStatus;
  wordProgress: number;     // 0..1 — progress through current word
  delayProgress: number | null; // 0..1 if we're holding on punctuation, else null
  currentWordDuration: number;
}

/**
 * Pure timer-driven RSVP engine — the Cadence hook with the speech-verification
 * layer removed. Per-word durations weighted by syllable count, punctuation
 * delays applied between words. Drives a rAF loop while playing.
 */
export class RSVPEngine {
  private tokens: WordToken[] = [];
  private wordDurations: number[] = [];
  private delaySettings: DelaySettings = PUNCTUATION_DELAYS;
  private wpm: number;

  private status: RSVPStatus = 'idle';
  private index = 0;
  private accumulator = 0;
  private delayRemaining = 0;
  private delayTotal = 0;
  private lastTick = 0;
  private rafId = 0;

  private readonly events: RSVPEngineEvents;

  constructor(wpm: number, events: RSVPEngineEvents) {
    this.wpm = wpm;
    this.events = events;
  }

  load(tokens: WordToken[]): void {
    this.tokens = tokens;
    this.wordDurations = computeWordDurations(tokens, this.wpm);
    this.index = 0;
    this.accumulator = 0;
    this.delayRemaining = 0;
    this.delayTotal = 0;
    this.setStatus('idle');
    this.emitTick();
  }

  setWPM(wpm: number): void {
    this.wpm = wpm;
    this.wordDurations = computeWordDurations(this.tokens, wpm);
    this.emitTick();
  }

  play(): void {
    if (this.tokens.length === 0) return;
    if (this.status === 'done') {
      this.index = 0;
      this.accumulator = 0;
      this.delayRemaining = 0;
    }
    this.setStatus('playing');
    this.lastTick = performance.now();
    this.loop();
  }

  pause(): void {
    if (this.status !== 'playing') return;
    this.setStatus('paused');
    cancelAnimationFrame(this.rafId);
  }

  toggle(): void {
    if (this.status === 'playing') this.pause();
    else this.play();
  }

  step(delta: number): void {
    const target = Math.max(0, Math.min(this.tokens.length - 1, this.index + delta));
    this.index = target;
    this.accumulator = 0;
    this.delayRemaining = 0;
    this.emitTick();
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
    this.setStatus('idle');
    this.index = 0;
    this.accumulator = 0;
    this.delayRemaining = 0;
  }

  getStatus(): RSVPStatus {
    return this.status;
  }

  getIndex(): number {
    return this.index;
  }

  private setStatus(s: RSVPStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.events.onStatusChange(s);
  }

  private loop = (): void => {
    if (this.status !== 'playing') return;
    const now = performance.now();
    const msPerWord = 60_000 / this.wpm;
    const delta = Math.min(now - this.lastTick, msPerWord * 2); // clamp on tab blur
    this.lastTick = now;

    if (this.delayRemaining > 0) {
      this.delayRemaining -= delta;
      if (this.delayRemaining <= 0) {
        this.delayRemaining = 0;
        this.delayTotal = 0;
      }
      this.emitTick();
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }

    this.accumulator += delta;
    const currentDuration = this.wordDurations[this.index] ?? msPerWord;

    if (this.accumulator >= currentDuration) {
      this.accumulator -= currentDuration;
      const prevToken = this.tokens[this.index];
      const punctDelay = prevToken ? computeDelayMs(prevToken, this.delaySettings) : 0;
      const next = this.index + 1;

      if (next >= this.tokens.length) {
        this.index = this.tokens.length - 1;
        this.setStatus('done');
        this.events.onDone();
        this.emitTick();
        return;
      }

      this.index = next;
      if (punctDelay > 0) {
        this.delayRemaining = punctDelay;
        this.delayTotal = punctDelay;
      }
    }

    this.emitTick();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private emitTick(): void {
    const dur = this.wordDurations[this.index] ?? 60_000 / this.wpm;
    this.events.onTick({
      index: this.index,
      status: this.status,
      wordProgress: dur > 0 ? Math.min(1, this.accumulator / dur) : 0,
      delayProgress:
        this.delayTotal > 0
          ? Math.min(1, 1 - this.delayRemaining / this.delayTotal)
          : null,
      currentWordDuration: dur,
    });
  }
}
