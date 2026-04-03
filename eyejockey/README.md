# EyeJockey

EyeJockey is an AI-powered teleprompter that uses real-time speech recognition to track your reading pace and advance the script accordingly. It combines Deepgram's streaming transcription with RSVP (Rapid Serial Visual Presentation) to help you maintain eye contact with the camera while reading.

## Prerequisites

- Node.js 18+
- A free Deepgram account (for the speech-to-text API key)

## Setup

```bash
# 1. Clone the repository
git clone <repo-url> && cd eyejockey

# 2. Copy the environment template
cp .env.local.example .env.local

# 3. Add your Deepgram API key to .env.local
#    Get one at https://console.deepgram.com

# 4. Install dependencies
npm install

# 5. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Where to get a Deepgram API key

1. Sign up at [https://console.deepgram.com](https://console.deepgram.com)
2. Create a new API key in your project dashboard
3. Paste it into your `.env.local` file as `DEEPGRAM_API_KEY`

## Known limitations

- **Local development only** — the API route returns the raw Deepgram key. In production, you would generate scoped short-lived tokens instead.
- **Chrome recommended** — MediaRecorder and WebSocket APIs have the best support in Chromium-based browsers. Safari and Firefox may exhibit inconsistent behaviour with audio encoding.
