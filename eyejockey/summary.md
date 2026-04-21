# EyeJockey -- Summary

EyeJockey is a browser-based teleprompter that displays one word at a time directly beneath the camera, so the speaker's eyes never move and they appear to be looking straight at their audience.

## Why RSVP Instead of Scrolling

Traditional teleprompters scroll text across the screen. The reader's eyes chase each line, jump back to the start of the next, and repeat -- a pattern called saccades. Viewers see the eye movement and recognize it as reading.

EyeJockey uses Rapid Serial Visual Presentation (RSVP): words appear one at a time in a fixed position. Because the eye stays still, there is nothing for the audience to detect. A smaller next-word preview sits just below the current word, giving the reader a split-second of preparation without requiring any lateral eye travel.

## Calibration

Before a session, the app measures the speaker's natural reading pace. The user reads a fixed passage aloud for ten seconds while Deepgram transcribes in real time. After the recording stops, a short drain period lets Deepgram finalize any pending words. WPM is calculated from total recognized words divided by elapsed time.

The result is shown on a gradient speed bar -- blue for slow, green for good, red for fast -- with threshold markers at 120 and 180 WPM. If the result falls outside the "good" range, a retry option appears with a 3-2-1 lead-in countdown so the speaker can settle before re-recording. The calibrated WPM is stored in session storage and carried into the session screen.

## The Session Experience

The session screen is a full-viewport dark interface. The RSVP word dominates the top of the screen. A narrow speed meter bar sits at the very top edge, shifting between blue, green, and red as the speaker's pace changes relative to their target WPM. The WPM target is editable via a number input in the top-left corner.

Below the RSVP display, the screen splits into two panels. The left panel shows the original script as flowing text with per-word coloring: confirmed words are bright white, the current word has a subtle highlight, unconfirmed words appear in amber, and future words are dim. The panel auto-scrolls to keep the current word centered. The right panel shows a live transcript during recording, or a list of completed takes when not recording.

A gear icon in the top-right opens a settings popover for adjusting punctuation delays -- per-character sliders for commas, periods, semicolons, question marks, and other punctuation, each controlling how long the display pauses after showing a word that ends with that mark.

## Off-Script Detection and Re-Sync

The engine tracks consecutive mismatches between Deepgram words and the script. After three consecutive unmatched words, it enters off-script mode: the display rewinds to the last confirmed position and shows a vertical stack of upcoming "runway" words in amber so the speaker can find their place.

Re-sync requires three consecutive sequential matches against the script. This threshold prevents false re-syncs from common words like "the" or "it" that could match by coincidence. Once three in a row confirm, the display snaps forward and resumes normal advancement.

## The Per-Word State Architecture

Every script word carries its own state: planned (not yet reached), displayed (shown by the timer but not yet confirmed by speech), confirmed (verified by Deepgram), or unconfirmed (displayed but later invalidated by drift or off-script detection). This lifecycle exists because the speech API lags 1-3 seconds behind actual speech. The teleprompter cannot wait for confirmation before advancing -- the reader would stare at a frozen word -- so it advances optimistically at the target WPM and reconciles when Deepgram catches up.

Drift detection monitors the gap between the display position and the confirmed position. If the gap exceeds 15 words, or if the gap exceeds 2 words and no Deepgram results have arrived for 4 seconds, the engine assumes the speaker has paused or stopped. It marks the unconfirmed words, rewinds the display to just past the last confirmed word, and enters a drifting state with a pulsing visual indicator until new confirmations arrive.

## Why These Thresholds

The drift threshold of 15 words is generous because Deepgram batches results with variable latency. At 140 WPM, 15 words represents roughly 6.5 seconds of reading -- enough to absorb normal API delays without triggering false rewinds. The 4-second silence timeout exceeds Deepgram's typical 1-2 second batch gap, so it only fires on genuine pauses. The 3-match re-sync requirement balances responsiveness (the speaker does not have to read far to re-sync) against reliability (random single-word matches from common words are ignored).

## Two-Tier State

The engine uses refs mutated at 60fps inside a requestAnimationFrame loop for authoritative state, then flushes a snapshot to React state every 100 milliseconds for rendering. This prevents React re-renders from interfering with the tight timing loop that drives word advancement and punctuation delays.
