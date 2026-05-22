/**
 * Heuristics for detecting whether a tab URL points at a PDF document,
 * and whether the URL is one our content script can run on at all.
 */

const PDF_EXTENSION_RE = /\.pdf($|\?|#)/i;
const PDF_PATH_RE = /\/pdf\/[A-Za-z0-9._-]+\/?($|\?|#)/i;
const BROWSER_INTERNAL_RE = /^(chrome|chrome-extension|edge|about|view-source):/i;

export function isPdfUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  if (PDF_EXTENSION_RE.test(url)) return true;
  if (PDF_PATH_RE.test(url)) return true;
  return false;
}

export interface UnsupportedCheck {
  unsupported: boolean;
  reason: string;
}

export function isUnsupportedUrl(url: string | undefined | null): UnsupportedCheck {
  if (!url) return { unsupported: true, reason: 'No active tab' };
  if (isPdfUrl(url)) return { unsupported: true, reason: 'Cannot run on PDF pages' };
  if (BROWSER_INTERNAL_RE.test(url)) {
    return { unsupported: true, reason: 'Cannot run on browser pages' };
  }
  return { unsupported: false, reason: '' };
}
