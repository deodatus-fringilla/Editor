import { safeUrl } from '../markdown/escape';
import { renderMarkdown, type RenderOptions } from '../markdown/render';
import { normalizeRoot } from './normalize';

/** Elements removed together with everything inside them. */
const DROP = new Set([
	'SCRIPT',
	'STYLE',
	'META',
	'LINK',
	'HEAD',
	'TITLE',
	'NOSCRIPT',
	'IFRAME',
	'OBJECT',
	'EMBED',
	'TEMPLATE',
	'SVG',
	'IMG',
	'PICTURE',
	'VIDEO',
	'AUDIO',
	'CANVAS',
	'FORM',
	'INPUT',
	'BUTTON',
	'SELECT',
	'TEXTAREA',
	'FIGURE'
]);

/** Block elements and what they become. Anything not listed is looked through (its text and inline marks survive). */
const BLOCK: Record<string, string> = {
	P: 'p',
	DIV: 'p',
	SECTION: 'p',
	ARTICLE: 'p',
	PRE: 'p',
	TD: 'p',
	TH: 'p',
	DT: 'p',
	DD: 'p',
	FIGCAPTION: 'p',
	H1: 'h2',
	H2: 'h2',
	H3: 'h3',
	H4: 'h4',
	H5: 'h4',
	H6: 'h4',
	BLOCKQUOTE: 'blockquote',
	HR: 'hr',
	UL: 'ul',
	OL: 'ol',
	LI: 'li'
};

const hasBlockChild = (el: Element) => Array.from(el.children).some((c) => c.tagName in BLOCK);

function weight(el: HTMLElement): 'bold' | 'normal' | null {
	const w = el.style.fontWeight;
	if (!w) return null;
	return w === 'bold' || w === 'bolder' || Number(w) >= 600 ? 'bold' : 'normal';
}

const italic = (el: HTMLElement) => el.style.fontStyle === 'italic';

function wrap(doc: Document, tag: string, into: Node): HTMLElement {
	const w = doc.createElement(tag);
	into.appendChild(w);
	return w;
}

function copy(src: Node, into: Node, doc: Document): void {
	for (const n of Array.from(src.childNodes)) {
		if (n.nodeType === 3) {
			const text = (n.nodeValue ?? '').replace(/[\s\u00a0]+/g, ' ');
			if (text) into.appendChild(doc.createTextNode(text));
			continue;
		}
		if (n.nodeType !== 1) continue;
		const el = n as HTMLElement;
		const tag = el.tagName;
		if (DROP.has(tag) || /mso-list:\s*ignore/i.test(el.getAttribute('style') ?? '')) continue;
		if (tag === 'BR') {
			into.appendChild(doc.createElement('br'));
			continue;
		}
		let target: Node = into;
		const w = weight(el);
		// Google Docs wraps a whole paste in <b style="font-weight:normal">: that is not bold.
		if ((tag === 'B' || tag === 'STRONG') && w !== 'normal') target = wrap(doc, 'strong', target);
		else if (tag !== 'B' && tag !== 'STRONG' && w === 'bold') target = wrap(doc, 'strong', target);
		if (tag === 'I' || tag === 'EM' || italic(el)) target = wrap(doc, 'em', target);
		if (tag === 'CODE' && el.parentElement?.tagName !== 'PRE') target = wrap(doc, 'code', target);
		if (tag === 'A') {
			// A relative link pointed into the page it was copied from, so only full addresses are kept.
			const href = safeUrl(el.getAttribute('href') ?? '');
			if (href && /^(https?|mailto):/i.test(href)) {
				const a = wrap(doc, 'a', target);
				a.setAttribute('href', href);
				target = a;
			}
		}
		if (tag === 'P' && isWordListItem(el)) {
			const li = wrap(doc, 'li', into);
			li.dataset.list = /^\s*(\d+|[a-z])[.)]\s/i.test(el.textContent ?? '') ? 'ol' : 'ul';
			copy(el, li, doc);
			if (li.firstChild?.nodeType === 3)
				li.firstChild.nodeValue = li.firstChild.nodeValue!.replace(WORD_MARKER, '');
			continue;
		}
		const block = BLOCK[tag];
		if (
			block &&
			!(tag === 'DIV' && hasBlockChild(el)) &&
			!(tag === 'SECTION' && hasBlockChild(el)) &&
			!(tag === 'ARTICLE' && hasBlockChild(el))
		) {
			target = wrap(doc, block, target);
			const start = tag === 'OL' ? Number(el.getAttribute('start')) : 0;
			if (start > 1) (target as HTMLElement).setAttribute('start', String(Math.floor(start)));
		}
		copy(el, target, doc);
	}
}

const WORD_MARKER = /^\s*(?:[·•o§▪–-]|\d+[.)]|[a-z][.)])\s+/i;

/** Word marks list paragraphs with `mso-list` or a MsoListParagraph class. */
const isWordListItem = (el: HTMLElement) =>
	/mso-list/i.test(el.getAttribute('style') ?? '') || /MsoListParagraph/i.test(el.className);

/** Gathers neighbouring Word list items into one list. */
function groupListItems(body: HTMLElement) {
	for (const li of Array.from(body.querySelectorAll<HTMLElement>('li[data-list]'))) {
		if (li.parentElement && /^(UL|OL)$/.test(li.parentElement.tagName)) continue;
		const kind = li.dataset.list!;
		const list = body.ownerDocument.createElement(kind);
		li.before(list);
		let cur: Element | null = li;
		while (cur && cur.tagName === 'LI' && (cur as HTMLElement).dataset.list === kind) {
			const next: Element | null = cur.nextElementSibling;
			delete (cur as HTMLElement).dataset.list;
			list.append(cur);
			cur = next;
		}
	}
}

/**
 * Pasted HTML (Word, Google Docs, web pages) reduced to what the editor knows: paragraphs, headings 2-4, quotes,
 * lists, bold, italic and safe links. Scripts, styles, classes, images and everything else are gone.
 */
export function sanitizeHtml(html: string): HTMLElement {
	const parsed = new DOMParser().parseFromString(html, 'text/html');
	const out = document.createElement('div');
	copy(parsed.body, out, document);
	groupListItems(out);
	normalizeRoot(out);
	return out;
}

/** Plain text is read as Markdown, the editor's own format. */
export function markdownToFragment(text: string, options: RenderOptions = {}): HTMLElement {
	const out = document.createElement('div');
	out.innerHTML = renderMarkdown(text, { ...options, mode: 'editor' });
	normalizeRoot(out);
	return out;
}
