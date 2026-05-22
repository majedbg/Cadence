import { DEFAULT_SETTINGS, STORAGE_KEY } from '../lib/constants';
import { isUnsupportedUrl } from '../lib/pdfDetection';
import { buildViewerUrl } from '../lib/viewerUrl';
import { popupMode } from './popupMode';
import type { ReaderSettings } from '../lib/types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const wpm = $<HTMLInputElement>('wpm');
const wpmOut = $<HTMLOutputElement>('wpmOut');
const color = $<HTMLInputElement>('color');
const opacity = $<HTMLInputElement>('opacity');
const opacityOut = $<HTMLOutputElement>('opacityOut');
const startBtn = $<HTMLButtonElement>('start');
const stopBtn = $<HTMLButtonElement>('stop');
const openInViewerBtn = $<HTMLButtonElement>('openInViewer');
const normalActions = $<HTMLElement>('normalActions');
const pdfActions = $<HTMLElement>('pdfActions');
const autoOpenPdfs = $<HTMLInputElement>('autoOpenPdfs');

async function getSettings(): Promise<ReaderSettings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEY] ?? {}) };
}

async function saveSettings(next: ReaderSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
}

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function showError(message: string): void {
  let el = document.getElementById('popup-error');
  if (!el) {
    el = document.createElement('div');
    el.id = 'popup-error';
    Object.assign(el.style, {
      marginTop: '10px',
      padding: '8px 10px',
      background: 'rgba(255, 107, 0, 0.12)',
      border: '1px solid rgba(255, 107, 0, 0.4)',
      borderRadius: '7px',
      fontSize: '12px',
      color: '#FFB37A',
    });
    document.querySelector('.actions')?.after(el);
  }
  el.textContent = message;
}

function clearError(): void {
  document.getElementById('popup-error')?.remove();
}

async function sendToTab(message: unknown): Promise<boolean> {
  const tab = await activeTab();
  if (!tab?.id) return false;
  try {
    await chrome.tabs.sendMessage(tab.id, message);
    return true;
  } catch {
    return false;
  }
}

function render(s: ReaderSettings): void {
  wpm.value = String(s.wpm);
  wpmOut.value = String(s.wpm);
  color.value = s.highlightColor;
  opacity.value = String(s.highlightOpacity);
  opacityOut.value = s.highlightOpacity.toFixed(2);
  autoOpenPdfs.checked = s.autoOpenPdfs;
}

async function pushChange(): Promise<void> {
  const next: ReaderSettings = {
    wpm: Number(wpm.value),
    highlightColor: color.value,
    highlightOpacity: Number(opacity.value),
    showRunway: true,
    autoOpenPdfs: autoOpenPdfs.checked,
  };
  wpmOut.value = String(next.wpm);
  opacityOut.value = next.highlightOpacity.toFixed(2);
  await saveSettings(next);
  await sendToTab({ type: 'updateSettings', settings: next });
}

(async () => {
  const s = await getSettings();
  render(s);

  wpm.addEventListener('input', pushChange);
  color.addEventListener('input', pushChange);
  opacity.addEventListener('input', pushChange);
  autoOpenPdfs.addEventListener('change', pushChange);

  const tab = await activeTab();
  const mode = popupMode(tab?.url);

  if (mode === 'pdf') {
    normalActions.hidden = true;
    pdfActions.hidden = false;
  } else if (mode === 'unsupported') {
    showError(isUnsupportedUrl(tab?.url).reason);
    startBtn.disabled = true;
    stopBtn.disabled = true;
  }

  startBtn.addEventListener('click', async () => {
    clearError();
    const ok = await sendToTab({ type: 'start' });
    if (!ok) {
      showError('Could not reach this page (PDF or restricted)');
      return;
    }
    window.close();
  });
  stopBtn.addEventListener('click', async () => {
    await sendToTab({ type: 'stop' });
    window.close();
  });
  openInViewerBtn.addEventListener('click', async () => {
    if (!tab?.id || !tab.url) return;
    const url = buildViewerUrl(tab.url);
    await chrome.tabs.update(tab.id, { url });
    window.close();
  });
})();
