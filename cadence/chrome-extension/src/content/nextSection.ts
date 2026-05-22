/**
 * Heuristic "find next block of readable text" for auto-advance.
 *
 * Strategy: from the last node of the current range, find the nearest
 * block-level ancestor (a paragraph, list item, heading, etc.). Walk the
 * document forward from there, looking for the next block element that
 * (a) is visible, (b) contains substantial text, and (c) isn't part of
 * page chrome like nav/footer/aside.
 *
 * Returns a Range that spans the found block's text, or null if nothing
 * suitable was found before the document end.
 */

const BLOCK_TAGS = new Set([
  'P', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'PRE', 'TD', 'DT', 'DD', 'FIGCAPTION', 'ARTICLE', 'SECTION',
]);

const SKIP_ANCESTOR_TAGS = new Set([
  'NAV', 'FOOTER', 'ASIDE', 'HEADER', 'FORM', 'BUTTON',
]);

const MIN_TEXT_LENGTH = 20;

export function findNextSection(currentRange: Range): Range | null {
  const startNode = nearestBlock(currentRange.endContainer);
  if (!startNode) return null;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        const el = node as Element;
        if (!BLOCK_TAGS.has(el.tagName)) return NodeFilter.FILTER_SKIP;
        if (isInsideSkipped(el)) return NodeFilter.FILTER_REJECT;
        if (!isVisible(el)) return NodeFilter.FILTER_REJECT;
        const text = (el.textContent ?? '').trim();
        if (text.length < MIN_TEXT_LENGTH) return NodeFilter.FILTER_SKIP;
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  // Position the walker past the current block.
  walker.currentNode = startNode;
  let node = walker.nextNode();

  // If nextNode walked back into our own block (because of how currentNode works
  // when the start node itself matched), skip it.
  while (node && (node === startNode || startNode.contains(node))) {
    node = walker.nextNode();
  }

  if (!node) return null;
  const range = document.createRange();
  range.selectNodeContents(node);
  return range;
}

function nearestBlock(node: Node): Element | null {
  let el: Node | null = node;
  // Climb to the first Element if we got a text node.
  while (el && el.nodeType !== Node.ELEMENT_NODE) el = el.parentNode;
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    if (BLOCK_TAGS.has((el as Element).tagName)) return el as Element;
    el = (el as Element).parentElement;
  }
  return null;
}

function isInsideSkipped(el: Element): boolean {
  let cur: Element | null = el;
  while (cur) {
    if (SKIP_ANCESTOR_TAGS.has(cur.tagName)) return true;
    // role="navigation" / "contentinfo" etc.
    const role = cur.getAttribute('role');
    if (role && (role === 'navigation' || role === 'contentinfo' || role === 'banner')) {
      return true;
    }
    cur = cur.parentElement;
  }
  return false;
}

function isVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none') return false;
  if (parseFloat(style.opacity) === 0) return false;
  return true;
}
