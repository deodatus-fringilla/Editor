import { restoreSnapshot, snapshotSelection, type SelectionSnapshot } from './selection';

interface Snapshot {
	html: string;
	sel: SelectionSnapshot | null;
}

/**
 * Undo/redo. The browser's own history is not used (it would be lost whenever we change the DOM ourselves), so
 * every state is kept as HTML plus the selection, and typing is grouped into steps after a short pause.
 */
export class History {
	private stack: Snapshot[] = [];
	private index = -1;
	private timer: ReturnType<typeof setTimeout> | undefined;

	constructor(
		private root: HTMLElement,
		private limit = 200
	) {}

	private take(): Snapshot {
		return { html: this.root.innerHTML, sel: snapshotSelection(this.root) };
	}

	reset(): void {
		clearTimeout(this.timer);
		this.stack = [this.take()];
		this.index = 0;
	}

	/** Called while typing: records a step once the typing pauses. */
	typed(): void {
		clearTimeout(this.timer);
		this.timer = setTimeout(() => this.commit(), 500);
	}

	/** Records the current state as a step (does nothing if it matches the last one). */
	commit(): void {
		clearTimeout(this.timer);
		const snap = this.take();
		const top = this.stack[this.index];
		if (top && top.html === snap.html) {
			top.sel = snap.sel;
			return;
		}
		this.stack.length = this.index + 1;
		this.stack.push(snap);
		this.index++;
		if (this.stack.length > this.limit) {
			this.stack.shift();
			this.index--;
		}
	}

	get canUndo(): boolean {
		return this.index > 0 || (this.index === 0 && this.stack[0]?.html !== this.root.innerHTML);
	}

	get canRedo(): boolean {
		return this.index < this.stack.length - 1;
	}

	private go(to: number): boolean {
		const snap = this.stack[to];
		if (!snap) return false;
		this.index = to;
		this.root.innerHTML = snap.html;
		restoreSnapshot(this.root, snap.sel);
		return true;
	}

	undo(): boolean {
		this.commit();
		return this.index > 0 && this.go(this.index - 1);
	}

	redo(): boolean {
		return this.index < this.stack.length - 1 && this.go(this.index + 1);
	}
}
