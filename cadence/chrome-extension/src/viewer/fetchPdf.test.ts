import { describe, it, expect } from 'vitest';
import { interpretFetchResult } from './fetchPdf';

describe('interpretFetchResult', () => {
  it('accepts an application/pdf response with bytes', () => {
    const r = interpretFetchResult({ status: 200, contentType: 'application/pdf', byteLength: 50_000 });
    expect(r.kind).toBe('ok');
  });

  it('accepts pdf with charset or trailing params', () => {
    const r = interpretFetchResult({ status: 200, contentType: 'application/pdf; charset=binary', byteLength: 10_000 });
    expect(r.kind).toBe('ok');
  });

  it('accepts when content-type is missing but bytes start with %PDF (caller hint)', () => {
    const r = interpretFetchResult({ status: 200, contentType: null, byteLength: 10_000, looksLikePdf: true });
    expect(r.kind).toBe('ok');
  });

  it('flags HTML responses as html-wrapper', () => {
    const r = interpretFetchResult({ status: 200, contentType: 'text/html; charset=utf-8', byteLength: 5000 });
    expect(r.kind).toBe('html-wrapper');
    expect(r.message).toMatch(/HTML/i);
  });

  it('flags 401/403 as auth-required', () => {
    expect(interpretFetchResult({ status: 401, contentType: null, byteLength: 0 }).kind).toBe('auth-required');
    expect(interpretFetchResult({ status: 403, contentType: null, byteLength: 0 }).kind).toBe('auth-required');
  });

  it('flags 404 as not-found', () => {
    expect(interpretFetchResult({ status: 404, contentType: null, byteLength: 0 }).kind).toBe('not-found');
  });

  it('flags 5xx as server-error', () => {
    expect(interpretFetchResult({ status: 502, contentType: null, byteLength: 0 }).kind).toBe('server-error');
  });

  it('flags zero-byte 200 as empty', () => {
    const r = interpretFetchResult({ status: 200, contentType: 'application/pdf', byteLength: 0 });
    expect(r.kind).toBe('empty');
  });
});
