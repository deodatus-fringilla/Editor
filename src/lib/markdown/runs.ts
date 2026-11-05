import { encodeUrlForMarkdown, escapeMarkdown } from './escape';

/**
 * Inline content as a flat list of runs. Formatting, links and Markdown output are all computed on this plain data,
 * so none of it depends on the browser. Atoms (a line break or a citation) have length 1 and `t === ATOM`.
 */
export const ATOM = '￼';

export interface Run {
	t: string;
	b?: boolean;
	i?: boolean;
	/** Link address. */
	a?: string;
	/** Inline code. */
	c?: boolean;
	/** `br`, or a citation such as `src:12`. */
	atom?: string;
}

export const runLength = (r: Run) => r.t.length;
export const totalLength = (runs: Run[]) => runs.reduce((n, r) => n + r.t.length, 0);

const sameFormat = (x: Run, y: Run) =>
	!x.atom && !y.atom && !!x.b === !!y.b && !!x.i === !!y.i && !!x.c === !!y.c && x.a === y.a;

/** Drops empty runs and merges neighbours with identical formatting. */
export function mergeRuns(runs: Run[]): Run[] {
	const out: Run[] = [];
	for (const r of runs) {
		if (!r.t) continue;
		const last = out[out.length - 1];
		if (last && sameFormat(last, r)) last.t += r.t;
		else out.push({ ...r });
	}
	return out;
}

/** Cuts runs at `from` and `to` so a range maps onto whole runs. Returns the runs and the index range inside. */
function split(runs: Run[], from: number, to: number) {
	const out: Run[] = [];
	let pos = 0;
	let first = -1;
	let last = -1;
	for (const r of runs) {
		const end = pos + r.t.length;
		const cuts = [Math.max(from, pos), Math.min(to, end)];
		if (r.atom || end <= from || pos >= to) {
			if (!r.atom || end <= from || pos >= to) {
				// untouched, or outside
			}
			if (r.atom && pos >= from && end <= to) {
				if (first < 0) first = out.length;
				last = out.length;
			}
			out.push(r);
		} else {
			const parts = [
				r.t.slice(0, cuts[0] - pos),
				r.t.slice(cuts[0] - pos, cuts[1] - pos),
				r.t.slice(cuts[1] - pos)
			];
			parts.forEach((t, k) => {
				if (!t) return;
				if (k === 1) {
					if (first < 0) first = out.length;
					last = out.length;
				}
				out.push({ ...r, t });
			});
		}
		pos = end;
	}
	return { runs: out, first, last };
}

/** Bold or italic: switched off when everything in the range already has it, otherwise switched on. */
export function toggleFormat(
	runs: Run[],
	from: number,
	to: number,
	key: 'b' | 'i',
	force?: boolean
): Run[] {
	const { runs: cut, first, last } = split(runs, from, to);
	if (first < 0) return runs;
	const inside = cut.slice(first, last + 1).filter((r) => !r.atom);
	const allOn = inside.length > 0 && inside.every((r) => r[key]);
	const on = force ?? !allOn;
	for (const r of inside) r[key] = on;
	return mergeRuns(cut);
}

/** Sets (or, with null, removes) a link on the range. */
export function setLink(runs: Run[], from: number, to: number, href: string | null): Run[] {
	const { runs: cut, first, last } = split(runs, from, to);
	if (first < 0) return runs;
	for (const r of cut.slice(first, last + 1)) if (!r.atom) r.a = href ?? undefined;
	return mergeRuns(cut);
}

/** Which formats apply to the whole range (used for the toolbar's pressed state). */
export function formatsAt(runs: Run[], from: number, to: number) {
	const { runs: cut, first, last } = split(runs, from, Math.max(to, from + 1));
	const inside = first < 0 ? [] : cut.slice(first, last + 1).filter((r) => !r.atom);
	return {
		b: inside.length > 0 && inside.every((r) => r.b),
		i: inside.length > 0 && inside.every((r) => r.i),
		a: inside.length > 0 && inside.every((r) => r.a) ? inside[0].a : undefined
	};
}

/** Whitespace tidy: collapse runs of spaces across run boundaries and trim both ends. */
export function tidyRuns(runs: Run[]): Run[] {
	const out = mergeRuns(
		runs.map((r) =>
			r.atom
				? r
				: {
						...r,
						t: r.t.replace(/\u200b/g, '').replace(/[ \t\r\n\u00a0]+/g, ' ')
					}
		)
	);
	let prevSpace = true;
	for (const r of out) {
		if (r.atom) {
			prevSpace = r.atom === 'br';
			continue;
		}
		if (prevSpace) r.t = r.t.replace(/^ /, '');
		prevSpace = r.t.endsWith(' ');
	}
	while (out.length && !out[out.length - 1].atom && !out[out.length - 1].t.replace(/ /g, ''))
		out.pop();
	while (out.length && out[out.length - 1].atom === 'br') out.pop();
	while (out.length && out[0].atom === 'br') out.shift();
	if (out[0] && !out[0].atom) out[0].t = out[0].t.replace(/^ /, '');
	const lastRun = out[out.length - 1];
	if (lastRun && !lastRun.atom) lastRun.t = lastRun.t.replace(/ $/, '');
	return mergeRuns(out);
}

// ---- Markdown output -------------------------------------------------------------------------------------------

type Tok =
	| string
	| { m: 'strong' }
	| { em: number; side: 'o' | 'c' }
	| { link: 'o' }
	| { link: 'c'; href: string };

const isWs = (c: string) => /\s/.test(c);

/** Wraps inner tokens in a marker pair, pushing surrounding whitespace outside it (Markdown needs that). */
function wrapTokens(open: Tok, close: Tok, inner: Tok[]): Tok[] {
	const body = [...inner];
	const lead: Tok[] = [];
	const trail: Tok[] = [];
	while (typeof body[0] === 'string' && body[0] && isWs(body[0][0])) {
		const s = body[0] as string;
		const m = /^\s+/.exec(s)![0];
		lead.push(m);
		if (s.length === m.length) body.shift();
		else body[0] = s.slice(m.length);
	}
	while (
		typeof body[body.length - 1] === 'string' &&
		isWs((body[body.length - 1] as string).slice(-1))
	) {
		const s = body[body.length - 1] as string;
		const m = /\s+$/.exec(s)![0];
		trail.unshift(m);
		if (s.length === m.length) body.pop();
		else body[body.length - 1] = s.slice(0, -m.length);
	}
	if (!body.length) return [...lead, ...trail];
	return [...lead, open, ...body, close, ...trail];
}

/** Inline code is written as is, between enough backticks that none inside can close it. */
function codeSpan(text: string): string {
	const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((m) => m.length));
	const fence = '`'.repeat(longest + 1);
	const pad = /^`|`$|^ .* $/.test(text) ? ' ' : '';
	return fence + pad + text + pad + fence;
}

let emId = 0;

function emit(runs: Run[], level: number): Tok[] {
	if (level === 3) {
		return runs.map((r) =>
			r.atom === 'br'
				? '\\\n'
				: r.atom
					? `[[${r.atom}]]`
					: r.c
						? codeSpan(r.t)
						: escapeMarkdown(r.t)
		);
	}
	const key = (['a', 'b', 'i'] as const)[level];
	const out: Tok[] = [];
	for (let k = 0; k < runs.length;) {
		const v = runs[k][key];
		let e = k + 1;
		while (e < runs.length && runs[e][key] === v && !!runs[e][key] === !!v) e++;
		const inner = emit(runs.slice(k, e), level + 1);
		if (!v) out.push(...inner);
		else if (key === 'a')
			out.push(...wrapTokens({ link: 'o' }, { link: 'c', href: v as string }, inner));
		else if (key === 'b')
			out.push(...wrapTokens({ m: 'strong', side: 'o' }, { m: 'strong', side: 'c' }, inner));
		else {
			const id = ++emId;
			out.push(...wrapTokens({ em: id, side: 'o' }, { em: id, side: 'c' }, inner));
		}
		k = e;
	}
	return out;
}

const isStrong = (t: Tok | undefined): t is { m: 'strong'; side: 'o' | 'c' } =>
	typeof t === 'object' && 'm' in t;
const isEm = (t: Tok | undefined): t is { em: number; side: 'o' | 'c' } =>
	typeof t === 'object' && 'em' in t;

function stringify(toks: Tok[]): string {
	// Italic uses `*`, but right next to another star marker it uses `_`, so the two cannot run together.
	const underscore = new Set<number>();
	toks.forEach((t, n) => {
		if (typeof t !== 'object' || !('em' in t)) return;
		// Only a marker that closes just before (or opens just after) collides; nesting like ***x*** is fine.
		const other = t.side === 'o' ? toks[n - 1] : toks[n + 1];
		const clash =
			t.side === 'o'
				? (isStrong(other) && other.side === 'c') || (isEm(other) && other.side === 'c')
				: (isStrong(other) && other.side === 'o') || (isEm(other) && other.side === 'o');
		if (clash) underscore.add(t.em);
	});
	return toks
		.map((t) => {
			if (typeof t === 'string') return t;
			if ('m' in t) return '**';
			if ('em' in t) return underscore.has(t.em) ? '_' : '*';
			return 'href' in t ? `](${encodeUrlForMarkdown(t.href)})` : '[';
		})
		.join('');
}

/** Runs to one line (or several, with hard breaks) of Markdown. */
export function runsToMarkdown(runs: Run[]): string {
	return stringify(emit(tidyRuns(runs), 0));
}
