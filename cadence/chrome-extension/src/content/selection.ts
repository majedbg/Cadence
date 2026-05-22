import type { WordToken } from '../lib/types';
import { estimateSyllables, extractPunctuation } from '../lib/textUtils';

/**
 * Walk text nodes inside a selection Range and produce one WordToken per
 * whitespace-delimited word. Each token gets its own sub-Range that points
 * at exactly that word in the live DOM, so we can call getBoundingClientRect()
 * on it later (e.g. after scroll/resize) without keeping stale coordinates.
 *
 * Handles three Range shapes:
 *   1. range entirely inside one text node (e.g. user drag-selecting mid-word)
 *   2. range = selectNodeContents on an element
 *   3. range crosses sibling/descendant text nodes (common multi-span case,
 *      including PDF.js text layers)
 */
export function tokeniseSelection(range: Range): WordToken[] {
  const tokens: WordToken[] = [];
  let tokenIndex = 0;
  const wordRe = /\S+/g;

  for (const textNode of textNodesInRange(range)) {
    let startOffset = 0;
    let endOffset = textNode.data.length;
    if (textNode === range.startContainer) startOffset = range.startOffset;
    if (textNode === range.endContainer) endOffset = range.endOffset;

    const segment = textNode.data.slice(startOffset, endOffset);
    wordRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = wordRe.exec(segment)) !== null) {
      const wordStart = startOffset + m.index;
      const wordEnd = wordStart + m[0].length;

      const wordRange = document.createRange();
      wordRange.setStart(textNode, wordStart);
      wordRange.setEnd(textNode, wordEnd);

      tokens.push({
        index: tokenIndex++,
        original: m[0],
        punctuation: extractPunctuation(m[0]),
        syllables: estimateSyllables(m[0]),
        range: wordRange,
      });
    }
  }

  return tokens;
}

function* textNodesInRange(range: Range): Generator<Text> {
  // Special-case: range entirely within one text node. (Element-typed
  // boundaries are handled by the general path below — startContainer ===
  // endContainer doesn't necessarily mean selectNodeContents; e.g.
  // setStartBefore/setEndAfter can produce same-parent ranges that don't
  // span the whole element.)
  if (
    range.startContainer === range.endContainer &&
    range.startContainer.nodeType === Node.TEXT_NODE
  ) {
    yield range.startContainer as Text;
    return;
  }

  // General path: gather all text descendants of the common ancestor in
  // document order, then yield only the slice that lies between the range's
  // actual boundary points.
  const root = range.commonAncestorContainer;
  const walkRoot =
    root.nodeType === Node.ELEMENT_NODE
      ? (root as Element)
      : ((root.parentNode ?? root) as Node);

  const all: Text[] = [];
  collectTextNodes(walkRoot, all);

  const startIdx = resolveStartIdx(range, all);
  const endIdx = resolveEndIdx(range, all);
  for (let i = startIdx; i <= endIdx && i < all.length && i >= 0; i++) {
    yield all[i];
  }
}

function resolveStartIdx(range: Range, all: Text[]): number {
  const sc = range.startContainer;
  if (sc.nodeType === Node.TEXT_NODE) {
    return all.indexOf(sc as Text);
  }
  const startEl = sc as Element;
  const firstChild = startEl.childNodes[range.startOffset] ?? null;
  if (!firstChild) return all.length; // range starts past the last child
  for (let i = 0; i < all.length; i++) {
    if (
      all[i] === firstChild ||
      (firstChild.nodeType === Node.ELEMENT_NODE &&
        (firstChild as Element).contains(all[i]))
    ) {
      return i;
    }
  }
  return all.length;
}

function resolveEndIdx(range: Range, all: Text[]): number {
  const ec = range.endContainer;
  if (ec.nodeType === Node.TEXT_NODE) {
    return all.indexOf(ec as Text);
  }
  if (range.endOffset === 0) return -1;
  const endEl = ec as Element;
  const lastChild = endEl.childNodes[range.endOffset - 1] ?? null;
  if (!lastChild) return -1;
  for (let i = all.length - 1; i >= 0; i--) {
    if (
      all[i] === lastChild ||
      (lastChild.nodeType === Node.ELEMENT_NODE &&
        (lastChild as Element).contains(all[i]))
    ) {
      return i;
    }
  }
  return -1;
}

function collectTextNodes(root: Node, out: Text[]): void {
  // Depth-first, skipping non-rendering subtrees.
  for (let child = root.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === Node.TEXT_NODE) {
      out.push(child as Text);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = (child as Element).tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;
      collectTextNodes(child, out);
    }
  }
}

export function getActiveSelectionRange(): Range | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  return sel.getRangeAt(0);
}
