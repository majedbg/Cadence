# Tradeoffs

## Why Deepgram over AssemblyAI and Web Speech API

Deepgram's Nova-2 model provides word-level timestamps with each streaming result, which is essential for mapping spoken words back to script positions in real time. AssemblyAI's real-time API has comparable accuracy but higher tail latency on interim results. The Web Speech API (SpeechRecognition) is free and requires no API key, but it provides no word-level timestamps, has inconsistent cross-browser support, and offers no control over the recognition model — making precise script tracking impossible.

## Why RSVP over scrolling prose

Traditional teleprompters scroll a block of text at a constant speed. This forces the reader's eyes to track a moving target, introducing saccadic eye movement that pulls gaze away from the camera. RSVP (Rapid Serial Visual Presentation) displays one word at a time in a fixed position near the webcam, eliminating saccades entirely. The reader's eyes stay locked on a single point, producing more natural-looking eye contact on camera.

## Why no global state library

The app has three screens with minimal shared state (script text and WPM), which flows linearly from screen 1 to screen 3. SessionStorage is sufficient to pass these two values between routes. Adding Redux, Zustand, or Jotai would introduce dependency overhead, boilerplate, and cognitive load without meaningful benefit at this scope. If the app grew to include user accounts, saved sessions, or collaborative features, a state library would become justified.

## Why useRef for audio stream rather than useState

MediaStream objects are mutable handles to live hardware resources — they are not serializable and should not trigger re-renders when assigned. Storing them in useState would cause unnecessary render cycles every time the stream reference is set, and React's batching could lead to stale closures reading an outdated stream. useRef provides a stable container that the WebSocket and MediaRecorder callbacks can read synchronously without re-render overhead.

## Why kinematic extrapolation rather than waiting for each Deepgram packet

Deepgram delivers final transcription results in bursts roughly every 250-500ms, depending on network conditions and utterance boundaries. If the RSVP display only advanced on each Deepgram packet, the user would see a stuttery, stop-and-start word display. Kinematic extrapolation uses the known target WPM to predict where the reader should be between packets, producing smooth continuous word advancement. When the next Deepgram result arrives, the position snaps to the ground-truth index, correcting any drift.

## Why sessionStorage over URL params for script passing

The teleprompter script can be hundreds of words long. Encoding it as a URL query parameter would create unwieldy URLs that hit browser length limits (around 2,000-8,000 characters depending on browser), break copy-paste sharing, and expose content in server logs and browser history. SessionStorage keeps the data client-side, survives navigation within the tab, and is automatically cleared when the tab closes — matching the ephemeral, single-session nature of a teleprompter run.
