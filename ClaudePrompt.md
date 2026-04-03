# CLAUDE.md — EyeJockey Teleprompter

> Full build instructions for Claude Code. Read this file completely before writing a single line of code.

---

## 0. What You Are Building

**EyeJockey** is an AI-powered RSVP teleprompter web app. The user pastes a script, calibrates their reading pace, then reads it aloud while the app displays words one at a time in a fixed position near their webcam — eliminating eye movement. A Deepgram WebSocket streams real-time speech recognition; the frontend continuously compares spoken words against the script, advances the display, detects off-script moments, and shows a live WPM speed meter.

The output is a recorded audio blob of the session, plus an updated version of the script that incorporates any off-script words the user spoke.

**Stack:** Next.js 14 (App Router), TypeScript (strict), Tailwind CSS, Deepgram streaming STT, Web MediaRecorder API.  
**Environment:** Local dev only. No auth. No database. All state is in-memory / React state.

---

## 1. Technology Decisions — Pros, Cons & Why

### Next.js 14 App Router

| Pros                                                  | Cons                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| API routes keep Deepgram key server-side              | App Router mental model differs from Pages Router — async Server Components can trip you up |
| File-system routing maps cleanly to the 3-screen flow | Streaming RSC adds complexity we don't need here — use `'use client'` liberally             |
| Built-in TypeScript, Tailwind integration             | Cold-start latency on API routes in dev is occasionally noticeable                          |

**Pattern used:** All pages are client components (`'use client'`). API routes are thin server-side proxies for secrets only.

---

### Deepgram Nova-2 (Streaming WebSocket)

| Pros                                                                          | Cons                                                                                 |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| ~200ms latency — lowest of any hosted STT for streaming                       | Requires an API key (free tier: 12,000 min/yr — more than enough)                    |
| Word-level timestamps on every response — backbone of WPM calc and phase sync | WebSocket connection management has edge cases (reconnect on tab blur, mic loss)     |
| `interim_results: true` gives us partial words as they are spoken             | Key must never reach the browser — requires a server-side token proxy                |
| Official `@deepgram/sdk` with good TypeScript types                           | SDK's browser WebSocket wrapper is slightly opinionated — understand the event names |
| Excellent documentation Claude Code can fetch and use                         |                                                                                      |

**Pattern used:** Custom hook `useDeepgram` — opens mic → proxies audio to a Next.js API route that re-streams to Deepgram. The browser never sees the API key.

---

### Web MediaRecorder API (Recording)

| Pros                                                                   | Cons                                                                                        |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Native browser API — zero dependencies                                 | Codec support varies by browser (prefer `audio/webm;codecs=opus`)                           |
| Captures a clean audio blob of the full session                        | Cannot seek within a blob until it has a duration; use `URL.createObjectURL()` for playback |
| State machine pattern (idle → recording → stopped) maps directly to UI | Must request mic permission before `MediaRecorder` can start                                |

**Pattern used:** Custom hook `useMediaRecorder` — exposes `{ start, stop, audioURL, blob, state }`. The `state` field is a discriminated union driving all button rendering logic.

---

### RSVP Display Pattern

| Pros                                                                                      | Cons                                                                                       |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Eliminates saccades — reader's eyes never move                                            | Unfamiliar to users; calibration step and "runway" on re-sync are essential UX scaffolding |
| One word at a time means font can be huge — readable near webcam                          | Off-script detection must be fast; a 300ms lag feels broken                                |
| Centering a fixed letter (ORP — Optimal Recognition Point) reduces cognitive load further |                                                                                            |

**Pattern used:** Single `RSVPDisplay` component renders one word. The `useRSVP` hook owns all index state and transitions.

---

### Design Patterns Summary

- **Custom hooks** own all side-effect logic: `useDeepgram`, `useRSVP`, `useMediaRecorder`, `useLeadIn`
- **State machine** for recording: `'idle' | 'lead-in' | 'recording' | 'stopped'`
- **Discriminated unions** for RSVP status: `'waiting' | 'synced' | 'offscript' | 'paused' | 'done'`
- **Ref-based audio pipeline**: mic stream held in a `useRef` to avoid re-render-triggered reconnects
- **No global state library**: props + context only. App is small enough.

---

## 2. User Flow

### Screen 1 — `/` — Script Input

**Title (large, centered):** "Insert your text"  
**Subtitle:** "or use the default passage"

- Textarea below the title, full width, generous height
- Pre-filled with `DEFAULT_SCRIPT` (a `const` in `lib/constants.ts` — placeholder text to be replaced later, clearly commented)
- Single **"Next →"** button bottom right
- On click: saves script to `sessionStorage` key `eyejocket_wpm`, navigates to `/calibrate`

---

### Screen 2 — `/calibrate` — WPM Calibration

**Title:** "First things first — what is your reading pace?"  
**Subtitle:** "Hit Record when ready, grant microphone access, and read the passage below."

- Shows a fixed ~80-word calibration passage (`CALIBRATION_PASSAGE` constant in `lib/constants.ts`)
- A **Record** button. On click:
  - Requests mic permission
  - Starts `useMediaRecorder`
  - Starts `useDeepgram` streaming
  - Runs for **10 seconds**, then auto-stops (or user can stop early)
- After stopping:
  - Calculates WPM from Deepgram word timestamps: `wordCount / (elapsedSeconds / 60)`
  - Saves `wpm` to `sessionStorage` key `eyejockey_wpm`
  - Shows result card:
    - WPM number, large
    - Explanation text based on range:
      - `< 100`: "A bit slow for a live demo. Aim for 120–160 WPM — it keeps your audience engaged without feeling rushed."
      - `100–180`: "Perfect range. Demos land best between 120–160 WPM. You're right in the zone."
      - `> 180`: "You're reading fast. For demos, slower feels more confident and gives your audience time to absorb what they're seeing."
  - **"Next →"** and **"Skip"** buttons both navigate to `/session`

---

### Screen 3 — `/session` — Teleprompter

This is the core screen. Layout is carefully specified.

#### Layout Zones (top to bottom, full viewport height, dark background `#0a0a0a`)

```
┌─────────────────────────────────────────────────────┐
│ [SPEED METER BAR — 10px, full width, flush top]      │
├──────────────────┬──────────────────────────────────┤
│                  │                                   │
│  Teleprompter    │     [RSVP WORD — top center]      │
│  (low contrast,  │     near webcam position          │
│  top-left, lg)   │                                   │
│                  │                                   │
│                  │                                   │
├──────────────────┴──────────────────────────────────┤
│  [ORIGINAL SCRIPT — left panel, scrollable]          │
│  [TRANSCRIBED TEXT — right panel, scrollable]        │
│   (off-script words in PURPLE)                       │
├─────────────────────────────────────────────────────┤
│  [RECORD BUTTON]  [STOP BUTTON]                      │
│  [AUDIO PLAYER — appears after stop]                 │
└─────────────────────────────────────────────────────┘
```

#### RSVP Word Display (top-center, near webcam)

- Single word, `font-size: 64px`, white, `font-weight: 600`
- Horizontally centered, positioned in top 30% of screen (y ≈ 15–20vh)
- When `status === 'offscript'`: word fades to 20% opacity, transitions to showing the live transcribed word in amber `#F59E0B`
- When `status === 'offscript'` AND runway is preloading: show 4 upcoming script words in a row, slightly smaller (48px), dimmed, so user can see what they are returning to
- When `status === 'synced'`: single word, full opacity, white

#### Speed Meter Bar

- `height: 10px`, `width: 100%`, flush to very top of viewport (`position: fixed; top: 0`)
- Fill color driven by `speedRatio` (0–2, where 1.0 = target WPM):
  - `0–0.75`: `#3B82F6` (blue — cold, speed up)
  - `0.75–1.25`: `#22C55E` (green — good)
  - `1.25–2.0`: `#EF4444` (red — hot, slow down)
- Fill width: `clamp(0%, speedRatio * 50%, 100%)` — so 1.0 = 50% fill, not 100%
- `transition: width 300ms ease, background-color 400ms ease`
- Accessible: width changes even without color (for color-blind users)

#### Lead-In Sequence (on Record click)

- State transitions: `idle → lead-in → recording`
- During `lead-in`: overlay text counts down:  
  `"Recording in 3…"` → `"Recording in 2…"` → `"Recording in 1…"` → disappears
- Text-to-speech via `window.speechSynthesis.speak()` with the utterance:  
  `"This is to set the pace for my target words per minute. Recording in 3, 2, 1."`
- After lead-in completes (≈ 4 seconds): start `MediaRecorder` + Deepgram simultaneously
- `useLeadIn(onComplete: () => void)` hook handles this sequence

#### Off-Script Behavior (detailed)

1. Deepgram returns a word token
2. `useRSVP` calls `fuzzyMatch(spokenWord, script[currentIndex..currentIndex+3])`
3. If **2 consecutive mismatches**: `status → 'offscript'`
4. RSVP display: fades to 20% opacity (CSS transition 200ms)
5. Live transcribed words appear in the **Transcribed Text panel** in **purple** (`#A855F7`)
6. Simultaneously: pre-render runway of next 4 script words above current RSVP word (small, dimmed)
7. Re-sync check runs on every new Deepgram word: call `fuzzyMatch` against a lookahead window of 5 script words
8. On re-sync match: `currentIndex → matchIndex`, `status → 'synced'`, RSVP resumes instantly

#### Text Panels (bottom half of screen, side by side)

- **Left panel**: Original script, word-by-word — current word highlighted (background: `#ffffff15`)
- **Right panel**: Live transcription — in-script words in white, off-script words in purple `#A855F7`
- Both panels scroll automatically to keep the active line visible (`scrollIntoView({ behavior: 'smooth', block: 'center' })`)

#### Recording Controls

- **Record button**: visible when `recordState === 'idle'`. Triggers lead-in then recording.
- **Stop button**: visible when `recordState === 'recording'`. Stops MediaRecorder + Deepgram.
- After stop: a **card** appears below the panels containing:
  - Updated script text (original + off-script insertions, off-script words in purple)
  - `<audio controls src={audioURL} />` HTML element (browser-native player)
  - A "Copy updated script" button

---

## 3. File Structure

```
eyejockey/
├── app/
│   ├── layout.tsx                        # Root layout, fonts, global styles
│   ├── page.tsx                          # Screen 1: Script input
│   ├── calibrate/
│   │   └── page.tsx                      # Screen 2: WPM calibration
│   ├── session/
│   │   └── page.tsx                      # Screen 3: Teleprompter session
│   └── api/
│       └── deepgram-token/
│           └── route.ts                  # Server: issues scoped Deepgram token
│
├── components/
│   ├── RSVPDisplay.tsx                   # Single-word RSVP + runway display
│   ├── SpeedMeter.tsx                    # 10px top bar
│   ├── ScriptPanel.tsx                   # Scrolling original script w/ highlights
│   ├── TranscriptPanel.tsx               # Live transcription w/ off-script colouring
│   ├── LeadInOverlay.tsx                 # Countdown overlay during lead-in
│   ├── WPMResultCard.tsx                 # Calibration result with explanation
│   └── RecordingCard.tsx                 # Post-session audio player + updated script
│
├── hooks/
│   ├── useDeepgram.ts                    # WebSocket + mic → Deepgram streaming
│   ├── useRSVP.ts                        # RSVP sync engine, off-script detection
│   ├── useMediaRecorder.ts               # Record/stop state machine, audio blob
│   └── useLeadIn.ts                      # TTS countdown + timing before recording
│
├── lib/
│   ├── constants.ts                      # DEFAULT_SCRIPT, CALIBRATION_PASSAGE, WPM ranges
│   ├── textUtils.ts                      # tokenize(), levenshtein(), fuzzyMatch(), mergeTranscript()
│   └── types.ts                          # All shared TypeScript types and discriminated unions
│
├── .env.local.example                    # DEEPGRAM_API_KEY=your_key_here
├── README.md
├── TRADEOFFS.md                          # (generated by you — see Section 6)
├── tailwind.config.ts
└── package.json
```

---

## 4. File-by-File Specification

> **Convention for every file:** Place a block comment at the top of each file (before any imports) with the following structure:
>
> ```ts
> /**
>  * @file filename.ts
>  * @description One sentence description of what this file does.
>  *
>  * DEPENDENCIES:
>  *   - list any non-obvious external or internal dependencies
>  *
>  * COGNITIVE DEBT NOTICE:
>  *   - Any non-obvious decisions, gotchas, or things a new developer
>  *     must understand before modifying this file. Be specific.
>  *     Example: "Deepgram sends interim AND final results on the same
>  *     event — always check result.is_final before advancing the index."
>  */
> ```
>
> This is mandatory on every file. Do not skip it.

---

### `lib/types.ts`

Define and export all shared types. No logic here.

```ts
// Recording state machine
export type RecordState = "idle" | "lead-in" | "recording" | "stopped";

// RSVP sync state
export type RSVPStatus = "waiting" | "synced" | "offscript" | "paused" | "done";

// A single word token with optional timing info
export type WordToken = {
  word: string; // lowercase, stripped of punctuation
  original: string; // original casing/punctuation as it appears in script
  index: number; // position in the full script token array
};

// A word as returned by Deepgram
export type DeepgramWord = {
  word: string;
  start: number; // seconds from stream start
  end: number;
  confidence: number;
};

// A transcribed word — either matched to script or off-script
export type TranscriptEntry = {
  word: string;
  isOffScript: boolean;
  scriptIndex: number | null; // null if off-script
  timestamp: number; // ms since session start
};

// The full state exposed by useRSVP
export type RSVPState = {
  currentIndex: number;
  displayWord: string;
  displayRunway: string[]; // 4-word runway shown during off-script
  status: RSVPStatus;
  speedRatio: number; // 1.0 = on target WPM
  transcript: TranscriptEntry[];
};

// Exposed by useMediaRecorder
export type MediaRecorderState = {
  recordState: RecordState;
  audioURL: string | null;
  blob: Blob | null;
  start: () => void;
  stop: () => void;
};

// WPM range classification
export type WPMRange = "too-slow" | "good" | "too-fast";
```

---

### `lib/constants.ts`

```ts
/**
 * @file constants.ts
 * @description App-wide constants. DEFAULT_SCRIPT and CALIBRATION_PASSAGE
 *              are intentional placeholders — replace with real content.
 *
 * COGNITIVE DEBT NOTICE:
 *   - DEFAULT_SCRIPT is used on Screen 1 as placeholder text.
 *     It is NOT the calibration passage. Two separate constants, two separate purposes.
 *   - WPM_TARGET is the fallback if the user skips calibration.
 *     sessionStorage key 'eyejockey_wpm' overrides this at runtime.
 */

export const DEFAULT_SCRIPT = `[Replace this with your default teleprompter script. 
This is a placeholder — paste any multi-paragraph text here and it will 
pre-fill the script input on the home screen.]`;

export const CALIBRATION_PASSAGE = `[Replace this with a calibration passage of approximately 
80 words. It should be natural, conversational prose — similar in register to a 
product demo script. The user reads this aloud so we can measure their WPM.]`;

export const WPM_TARGET = 140; // fallback if calibration is skipped
export const WPM_MIN_GOOD = 100;
export const WPM_MAX_GOOD = 180;
export const CALIBRATION_DURATION_MS = 10_000;
export const OFFSCRIPT_THRESHOLD = 2; // consecutive mismatches before pausing
export const FUZZY_LOOKAHEAD = 5; // how many script words ahead to search for re-sync
export const RUNWAY_WORD_COUNT = 4; // words shown during off-script runway
export const LEVENSHTEIN_MAX_DISTANCE = 2;

export const WPM_EXPLANATIONS: Record<string, string> = {
  "too-slow": `A bit slow for a live demo. Aim for 120–160 WPM — it keeps your audience 
    engaged without feeling rushed. Take a breath and try again, or continue.`,
  good: `Perfect range. Demos land best between 120–160 WPM. You're right in the zone.`,
  "too-fast": `You're reading fast. For demos, slower feels more confident and gives your 
    audience time to absorb what you're showing them.`,
};
```

---

### `lib/textUtils.ts`

Implement these functions fully. No stubs.

```ts
/**
 * tokenize(text: string): WordToken[]
 *   Splits text into WordToken[]. Strips punctuation for matching but preserves
 *   original form. Assigns sequential index.
 *   Edge cases: handle em-dashes, ellipses, hyphenated words (keep as one token).
 *
 * levenshtein(a: string, b: string): number
 *   Iterative dynamic programming. NOT recursive (stack overflow risk on long words).
 *   Lowercase both inputs before comparing.
 *
 * fuzzyMatch(spoken: string, candidates: WordToken[], maxDistance?: number): number | null
 *   Returns the index in `candidates` of the best match within maxDistance.
 *   Returns null if no match found within threshold.
 *   Used for both normal sync and re-sync lookahead.
 *
 * calculateWPM(words: DeepgramWord[]): number
 *   Given an array of timed words, returns WPM as:
 *   wordCount / ((lastWord.end - firstWord.start) / 60)
 *   Returns 0 if fewer than 3 words.
 *
 * mergeTranscript(script: WordToken[], transcript: TranscriptEntry[]): string
 *   Produces the final merged script string. Script words that were spoken correctly
 *   appear as-is. Off-script words are inserted at the point they were spoken,
 *   wrapped in a marker so the UI can colour them: e.g. [[OFF:word]]
 *   The RecordingCard component parses this marker format for purple colouring.
 *
 * classifyWPM(wpm: number): WPMRange
 *   Returns 'too-slow' | 'good' | 'too-fast' based on WPM_MIN_GOOD / WPM_MAX_GOOD.
 */
```

---

### `hooks/useDeepgram.ts`

```ts
/**
 * @file useDeepgram.ts
 * @description Custom hook that manages the full Deepgram streaming pipeline:
 *              mic access → AudioContext → WebSocket to Deepgram → parsed word events.
 *
 * DEPENDENCIES:
 *   - @deepgram/sdk (npm) — use the LiveClient from the browser-compatible export
 *   - /api/deepgram-token — server route that returns { key: string }
 *   - lib/types.ts — DeepgramWord
 *
 * COGNITIVE DEBT NOTICE:
 *   - Deepgram sends TWO types of results on the same event: interim (is_final: false)
 *     and final (is_final: true). ONLY advance the RSVP index on final results.
 *     Interim results can be used to update the live transcript display only.
 *   - The WebSocket must be closed on component unmount — use a useEffect cleanup.
 *   - getUserMedia() is async and can throw (user denies permission, no mic).
 *     Handle the NotAllowedError with a user-facing error message, not a console.error.
 *   - Audio must be sent as raw PCM or via the SDK's built-in encoding.
 *     Use encoding: 'linear16', sample_rate: 16000 for best accuracy.
 *   - Do NOT open the WebSocket until startListening() is called. Do not open on mount.
 */

export type UseDeepgramReturn = {
  startListening: () => Promise<void>;
  stopListening: () => void;
  finalWords: DeepgramWord[]; // committed words (is_final: true)
  interimText: string; // current partial utterance
  isListening: boolean;
  error: string | null;
};

export function useDeepgram(): UseDeepgramReturn;
```

---

### `hooks/useRSVP.ts`

```ts
/**
 * @file useRSVP.ts
 * @description The core RSVP sync engine. Consumes Deepgram word events and
 *              drives the teleprompter display state.
 *
 * DEPENDENCIES:
 *   - lib/textUtils.ts — fuzzyMatch, tokenize
 *   - lib/types.ts — RSVPState, RSVPStatus, DeepgramWord, WordToken, TranscriptEntry
 *   - lib/constants.ts — OFFSCRIPT_THRESHOLD, FUZZY_LOOKAHEAD, RUNWAY_WORD_COUNT
 *
 * COGNITIVE DEBT NOTICE:
 *   - This hook is the most complex in the app. Read it before touching it.
 *   - `consecutiveMismatches` is a ref, NOT state — it must not trigger re-renders.
 *   - The kinematic extrapolation runs on a requestAnimationFrame loop, NOT on
 *     Deepgram events. It predicts forward from the last confirmed word using
 *     rolling WPM. This means the display advances even between Deepgram packets.
 *     Cancel the rAF loop on unmount.
 *   - The runway (4 upcoming words shown during off-script) is pre-computed whenever
 *     status transitions to 'offscript'. It does NOT update word-by-word during
 *     off-script — it is a snapshot of what comes next.
 *   - Re-sync check uses a LOOKAHEAD window, not just the next expected word.
 *     This handles the user resuming a few words further in than expected.
 *   - `speedRatio` is a rolling average over the last 10 confirmed word timestamps.
 *     Do not compute it from the first word — the lead-in makes it inaccurate.
 */

export type UseRSVPInput = {
  script: string;
  targetWPM: number;
  finalWords: DeepgramWord[]; // live-updating array from useDeepgram
  isListening: boolean;
};

export function useRSVP(input: UseRSVPInput): RSVPState;
```

---

### `hooks/useMediaRecorder.ts`

```ts
/**
 * @file useMediaRecorder.ts
 * @description State machine hook for browser audio recording via MediaRecorder API.
 *
 * DEPENDENCIES:
 *   - Web API: MediaRecorder, MediaStream, URL.createObjectURL
 *   - lib/types.ts — RecordState, MediaRecorderState
 *
 * COGNITIVE DEBT NOTICE:
 *   - MediaRecorder records from the SAME getUserMedia stream as Deepgram.
 *     Pass the stream in as a parameter — do NOT call getUserMedia twice.
 *     Two calls = two permission prompts = confusing UX.
 *   - The blob is only complete AFTER the 'stop' event fires on MediaRecorder,
 *     NOT immediately when stop() is called. Use the ondataavailable + onstop
 *     pattern: collect chunks in ondataavailable, assemble blob in onstop.
 *   - audioURL must be revoked with URL.revokeObjectURL() on unmount to avoid
 *     memory leaks. Do this in the useEffect cleanup.
 *   - Preferred MIME type: 'audio/webm;codecs=opus'. Fall back to 'audio/webm'
 *     if not supported. Check with MediaRecorder.isTypeSupported() before using.
 */

// Signature:
export function useMediaRecorder(
  stream: MediaStream | null
): MediaRecorderState;
```

---

### `hooks/useLeadIn.ts`

```ts
/**
 * @file useLeadIn.ts
 * @description Manages the lead-in countdown sequence before recording starts.
 *              Uses Web Speech Synthesis API for the spoken countdown.
 *
 * DEPENDENCIES:
 *   - Web API: window.speechSynthesis, SpeechSynthesisUtterance
 *   - lib/types.ts — RecordState
 *
 * COGNITIVE DEBT NOTICE:
 *   - speechSynthesis.speak() is async in behavior but has no Promise API.
 *     Use the utterance's onend event to chain to the next step.
 *   - Some browsers (especially mobile Safari) require speechSynthesis to be
 *     triggered from a direct user gesture (the Record button click). This hook
 *     must be called synchronously in the button's onClick handler.
 *   - If speechSynthesis is unavailable (SSR, test env), fall back to a
 *     setTimeout-only countdown silently — do not throw.
 *   - The visual countdown (3, 2, 1) updates via a setInterval at 1000ms.
 *     Cancel it in cleanup.
 */

export type UseLeadInReturn = {
  startLeadIn: () => void;
  countdownValue: number | null; // 3 | 2 | 1 | null (null = not active)
  isActive: boolean;
};

export function useLeadIn(onComplete: () => void): UseLeadInReturn;
```

---

### `app/api/deepgram-token/route.ts`

```ts
/**
 * @file route.ts
 * @description Server-side API route. Issues a short-lived Deepgram API key
 *              scoped to streaming only. The browser receives this key, uses it
 *              for one session, and it expires. The real DEEPGRAM_API_KEY never
 *              leaves the server.
 *
 * DEPENDENCIES:
 *   - process.env.DEEPGRAM_API_KEY — must be set in .env.local
 *   - process.env.DEEPGRAM_PROJECT_ID — must be set in .env.local
 *   - Deepgram REST API: POST /v1/projects/{projectId}/keys
 *
 * COGNITIVE DEBT NOTICE:
 *   - If the Deepgram project key creation endpoint is unavailable or too complex
 *     to set up quickly, fall back to returning the API key directly (still
 *     server-side). The key is then passed to the browser. This is acceptable
 *     for local dev but must NOT be done in production.
 *   - Add a comment in the code marking the fallback so it is visible and
 *     cannot be accidentally shipped.
 *   - CORS: this route is called from the same origin — no CORS headers needed.
 */
```

---

### `components/RSVPDisplay.tsx`

```ts
/**
 * @file RSVPDisplay.tsx
 * @description Renders the single RSVP word (or 4-word runway) near the top-center
 *              of the screen. Handles opacity transitions for off-script state.
 *
 * DEPENDENCIES:
 *   - lib/types.ts — RSVPStatus
 *
 * COGNITIVE DEBT NOTICE:
 *   - The RSVP word is positioned at top: 18vh to sit near a typical webcam position
 *     (top-center of a laptop screen). This is a magic number. Comment it as such.
 *   - During 'offscript': the current word fades to opacity 0.2, and the runway
 *     words appear ABOVE the normal word position (negative translateY), smaller.
 *     This gives the user a preview of where they are returning to without moving
 *     the anchor position of the main word.
 *   - Font size for main word: 64px. Runway words: 36px. These are magic numbers
 *     chosen for readability at arm's length near a webcam. Comment them.
 */

type Props = {
  word: string;
  runway: string[];
  status: RSVPStatus;
};
```

---

### `components/SpeedMeter.tsx`

```ts
/**
 * @file SpeedMeter.tsx
 * @description Fixed 10px bar at the very top of the viewport.
 *              Color and fill-width encode speed relative to target WPM.
 *              Accessible: width changes independently of color.
 *
 * COGNITIVE DEBT NOTICE:
 *   - `speedRatio` is 0–2 where 1.0 = exactly on target. The bar is 50% full at 1.0.
 *     This means the bar is never "full" during normal reading — full (100%) means
 *     twice the target speed. This is intentional: the bar communicates direction
 *     (fill growing = speeding up) not completion.
 *   - Uses `position: fixed; top: 0; left: 0; z-index: 50` — this overlaps everything.
 *     If you add a nav bar later, adjust z-indices accordingly.
 */

type Props = {
  speedRatio: number; // 0–2, where 1.0 = target WPM
};
```

---

### `components/ScriptPanel.tsx`

- Renders the original script tokens as a flowing block
- Current word (`currentIndex`) highlighted with background `rgba(255,255,255,0.08)` and white text
- Past words: `opacity: 0.3`
- Future words: `opacity: 0.6`
- Auto-scrolls to keep the current word in view using a `ref` on the current word element

---

### `components/TranscriptPanel.tsx`

- Renders `TranscriptEntry[]` as flowing text
- `isOffScript: false` → white text
- `isOffScript: true` → purple `#A855F7`, slightly bold
- Label at top: "Live transcript" in muted low-contrast text
- Auto-scrolls to bottom as new words arrive

---

### `components/LeadInOverlay.tsx`

- Full-screen overlay (`position: fixed, inset: 0, z-index: 100, background: rgba(0,0,0,0.85)`)
- Centered large countdown number: `3`, `2`, `1`
- Fade in/out per digit (CSS `@keyframes fadeNumber`)
- Disappears entirely when `countdownValue === null`

---

### `components/WPMResultCard.tsx`

- Props: `{ wpm: number, range: WPMRange }`
- Large WPM number centered
- Explanation text from `WPM_EXPLANATIONS[range]`
- Color accent: too-slow = blue, good = green, too-fast = red

---

### `components/RecordingCard.tsx`

- Appears below panels after recording stops
- Props: `{ audioURL: string, mergedScript: string }`
- Renders `mergedScript` with `[[OFF:word]]` markers parsed to purple `<span>` elements
- Native `<audio controls src={audioURL} />` element
- "Copy updated script" button → copies plain text (no markers) to clipboard

---

## 5. Deepgram WebSocket Integration Detail

### Connection Parameters

```
wss://api.deepgram.com/v1/listen
  ?model=nova-2
  &language=en
  &punctuate=true
  &interim_results=true
  &utterance_end_ms=1000
  &vad_events=true
  &encoding=linear16
  &sample_rate=16000
```

### Audio Pipeline

```
getUserMedia({ audio: true })
  → MediaStream
  → AudioContext (sample rate: 16000)
  → ScriptProcessorNode OR AudioWorkletNode (prefer Worklet)
  → Float32 PCM → convert to Int16 PCM
  → WebSocket.send(int16Buffer)
```

### Result Handling

```ts
// On each Deepgram message:
const result = JSON.parse(event.data);
if (result.type === "Results") {
  const words: DeepgramWord[] = result.channel.alternatives[0].words;
  if (result.is_final) {
    // Commit to finalWords array → triggers useRSVP sync
  } else {
    // Update interimText only (display only, no RSVP advancement)
  }
}
```

---

## 6. Files to Auto-Generate

### `README.md`

Include:

1. What EyeJockey is (2 sentences)
2. Prerequisites: Node 18+, Deepgram free account
3. Setup steps: clone → `cp .env.local.example .env.local` → add key → `npm install` → `npm run dev`
4. Where to get a Deepgram API key (link: https://console.deepgram.com)
5. Known limitations (local dev only, Chrome recommended for best MediaRecorder support)

### `TRADEOFFS.md`

Generate a markdown file documenting:

- Why Deepgram over AssemblyAI and Web Speech API (latency, word timestamps)
- Why RSVP over scrolling prose (saccade elimination)
- Why no global state library (scope, simplicity)
- Why `useRef` for audio stream rather than `useState`
- Why kinematic extrapolation rather than waiting for each Deepgram packet
- The deliberate choice to use `sessionStorage` over URL params for script passing between pages

---

## 7. Design System

### Colors (session screen)

```
Background:        #0a0a0a
RSVP word:         #ffffff
Off-script word:   #F59E0B  (amber)
Off-script text panel: #A855F7 (purple)
Speed bar — cold:  #3B82F6  (blue)
Speed bar — good:  #22C55E  (green)
Speed bar — hot:   #EF4444  (red)
Muted labels:      rgba(255,255,255,0.2)
Panel backgrounds: rgba(255,255,255,0.03)
Teleprompter label (top-left): rgba(255,255,255,0.08)
```

### Typography

- "Teleprompter" label top-left: `font-size: clamp(32px, 5vw, 64px)`, `color: rgba(255,255,255,0.08)`, `font-weight: 700`, `letter-spacing: -0.02em`
- RSVP main word: `font-size: 64px`, `font-weight: 600`, `letter-spacing: -0.01em`
- Runway words: `font-size: 36px`, `font-weight: 400`, `opacity: 0.4`
- Panel text: `font-size: 15px`, `line-height: 1.8`

### Tailwind Config

Use Tailwind for all layout and spacing. For the few hex values listed above that are not in the default Tailwind palette, extend `tailwind.config.ts` under `theme.extend.colors`:

```ts
eyejockey: {
  bg: '#0a0a0a',
  rsvp: '#ffffff',
  offscript: '#F59E0B',
  transcript: '#A855F7',
  label: 'rgba(255,255,255,0.08)',
}
```

---

## 8. Scaffold Command

Run this first, then build all files above into the resulting project:

```bash
npx create-next-app@latest eyejockey \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --no-eslint
```

Then install dependencies:

```bash
cd eyejcokey
npm install @deepgram/sdk
```

Create `.env.local` from `.env.local.example`:

```
DEEPGRAM_API_KEY=your_key_here
DEEPGRAM_PROJECT_ID=your_project_id_here
```

---

## 9. Build Order

Implement files in this order to avoid import errors:

1. `lib/types.ts`
2. `lib/constants.ts`
3. `lib/textUtils.ts` (+ unit test each function with a console.assert block at the bottom, wrapped in `if (process.env.NODE_ENV === 'development')`)
4. `app/api/deepgram-token/route.ts`
5. `hooks/useMediaRecorder.ts`
6. `hooks/useLeadIn.ts`
7. `hooks/useDeepgram.ts`
8. `hooks/useRSVP.ts`
9. All components (leaf components first: `SpeedMeter`, `RSVPDisplay`, `LeadInOverlay`, `WPMResultCard`, `ScriptPanel`, `TranscriptPanel`, `RecordingCard`)
10. `app/page.tsx`
11. `app/calibrate/page.tsx`
12. `app/session/page.tsx`
13. `README.md` and `TRADEOFFS.md`

---

## 10. Non-Negotiables

- TypeScript strict mode. No `any`. No `as unknown as X` hacks.
- Every file has the `@file` block comment as specified in Section 4.
- No third-party UI component libraries. Tailwind + custom components only.
- `useDeepgram` and `useMediaRecorder` must share the same `MediaStream` instance — do not call `getUserMedia` twice.
- The Deepgram API key must never appear in any client-side bundle. The `/api/deepgram-token` route is the only place it exists.
- All `useEffect` hooks that set up WebSockets, MediaRecorder, or rAF loops must return a cleanup function that tears them down.
- `textUtils.ts` functions must be pure (no side effects, no module-level state).
