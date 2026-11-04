/** Selection helpers: reading the caret inside the surface, setting it, and saving it as paths for undo. */

export interface Point {
	node: Node;
	offset: number;
}

export function currentRange(root: HTMLElement): Range | null {
	const sel = root.ownerDocument.getSelection();
	if (!sel || !sel.rangeCount) return null;
	const r = sel.getRangeAt(0);
	return root.contains(r.startContainer) && root.contains(r.endContainer) ? r : null;
}

export function setRange(doc: Document, start: Point, end: Point = start): void {
	const sel = doc.getSelection();
	if (!sel) return;
	const r = doc.createRange();
	r.setStart(start.node, start.offset);
	r.setEnd(end.node, end.offset);
	sel.removeAllRanges();
	sel.addRange(r);
}

// ---- paths (undo/redo restores exact HTML, so child-index paths stay valid) ---------------------------------------

interface PathPoint {
	path: number[];
	offset: number;
}
export interface SelectionSnapshot {
	start: PathPoint;
	end: PathPoint;
}

function pathTo(root: Node, node: Node): number[] {
	const path: number[] = [];
	for (let n: Node | null = node; n && n !== root; n = n.parentNode) {
		path.unshift(Array.prototype.indexOf.call(n.parentNode!.childNodes, n));
	}
	return path;
}

function nodeAt(root: Node, path: number[]): Node {
	let n: Node = root;
	for (const i of path) n = n.childNodes[Math.min(i, n.childNodes.length - 1)] ?? n;
	return n;
}

const clamp = (node: Node, offset: number) =>
	Math.min(offset, node.nodeType === 3 ? (node.nodeValue?.length ?? 0) : node.childNodes.length);

export function snapshotSelection(root: HTMLElement): SelectionSnapshot | null {
	const r = currentRange(root);
	if (!r) return null;
	return {
		start: { path: pathTo(root, r.startContainer), offset: r.startOffset },
		end: { path: pathTo(root, r.endContainer), offset: r.endOffset }
	};
}

export function restoreSnapshot(root: HTMLElement, snap: SelectionSnapshot | null): void {
	if (!snap) return;
	const s = nodeAt(root, snap.start.path);
	const e = nodeAt(root, snap.end.path);
	setRange(
		root.ownerDocument,
		{ node: s, offset: clamp(s, snap.start.offset) },
		{ node: e, offset: clamp(e, snap.end.offset) }
	);
}
