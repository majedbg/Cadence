import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { decideAutoOpenRedirect, SKIP_MARKER } from './autoOpen';

beforeEach(() => {
  vi.stubGlobal('chrome', {
    runtime: {
      getURL: (path: string) => `chrome-extension://fakeid/${path.replace(/^\//, '')}`,
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('decideAutoOpenRedirect', () => {
  it('returns the viewer URL for a PDF when auto-open is on', () => {
    const out = decideAutoOpenRedirect('https://example.com/foo.pdf', { autoOpenPdfs: true });
    expect(out).toBe(
      `chrome-extension://fakeid/viewer/viewer.html?src=${encodeURIComponent('https://example.com/foo.pdf')}`,
    );
  });

  it('returns null when auto-open is off', () => {
    expect(decideAutoOpenRedirect('https://example.com/foo.pdf', { autoOpenPdfs: false })).toBe(null);
  });

  it('returns null for non-PDF URLs', () => {
    expect(decideAutoOpenRedirect('https://example.com/', { autoOpenPdfs: true })).toBe(null);
    expect(decideAutoOpenRedirect('https://example.com/index.html', { autoOpenPdfs: true })).toBe(null);
  });

  it('returns null for our own viewer URL (loop prevention)', () => {
    const viewer = 'chrome-extension://fakeid/viewer/viewer.html?src=https%3A%2F%2Fx.com%2Ff.pdf';
    expect(decideAutoOpenRedirect(viewer, { autoOpenPdfs: true })).toBe(null);
  });

  it(`returns null when the URL carries the ${SKIP_MARKER} marker (user chose default viewer)`, () => {
    expect(
      decideAutoOpenRedirect(`https://example.com/foo.pdf#${SKIP_MARKER}`, { autoOpenPdfs: true }),
    ).toBe(null);
  });

  it('returns null for undefined / chrome:// URLs', () => {
    expect(decideAutoOpenRedirect(undefined, { autoOpenPdfs: true })).toBe(null);
    expect(decideAutoOpenRedirect('chrome://extensions', { autoOpenPdfs: true })).toBe(null);
  });
});
