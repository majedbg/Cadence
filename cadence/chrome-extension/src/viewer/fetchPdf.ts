/**
 * Diagnose what a fetch() returned so we can produce a useful error message
 * instead of letting PDF.js fail with "Invalid PDF structure".
 *
 * The common failure mode: the server returns an HTML wrapper (login page,
 * a viewer interstitial, a "click here to download" page) instead of the raw
 * PDF bytes. PDF.js just reports the parse failure.
 */

export type FetchResultKind =
  | 'ok'
  | 'html-wrapper'
  | 'auth-required'
  | 'not-found'
  | 'server-error'
  | 'empty'
  | 'unknown-error';

export interface FetchResult {
  kind: FetchResultKind;
  message: string;
}

interface FetchSnapshot {
  status: number;
  contentType: string | null;
  byteLength: number;
  /** Caller can pre-sniff the first bytes for a `%PDF` signature. */
  looksLikePdf?: boolean;
}

export function interpretFetchResult(snap: FetchSnapshot): FetchResult {
  if (snap.status === 401 || snap.status === 403) {
    return {
      kind: 'auth-required',
      message: 'The PDF is behind authentication. Try the default Chrome viewer.',
    };
  }
  if (snap.status === 404) {
    return { kind: 'not-found', message: 'PDF not found (404).' };
  }
  if (snap.status >= 500) {
    return { kind: 'server-error', message: `Server error (${snap.status}).` };
  }
  if (snap.status !== 200) {
    return { kind: 'unknown-error', message: `Unexpected response (${snap.status}).` };
  }
  if (snap.byteLength === 0) {
    return { kind: 'empty', message: 'Server returned an empty response.' };
  }

  const ct = (snap.contentType ?? '').toLowerCase();
  if (ct.startsWith('application/pdf')) return { kind: 'ok', message: '' };
  // Some servers send octet-stream for PDFs. Accept if the body looks like a PDF.
  if (ct.startsWith('application/octet-stream') && snap.looksLikePdf) {
    return { kind: 'ok', message: '' };
  }
  // No content-type header at all but caller verified the magic bytes.
  if (!snap.contentType && snap.looksLikePdf) return { kind: 'ok', message: '' };

  if (ct.includes('text/html') || ct.includes('text/plain')) {
    return {
      kind: 'html-wrapper',
      message:
        'Server returned HTML instead of a PDF. The site may require login or block extension fetches.',
    };
  }

  return {
    kind: 'unknown-error',
    message: `Unexpected content type: ${snap.contentType ?? 'unknown'}.`,
  };
}

/**
 * Fetch a PDF with credentials, sniff the result, and return a typed outcome.
 * The caller passes the bytes to PDF.js via { data } if .kind === 'ok'.
 */
export async function fetchPdfBytes(url: string): Promise<
  | { kind: 'ok'; data: ArrayBuffer }
  | { kind: Exclude<FetchResultKind, 'ok'>; message: string }
> {
  let response: Response;
  try {
    response = await fetch(url, { credentials: 'include', redirect: 'follow' });
  } catch (e) {
    return {
      kind: 'unknown-error',
      message: `Network error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const buf = await response.arrayBuffer();
  const looksLikePdf = startsWithPdfMagic(buf);
  const snap: FetchSnapshot = {
    status: response.status,
    contentType: response.headers.get('content-type'),
    byteLength: buf.byteLength,
    looksLikePdf,
  };
  const result = interpretFetchResult(snap);
  if (result.kind === 'ok') return { kind: 'ok', data: buf };
  return { kind: result.kind, message: result.message };
}

function startsWithPdfMagic(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 5) return false;
  const v = new Uint8Array(buf, 0, 5);
  return v[0] === 0x25 && v[1] === 0x50 && v[2] === 0x44 && v[3] === 0x46 && v[4] === 0x2d;
}
