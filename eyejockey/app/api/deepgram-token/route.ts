/**
 * @file route.ts
 * @description Server-side API route that provides the Deepgram API key to
 *              the client. In production, this should create a scoped,
 *              short-lived token instead of returning the raw key.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'DEEPGRAM_API_KEY not set' },
      { status: 500 }
    );
  }
  // DEV-ONLY FALLBACK: In production, create a scoped short-lived key instead.
  return NextResponse.json({ key });
}
