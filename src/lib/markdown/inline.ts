import { escapeHtml, safeUrl } from './escape';

export interface InlineContext {
	mode: 'editor' | 'publish';
	/** Returns the HTML for a citation marker such as [[src:12]]. */
	cite: (kind: 'src' | 'quote', id: number) => string;
}

type Marker = '**' | '*' | '__' | '_';

const CITE = /^\[\[(src|quote):(\d{1,9})\]\]/;
const WORD = /[\p{L}\p{N}]/u;
const ESCAPABLE = /[!-/:-@[-`{-~]/;

/** Index just after the code span that starts at `j`, or -1 when the backticks are not closed. */
function skipCode(src: string, j: number): number {
	let n = 0;
	while (src[j + n] === '`') n++;
	const fence = '`'.repeat(n);
	let end = src.indexOf(fence, j + n);
	while (end >= 0 && src[end + n] === '`') end = src.indexOf(fence, end + n + 1);
	return end < 0 ? -1 : end + n;
}

/** Index of the closing `marker` for an opening at `from`, or -1. Skips escapes and nested star runs. */
function findClose(src: string, from: number, marker: Marker): number {
	for (let j = from; j < src.length; j++) {
		const c = src[j];
		if (c === '\\') {
			j++;
			continue;
		}
		// Markers inside inline code do not count.
		if (c === '`') {
			const after = skipCode(src, j);
			if (after > 0) j = after - 1;
			continue;
		}
		if (marker === '_' || marker === '__') {
			if (c !== '_') continue;
			let k = 0;
			while (src[j + k] === '_') k++;
			const after = /[\p{L}\p{N}]/u.test(src[j + k] ?? '');
			if (!after && marker === '_' && k !== 2) return j + k - 1;
			if (!after && marker === '__' && k >= 2) return j + k - 2;
			j += k - 1;
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
		else if (src[j] === '`') {
			const after = skipCode(src, j);
			if (after > 0) j = after - 1;
		} else if (src[j] === ']') return j;
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
	ctx: InlineContext,
	find: (from: number, marker: '[' | '(') => number
): { html: string; next: number } | null {
	const end = find(i + 1, '[');
	if (end < 0 || src[end + 1] !== '(') return null;
	const close = find(end + 2, '(');
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
	// Once a search for a closing marker fails from some position, it fails from every later one too: remembering that
	// keeps a long paragraph full of unmatched stars or brackets linear instead of quadratic.
	const failedFrom: Record<string, number> = {};
	// (Not for `(`: a later start can still find a `)` that an earlier `(` had paired with.)
	const close = (from: number, marker: Marker | '[' | '(') => {
		if (marker === '(') return findParenEnd(src, from);
		if (from >= (failedFrom[marker] ?? Infinity)) return -1;
		const j = marker === '[' ? findBracketEnd(src, from - 1) : findClose(src, from, marker);
		if (j < 0) failedFrom[marker] = Math.min(failedFrom[marker] ?? Infinity, from);
		return j;
	};
	while (i < src.length) {
		const c = src[i];
		if (c === '\\') {
			const n = src[i + 1];
			if (n === '\n') {
				out += '<br>';
				i += 2;
			} else if (n !== undefined && ESCAPABLE.test(n)) {
				out += escapeHtml(n);
				i += 2;
			} else {
				out += '\\';
				i++;
			}
			continue;
		}
		if (c === '`') {
			let n = 0;
			while (src[i + n] === '`') n++;
			const after = skipCode(src, i);
			if (after < 0) {
				out += '`'.repeat(n);
				i += n;
				continue;
			}
			const end = after - n;
			let code = src.slice(i + n, end).replace(/\n/g, ' ');
			if (/^ .*[^ ].* $/.test(code)) code = code.slice(1, -1);
			out += `<code>${escapeHtml(code)}</code>`;
			i = end + n;
			continue;
		}
		if (c === '\n') {
			out += ' ';
			i++;
		} else if (c === '[' && src[i + 1] === '[' && CITE.test(src.slice(i, i + 24))) {
			const m = CITE.exec(src.slice(i, i + 24))!;
			out += ctx.cite(m[1] as 'src' | 'quote', Number(m[2]));
			i += m[0].length;
		} else {
			const wordBefore = WORD.test(src[i - 1] ?? '');
			const marker: Marker | null = src.startsWith('**', i)
				? '**'
				: c === '*'
					? '*'
					: c === '_' && !wordBefore
						? src.startsWith('__', i)
							? '__'
							: '_'
						: null;
			if (marker) {
				const j = close(i + marker.length, marker);
				const inner = j > 0 ? src.slice(i + marker.length, j) : '';
				if (j > 0 && valid(inner)) {
					const tag = marker.length === 2 ? 'strong' : 'em';
					out += `<${tag}>${renderInline(inner, ctx)}</${tag}>`;
					i = j + marker.length;
					continue;
				}
			}
			const link = c === '[' ? renderLink(src, i, ctx, close) : null;
			if (link) {
				out += link.html;
				i = link.next;
			} else {
				out += escapeHtml(c);
				i++;
			}
		}
	}
	return out;
}
