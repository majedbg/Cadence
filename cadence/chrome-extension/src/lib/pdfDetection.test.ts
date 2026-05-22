import { describe, it, expect } from 'vitest';
import { isPdfUrl, isUnsupportedUrl } from './pdfDetection';

describe('isPdfUrl', () => {
  it('matches plain .pdf URLs', () => {
    expect(isPdfUrl('https://example.com/foo.pdf')).toBe(true);
    expect(isPdfUrl('https://example.com/papers/foo.PDF')).toBe(true);
  });

  it('matches .pdf URLs with query strings and fragments', () => {
    expect(isPdfUrl('https://example.com/foo.pdf?x=1')).toBe(true);
    expect(isPdfUrl('https://example.com/foo.pdf#page=3')).toBe(true);
  });

  it('matches arxiv-style /pdf/<id> paths even without extension', () => {
    expect(isPdfUrl('https://arxiv.org/pdf/2401.12345')).toBe(true);
    expect(isPdfUrl('https://arxiv.org/pdf/2401.12345v2')).toBe(true);
  });

  it('returns false for ordinary html pages', () => {
    expect(isPdfUrl('https://example.com/')).toBe(false);
    expect(isPdfUrl('https://example.com/article.html')).toBe(false);
    expect(isPdfUrl('https://example.com/blog/my-pdf-guide')).toBe(false);
  });

  it('returns false for undefined or empty input', () => {
    expect(isPdfUrl(undefined)).toBe(false);
    expect(isPdfUrl('')).toBe(false);
  });
});

describe('isUnsupportedUrl', () => {
  it('flags PDFs as unsupported with a clear reason', () => {
    const r = isUnsupportedUrl('https://example.com/foo.pdf');
    expect(r.unsupported).toBe(true);
    expect(r.reason).toMatch(/pdf/i);
  });

  it('flags browser-internal pages', () => {
    expect(isUnsupportedUrl('chrome://extensions').unsupported).toBe(true);
    expect(isUnsupportedUrl('chrome-extension://abc/popup.html').unsupported).toBe(true);
    expect(isUnsupportedUrl('about:blank').unsupported).toBe(true);
    expect(isUnsupportedUrl('view-source:https://foo.com').unsupported).toBe(true);
  });

  it('allows ordinary http(s) pages', () => {
    expect(isUnsupportedUrl('https://example.com/').unsupported).toBe(false);
    expect(isUnsupportedUrl('http://localhost:3000/').unsupported).toBe(false);
  });

  it('handles undefined as unsupported', () => {
    expect(isUnsupportedUrl(undefined).unsupported).toBe(true);
  });
});
