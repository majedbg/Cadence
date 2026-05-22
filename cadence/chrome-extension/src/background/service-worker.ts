/**
 * Bridges keyboard commands to the active tab's content script.
 * The popup talks to the content script directly via chrome.tabs.sendMessage,
 * so the service worker only handles the command shortcuts.
 */

import { isUnsupportedUrl } from '../lib/pdfDetection';
import { registerContextMenu } from './contextMenu';
import { registerAutoOpen } from './autoOpen';
import { DEFAULT_SETTINGS, STORAGE_KEY } from '../lib/constants';

chrome.runtime.onInstalled.addListener(() => {
  registerContextMenu();
});

registerAutoOpen(async () => {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const settings = { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEY] ?? {}) };
  return { autoOpenPdfs: settings.autoOpenPdfs };
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  if (isUnsupportedUrl(tab.url).unsupported) {
    chrome.action.setTitle({ tabId: tab.id, title: 'Cadence Reader — not available on this page' });
    return;
  }
  if (command === 'start-rsvp') {
    await safeSend(tab.id, { type: 'start' });
  } else if (command === 'toggle-pause') {
    await safeSend(tab.id, { type: 'toggle' });
  }
});

async function safeSend(tabId: number, message: unknown): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // Content script may not be loaded. Silently ignore.
  }
}
