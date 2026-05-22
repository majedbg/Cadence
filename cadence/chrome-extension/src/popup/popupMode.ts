import { isPdfUrl, isUnsupportedUrl } from '../lib/pdfDetection';

export type PopupMode = 'normal' | 'pdf' | 'unsupported';

/**
 * Decide which face the popup should present for a given tab URL.
 * - 'pdf'         → main action is "Open in Cadence Viewer"
 * - 'unsupported' → both actions disabled with an inline error
 * - 'normal'      → standard Start / Stop
 */
export function popupMode(url: string | undefined | null): PopupMode {
  if (isPdfUrl(url)) return 'pdf';
  if (isUnsupportedUrl(url).unsupported) return 'unsupported';
  return 'normal';
}
