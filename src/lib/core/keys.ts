import { leafOf, topBlockOf } from './dom';
import { offsetIn } from './domRuns';
import { currentRange, setRange } from './selection';
import { liftItems, convert } from '../commands/blocks';

const isEmpty = (el: Element) =>
	!el.textContent?.replace(/\u200b/g, '') && !el.querySelector('.mde-cite');

/** Enter on an empty quote paragraph or list item leaves the quote or list; a heading continues as a paragraph. */
export function handleEnter(root: HTMLElement, shift: boolean): boolean {
	const range = currentRange(root);
	if (!range?.collapsed) return false;
	const doc = root.ownerDocument;
	const leaf = leafOf(root, range.startContainer);
	if (!leaf) return false;

	if (shift) {
		const br = doc.createElement('br');
		range.insertNode(br);
		if (!br.nextSibling) br.after(doc.createElement('br'));
		setRange(doc, {
			node: br.parentNode!,
			offset: Array.prototype.indexOf.call(br.parentNode!.childNodes, br) + 1
		});
		return true;
	}

	if (leaf.tagName === 'LI' && isEmpty(leaf)) {
		const [p] = liftItems(leaf.parentElement!, [leaf], 'p');
		setRange(doc, { node: p, offset: 0 });
		return true;
	}

	if (leaf.tagName === 'P' && leaf.parentElement?.tagName === 'BLOCKQUOTE' && isEmpty(leaf)) {
		const quote = leaf.parentElement;
		const after = Array.from(quote.children).slice(Array.from(quote.children).indexOf(leaf) + 1);
		if (after.length) {
			const tail = quote.cloneNode(false) as HTMLElement;
			tail.append(...after);
			quote.after(tail);
		}
		quote.after(leaf);
		if (!quote.children.length) quote.remove();
		setRange(doc, { node: leaf, offset: 0 });
		return true;
	}

	if (/^H[2-4]$/.test(leaf.tagName)) {
		const p = doc.createElement('p');
		if (offsetIn(leaf, range.startContainer, range.startOffset) === 0 && !isEmpty(leaf)) {
			leaf.before(p);
			p.append(doc.createElement('br'));
			setRange(doc, { node: leaf, offset: 0 });
			return true;
		}
		const tail = doc.createRange();
		tail.setStart(range.startContainer, range.startOffset);
		tail.setEnd(leaf, leaf.childNodes.length);
		p.append(tail.extractContents());
		if (isEmpty(p)) p.replaceChildren(doc.createElement('br'));
		if (!leaf.hasChildNodes()) leaf.append(doc.createElement('br'));
		leaf.after(p);
		setRange(doc, { node: p, offset: 0 });
		return true;
	}
	return false;
}

/** Backspace at the start of a heading, list item or quote turns it into a plain paragraph first. */
export function handleBackspaceAtStart(root: HTMLElement): boolean {
	const range = currentRange(root);
	if (!range?.collapsed) return false;
	const leaf = leafOf(root, range.startContainer);
	if (!leaf || offsetIn(leaf, range.startContainer, range.startOffset) !== 0) return false;
	const doc = root.ownerDocument;

	if (/^H[2-4]$/.test(leaf.tagName)) {
		const p = convert(leaf, 'p');
		setRange(doc, { node: p, offset: 0 });
		return true;
	}
	if (leaf.tagName === 'LI') {
		const [p] = liftItems(leaf.parentElement!, [leaf], 'p');
		setRange(doc, { node: p, offset: 0 });
		return true;
	}
	const quote = leaf.parentElement;
	if (quote?.tagName === 'BLOCKQUOTE' && quote.firstElementChild === leaf) {
		quote.before(leaf);
		if (!quote.children.length) quote.remove();
		setRange(doc, { node: leaf, offset: 0 });
		return true;
	}
	return false;
}

/** The figure that Backspace (at the start of a block) or Delete (at its end) would delete, if any. */
export function figureNextToCaret(
	root: HTMLElement,
	key: 'Backspace' | 'Delete'
): HTMLElement | null {
	const range = currentRange(root);
	if (!range?.collapsed) return null;
	const leaf = leafOf(root, range.startContainer);
	const top = topBlockOf(root, range.startContainer);
	if (!leaf || leaf !== top) return null;
	const off = offsetIn(leaf, range.startContainer, range.startOffset);
	if (key === 'Backspace' && off === 0 && leaf.previousElementSibling?.tagName === 'FIGURE')
		return leaf.previousElementSibling as HTMLElement;
	const atEnd = isEmpty(leaf) || off === offsetIn(leaf, leaf, leaf.childNodes.length);
	if (key === 'Delete' && atEnd && leaf.nextElementSibling?.tagName === 'FIGURE')
		return leaf.nextElementSibling as HTMLElement;
	return null;
}

/** First figure inside a (non-collapsed) selection, which a delete or replace would remove. */
export function figureInSelection(root: HTMLElement): HTMLElement | null {
	const range = currentRange(root);
	if (!range || range.collapsed) return null;
	return (
		Array.from(root.querySelectorAll<HTMLElement>(':scope > figure')).find((f) =>
			range.intersectsNode(f)
		) ?? null
	);
}
