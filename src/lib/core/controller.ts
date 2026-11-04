import {
	activeBlock,
	setBlockKind,
	toggleList,
	toggleQuote,
	type ActiveBlock,
	type BlockKind
} from '../commands/blocks';
import {
	activeInline,
	applyLink,
	linkAtSelection,
	selectedText,
	toggleInline,
	type ActiveInline
} from '../commands/inline';
import { safeUrl } from '../markdown/escape';
import { ATOM } from '../markdown/runs';
import { figureHtml, renderMarkdown } from '../markdown/render';
import { leafOf, topBlockOf } from './dom';
import { runsToDom } from './domRuns';
import { History } from './history';
import { figureInSelection, figureNextToCaret, handleBackspaceAtStart, handleEnter } from './keys';
import type { Labels } from './labels';
import { normalizeRoot } from './normalize';
import { markdownToFragment, sanitizeHtml } from './sanitize';
import {
	currentRange,
	restoreSnapshot,
	setRange,
	snapshotSelection,
	type SelectionSnapshot
} from './selection';
import { domToMarkdown } from './serialize';

export interface EditorState extends ActiveInline, ActiveBlock {
	canUndo: boolean;
	canRedo: boolean;
}

/** What the controller needs from the component around it. */
export interface Hooks {
	labels: () => Labels;
	emit: (markdown: string) => void;
	state: (state: EditorState) => void;
	/** An image file was pasted or dropped. */
	imageFile: (file: File) => void;
	/** The user is about to remove a figure: the host asks how. */
	removeFigure: (figure: HTMLElement) => void;
	openLink: () => void;
}

export interface FigureData {
	src: string;
	alt: string;
	caption: string;
}

const isBlank = (el: Element) =>
	!el.textContent?.replace(/\u200b/g, '') && !el.querySelector('.mde-cite');

/** All of the editor's behaviour, on a plain DOM element. The Svelte component only wires events and dialogs. */
export class EditorController {
	readonly history: History;
	private saved: SelectionSnapshot | null = null;
	private composing = false;

	constructor(
		readonly root: HTMLElement,
		private hooks: Hooks
	) {
		this.history = new History(root);
	}

	private label = (kind: 'src' | 'quote', id: number) =>
		this.hooks.labels().citationLabel(kind, id);

	// ---- content ------------------------------------------------------------------------------------------------

	load(markdown: string): void {
		this.root.innerHTML = renderMarkdown(markdown, { mode: 'editor', citationLabel: this.label });
		normalizeRoot(this.root);
		this.root.toggleAttribute('data-empty', !domToMarkdown(this.root));
		this.history.reset();
		this.pushState();
	}

	markdown(): string {
		return domToMarkdown(this.root);
	}

	/** Called after every change to the surface. */
	changed(kind: 'typing' | 'step'): void {
		const range = currentRange(this.root);
		const keep =
			range &&
			([range.startContainer, range.startOffset, range.endContainer, range.endOffset] as const);
		if (!this.composing) normalizeRoot(this.root);
		if (keep && this.root.contains(keep[0]) && this.root.contains(keep[2])) {
			setRange(
				this.root.ownerDocument,
				{ node: keep[0], offset: keep[1] },
				{ node: keep[2], offset: keep[3] }
			);
		}
		const md = this.markdown();
		this.root.toggleAttribute('data-empty', !md);
		if (kind === 'typing') this.history.typed();
		else this.history.commit();
		this.hooks.emit(md);
		this.pushState();
	}

	pushState(): void {
		const range = currentRange(this.root);
		this.hooks.state({
			...(range ? activeInline(this.root) : { bold: false, italic: false, link: false }),
			...activeBlock(this.root),
			canUndo: this.history.canUndo,
			canRedo: this.history.canRedo
		});
	}

	private run(fn: () => void): void {
		this.history.commit();
		fn();
		this.changed('step');
	}

	// ---- commands -----------------------------------------------------------------------------------------------

	bold = () => this.run(() => toggleInline(this.root, 'b', this.label));
	italic = () => this.run(() => toggleInline(this.root, 'i', this.label));
	block = (kind: BlockKind) => this.run(() => setBlockKind(this.root, kind));
	list = (kind: 'ul' | 'ol') => this.run(() => toggleList(this.root, kind));
	quote = () => this.run(() => toggleQuote(this.root));

	undo = () => {
		if (this.history.undo()) this.afterHistory();
	};
	redo = () => {
		if (this.history.redo()) this.afterHistory();
	};
	private afterHistory() {
		this.root.toggleAttribute('data-empty', !this.markdown());
		this.hooks.emit(this.markdown());
		this.pushState();
	}

	// ---- dialogs: the selection is remembered while focus is elsewhere --------------------------------------------

	rememberSelection(): void {
		this.saved = snapshotSelection(this.root);
	}

	recall(): void {
		this.root.focus();
		restoreSnapshot(this.root, this.saved);
	}

	currentLink(): { href: string; text: string } {
		return linkAtSelection(this.root) ?? { href: '', text: selectedText(this.root) };
	}

	setLink(href: string | null): void {
		this.recall();
		this.run(() => applyLink(this.root, href, this.label));
	}

	insertCitation(kind: 'src' | 'quote', id: number): void {
		this.recall();
		this.run(() => {
			const range = currentRange(this.root);
			if (!range) return;
			range.deleteContents();
			const doc = this.root.ownerDocument;
			const chip = runsToDom([{ t: ATOM, atom: `${kind}:${id}` }], doc, this.label);
			const last = chip.lastChild!;
			range.insertNode(chip);
			const after = doc.createTextNode('\u200b');
			last.after(after);
			setRange(doc, { node: after, offset: 1 });
		});
	}

	insertFigure(data: FigureData): void {
		const src = safeUrl(data.src);
		if (!src) throw new Error('Unsafe image address');
		this.recall();
		this.run(() => {
			const tpl = this.root.ownerDocument.createElement('template');
			tpl.innerHTML = figureHtml({ ...data, src, mode: 'editor' });
			const fig = tpl.content.firstElementChild as HTMLElement;
			const range = currentRange(this.root);
			const top = range ? topBlockOf(this.root, range.startContainer) : null;
			if (top?.tagName === 'P' && isBlank(top)) top.replaceWith(fig);
			else if (top) top.after(fig);
			else this.root.append(fig);
			normalizeRoot(this.root);
			if (fig.nextElementSibling)
				setRange(this.root.ownerDocument, { node: fig.nextElementSibling, offset: 0 });
		});
	}

	updateFigure(fig: HTMLElement, data: Omit<FigureData, 'src'>): void {
		this.run(() => {
			fig.querySelector('img')?.setAttribute('alt', data.alt);
			let cap = fig.querySelector('figcaption');
			if (!data.caption) cap?.remove();
			else {
				cap ??= fig.appendChild(this.root.ownerDocument.createElement('figcaption'));
				cap.textContent = data.caption;
			}
		});
	}

	removeFigure(fig: HTMLElement): void {
		this.run(() => {
			const next = fig.nextElementSibling ?? fig.previousElementSibling;
			fig.remove();
			normalizeRoot(this.root);
			if (next?.isConnected) setRange(this.root.ownerDocument, { node: next, offset: 0 });
		});
	}

	// ---- events -------------------------------------------------------------------------------------------------

	input = () => this.changed('typing');
	compositionStart = () => (this.composing = true);
	compositionEnd = () => {
		this.composing = false;
		this.changed('typing');
	};
	blur = () => this.history.commit();

	beforeInput = (e: InputEvent) => {
		if (e.inputType === 'historyUndo') {
			e.preventDefault();
			this.undo();
		} else if (e.inputType === 'historyRedo') {
			e.preventDefault();
			this.redo();
		} else if (/^(delete|insert)/.test(e.inputType) && !e.isComposing) {
			const fig = figureInSelection(this.root);
			if (fig) {
				e.preventDefault();
				this.hooks.removeFigure(fig);
			}
		}
	};

	keydown = (e: KeyboardEvent) => {
		const mod = e.ctrlKey || e.metaKey;
		const stop = (fn: () => void) => (e.preventDefault(), fn());
		if (mod && !e.altKey) {
			const k = e.key.toLowerCase();
			if (k === 'b') return stop(this.bold);
			if (k === 'i') return stop(this.italic);
			if (k === 'k') return stop(this.hooks.openLink);
			if (k === 'z') return stop(e.shiftKey ? this.redo : this.undo);
			if (k === 'y') return stop(this.redo);
			if (e.shiftKey && e.code === 'Digit8') return stop(() => this.list('ul'));
			if (e.shiftKey && e.code === 'Digit7') return stop(() => this.list('ol'));
			if (e.shiftKey && e.code === 'Digit9') return stop(this.quote);
		}
		if (mod && e.altKey) {
			const kinds: Record<string, BlockKind> = {
				Digit0: 'p',
				Digit2: 'h2',
				Digit3: 'h3',
				Digit4: 'h4'
			};
			if (kinds[e.code]) return stop(() => this.block(kinds[e.code]));
		}
		if (e.isComposing) return;
		if (e.key === 'Enter') {
			this.history.commit();
			if (handleEnter(this.root, e.shiftKey)) {
				e.preventDefault();
				this.changed('step');
			}
		} else if (e.key === 'Backspace' || e.key === 'Delete') {
			const fig = figureNextToCaret(this.root, e.key);
			if (fig) return stop(() => this.hooks.removeFigure(fig));
			if (e.key === 'Backspace') {
				this.history.commit();
				if (handleBackspaceAtStart(this.root)) {
					e.preventDefault();
					this.changed('step');
				}
			}
		}
	};

	// ---- paste and drop -----------------------------------------------------------------------------------------

	paste = (e: ClipboardEvent) => {
		const data = e.clipboardData;
		if (!data) return;
		e.preventDefault();
		this.insertTransfer(data);
	};

	drop = (e: DragEvent) => {
		const data = e.dataTransfer;
		if (!data) return;
		const hasImage = Array.from(data.files).some((f) => f.type.startsWith('image/'));
		if (!hasImage && !data.getData('text/html') && !data.getData('text/plain')) return;
		e.preventDefault();
		const doc = this.root.ownerDocument;
		const pos = doc.caretPositionFromPoint?.(e.clientX, e.clientY);
		if (pos && this.root.contains(pos.offsetNode))
			setRange(doc, { node: pos.offsetNode, offset: pos.offset });
		this.root.focus();
		this.insertTransfer(data);
	};

	private insertTransfer(data: DataTransfer) {
		const image = Array.from(data.files).find((f) => f.type.startsWith('image/'));
		if (image) return this.hooks.imageFile(image);
		const html = data.getData('text/html');
		let content = html ? sanitizeHtml(html) : null;
		if (!content || !content.textContent?.trim())
			content = markdownToFragment(data.getData('text/plain'));
		if (content.textContent?.trim()) this.insertBlocks(content);
	}

	/** Puts cleaned content at the caret. A single paragraph goes inline; several blocks are placed between blocks. */
	private insertBlocks(content: HTMLElement): void {
		this.history.commit();
		const doc = this.root.ownerDocument;
		const range = currentRange(this.root);
		if (range) range.deleteContents();
		const blocks = Array.from(content.children);
		if (range && blocks.length === 1 && blocks[0].tagName === 'P') {
			const nodes = Array.from(blocks[0].childNodes);
			const frag = doc.createDocumentFragment();
			frag.append(...nodes);
			const lastNode = nodes[nodes.length - 1];
			range.insertNode(frag);
			if (lastNode) range.setStartAfter(lastNode);
			range.collapse(true);
			setRange(doc, { node: range.startContainer, offset: range.startOffset });
			return this.changed('step');
		}
		const leaf = range && leafOf(this.root, range.startContainer);
		const top = range && topBlockOf(this.root, range.startContainer);
		let last: Element = blocks[blocks.length - 1];
		if (leaf && top && leaf === top) {
			const tailRange = doc.createRange();
			tailRange.setStart(range.startContainer, range.startOffset);
			tailRange.setEnd(leaf, leaf.childNodes.length);
			const tail = leaf.cloneNode(false) as HTMLElement;
			tail.append(tailRange.extractContents());
			leaf.after(...blocks);
			if (!isBlank(tail)) {
				last.after(tail);
				last = tail;
			}
			if (isBlank(leaf)) leaf.remove();
		} else if (top) {
			top.after(...blocks);
		} else {
			this.root.append(...blocks);
		}
		normalizeRoot(this.root);
		const end = Array.from(last.querySelectorAll('li,p')).pop() ?? last;
		setRange(doc, { node: end, offset: end.childNodes.length });
		this.changed('step');
	}
}
