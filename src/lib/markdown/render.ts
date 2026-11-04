import { escapeHtml, safeUrl } from './escape';
import { renderInline, type InlineContext } from './inline';

export interface RenderOptions {
	/** `editor` keeps citations as editable chips; `publish` gives readers numbered footnotes. */
	mode?: 'editor' | 'publish';
	/** Text shown for a citation, e.g. "Source 12". */
	citationLabel?: (kind: 'src' | 'quote', id: number) => string;
}

const defaultLabel = (kind: 'src' | 'quote', id: number) =>
	`${kind === 'src' ? 'Source' : 'Quote'} ${id}`;

const RE = {
	heading: /^(#{2,4}) +(.+?)\s*$/,
	ul: /^[-*+] +(.*)$/,
	ol: /^\d+[.)] +(.*)$/,
	quote: /^> ?(.*)$/,
	image: /^!\[((?:[^\]\\]|\\.)*)\]\(([^\s)]+)(?: "((?:[^"\\]|\\.)*)")?\)$/
};

const unescape = (s: string) => s.replace(/\\(.)/g, '$1');

export function citeChip(kind: 'src' | 'quote', id: number, label: string): string {
	return `<span class="mde-cite" data-cite="${kind}:${id}" contenteditable="false">${escapeHtml(label)}</span>`;
}

export function figureHtml(o: {
	src: string;
	alt: string;
	caption: string;
	mode: 'editor' | 'publish';
}): string {
	const img = `<img src="${escapeHtml(o.src)}" alt="${escapeHtml(o.alt)}"${o.mode === 'publish' ? ' loading="lazy"' : ''}>`;
	const cap = o.caption ? `<figcaption>${escapeHtml(o.caption)}</figcaption>` : '';
	const attrs = o.mode === 'editor' ? ' class="mde-figure" contenteditable="false"' : '';
	return `<figure${attrs}>${img}${cap}</figure>`;
}

function isBlockStart(line: string): boolean {
	return (
		RE.heading.test(line) ||
		RE.ul.test(line) ||
		RE.ol.test(line) ||
		RE.quote.test(line) ||
		RE.image.test(line)
	);
}

/** Markdown to HTML. The same function feeds the editing surface and the publish preview. */
export function renderMarkdown(markdown: string, options: RenderOptions = {}): string {
	const mode = options.mode ?? 'publish';
	const label = options.citationLabel ?? defaultLabel;
	const cited: string[] = [];
	const ctx: InlineContext = {
		mode,
		cite(kind, id) {
			if (mode === 'editor') return citeChip(kind, id, label(kind, id));
			const key = `${kind}:${id}`;
			if (!cited.includes(key)) cited.push(key);
			const n = cited.indexOf(key) + 1;
			return `<sup class="cite"><a href="#cite-${n}" id="cite-ref-${n}">${n}</a></sup>`;
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
			else if ((m = RE.heading.exec(line))) {
				html.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
				i++;
			} else if ((m = RE.image.exec(line)) && safeUrl(m[2])) {
				html.push(
					figureHtml({
						src: safeUrl(m[2])!,
						alt: unescape(m[1]),
						caption: unescape(m[3] ?? ''),
						mode
					})
				);
				i++;
			} else if (RE.ul.test(line) || RE.ol.test(line)) {
				const re = RE.ul.test(line) ? RE.ul : RE.ol;
				const items: string[] = [];
				while (i < lines.length && (m = re.exec(lines[i])))
					(items.push(`<li>${inline(m[1])}</li>`), i++);
				const tag = re === RE.ul ? 'ul' : 'ol';
				html.push(`<${tag}>${items.join('')}</${tag}>`);
			} else if (RE.quote.test(line)) {
				const inner: string[] = [];
				while (i < lines.length && (m = RE.quote.exec(lines[i]))) (inner.push(m[1]), i++);
				html.push(`<blockquote>${blocks(inner).join('')}</blockquote>`);
			} else {
				const para = [line];
				i++;
				while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i]))
					para.push(lines[i++]);
				html.push(`<p>${inline(para.join('\n'))}</p>`);
			}
		}
		return html;
	}

	if (mode === 'publish' && cited.length) {
		const items = cited.map((k, n) => {
			const [kind, id] = k.split(':');
			return `<li id="cite-${n + 1}">${escapeHtml(label(kind as 'src' | 'quote', Number(id)))} <a href="#cite-ref-${n + 1}" aria-label="Back">↩</a></li>`;
		});
		html.push(`<ol class="footnotes">${items.join('')}</ol>`);
	}
	if (mode === 'editor' && !html.length) html.push('<p><br></p>');
	return html.join('\n');
}
