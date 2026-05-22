import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildViewerUrl, getSourceFromViewerUrl } from './viewerUrl';

beforeEach(() => {
  // Stub chrome.runtime.getURL so tests can run outside a real extension.
  vi.stubGlobal('chrome', {
    runtime: {
      getURL: (path: string) => `chrome-extension://fakeid/${path.replace(/^\//, '')}`,
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildViewerUrl', () => {
  it('points at viewer/viewer.html with an encoded src query', () => {
    const url = buildViewerUrl('https://example.com/paper.pdf');
    expect(url).toMatch(/^chrome-extension:\/\/fakeid\/viewer\/viewer\.html\?src=/);
    expect(url).toContain(encodeURIComponent('https://example.com/paper.pdf'));
  });

  it('handles URLs with query strings and fragments', () => {
    const original = 'https://example.com/foo.pdf?a=1&b=2#page=3';
    const url = buildViewerUrl(original);
    expect(getSourceFromViewerUrl(url)).toBe(original);
  });
});

describe('getSourceFromViewerUrl', () => {
  it('round-trips with buildViewerUrl', () => {
    const original = 'https://arxiv.org/pdf/2401.12345v2';
    expect(getSourceFromViewerUrl(buildViewerUrl(original))).toBe(original);
  });

  it('returns null when no src query is present', () => {
    expect(getSourceFromViewerUrl('chrome-extension://fakeid/viewer/viewer.html')).toBe(null);
  });
});
