import { describe, it, expect } from 'vitest';
import {
  clampMultiplier,
  stepMultiplier,
  formatMultiplier,
  MIN_MULTIPLIER,
  MAX_MULTIPLIER,
} from './speed';

describe('clampMultiplier', () => {
  it('rounds to 1 decimal place', () => {
    expect(clampMultiplier(1.23)).toBe(1.2);
    expect(clampMultiplier(1.26)).toBe(1.3);
  });

  it('clamps above the maximum', () => {
    expect(clampMultiplier(4.0)).toBe(3.5);
    expect(clampMultiplier(100)).toBe(3.5);
  });

  it('clamps below the minimum', () => {
    expect(clampMultiplier(0.1)).toBe(0.5);
    expect(clampMultiplier(-1)).toBe(0.5);
  });

  it('falls back to 1.0 for non-finite input', () => {
    expect(clampMultiplier(NaN)).toBe(1.0);
    expect(clampMultiplier(Infinity)).toBe(1.0);
  });

  it('passes through valid values unchanged', () => {
    expect(clampMultiplier(1.0)).toBe(1.0);
    expect(clampMultiplier(MIN_MULTIPLIER)).toBe(MIN_MULTIPLIER);
    expect(clampMultiplier(MAX_MULTIPLIER)).toBe(MAX_MULTIPLIER);
  });
});

describe('stepMultiplier', () => {
  it('steps up by 0.1', () => {
    expect(stepMultiplier(1.0, 1)).toBe(1.1);
  });

  it('steps down by 0.1', () => {
    expect(stepMultiplier(1.0, -1)).toBe(0.9);
  });

  it('clamps at the top', () => {
    expect(stepMultiplier(3.5, 1)).toBe(3.5);
  });

  it('clamps at the bottom', () => {
    expect(stepMultiplier(0.5, -1)).toBe(0.5);
  });

  it('survives float dust on the input', () => {
    expect(stepMultiplier(1.0000001, 1)).toBe(1.1);
    expect(stepMultiplier(1.2999999, 1)).toBe(1.4);
  });
});

describe('formatMultiplier', () => {
  it('always shows one decimal and a multiplication sign', () => {
    expect(formatMultiplier(1.0)).toBe('1.0×');
    expect(formatMultiplier(0.9)).toBe('0.9×');
    expect(formatMultiplier(2.3)).toBe('2.3×');
  });
});
