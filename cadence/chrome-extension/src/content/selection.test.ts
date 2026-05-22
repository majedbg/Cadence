import { describe, it, expect, beforeEach } from 'vitest';
import { tokeniseSelection } from './selection';

/**
 * PDF.js renders text as absolutely-positioned <span>s inside a .textLayer
 * div. Each span typically holds a few words (sometimes a whole line). We
 * verify that tokeniseSelection produces correct tokens when the selection
 * Range spans multiple of these spans.
 */
function buildTextLayer(lines: string[]): HTMLDivElement {
  const layer = document.createElement('div');
  layer.className = 'textLayer';
  for (const line of lines) {
    const span = document.createElement('span');
    span.textContent = line;
    layer.appendChild(span);
  }
  document.body.appendChild(layer);
  return layer;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('tokeniseSelection on a PDF.js-shaped text layer', () => {
  it('tokenises a single-span selection', () => {
    const layer = buildTextLayer(['The quick brown fox']);
    const range = document.createRange();
    range.selectNodeContents(layer.firstChild!);

    const tokens = tokeniseSelection(range);
    expect(tokens.map((t) => t.original)).toEqual(['The', 'quick', 'brown', 'fox']);
  });

  it('tokenises a selection spanning multiple sibling spans', () => {
    const layer = buildTextLayer(['Hello world', 'on the next', 'line of text.']);
    const range = document.createRange();
    range.setStart(layer.children[0].firstChild!, 0);
    range.setEnd(
      layer.children[2].firstChild!,
      layer.children[2].textContent!.length,
    );

    const tokens = tokeniseSelection(range);
    expect(tokens.map((t) => t.original)).toEqual([
      'Hello', 'world', 'on', 'the', 'next', 'line', 'of', 'text.',
    ]);
  });

  it('respects partial selection inside a span', () => {
    const layer = buildTextLayer(['The quick brown fox jumps over']);
    const textNode = layer.firstChild!.firstChild! as Text;
    const range = document.createRange();
    // Start mid-word: skip "The " (4 chars), end after "fox" (4+15=19 chars).
    range.setStart(textNode, 4);
    range.setEnd(textNode, 19);

    const tokens = tokeniseSelection(range);
    expect(tokens.map((t) => t.original)).toEqual(['quick', 'brown', 'fox']);
  });

  it('each token carries a Range pointing to that word', () => {
    const layer = buildTextLayer(['alpha beta gamma']);
    const range = document.createRange();
    range.selectNodeContents(layer.firstChild!);

    const tokens = tokeniseSelection(range);
    expect(tokens[0].range.toString()).toBe('alpha');
    expect(tokens[1].range.toString()).toBe('beta');
    expect(tokens[2].range.toString()).toBe('gamma');
  });

  it('returns empty for an all-whitespace selection', () => {
    const layer = buildTextLayer(['   \n  ']);
    const range = document.createRange();
    range.selectNodeContents(layer.firstChild!);
    expect(tokeniseSelection(range)).toEqual([]);
  });

  it('stops at endContainer when it is an element (whole-page selection)', () => {
    // Simulates a "select whole document" Range from one text layer to another.
    document.body.innerHTML = '';
    const layer1 = buildTextLayer(['first page text']);
    const layer2 = buildTextLayer(['second page text']);
    // Add trailing content that must NOT be included.
    const after = document.createElement('div');
    after.textContent = 'should not appear';
    document.body.appendChild(after);

    const range = document.createRange();
    range.setStartBefore(layer1);
    range.setEndAfter(layer2);

    const tokens = tokeniseSelection(range).map((t) => t.original);
    expect(tokens).toEqual(['first', 'page', 'text', 'second', 'page', 'text']);
  });
});
