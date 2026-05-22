import { isPdfUrl } from '../lib/pdfDetection';
import { buildViewerUrl } from '../lib/viewerUrl';

/** Marker the viewer's "back to default viewer" link appends so we don't
 *  redirect the user right back into the Cadence viewer. */
export const SKIP_MARKER = 'cadence-skip';

export interface AutoOpenSettings {
  autoOpenPdfs: boolean;
}

/**
 * Pure decision function. Given a tab URL and settings, return the URL we
 * should redirect the tab to, or null if no redirect should happen.
 */
export function decideAutoOpenRedirect(
  url: string | undefined | null,
  settings: AutoOpenSettings,
): string | null {
  if (!settings.autoOpenPdfs) return null;
  if (!url) return null;
  if (url.startsWith('chrome-extension://')) return null; // already in our viewer
  if (url.includes(SKIP_MARKER)) return null;             // user opted out for this load
  if (!isPdfUrl(url)) return null;
  return buildViewerUrl(url);
}

/**
 * Subscribe to tab URL changes and redirect PDFs into the Cadence viewer
 * when the setting is enabled. The settings getter is injected so the
 * background can re-read storage on each event without holding stale state.
 */
export function registerAutoOpen(getSettings: () => Promise<AutoOpenSettings>): void {
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    // Only act when the URL actually changes — not on every loading-status tick.
    if (!changeInfo.url) return;
    const settings = await getSettings();
    const next = decideAutoOpenRedirect(changeInfo.url, settings);
    if (!next) return;
    try {
      await chrome.tabs.update(tabId, { url: next });
    } catch {
      // Tab may have been closed mid-flight; ignore.
    }
  });
}
