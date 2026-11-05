import { safeUrl } from '../markdown/escape';
import { ATOM, totalLength, type Run } from '../markdown/runs';

type Fmt = { b?: boolean; i?: boolean; a?: string; c?: boolean };

/** Reads the inline content of a block (or fragment) into runs, keeping every character, including placeholders. */
export function domToRuns(parent: Node): Run[] {
	const out: Run[] = [];
	const walk = (node: Node, f: Fmt) => {
		for (const n of Array.from(node.childNodes)) {
			if (n.nodeType === 3) {
				if (n.nodeValue) out.push({ t: n.nodeValue, ...f });
				continue;
			}
			if (n.nodeType !== 1) continue;
			const el = n as HTMLElement;
			if (el.tagName === 'BR') out.push({ t: ATOM, atom: 'br' });
			else if (el.classList.contains('mde-cite') && el.dataset.cite)
				out.push({ t: ATOM, atom: el.dataset.cite });
			else if (el.tagName === 'STRONG' || el.tagName === 'B') walk(el, { ...f, b: true });
			else if (el.tagName === 'CODE') walk(el, { ...f, c: true });
			else if (el.tagName === 'EM' || el.tagName === 'I') walk(el, { ...f, i: true });
			else if (el.tagName === 'A')
				walk(el, { ...f, a: safeUrl(el.getAttribute('href') ?? '') ?? f.a });
			else walk(el, f);
		}
	};
	walk(parent, {});
	return out;
}

/** Builds DOM for runs. `citeLabel` gives the text shown on a citation chip. */
export function runsToDom(
	runs: Run[],
	doc: Document,
	citeLabel: (kind: 'src' | 'quote', id: number) => string
): DocumentFragment {
	const frag = doc.createDocumentFragment();
	for (const r of runs) {
		if (r.atom === 'br') {
			frag.append(doc.createElement('br'));
			continue;
		}
		if (r.atom) {
			const [kind, id] = r.atom.split(':');
			const chip = doc.createElement('span');
			chip.className = 'mde-cite';
			chip.dataset.cite = r.atom;
			chip.contentEditable = 'false';
			chip.textContent = citeLabel(kind as 'src' | 'quote', Number(id));
			frag.append(chip);
			continue;
		}
		let node: Node = doc.createTextNode(r.t);
		for (const [on, tag] of [
			[r.c, 'code'],
			[r.i, 'em'],
			[r.b, 'strong']
		] as const) {
			if (!on) continue;
			const w = doc.createElement(tag);
			w.append(node);
			node = w;
		}
		if (r.a) {
			const a = doc.createElement('a');
			a.setAttribute('href', r.a);
			a.append(node);
			node = a;
		}
		frag.append(node);
	}
	return frag;
}

/** Character offset of a DOM position inside a block, in run units (text length; a break or citation counts as 1). */
export function offsetIn(block: Element, node: Node, offset: number): number {
	const range = block.ownerDocument.createRange();
	range.setStart(block, 0);
	range.setEnd(node, offset);
	const holder = block.ownerDocument.createElement('div');
	holder.append(range.cloneContents());
	return totalLength(domToRuns(holder));
}

/** The inverse of `offsetIn`. `prefer: 'start'` leans into the following text, `'end'` stays in the previous one. */
export function positionAt(
	block: Element,
	offset: number,
	prefer: 'start' | 'end'
): { node: Node; offset: number } {
	let left = offset;
	const walk = (parent: Node): { node: Node; offset: number } | null => {
		for (const n of Array.from(parent.childNodes)) {
			if (n.nodeType === 3) {
				const len = n.nodeValue?.length ?? 0;
				if (prefer === 'end' ? left <= len : left < len) return { node: n, offset: left };
				left -= len;
			} else if (n.nodeType === 1) {
				const el = n as HTMLElement;
				if (el.tagName === 'BR' || el.classList.contains('mde-cite')) {
					if (left === 0)
						return { node: parent, offset: Array.from(parent.childNodes).indexOf(n as ChildNode) };
					left -= 1;
				} else {
					const hit = walk(el);
					if (hit) return hit;
				}
			}
		}
		return null;
	};
	return walk(block) ?? { node: block, offset: block.childNodes.length };
}
