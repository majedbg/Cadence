import { describe, it, expect } from 'vitest';
import { popupMode } from './popupMode';

describe('popupMode', () => {
  it('returns "pdf" when the tab URL is a PDF', () => {
    expect(popupMode('https://example.com/foo.pdf')).toBe('pdf');
    expect(popupMode('https://arxiv.org/pdf/2401.12345')).toBe('pdf');
  });

  it('returns "unsupported" for browser-internal URLs', () => {
    expect(popupMode('chrome://extensions')).toBe('unsupported');
    expect(popupMode('chrome-extension://abc/popup.html')).toBe('unsupported');
  });

  it('returns "unsupported" when there is no URL', () => {
    expect(popupMode(undefined)).toBe('unsupported');
  });

  it('returns "normal" for ordinary web pages', () => {
    expect(popupMode('https://example.com/')).toBe('normal');
    expect(popupMode('https://en.wikipedia.org/wiki/Foo')).toBe('normal');
  });
});
