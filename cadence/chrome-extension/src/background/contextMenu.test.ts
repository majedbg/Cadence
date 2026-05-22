import { describe, it, expect } from 'vitest';
import { pickPdfTargetFromClick } from './contextMenu';

describe('pickPdfTargetFromClick', () => {
  it('prefers linkUrl when it points at a PDF', () => {
    expect(
      pickPdfTargetFromClick({
        linkUrl: 'https://example.com/paper.pdf',
        pageUrl: 'https://example.com/index.html',
      }),
    ).toBe('https://example.com/paper.pdf');
  });

  it('falls back to pageUrl if linkUrl is not a PDF but pageUrl is', () => {
    expect(
      pickPdfTargetFromClick({
        linkUrl: 'https://example.com/other.html',
        pageUrl: 'https://example.com/paper.pdf',
      }),
    ).toBe('https://example.com/paper.pdf');
  });

  it('returns null when neither is a PDF', () => {
    expect(
      pickPdfTargetFromClick({
        linkUrl: 'https://example.com/other.html',
        pageUrl: 'https://example.com/index.html',
      }),
    ).toBe(null);
  });

  it('handles missing fields', () => {
    expect(pickPdfTargetFromClick({ pageUrl: 'https://example.com/foo.pdf' })).toBe(
      'https://example.com/foo.pdf',
    );
    expect(pickPdfTargetFromClick({})).toBe(null);
  });
});
