# EyeJockey -- Product Description

EyeJockey is a browser-based teleprompter designed for video creators who need to deliver scripted content while appearing to look directly at their audience. Instead of scrolling text that forces the reader's eyes to track across the screen, EyeJockey presents one word at a time in a fixed position near the camera, advances at the speaker's natural pace, and uses real-time speech recognition to stay in sync with what the speaker actually says.

## The RSVP Approach

Traditional teleprompters scroll lines of text horizontally or vertically. The reader's eyes perform saccades -- rapid jumps between fixation points -- to track each word, then snap back to the beginning of the next line. These eye movements are visible to viewers and break the illusion of direct eye contact.

Rapid Serial Visual Presentation (RSVP) eliminates saccades entirely. Words appear one at a time at a single fixed point on screen. The reader's gaze stays locked in place. To the audience, the speaker is simply looking at them.

EyeJockey adds a next-word preview displayed in smaller, dimmer text just below the current word. This gives the reader a fraction-of-a-second head start on the upcoming word without requiring any lateral eye movement. During off-script states, a vertical stack of upcoming "runway" words (up to 8) is shown in descending size, again arranged vertically to avoid horizontal saccades.

## Technical Architecture Overview

The application is built with Next.js App Router. All teleprompter logic lives in client components and custom hooks. The architecture separates concerns into three layers:

**Hooks (logic layer):**
- useRSVP -- the core engine that drives word advancement, processes speech confirmations, detects drift and off-script speech, and manages per-word state
- useDeepgram -- manages the WebSocket connection to Deepgram's streaming speech-to-text API
- useMediaRecorder -- captures audio from the microphone for playback and download
- useLeadIn -- provides a 3-2-1 countdown before recording begins
- useDelaySettings -- manages per-punctuation delay configuration with session storage persistence

**Components (presentation layer):**
- RSVPDisplay -- the central one-word display with next-word preview and runway
- SpeedMeter -- a narrow 200px bar at the top of the viewport showing speaking pace
- ScriptPanel -- the full script rendered as flowing text with per-word status coloring
- TranscriptPanel -- live feed of recognized words during recording
- TakeCard -- expandable card for completed takes with transcript, audio player, and download
- WPMResultCard -- calibration result with gradient speed bar
- SettingsPopper -- gear icon popover with punctuation delay sliders
- ConnectionStatus -- colored dot indicator for Deepgram WebSocket state
- LeadInOverlay -- full-screen 3-2-1 countdown overlay
- DelayBar -- thin animated bar showing punctuation delay progress

**Pages:**
- /calibrate -- WPM calibration flow
- /session -- the main teleprompter session

### Data Flow Diagram

```
User speaks into microphone
        |
        v
MediaRecorder (audio/webm;codecs=opus, 250ms chunks)
        |
        v
WebSocket --> Deepgram Nova-2 (streaming, interim + final results)
        |
        v
useDeepgram accumulates finalWords[] with timestamps
        |
        v
useRSVP receives finalWords via props
        |
        +---> Deepgram sync effect: matches words against script tokens,
        |     updates confirmedIndex, detects off-script, triggers re-sync
        |
        +---> rAF loop (independent): advances displayIndex at target WPM,
        |     applies punctuation delays, detects drift/silence, rewinds
        |
        +---> Flush interval (100ms): copies ref state to React state
        |
        v
React state drives component rendering:
  RSVPDisplay <-- currentWord, nextWord, runway, status, delayProgress, isDrifting
  ScriptPanel <-- wordStates[], displayIndex
  SpeedMeter  <-- speedRatio
  TranscriptPanel <-- transcript[]
```

## The Two-Tier State Architecture

The RSVP engine must advance words with sub-frame precision. A word displayed 50ms late at 200 WPM means the speaker is already past it. React's asynchronous state updates and re-render cycle are too slow and unpredictable for this timing requirement.

The solution is a two-tier architecture:

**Tier 1 -- Refs at 60fps.** All authoritative state lives in React refs: wordStates, displayIndex, confirmedIndex, drift flags, delay accumulators, consecutive match/miss counters. The requestAnimationFrame loop and the Deepgram sync effect both mutate these refs directly. There are no stale closure problems because refs are mutable containers.

**Tier 2 -- React state at 10Hz.** A setInterval running every 100ms (STATE_FLUSH_INTERVAL_MS) copies the current ref values into React useState variables. Components re-render from this snapshot. The 100ms interval is fast enough for smooth visual updates but slow enough to avoid unnecessary render pressure.

This means the rAF loop never triggers a React re-render. It reads and writes refs only. The flush interval is the sole bridge between the two tiers.

## The rAF Loop: Word Advancement

The requestAnimationFrame loop is the primary driver of word advancement. It runs continuously while the session is active and the status is "synced." On each frame, it:

1. Computes the time delta since the last frame, clamped to 2x the per-word interval (to handle tab blur gracefully -- if the user switches tabs for 30 seconds, the display does not try to catch up 30 seconds of words in one frame).

2. Checks for drift or silence before doing anything else. If the gap between displayIndex and confirmedIndex exceeds the effective threshold, or if the gap exceeds 2 and no Deepgram words have arrived for 4 seconds, it marks unconfirmed words, rewinds to confirmed + 2, and returns without advancing.

3. Checks if the speaker is ahead of the timer (confirmedIndex > displayIndex). If so, it snaps displayIndex forward to match.

4. If a punctuation delay is in progress, it decrements the remaining delay by the frame delta and updates a progress value for the delay bar animation. No word advancement happens during a delay.

5. Accumulates the frame delta into a time accumulator. When the accumulator exceeds the milliseconds-per-word interval (60000 / targetWPM), it advances displayIndex by one, marks the new word as "displayed" with a performance.now() timestamp, and checks for trailing punctuation on the previous word to initiate a delay.

6. When displayIndex reaches the end of the token array, it sets status to "done."

## Deepgram Integration

The useDeepgram hook manages a WebSocket connection to Deepgram's Nova-2 streaming API. Audio is captured via MediaRecorder using the audio/webm;codecs=opus MIME type and sent in 250ms chunks. The hook fetches a temporary API key from a server route (/api/deepgram-token) before opening the WebSocket.

Deepgram returns two types of results: interim (partial, low-latency, may change) and final (committed, includes per-word timestamps with start/end times and confidence scores). The hook accumulates final words into a growing array and exposes the latest interim transcript as a separate string for UI display. The useRSVP engine only processes final words for confirmation, since interim results are unstable.

The connection lifecycle is tracked as a four-state machine: idle, connecting, connected, error. The ConnectionStatus component renders a colored dot (gray, amber, green, red) with a label reflecting this state.

## The Token Pipeline

When the user provides a script, it flows through a tokenization pipeline:

1. The raw script string is split into words, preserving original casing and punctuation.
2. Each word becomes a WordToken with four fields: index (zero-based position), original (the word as written), normalised (lowercase, stripped of punctuation, used for fuzzy matching), and punctuation (an array of trailing punctuation characters detected on the word, such as [","] or [".", "!"]).
3. The token array is wrapped into a WordState array where each entry pairs a token with lifecycle metadata: status (planned/displayed/confirmed/unconfirmed), displayedAt and confirmedAt timestamps, and confirmedWith (the Deepgram word that matched).

This pipeline ensures that display logic works with clean normalized text for matching while preserving the original formatting for display, and that punctuation metadata is available for computing delays without re-parsing.

## Off-Script Detection

The Deepgram sync effect processes each new final word by searching forward from confirmedIndex for a matching token in the script. When no match is found, a consecutive-miss counter increments. After three consecutive misses (OFFSCRIPT_THRESHOLD), the engine:

1. Marks all words between confirmedIndex and displayIndex as "unconfirmed."
2. Rewinds displayIndex back to confirmedIndex.
3. Sets status to "offscript."
4. Records the unmatched word as an OffScriptEntry with a timestamp and the current confirmed position.

In off-script mode, the rAF loop stops advancing words. The RSVPDisplay shows the last confirmed word dimmed in amber with a vertical stack of upcoming runway words (RUNWAY_LENGTH = 8) so the speaker can see where to pick up.

### Re-Sync

While off-script, the engine watches incoming Deepgram words for matches against the script. But a single match is not enough -- common words like "the," "it," "your," or "is" could produce false positives. Re-sync requires RESYNC_MATCH_THRESHOLD (3) consecutive sequential matches: each match must be at the next expected position in the script.

The engine tracks this with two counters: consecutiveMatches and pendingResyncIndex. When the first potential match arrives, pendingResyncIndex is set to that position. Each subsequent word must match at pendingResyncIndex + 1. If a word matches but at a non-sequential position, the counters reset and the word is treated as off-script.

Once three sequential matches confirm, the engine commits all matched words as "confirmed," updates confirmedIndex and displayIndex, clears all counters, and transitions back to "synced." The rAF loop resumes advancing from the new position.

## Drift and Silence Detection

The rAF loop monitors the gap between displayIndex (where the timer has reached) and confirmedIndex (where Deepgram has verified) on every frame. Two conditions trigger a rewind:

1. **Word gap:** displayIndex - confirmedIndex exceeds an effective threshold. The threshold is the smaller of DRIFT_THRESHOLD (15) and half the script length, with a floor of 3. At 140 WPM, 15 words is roughly 6.5 seconds of reading -- enough to absorb Deepgram's normal 1-3 second batch latency without false alarms.

2. **Silence timeout:** The gap exceeds 2 words AND no new Deepgram word has arrived for SILENCE_TIMEOUT_MS (4000ms). This catches the case where the speaker pauses mid-sentence. The 4-second threshold exceeds Deepgram's normal 1-2 second gap between result batches.

When either condition fires, all displayed-but-unconfirmed words are marked as "unconfirmed," displayIndex rewinds to confirmedIndex + REWIND_BUFFER (2), and isDrifting is set to true. The RSVPDisplay renders the current word with a pulsing opacity animation and a "Rewinding..." label. When new confirmations arrive, isDrifting clears and displayIndex snaps to the new confirmed position.

## Punctuation Delay System

Each punctuation character has a configurable delay in milliseconds: comma (200ms), period (400ms), semicolon (300ms), colon (300ms), em dash (350ms), en dash (300ms), ellipsis (600ms), question mark (450ms), exclamation (300ms), paragraph mark (700ms). These defaults come from video production standards for natural-sounding pacing.

When the rAF loop advances past a word, it checks the previous word's punctuation array and computes a total delay. If the delay is non-zero, delayRemaining and delayTotal refs are set. On subsequent frames, the loop decrements delayRemaining by the frame delta instead of accumulating toward the next word. A delayProgress value (0 to 1) is flushed to React state, driving a thin animated bar beneath the RSVP word (the DelayBar component).

The SettingsPopper component exposes per-punctuation sliders with a range from MIN_PUNCTUATION_DELAY (50ms) to MAX_PUNCTUATION_DELAY (1200ms) in 10ms steps. Changes take effect immediately because the rAF loop reads from a ref that stays synchronized with the prop via a useEffect. A "Reset to defaults" button restores the original values.

## Calibration Flow

The calibration page (/calibrate) measures the speaker's natural reading pace:

1. The user sees a fixed calibration passage and hits "Record."
2. The browser requests microphone access, starts a MediaRecorder, and opens a Deepgram WebSocket.
3. A 10-second countdown runs. The passage container gets a blue border glow to indicate active recording. A live transcript appears below as Deepgram returns results.
4. At 10 seconds, the MediaRecorder stops. A 1.5-second drain period lets Deepgram finalize any buffered audio. The phase transitions to "processing" with a "Finalizing..." label.
5. After the drain, WPM is calculated: total words (final + any remaining interim) divided by calibration seconds, multiplied by 60.
6. The WPMResultCard displays the result with a large color-coded number and a gradient bar spanning 60-240 WPM. The bar is segmented into blue (below 120), green (120-180), and red (above 180) zones. A triangle marker indicates the user's position. A word-count breakdown shows the arithmetic.
7. If the result is outside the "good" range, a "Try Again" button appears. Retrying triggers a 3-2-1 lead-in countdown (via useLeadIn) before the next recording begins, giving the speaker time to prepare.
8. The calibrated WPM is saved to session storage. The "Next" button navigates to the session page.

## Takes System

Each recording in the session produces a "take." When the user clicks Stop, the MediaRecorder finalizes and produces a blob URL. The session page saves the current transcript snapshot and audio URL as a Take object with an incrementing number.

Completed takes appear in the right panel as expandable TakeCard components. Each card shows the take number, word count, and off-script word count in the collapsed header. Expanding reveals the full transcript (with off-script words highlighted in purple), an HTML audio player, and a download button that saves the recording as a .webm file. The latest take auto-expands.

After completing a take, the Record button relabels to "Take N+1." Each new recording starts fresh: the RSVP engine resets all word states, the Deepgram connection reopens, and a lead-in countdown plays before recording begins.

## Edge Cases Handled

**User pauses mid-speech.** The silence timeout (4 seconds with no Deepgram results while the gap exceeds 2 words) triggers a rewind to confirmed position. The display enters a drifting state with pulsing animation. When the user resumes speaking, new confirmations clear the drift and the display resumes.

**User speaks faster than the WPM timer.** If confirmedIndex advances past displayIndex, the rAF loop snaps displayIndex forward to match. The speaker never sees a word they have already passed.

**Common-word false re-sync.** The 3-consecutive-sequential-match requirement prevents single-word coincidences from falsely re-syncing. A match at a non-sequential position resets the counter entirely.

**Tab blur.** The rAF delta is clamped to 2x the per-word interval. If the browser throttles requestAnimationFrame while the tab is hidden, the display advances by at most one extra word when the tab returns, rather than trying to catch up the entire elapsed time.

**Short scripts.** The effective drift threshold scales down to half the script length (with a floor of 3), preventing the threshold from exceeding the total number of words.

**Rapid start/stop.** The session page gates Deepgram connection on the stream reference changing, preventing duplicate connections. The useDeepgram hook cleans up the WebSocket and MediaRecorder on stop and on unmount.

## Connection Status Indicator

The ConnectionStatus component displays a colored dot and label reflecting the Deepgram WebSocket state: gray "Disconnected" when idle, amber "Connecting..." during the handshake, green "Connected" with a glow when streaming, and red "Error" if the connection fails. It appears in the top-left corner of both the calibration and session screens.

## Editable WPM Control

The session screen exposes the target WPM as an editable number input (range 60-300) in the top-left corner next to the connection indicator. Changing the value immediately adjusts the rAF loop's milliseconds-per-word calculation because the targetWPM prop flows into the useRSVP hook's useEffect dependency array, tearing down and recreating the animation loop with the new timing.
