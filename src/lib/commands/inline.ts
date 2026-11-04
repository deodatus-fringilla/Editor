import { totalLength, toggleFormat, setLink, formatsAt, type Run } from '../markdown/runs';
import { leafBlocks, leafOf } from '../core/dom';
import { domToRuns, offsetIn, positionAt, runsToDom } from '../core/domRuns';
import { currentRange, setRange } from '../core/selection';

export type CiteLabel = (kind: 'src' | 'quote', id: number) => string;

interface Item {
	block: HTMLElement;
	from: number;
	to: number;
}

/** The text blocks touched by the selection, each with the part of it that is selected. */
function selectedItems(root: HTMLElement, range: Range): Item[] {
	return leafBlocks(root)
		.filter((b) => range.intersectsNode(b))
		.map((block) => ({
			block,
			from: block.contains(range.startContainer)
				? offsetIn(block, range.startContainer, range.startOffset)
				: 0,
			to: block.contains(range.endContainer)
				? offsetIn(block, range.endContainer, range.endOffset)
				: totalLength(domToRuns(block))
		}));
}

/** Rewrites the runs of the given items and puts the selection back where it was. */
function rewrite(
	root: HTMLElement,
	range: Range,
	items: Item[],
	label: CiteLabel,
	fn: (runs: Run[], item: Item) => Run[]
) {
	const doc = root.ownerDocument;
	const sb = leafOf(root, range.startContainer);
	const eb = leafOf(root, range.endContainer);
	const sOff = sb ? offsetIn(sb, range.startContainer, range.startOffset) : 0;
	const eOff = eb ? offsetIn(eb, range.endContainer, range.endOffset) : 0;
	for (const item of items) {
		const next = fn(domToRuns(item.block), item);
		item.block.replaceChildren(runsToDom(next, doc, label));
		if (!item.block.hasChildNodes()) item.block.append(doc.createElement('br'));
	}
	if (sb && eb) setRange(doc, positionAt(sb, sOff, 'start'), positionAt(eb, eOff, 'end'));
}

const ancestorOf = (node: Node, stop: Element, tags: string[]): HTMLElement | null => {
	for (let n: Node | null = node; n && n !== stop; n = n.parentNode) {
		if (n.nodeType === 1 && tags.includes((n as Element).tagName)) return n as HTMLElement;
	}
	return null;
};

const TAGS = { b: ['STRONG', 'B'], i: ['EM', 'I'] } as const;

/** Bold or italic with nothing selected: leave the formatting (splitting it at the caret) or start it. */
function toggleAtCaret(root: HTMLElement, range: Range, key: 'b' | 'i') {
	const doc = root.ownerDocument;
	const leaf = leafOf(root, range.startContainer);
	if (!leaf) return;
	const marker = doc.createTextNode('\u200b');
	const inside = ancestorOf(range.startContainer, leaf, [...TAGS[key]]);
	if (inside) {
		const tail = doc.createRange();
		tail.setStart(range.startContainer, range.startOffset);
		tail.setEnd(inside, inside.childNodes.length);
		const rest = inside.cloneNode(false) as HTMLElement;
		rest.append(tail.extractContents());
		inside.after(marker);
		if (rest.textContent) marker.after(rest);
		if (!inside.textContent) inside.remove();
	} else {
		const el = doc.createElement(key === 'b' ? 'strong' : 'em');
		el.append(marker);
		range.insertNode(el);
	}
	setRange(doc, { node: marker, offset: 1 });
}

export function toggleInline(root: HTMLElement, key: 'b' | 'i', label: CiteLabel): void {
	const range = currentRange(root);
	if (!range) return;
	if (range.collapsed) return toggleAtCaret(root, range, key);
	const items = selectedItems(root, range).filter((i) => i.from < i.to);
	const allOn =
		items.length > 0 && items.every((i) => formatsAt(domToRuns(i.block), i.from, i.to)[key]);
	rewrite(root, range, items, label, (runs, i) => toggleFormat(runs, i.from, i.to, key, !allOn));
}

/** The link under the caret or covering the whole selection, if any. */
export function linkAtSelection(root: HTMLElement): { href: string; text: string } | null {
	const range = currentRange(root);
	if (!range) return null;
	const leaf = leafOf(root, range.startContainer);
	const a = leaf && ancestorOf(range.startContainer, leaf, ['A']);
	if (a && (range.collapsed || a.contains(range.endContainer)))
		return { href: a.getAttribute('href') ?? '', text: a.textContent ?? '' };
	return null;
}

export function selectedText(root: HTMLElement): string {
	const r = currentRange(root);
	return r && !r.collapsed ? r.toString() : '';
}

/** Sets the link on the selection (or on the link under the caret); `null` removes it. */
export function applyLink(root: HTMLElement, href: string | null, label: CiteLabel): void {
	const range = currentRange(root);
	if (!range) return;
	const doc = root.ownerDocument;
	const leaf = leafOf(root, range.startContainer);
	const a = leaf && ancestorOf(range.startContainer, leaf, ['A']);
	if (range.collapsed || (a && a.contains(range.endContainer))) {
		if (a && leaf) {
			const from = offsetIn(leaf, a, 0);
			const item = { block: leaf, from, to: from + totalLength(domToRuns(a)) };
			return rewrite(root, range, [item], label, (runs) => setLink(runs, item.from, item.to, href));
		}
		if (href && leaf) {
			const link = doc.createElement('a');
			link.setAttribute('href', href);
			link.textContent = href;
			range.insertNode(link);
			setRange(doc, { node: link, offset: 1 });
		}
		return;
	}
	const items = selectedItems(root, range).filter((i) => i.from < i.to);
	rewrite(root, range, items, label, (runs, i) => setLink(runs, i.from, i.to, href));
}

export interface ActiveInline {
	bold: boolean;
	italic: boolean;
	link: boolean;
}

export function activeInline(root: HTMLElement): ActiveInline {
	const none = { bold: false, italic: false, link: false };
	const range = currentRange(root);
	const leaf = range && leafOf(root, range.startContainer);
	if (!range || !leaf) return none;
	if (range.collapsed) {
		return {
			bold: !!ancestorOf(range.startContainer, leaf, [...TAGS.b]),
			italic: !!ancestorOf(range.startContainer, leaf, [...TAGS.i]),
			link: !!ancestorOf(range.startContainer, leaf, ['A'])
		};
	}
	const items = selectedItems(root, range).filter((i) => i.from < i.to);
	const f = items.map((i) => formatsAt(domToRuns(i.block), i.from, i.to));
	return {
		bold: f.length > 0 && f.every((x) => x.b),
		italic: f.length > 0 && f.every((x) => x.i),
		link: f.length > 0 && f.every((x) => !!x.a)
	};
}
