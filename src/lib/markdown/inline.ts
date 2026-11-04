import { escapeHtml, safeUrl } from './escape';

export interface InlineContext {
	mode: 'editor' | 'publish';
	/** Returns the HTML for a citation marker such as [[src:12]]. */
	cite: (kind: 'src' | 'quote', id: number) => string;
}

const CITE = /^\[\[(src|quote):(\d{1,9})\]\]/;
const ESCAPABLE = /[!-/:-@[-`{-~]/;

/** Index of the closing `marker` for an opening at `from`, or -1. Skips escapes and nested star runs. */
function findClose(src: string, from: number, marker: '**' | '*' | '_'): number {
	for (let j = from; j < src.length; j++) {
		const c = src[j];
		if (c === '\\') {
			j++;
			continue;
		}
		if (marker === '_') {
			if (c === '_' && !/[\p{L}\p{N}]/u.test(src[j + 1] ?? '')) return j;
			continue;
		}
		if (c !== '*') continue;
		let k = 0;
		while (src[j + k] === '*') k++;
		if (marker === '**' && k >= 2) return j + k - 2;
		if (marker === '*' && k === 1) return j;
		if (marker === '*' && k >= 3) return j + k - 1;
		j += k - 1;
	}
	return -1;
}

const valid = (inner: string) => inner.length > 0 && !/^\s|\s$/.test(inner);

/** Index of the `]` that closes the `[` at `from`, or -1. */
function findBracketEnd(src: string, from: number): number {
	for (let j = from + 1; j < src.length; j++) {
		if (src[j] === '\\') j++;
		else if (src[j] === ']') return j;
	}
	return -1;
}

/** Index of the `)` that ends a link address, allowing balanced parentheses inside it. */
function findParenEnd(src: string, from: number): number {
	let depth = 0;
	for (let j = from; j < src.length; j++) {
		if (src[j] === '(') depth++;
		else if (src[j] === ')' && depth-- === 0) return j;
	}
	return -1;
}

function renderLink(
	src: string,
	i: number,
	ctx: InlineContext
): { html: string; next: number } | null {
	const end = findBracketEnd(src, i);
	if (end < 0 || src[end + 1] !== '(') return null;
	const close = findParenEnd(src, end + 2);
	if (close < 0) return null;
	const text = renderInline(src.slice(i + 1, end), ctx);
	const href = safeUrl(src.slice(end + 2, close));
	if (!href) return { html: text, next: close + 1 };
	const external = /^(https?:)/i.test(href);
	const attrs =
		ctx.mode === 'publish' && external ? ' target="_blank" rel="noopener noreferrer nofollow"' : '';
	return { html: `<a href="${escapeHtml(href)}"${attrs}>${text}</a>`, next: close + 1 };
}

/** Inline Markdown to HTML. Raw HTML in the source is never passed through: it is shown as text. */
export function renderInline(src: string, ctx: InlineContext): string {
	let out = '';
	let i = 0;
	while (i < src.length) {
		const c = src[i];
		if (c === '\\') {
			const n = src[i + 1];
			if (n === '\n') ((out += '<br>'), (i += 2));
			else if (n !== undefined && ESCAPABLE.test(n)) ((out += escapeHtml(n)), (i += 2));
			else ((out += '\\'), i++);
			continue;
		}
		if (c === '\n') ((out += ' '), i++);
		else if (c === '[' && src[i + 1] === '[' && CITE.test(src.slice(i, i + 24))) {
			const m = CITE.exec(src.slice(i, i + 24))!;
			out += ctx.cite(m[1] as 'src' | 'quote', Number(m[2]));
			i += m[0].length;
		} else {
			const marker = src.startsWith('**', i)
				? '**'
				: c === '*'
					? '*'
					: c === '_' && !/[\p{L}\p{N}]/u.test(src[i - 1] ?? '')
						? '_'
						: null;
			if (marker) {
				const j = findClose(src, i + marker.length, marker);
				const inner = j > 0 ? src.slice(i + marker.length, j) : '';
				if (j > 0 && valid(inner)) {
					const tag = marker === '**' ? 'strong' : 'em';
					out += `<${tag}>${renderInline(inner, ctx)}</${tag}>`;
					i = j + marker.length;
					continue;
				}
			}
			const link = c === '[' ? renderLink(src, i, ctx) : null;
			if (link) ((out += link.html), (i = link.next));
			else ((out += escapeHtml(c)), i++);
		}
	}
	return out;
}
