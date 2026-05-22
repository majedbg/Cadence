# Cadence Reader — Chrome Extension

An RSVP (Rapid Serial Visual Presentation) reader for any webpage, extracted
from the main Cadence project.

Highlight text on a page, hit start, and the extension:
1. Tokenises the selection into words with per-word display durations
   (syllable-weighted) and punctuation pauses, just like the main Cadence app.
2. Displays one word at a time in a draggable floating overlay.
3. Subtly highlights the live word in the page DOM with a low-opacity colored
   rectangle (orange `#FF6B00` by default, configurable).
4. Wraps the **whole selected reading area** in a soft SVG polygon outline —
   a staircase hull that follows line breaks — so you can see where you are
   in the larger passage.
5. When the engine reaches the last word, offers **Auto-select next** —
   a heuristic that walks the DOM forward to the next paragraph / list item
   / heading and starts a new session on it.

The speech-to-text verification layer from the main app is **removed** here —
this extension is timer-only. No microphone, no Deepgram, no permissions
beyond `activeTab` and `storage`.

## What was reused from the main app

The Cadence app (`../`) has a `useRSVP` React hook that combines two systems:
a timer-driven rAF loop (primary word advancement) and a Deepgram sync layer
(speech verification). Only the timer side is needed here, so I extracted:

- **`lib/textUtils.ts`** — `estimateSyllables`, `extractPunctuation`,
  `computeDelayMs`, and a new `computeWordDurations` helper that does the same
  syllable-weighted budget redistribution as `useRSVP.wordDurations`.
- **`lib/constants.ts`** — `PUNCTUATION_DELAYS` (with the same character map
  and `MAX_PUNCTUATION_DELAY` cap).
- **`content/rsvp.ts`** — the rAF loop, punctuation-pause phase, and per-word
  advancement logic from `useRSVP`, repackaged as a plain `RSVPEngine` class
  (no React, no Deepgram refs). Methods: `load`, `play`, `pause`, `toggle`,
  `step`, `stop`, `setWPM`.

New for the extension:

- **`content/selection.ts`** — walks the user's `Selection` Range with a
  `TreeWalker`, splits each text node into whitespace-delimited words, and
  creates a sub-`Range` per word. Those Ranges are the source of truth for
  re-measuring positions on scroll/resize.
- **`content/highlighter.ts`** — fixed-position rectangle host that calls
  `Range.getClientRects()` on the active word and positions one rect per line
  (handles word wrap). Repositions on scroll, resize, and any ResizeObserver
  tick.
- **`content/areaOutline.ts`** — single SVG `<polygon>` that hugs the entire
  selected passage. Walks down the right edges of each line rect then back up
  the left edges to produce a "staircase" hull (a true polygon, not a stack
  of rectangles). Same scroll/resize re-render strategy.
- **`content/nextSection.ts`** — DOM heuristic for auto-advance. Finds the
  nearest block ancestor of the current selection (`p`/`li`/`h*`/`blockquote`/
  etc.), then walks forward via `TreeWalker`, skipping `nav`/`footer`/`aside`
  and short text, until it finds the next readable block.
- **`content/overlay.ts`** — the floating word panel: pivot-letter highlight,
  runway preview, progress bar, drag-to-move, keyboard hints. Pure DOM, no
  React.
- **`content/main.ts`** — wiring: messages from popup/commands, settings
  storage, lifecycle.

## Install (developer mode)

```bash
cd chrome-extension
npm install
npm run build
```

Then in Chrome:

1. Visit `chrome://extensions`.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select the `chrome-extension/dist` folder.
4. The orange icon should appear in your toolbar.

## Use

1. Select text anywhere on a page.
2. Click the extension icon → **Start**, or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>.
3. The floating overlay shows the current word; an orange rectangle marks it
   in the DOM.

### In-page keyboard

| Key | Action |
|---|---|
| <kbd>Space</kbd> | Play / pause |
| <kbd>←</kbd> / <kbd>→</kbd> | Step one word |
| <kbd>Esc</kbd> | Stop and hide overlay |

### Settings (popup)

- **Speed** — 100–700 WPM
- **Highlight color** — color picker (default `#FF6B00`)
- **Opacity** — 0.05–0.6 for the DOM rectangle

Settings persist via `chrome.storage.local` and apply live during a session.

## Architecture

```
chrome-extension/
├── manifest.json              MV3 manifest, content script + popup + service worker
├── esbuild.config.mjs         Bundles each entry to dist/ and copies static assets
├── src/
│   ├── lib/                   Shared types, constants, text utilities (port of main app)
│   ├── content/
│   │   ├── main.ts            Entry: message handling, lifecycle, key bindings
│   │   ├── rsvp.ts            RSVPEngine — rAF loop, no React, no speech
│   │   ├── selection.ts       Tokenise a user Selection into per-word Ranges
│   │   ├── highlighter.ts     Orange rectangle overlay on the active word
│   │   └── overlay.ts         Floating word display (draggable, with runway)
│   ├── popup/                 Settings popup (HTML + CSS + TS)
│   └── background/            Service worker — keyboard command bridge
└── dist/                      Built output (load this in chrome://extensions)
```

### Scripts

```bash
npm run build       # one-shot build → dist/
npm run watch       # rebuild on file changes
npm run typecheck   # tsc --noEmit
```

After a rebuild, click the **Reload** button on the extension card in
`chrome://extensions` to pick up changes (or use a reloader extension).

## PDF support

The extension ships its own PDF viewer (`src/viewer/`) built on PDF.js.

- When you visit a PDF, the popup swaps its main button to **"Open in
  Cadence Viewer"**. Click it and the tab navigates to the viewer.
- The viewer renders all pages with selectable text and a header with a
  **Read selection / Read whole page** toggle. RSVP works exactly as on
  regular web pages — same overlay, highlighter, polygon outline.
- Right-click a PDF link anywhere on the web to see **Open in Cadence
  Reader** in the context menu.
- A checkbox in the popup, **Always open PDFs in Cadence**, makes the
  background redirect PDF navigations into the viewer automatically. The
  viewer's "Back to default viewer" link bypasses the redirect for that
  load (via a `#cadence-skip` URL fragment).

### When PDFs fail to load

The viewer pre-fetches the PDF with cookies (`credentials: 'include'`) and
shows a typed error if the bytes aren't actually a PDF:
- *Server returned HTML* → the site likely requires special login state
  beyond cookies, or rewrites the URL to a download page. Fall back to the
  default viewer via the inline link.
- *Authentication required (401/403)* → same fallback applies.
- *Network error* → host_permissions may be missing or the URL unreachable.

### Where the extension doesn't work

- **`chrome://`, `chrome-extension://` (other extensions), `view-source:`,
  New Tab.** Chrome forbids content-script injection. Popup shows an inline
  error and disables Start.
- **Text rendered inside `<canvas>` or images** (web apps, scanned PDFs).
  No DOM = nothing to select. OCR would solve this — see follow-ups.

## Tradeoffs vs the main app

- **No speech-to-text** — no mic permissions, no Deepgram client, no
  off-script/drift detection. Timer-only. The extension reads what you
  highlighted at the pace you set.
- **No React** — content scripts run on arbitrary pages; shipping React would
  bloat every page load. Plain DOM throughout.
- **`Range`-based positioning** — works on any page without rewriting the
  DOM. Doesn't replace text, doesn't fight CSS, doesn't break the page.

## Possible follow-ups

- **OCR mode for images / canvas / PDF** — Tesseract.js in a sandboxed iframe
  could pick up image text or canvas-rendered content (PDFs in particular).
  Current selection-based approach can't reach those. Would add ~2MB to the
  bundle; worth gating behind a setting.
- **Right-click context menu** — "Read selection with Cadence" entry via
  `chrome.contextMenus`.
- **Auto-detect article body** — Readability.js-style content extraction so
  the user can click once on an article and read the whole thing without
  manually selecting.
- **Calibration mode** — port the main app's calibration step so the
  default WPM matches the user's natural reading speed.

## Deploying to the Chrome Web Store

This directory is self-contained — `npm run build` produces a `dist/` that
can be zipped and uploaded directly. Bump `version` in `manifest.json`
before each release.
