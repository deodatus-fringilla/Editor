import { TOP_BLOCKS, isElement } from './dom';

const RENAME: Record<string, string> = { DIV: 'P', H1: 'H2', H5: 'H4', H6: 'H4' };
const BLOCKISH = /^(P|DIV|H[1-6]|BLOCKQUOTE|UL|OL|LI|FIGURE|TABLE)$/;

function rename(el: HTMLElement, tag: string): HTMLElement {
	const n = el.ownerDocument.createElement(tag);
	while (el.firstChild) n.append(el.firstChild);
	el.replaceWith(n);
	return n;
}

const isBlank = (n: Node) => n.nodeType === 3 && !(n.nodeValue ?? '').trim();

/** Wraps loose inline nodes in a paragraph, in place. */
function wrapLoose(parent: Element, nodes: Node[], tag: string) {
	const el = parent.ownerDocument.createElement(tag);
	nodes[0].before(el);
	for (const n of nodes) el.append(n);
}

function fixList(list: Element) {
	for (const child of Array.from(list.childNodes)) {
		if (isElement(child) && child.tagName === 'LI') continue;
		if (isBlank(child)) child.remove();
		else wrapLoose(list, [child], 'li');
	}
}

function fixQuote(q: Element) {
	let run: Node[] = [];
	const flush = () => {
		if (run.length && !run.every(isBlank)) wrapLoose(q, run, 'p');
		else run.forEach((n) => n.parentNode?.removeChild(n));
		run = [];
	};
	for (const child of Array.from(q.childNodes)) {
		if (isElement(child) && /^(P|H[2-4])$/.test(child.tagName)) flush();
		else if (isElement(child) && BLOCKISH.test(child.tagName)) {
			flush();
			rename(child, 'P');
		} else run.push(child);
	}
	flush();
}

/**
 * Brings the editing surface back to the shape the editor understands: only paragraphs, headings 2-4, quotes, lists
 * and figures at the top; loose text wrapped; foreign wrappers unwrapped; a stop for the caret before, between
 * and after figures; never empty.
 */
export function normalizeRoot(root: HTMLElement): void {
	for (let pass = 0; pass < 3; pass++) {
		let run: Node[] = [];
		const flush = () => {
			if (run.length && !run.every(isBlank)) wrapLoose(root, run, 'p');
			else run.forEach((n) => n.parentNode?.removeChild(n));
			run = [];
		};
		for (const child of Array.from(root.childNodes)) {
			if (!isElement(child) || !BLOCKISH.test(child.tagName)) {
				run.push(child);
				continue;
			}
			flush();
			let el: HTMLElement = child;
			if (el.tagName === 'DIV' && Array.from(el.children).some((c) => BLOCKISH.test(c.tagName))) {
				while (el.firstChild) el.before(el.firstChild);
				el.remove();
				continue;
			}
			if (RENAME[el.tagName]) el = rename(el, RENAME[el.tagName]);
			if (!TOP_BLOCKS.has(el.tagName)) el = rename(el, 'P');
			if (el.tagName === 'UL' || el.tagName === 'OL') fixList(el);
			else if (el.tagName === 'BLOCKQUOTE') fixQuote(el);
		}
		flush();
	}
	for (const leaf of Array.from(root.querySelectorAll('p, h2, h3, h4, li'))) {
		if (!leaf.closest('figure') && !leaf.hasChildNodes())
			leaf.append(leaf.ownerDocument.createElement('br'));
	}
	const stop = () => {
		const p = root.ownerDocument.createElement('p');
		p.append(root.ownerDocument.createElement('br'));
		return p;
	};
	for (const fig of Array.from(root.querySelectorAll(':scope > figure'))) {
		if (!fig.previousElementSibling || fig.previousElementSibling.tagName === 'FIGURE')
			fig.before(stop());
		if (!fig.nextElementSibling) fig.after(stop());
	}
	if (!root.firstChild) root.append(stop());
}
