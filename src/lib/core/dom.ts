/** Shared DOM facts about the editing surface. */

export const LEAF = 'p, h2, h3, h4, li';
export const TOP_BLOCKS = new Set([
	'P',
	'H2',
	'H3',
	'H4',
	'BLOCKQUOTE',
	'UL',
	'OL',
	'FIGURE',
	'HR',
	'PRE'
]);

/** Blocks that are one piece: an image, a separator line, a kept table or code block. The caret goes around them. */
export const isAtomic = (el: Element | null | undefined) =>
	!!el &&
	(el.tagName === 'FIGURE' ||
		el.tagName === 'HR' ||
		(el.tagName === 'PRE' && el.classList.contains('mde-raw')));

export const isElement = (n: Node | null | undefined): n is HTMLElement => !!n && n.nodeType === 1;

/** Paragraphs, headings and list items: the blocks that directly hold text. */
export function leafBlocks(root: Element): HTMLElement[] {
	return Array.from(root.querySelectorAll<HTMLElement>(LEAF)).filter((el) => !el.closest('figure'));
}

/** The child of `root` that contains `node`. */
export function topBlockOf(root: Element, node: Node | null): HTMLElement | null {
	let n: Node | null = node;
	while (n && n.parentNode !== root) n = n.parentNode;
	return isElement(n) ? n : null;
}

/** The nearest leaf block around a node, if it is inside the root. */
export function leafOf(root: Element, node: Node | null): HTMLElement | null {
	const el = isElement(node) ? node : (node?.parentElement ?? null);
	const leaf = el?.closest<HTMLElement>(LEAF) ?? null;
	return leaf && root.contains(leaf) ? leaf : null;
}
