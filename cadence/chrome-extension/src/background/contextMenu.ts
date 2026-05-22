import { isPdfUrl } from '../lib/pdfDetection';
import { buildViewerUrl } from '../lib/viewerUrl';

export interface ContextClickInfo {
  linkUrl?: string;
  pageUrl?: string;
}

/**
 * Decide what URL the user "meant" when they right-clicked and chose
 * "Open in Cadence Reader". Prefer a link target if it's a PDF; otherwise
 * fall back to the page URL if it's a PDF; otherwise nothing.
 */
export function pickPdfTargetFromClick(info: ContextClickInfo): string | null {
  if (info.linkUrl && isPdfUrl(info.linkUrl)) return info.linkUrl;
  if (info.pageUrl && isPdfUrl(info.pageUrl)) return info.pageUrl;
  return null;
}

export const CONTEXT_MENU_ID = 'cadence-open-in-viewer';

export function registerContextMenu(): void {
  chrome.contextMenus.create(
    {
      id: CONTEXT_MENU_ID,
      title: 'Open in Cadence Reader',
      contexts: ['link', 'page'],
      // The menu item is created globally; we filter in the click handler.
      // (documentUrlPatterns / targetUrlPatterns don't support /pdf/ paths
      // without an extension, so we do the check in JS instead.)
    },
    () => {
      // Swallow "menu already exists" errors on re-install during dev.
      if (chrome.runtime.lastError) void chrome.runtime.lastError;
    },
  );

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID) return;
    const target = pickPdfTargetFromClick({
      linkUrl: info.linkUrl,
      pageUrl: info.pageUrl,
    });
    if (!target) return;
    const viewerUrl = buildViewerUrl(target);
    if (tab?.id && info.pageUrl === target) {
      await chrome.tabs.update(tab.id, { url: viewerUrl });
    } else {
      await chrome.tabs.create({ url: viewerUrl });
    }
  });
}
