import { isAtomic, leafBlocks, leafOf } from '../core/dom';
import { offsetIn, positionAt } from '../core/domRuns';
import { currentRange, setRange } from '../core/selection';

export type BlockKind = 'p' | 'h2' | 'h3' | 'h4';

// ---- keeping the selection while blocks are moved around ---------------------------------------------------------

function mark(root: HTMLElement, range: Range) {
	const sb = leafOf(root, range.startContainer);
	const eb = leafOf(root, range.endContainer);
	if (sb) sb.dataset.mdeS = String(offsetIn(sb, range.startContainer, range.startOffset));
	if (eb) eb.dataset.mdeE = String(offsetIn(eb, range.endContainer, range.endOffset));
}

function restore(root: HTMLElement) {
	const sb = root.querySelector<HTMLElement>('[data-mde-s]');
	const eb = root.querySelector<HTMLElement>('[data-mde-e]');
	if (sb && eb) {
		setRange(
			root.ownerDocument,
			positionAt(sb, Number(sb.dataset.mdeS), 'start'),
			positionAt(eb, Number(eb.dataset.mdeE), 'end')
		);
	}
	for (const el of root.querySelectorAll<HTMLElement>('[data-mde-s],[data-mde-e]')) {
		delete el.dataset.mdeS;
		delete el.dataset.mdeE;
	}
}

/** Changes an element's tag by moving its children (and selection markers) into a new element. */
export function convert(el: HTMLElement, tag: string): HTMLElement {
	if (el.tagName.toLowerCase() === tag) return el;
	const n = el.ownerDocument.createElement(tag);
	if (el.dataset.mdeS) n.dataset.mdeS = el.dataset.mdeS;
	if (el.dataset.mdeE) n.dataset.mdeE = el.dataset.mdeE;
	while (el.firstChild) n.append(el.firstChild);
	el.replaceWith(n);
	return n;
}

const isList = (el: Element) => el.tagName === 'UL' || el.tagName === 'OL';

/** Takes list items out of their list as blocks of `tag`, splitting the list around them. */
export function liftItems(list: HTMLElement, items: HTMLElement[], tag: string): HTMLElement[] {
	const kids = Array.from(list.children) as HTMLElement[];
	const first = kids.indexOf(items[0]);
	const last = kids.indexOf(items[items.length - 1]);
	const after = kids.slice(last + 1);
	const blocks = kids.slice(first, last + 1).map((li) => convert(li, tag));
	if (after.length) {
		const tail = list.cloneNode(false) as HTMLElement;
		tail.append(...after);
		list.after(tail);
	}
	let anchor: HTMLElement = list;
	for (const b of blocks) {
		anchor.after(b);
		anchor = b;
	}
	if (!list.children.length) list.remove();
	return blocks;
}

function mergeNeighbours(root: HTMLElement) {
	for (const el of Array.from(root.children)) {
		const prev = el.previousElementSibling;
		if (prev && prev.tagName === el.tagName && (isList(el) || el.tagName === 'BLOCKQUOTE')) {
			prev.append(...Array.from(el.childNodes));
			el.remove();
		}
	}
}

const affected = (root: HTMLElement, range: Range) =>
	(Array.from(root.children) as HTMLElement[]).filter((c) => range.intersectsNode(c));

function run(root: HTMLElement, fn: (range: Range) => void) {
	const range = currentRange(root);
	if (!range) return;
	mark(root, range);
	fn(range);
	mergeNeighbours(root);
	restore(root);
}

// ---- commands ----------------------------------------------------------------------------------------------------

/** Paragraph or heading 2-4 for the selected blocks. Choosing the heading you are already in goes back to paragraph. */
export function setBlockKind(root: HTMLElement, kind: BlockKind): void {
	run(root, (range) => {
		const leaves = leafBlocks(root).filter((b) => range.intersectsNode(b));
		const same = leaves.length > 0 && leaves.every((l) => l.tagName.toLowerCase() === kind);
		const target = same && kind !== 'p' ? 'p' : kind;
		const byList = new Map<HTMLElement, HTMLElement[]>();
		for (const leaf of leaves) {
			if (leaf.tagName === 'LI') {
				const list = leaf.parentElement!;
				byList.set(list, [...(byList.get(list) ?? []), leaf]);
			} else convert(leaf, target);
		}
		for (const [list, items] of byList) liftItems(list, items, target);
	});
}

export function toggleList(root: HTMLElement, kind: 'ul' | 'ol'): void {
	run(root, (range) => {
		const leaves = leafBlocks(root).filter((b) => range.intersectsNode(b));
		const allIn =
			leaves.length > 0 &&
			leaves.every((l) => l.tagName === 'LI' && l.parentElement!.tagName.toLowerCase() === kind);
		if (allIn) {
			const lists = new Map<HTMLElement, HTMLElement[]>();
			for (const l of leaves)
				lists.set(l.parentElement!, [...(lists.get(l.parentElement!) ?? []), l]);
			for (const [list, items] of lists) liftItems(list, items, 'p');
			return;
		}
		let group: HTMLElement[] = [];
		const flush = () => {
			if (!group.length) return;
			const list = root.ownerDocument.createElement(kind);
			group[0].before(list);
			for (const el of group) list.append(convert(el, 'li'));
			group = [];
		};
		for (const top of affected(root, range)) {
			if (/^(P|H[2-4])$/.test(top.tagName)) group.push(top);
			else {
				flush();
				if (isList(top)) convert(top, kind);
			}
		}
		flush();
	});
}

export function toggleQuote(root: HTMLElement): void {
	run(root, (range) => {
		const tops = affected(root, range).filter((t) => !isList(t) && !isAtomic(t));
		if (!tops.length) return;
		if (tops.every((t) => t.tagName === 'BLOCKQUOTE')) {
			for (const q of tops) {
				q.before(...Array.from(q.childNodes));
				q.remove();
			}
			return;
		}
		let group: HTMLElement[] = [];
		const flush = () => {
			if (!group.length) return;
			const q = root.ownerDocument.createElement('blockquote');
			group[0].before(q);
			for (const el of group) q.append(convert(el, 'p'));
			group = [];
		};
		for (const top of tops) {
			if (top.tagName === 'BLOCKQUOTE') flush();
			else group.push(top);
		}
		flush();
	});
}

export interface ActiveBlock {
	kind: BlockKind;
	list: 'ul' | 'ol' | null;
	quote: boolean;
}

export function activeBlock(root: HTMLElement): ActiveBlock {
	const range = currentRange(root);
	const leaf = range && leafOf(root, range.startContainer);
	if (!leaf) return { kind: 'p', list: null, quote: false };
	const inList = leaf.tagName === 'LI';
	return {
		kind: inList ? 'p' : (leaf.tagName.toLowerCase() as BlockKind),
		list: inList ? (leaf.parentElement!.tagName.toLowerCase() as 'ul' | 'ol') : null,
		quote: !!leaf.closest('blockquote')
	};
}
