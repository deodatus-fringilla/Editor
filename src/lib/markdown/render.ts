import { escapeHtml, isLocalImage, safeUrl } from './escape';
import { renderInline, type InlineContext } from './inline';

export interface RenderOptions {
	/** `editor` keeps citations as editable chips; `publish` gives readers numbered footnotes. */
	mode?: 'editor' | 'publish';
	/** Text shown for a citation, e.g. "Source 12". */
	citationLabel?: (kind: 'src' | 'quote', id: number) => string;
	/** Which image addresses may be shown. Default: only images from this site (addresses starting with `/`). */
	allowImage?: (src: string) => boolean;
	/** Prefix for footnote ids, so several articles can share one page. Default `cite`. */
	idPrefix?: string;
	/** Accessible name of the link from a footnote back to the text. Default `Back to text`. */
	backLabel?: string;
}

const defaultLabel = (kind: 'src' | 'quote', id: number) =>
	`${kind === 'src' ? 'Source' : 'Quote'} ${id}`;

const RE = {
	heading: /^(#{1,4}) +(.+?)\s*$/,
	// Indented (nested) items are kept, one level deep: the editor has flat lists only.
	ul: /^ {0,8}[-*+] +(.*)$/,
	ol: /^ {0,8}(?:\d{1,9})[.)] +(.*)$/,
	// Indented forms (inside a list item) are accepted too; the editor has no nesting, so they come out flat.
	quote: /^ {0,8}> ?(.*)$/,
	fence: /^( {0,8})(`{3,}|~{3,})/,
	hr: /^ {0,3}([-*_])( *\1){2,} *$/,
	setext: /^ {0,3}(=+|-+) *$/,
	tableDelim: /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/,
	image: /^!\[((?:[^\]\\]|\\.)*)\]\(([^\s)]+)(?: "((?:[^"\\]|\\.)*)")?\)(?:\{\.([a-z]+)\})?$/
};

const unescape = (s: string) => s.replace(/\\(.)/g, '$1');

export function citeChip(kind: 'src' | 'quote', id: number, label: string): string {
	return `<span class="mde-cite" data-cite="${kind}:${id}" contenteditable="false">${escapeHtml(label)}</span>`;
}

/** Where an image sits: centred (the default), floated left or right with text around it, or across the full width. */
export type Placement = 'center' | 'left' | 'right' | 'full';
export const PLACEMENTS: Placement[] = ['center', 'left', 'right', 'full'];

export function figureHtml(o: {
	src: string;
	alt: string;
	caption: string;
	place?: Placement;
	mode: 'editor' | 'publish';
}): string {
	// In the editor the whole figure is dragged (to move it), not the picture inside it.
	const extra = o.mode === 'publish' ? ' loading="lazy"' : ' draggable="false"';
	const img = `<img src="${escapeHtml(o.src)}" alt="${escapeHtml(o.alt)}"${extra}>`;
	const cap = o.caption ? `<figcaption>${escapeHtml(o.caption)}</figcaption>` : '';
	const place = o.place && o.place !== 'center' ? ` data-place="${o.place}"` : '';
	const attrs =
		o.mode === 'editor'
			? ' class="mde-figure" contenteditable="false" tabindex="0" draggable="true"'
			: '';
	return `<figure${attrs}${place}>${img}${cap}</figure>`;
}

const isTableStart = (lines: string[], i: number) =>
	lines[i].includes('|') && (lines[i + 1] ?? '').includes('|') && RE.tableDelim.test(lines[i + 1]);

function isBlockStart(lines: string[], i: number): boolean {
	const line = lines[i];
	return (
		RE.fence.test(line) ||
		RE.hr.test(line) ||
		isTableStart(lines, i) ||
		RE.heading.test(line) ||
		RE.ul.test(line) ||
		RE.ol.test(line) ||
		RE.quote.test(line) ||
		RE.image.test(line)
	);
}

const cells = (row: string) =>
	row
		.trim()
		.replace(/^\|/, '')
		.replace(/(?<!\\)\|$/, '')
		.split(/(?<!\\)\|/)
		.map((c) => c.trim());

/**
 * Content the editor cannot edit (a table, a code block) is kept exactly as written: in the editor as a locked box,
 * for readers rendered the way a Markdown renderer would.
 */
function rawBlock(
	raw: string,
	kind: 'table' | 'code' | 'image',
	mode: 'editor' | 'publish',
	inline: (s: string) => string
): string {
	if (mode === 'editor') {
		return `<pre class="mde-raw" contenteditable="false" data-kind="${kind}">${escapeHtml(raw)}</pre>`;
	}
	if (kind === 'image') {
		// Shown the way Lemiesz shows an image it will not embed: its description, as a link when the address is safe.
		const m = RE.image.exec(raw)!;
		const alt = escapeHtml(unescape(m[1]) || m[2]);
		const href = safeUrl(m[2]);
		return `<p>${href ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer nofollow" target="_blank">${alt}</a>` : alt}</p>`;
	}
	if (kind === 'code') {
		const body = raw.split('\n').slice(1);
		if (body.length && RE.fence.test(body[body.length - 1])) body.pop();
		return `<pre><code>${escapeHtml(body.join('\n'))}</code></pre>`;
	}
	const [head, , ...rows] = raw.split('\n');
	const tr = (r: string, tag: 'th' | 'td') =>
		`<tr>${cells(r)
			.map((c) => `<${tag}>${inline(c)}</${tag}>`)
			.join('')}</tr>`;
	return `<div class="table"><table><thead>${tr(head, 'th')}</thead><tbody>${rows.map((r) => tr(r, 'td')).join('')}</tbody></table></div>`;
}

/** Markdown to HTML. The same function feeds the editing surface and the publish preview. */
export function renderMarkdown(markdown: string, options: RenderOptions = {}): string {
	const mode = options.mode ?? 'publish';
	const label = options.citationLabel ?? defaultLabel;
	const allowImage = options.allowImage ?? isLocalImage;
	const prefix = options.idPrefix ?? 'cite';
	const back = escapeHtml(options.backLabel ?? 'Back to text');
	const cited: string[] = [];
	const ctx: InlineContext = {
		mode,
		cite(kind, id) {
			if (mode === 'editor') return citeChip(kind, id, label(kind, id));
			const key = `${kind}:${id}`;
			if (!cited.includes(key)) cited.push(key);
			const n = cited.indexOf(key) + 1;
			return `<sup class="cite"><a href="#${prefix}-${n}" id="${prefix}-ref-${n}">${n}</a></sup>`;
		}
	};
	const inline = (s: string) => renderInline(s, ctx);
	const html = blocks(markdown.replace(/\r\n?/g, '\n').split('\n'));

	function blocks(lines: string[]): string[] {
		const html: string[] = [];
		for (let i = 0; i < lines.length;) {
			const line = lines[i];
			let m: RegExpExecArray | null;
			if (!line.trim()) i++;
			else if ((m = RE.fence.exec(line))) {
				const close = new RegExp(`^ {0,8}${m[2][0] === '`' ? '`' : '~'}{${m[2].length},}\\s*$`);
				// Kept without the indentation it had inside a list item, so it stays a code block on its own.
				const indent = m[1].length;
				const strip = (l: string) => l.replace(new RegExp(`^ {0,${indent}}`), '');
				const raw = [strip(lines[i++])];
				while (i < lines.length) {
					raw.push(strip(lines[i]));
					if (close.test(lines[i++])) break;
				}
				html.push(rawBlock(raw.join('\n'), 'code', mode, inline));
			} else if (RE.hr.test(line)) {
				html.push('<hr>');
				i++;
			} else if (isTableStart(lines, i)) {
				const raw: string[] = [];
				while (i < lines.length && lines[i].trim() && lines[i].includes('|')) raw.push(lines[i++]);
				html.push(rawBlock(raw.join('\n'), 'table', mode, inline));
			} else if ((m = RE.heading.exec(line))) {
				const level = Math.max(2, m[1].length); // the article title lives elsewhere, so # counts as ##
				html.push(`<h${level}>${inline(m[2])}</h${level}>`);
				i++;
			} else if ((m = RE.image.exec(line)) && !(safeUrl(m[2]) && allowImage(safeUrl(m[2])!))) {
				// An image this page may not show is kept as written rather than lost.
				html.push(rawBlock(line, 'image', mode, inline));
				i++;
			} else if ((m = RE.image.exec(line))) {
				html.push(
					figureHtml({
						src: safeUrl(m[2])!,
						alt: unescape(m[1]),
						caption: unescape(m[3] ?? ''),
						place: PLACEMENTS.includes(m[4] as Placement) ? (m[4] as Placement) : undefined,
						mode
					})
				);
				i++;
			} else if (RE.ul.test(line) || RE.ol.test(line)) {
				const re = RE.ul.test(line) ? RE.ul : RE.ol;
				const other = re === RE.ul ? RE.ol : RE.ul;
				const items: string[] = [];
				const indented = (k: number) =>
					/^ {2,}\S/.test(lines[k]) &&
					!re.test(lines[k]) &&
					!other.test(lines[k]) &&
					!isBlockStart(lines, k);
				while (i < lines.length && (m = re.exec(lines[i]))) {
					const text = [m[1]];
					i++;
					// An item goes on over indented lines; a blank line followed by more indented text starts a new
					// paragraph in the item (kept as a line break), and blank lines between items keep one list.
					while (i < lines.length) {
						if (lines[i].trim() && indented(i)) {
							text.push(lines[i++].trim());
							continue;
						}
						if (lines[i].trim()) break;
						let k = i;
						while (k < lines.length && !lines[k].trim()) k++;
						if (k < lines.length && indented(k)) {
							text[text.length - 1] += '\\';
							i = k;
						} else {
							if (k < lines.length && re.test(lines[k])) i = k;
							break;
						}
					}
					items.push(`<li>${inline(text.join('\n'))}</li>`);
				}
				const tag = re === RE.ul ? 'ul' : 'ol';
				// A numbered list that starts at another number (e.g. it continues after a sub-list) keeps it.
				const start = tag === 'ol' ? Number(/\d+/.exec(line)![0]) : 1;
				html.push(`<${tag}${start !== 1 ? ` start="${start}"` : ''}>${items.join('')}</${tag}>`);
			} else if (RE.quote.test(line)) {
				const inner: string[] = [];
				while (i < lines.length && (m = RE.quote.exec(lines[i]))) {
					inner.push(m[1]);
					i++;
				}
				html.push(`<blockquote>${blocks(inner).join('')}</blockquote>`);
			} else {
				const para = [line];
				i++;
				while (
					i < lines.length &&
					lines[i].trim() &&
					!isBlockStart(lines, i) &&
					!RE.setext.test(lines[i])
				)
					para.push(lines[i++]);
				// "Title" underlined with === or --- is a heading (as in every Markdown renderer).
				if (i < lines.length && RE.setext.test(lines[i])) {
					i++;
					html.push(`<h2>${inline(para.join('\n'))}</h2>`);
				} else html.push(`<p>${inline(para.join('\n'))}</p>`);
			}
		}
		return html;
	}

	if (mode === 'publish' && cited.length) {
		const items = cited.map((k, n) => {
			const [kind, id] = k.split(':');
			return `<li id="${prefix}-${n + 1}">${escapeHtml(label(kind as 'src' | 'quote', Number(id)))} <a href="#${prefix}-ref-${n + 1}" aria-label="${back}">↩</a></li>`;
		});
		html.push(`<ol class="footnotes">${items.join('')}</ol>`);
	}
	if (mode === 'editor' && !html.length) html.push('<p><br></p>');
	return html.join('\n');
}
