/** Small shared helpers: HTML escaping, URL safety and Markdown escaping. */

export function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * Accepts http(s) and mailto addresses, site paths starting with `/` and in-page anchors starting with `#` (the same
 * rule as the Lemiesz renderer). Everything else is refused and returns null: other schemes (javascript:, data:),
 * protocol-relative `//host`, bare words, and anything with spaces, control characters or backslashes (browsers read
 * `/\host` as `//host`).
 */
export function safeUrl(raw: string): string | null {
	const u = raw.trim();
	// eslint-disable-next-line no-control-regex
	if (!u || /[\s\u0000-\u001f\u007f\\]/.test(u)) return null;
	if (/^(https?:\/\/[^/]|mailto:)/i.test(u)) return u;
	if (/^[/#]/.test(u) && !u.startsWith('//')) return u;
	return null;
}

/** Images may only come from this site by default: a third-party image would track readers. */
export const isLocalImage = (src: string) => src.startsWith('/') && !src.startsWith('//');

/** Escapes characters that would be read as Markdown, and block markers at the start of a line. */
export function escapeMarkdown(text: string): string {
	return text.replace(/[\\*_[\]`]/g, '\\$&');
}

/** A paragraph that starts like a heading, list, quote or number must not turn into one when read back. */
export function protectLineStart(line: string): string {
	if (/^#{1,6}(\s|$)/.test(line) || /^[-+>]/.test(line)) return '\\' + line;
	return line.replace(/^(\d+)([.)])(\s|$)/, '$1\\$2$3');
}

/** Image addresses go inside `( … )`, so spaces and brackets are percent-encoded. */
export function encodeUrlForMarkdown(url: string): string {
	return url.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
}
