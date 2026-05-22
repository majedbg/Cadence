/**
 * Helpers for the URL that loads our PDF.js-based viewer page.
 * Layout: chrome-extension://<id>/viewer/viewer.html?src=<encoded original URL>
 */

const VIEWER_PATH = 'viewer/viewer.html';

export function buildViewerUrl(pdfSource: string): string {
  const base = chrome.runtime.getURL(VIEWER_PATH);
  return `${base}?src=${encodeURIComponent(pdfSource)}`;
}

export function getSourceFromViewerUrl(viewerUrl: string): string | null {
  const queryIdx = viewerUrl.indexOf('?');
  if (queryIdx === -1) return null;
  const params = new URLSearchParams(viewerUrl.slice(queryIdx + 1));
  const src = params.get('src');
  return src;
}
