import { encodeUrlForMarkdown, protectLineStart, safeUrl } from '../markdown/escape';
import { runsToMarkdown } from '../markdown/runs';
import { domToRuns } from './domRuns';

const escapeAlt = (s: string) => s.replace(/[\\[\]]/g, '\\$&');
const escapeTitle = (s: string) => s.replace(/[\\"]/g, '\\$&');

const inline = (el: Element) => runsToMarkdown(domToRuns(el));
const oneLine = (el: Element) => inline(el).replace(/\\\n/g, ' ');

function paragraph(el: Element): string | null {
	const md = inline(el);
	return md ? md.split('\n').map(protectLineStart).join('\n') : null;
}

function figure(el: Element): string | null {
	const img = el.querySelector('img');
	const src = safeUrl(img?.getAttribute('src') ?? '');
	if (!img || !src) return null;
	const caption = el.querySelector('figcaption')?.textContent?.trim() ?? '';
	const title = caption ? ` "${escapeTitle(caption)}"` : '';
	return `![${escapeAlt(img.getAttribute('alt') ?? '')}](${encodeUrlForMarkdown(src)}${title})`;
}

function list(el: Element): string | null {
	const lines: string[] = [];
	for (const li of Array.from(el.children)) {
		const text = oneLine(li);
		if (!text) continue;
		const marker = el.tagName === 'OL' ? `${lines.length + 1}. ` : '- ';
		lines.push(marker + text);
	}
	return lines.length ? lines.join('\n') : null;
}

function quote(el: Element): string | null {
	const hasBlocks = Array.from(el.children).some((c) => /^(P|H[2-4]|UL|OL)$/.test(c.tagName));
	const parts = hasBlocks
		? Array.from(el.children)
				.map(block)
				.filter((x): x is string => !!x)
		: [paragraph(el) ?? ''];
	const text = parts.filter(Boolean).join('\n\n');
	return text
		? text
				.split('\n')
				.map((l) => (l ? `> ${l}` : '>'))
				.join('\n')
		: null;
}

function block(el: Element): string | null {
	switch (el.tagName) {
		case 'H2':
		case 'H3':
		case 'H4': {
			const text = oneLine(el);
			return text ? `${'#'.repeat(Number(el.tagName[1]))} ${text}` : null;
		}
		case 'UL':
		case 'OL':
			return list(el);
		case 'BLOCKQUOTE':
			return quote(el);
		case 'FIGURE':
			return figure(el);
		default:
			return paragraph(el);
	}
}

/** The editing surface to Markdown. Only the editor's own constructs can come out, so output is clean by design. */
export function domToMarkdown(root: Element): string {
	return Array.from(root.children)
		.map(block)
		.filter((x): x is string => !!x)
		.join('\n\n');
}
