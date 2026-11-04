import { afterEach, describe, expect, it } from 'vitest';
import { renderMarkdown } from '../markdown/render';
import { domToMarkdown } from '../core/serialize';
import { normalizeRoot } from '../core/normalize';
import { setRange } from '../core/selection';
import { positionAt } from '../core/domRuns';
import { applyLink, linkAtSelection, toggleInline, activeInline } from './inline';
import { activeBlock, setBlockKind, toggleList, toggleQuote } from './blocks';

const label = (k: 'src' | 'quote', id: number) => `${k} ${id}`;
let root: HTMLElement;

function setup(md: string): HTMLElement {
	root = document.createElement('div');
	root.contentEditable = 'true';
	root.innerHTML = renderMarkdown(md, { mode: 'editor' });
	document.body.append(root);
	normalizeRoot(root);
	return root;
}
afterEach(() => root?.remove());

/** Selects from (block i, character offset) to (block j, character offset). */
function select(sel: [number, number], to: [number, number] = sel) {
	const blocks = Array.from(root.querySelectorAll('p,h2,h3,h4,li'));
	setRange(
		document,
		positionAt(blocks[sel[0]], sel[1], 'start'),
		positionAt(blocks[to[0]], to[1], 'end')
	);
}
const md = () => domToMarkdown(root);

describe('bold and italic', () => {
	it('bolds a selection and keeps it selected', () => {
		setup('one two three');
		select([0, 4], [0, 7]);
		toggleInline(root, 'b', label);
		expect(md()).toBe('one **two** three');
		expect(document.getSelection()?.toString()).toBe('two');
		expect(activeInline(root).bold).toBe(true);
	});
	it('toggles bold off again', () => {
		setup('one **two** three');
		select([0, 4], [0, 7]);
		toggleInline(root, 'b', label);
		expect(md()).toBe('one two three');
	});
	it('works across paragraphs, all or nothing', () => {
		setup('first\n\nsecond **bold**');
		select([0, 0], [1, 11]);
		toggleInline(root, 'b', label);
		expect(md()).toBe('**first**\n\n**second bold**');
	});
	it('italic nests with bold', () => {
		setup('word');
		select([0, 0], [0, 4]);
		toggleInline(root, 'b', label);
		toggleInline(root, 'i', label);
		expect(md()).toBe('***word***');
	});
	it('with nothing selected, starts bold for what is typed next', () => {
		setup('ab');
		select([0, 1]);
		toggleInline(root, 'b', label);
		const caret = document.getSelection()!.getRangeAt(0);
		caret.insertNode(document.createTextNode('X'));
		expect(md()).toBe('a**X**b');
	});
});

describe('links', () => {
	it('links the selection and reads it back', () => {
		setup('go here now');
		select([0, 3], [0, 7]);
		applyLink(root, 'https://x.pl', label);
		expect(md()).toBe('go [here](https://x.pl) now');
		expect(linkAtSelection(root)?.href).toBe('https://x.pl');
	});
	it('edits and removes the link under the caret', () => {
		setup('go [here](https://x.pl) now');
		select([0, 3]);
		const a = root.querySelector('a')!;
		setRange(document, { node: a.firstChild!, offset: 2 });
		applyLink(root, 'https://y.pl', label);
		expect(md()).toBe('go [here](https://y.pl) now');
		applyLink(root, null, label);
		expect(md()).toBe('go here now');
	});
});

describe('blocks', () => {
	it('makes a heading, and toggles back to a paragraph', () => {
		setup('title');
		select([0, 2]);
		setBlockKind(root, 'h2');
		expect(md()).toBe('## title');
		expect(activeBlock(root).kind).toBe('h2');
		setBlockKind(root, 'h2');
		expect(md()).toBe('title');
	});
	it('changes heading level', () => {
		setup('## title');
		select([0, 1]);
		setBlockKind(root, 'h3');
		expect(md()).toBe('### title');
	});
	it('makes a list from several paragraphs, and back', () => {
		setup('a\n\nb\n\nc');
		select([0, 0], [1, 1]);
		toggleList(root, 'ul');
		expect(md()).toBe('- a\n- b\n\nc');
		toggleList(root, 'ul');
		expect(md()).toBe('a\n\nb\n\nc');
	});
	it('switches a list between bullets and numbers', () => {
		setup('- a\n- b');
		select([0, 0]);
		toggleList(root, 'ol');
		expect(md()).toBe('1. a\n2. b');
	});
	it('lifts one item out of the middle of a list', () => {
		setup('- a\n- b\n- c');
		select([1, 0]);
		toggleList(root, 'ul');
		expect(md()).toBe('- a\n\nb\n\n- c');
	});
	it('wraps paragraphs in a quote and unwraps them', () => {
		setup('a\n\nb');
		select([0, 0], [1, 1]);
		toggleQuote(root);
		expect(md()).toBe('> a\n>\n> b');
		toggleQuote(root);
		expect(md()).toBe('a\n\nb');
	});
	it('turns a heading inside a quote into a plain quoted paragraph', () => {
		setup('## h');
		select([0, 0]);
		toggleQuote(root);
		expect(md()).toBe('> h');
	});
	it('keeps surfaces valid after commands', () => {
		setup('a\n\nb');
		select([0, 0], [1, 1]);
		toggleList(root, 'ol');
		const before = root.innerHTML;
		normalizeRoot(root);
		expect(root.innerHTML).toBe(before);
	});
});
