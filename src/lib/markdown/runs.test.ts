import { describe, expect, it } from 'vitest';
import { ATOM, runsToMarkdown, setLink, toggleFormat, formatsAt, type Run } from './runs';

const plain = (t: string): Run[] => [{ t }];

describe('toggleFormat', () => {
	it('bolds a range in the middle', () => {
		expect(runsToMarkdown(toggleFormat(plain('one two three'), 4, 7, 'b'))).toBe(
			'one **two** three'
		);
	});
	it('switches bold off when the whole range already has it', () => {
		const bold = toggleFormat(plain('one two three'), 4, 7, 'b');
		expect(runsToMarkdown(toggleFormat(bold, 4, 7, 'b'))).toBe('one two three');
	});
	it('switches bold on when only part has it', () => {
		const half = toggleFormat(plain('abcdef'), 0, 3, 'b');
		expect(runsToMarkdown(toggleFormat(half, 0, 6, 'b'))).toBe('**abcdef**');
	});
	it('turns off a slice inside a bold run, keeping the rest bold', () => {
		const all = toggleFormat(plain('abcdef'), 0, 6, 'b');
		expect(runsToMarkdown(toggleFormat(all, 2, 4, 'b'))).toBe('**ab**cd**ef**');
	});
	it('nests bold and italic', () => {
		const r = toggleFormat(toggleFormat(plain('word'), 0, 4, 'b'), 0, 4, 'i');
		expect(runsToMarkdown(r)).toBe('***word***');
	});
});

describe('runsToMarkdown', () => {
	it('keeps spaces outside markers', () => {
		expect(runsToMarkdown(toggleFormat(plain('a b c'), 1, 4, 'b'))).toBe('a **b** c');
	});
	it('escapes Markdown characters in text', () => {
		expect(runsToMarkdown(plain('2 * 3 [x] a_b'))).toBe('2 \\* 3 \\[x\\] a\\_b');
	});
	it('writes links and citations', () => {
		const runs: Run[] = [
			{ t: 'see ' },
			{ t: 'this', a: 'https://x.pl/a b' },
			{ t: ' ' },
			{ t: ATOM, atom: 'src:12' }
		];
		expect(runsToMarkdown(runs)).toBe('see [this](https://x.pl/a%20b) [[src:12]]');
	});
	it('writes a hard line break', () => {
		expect(runsToMarkdown([{ t: 'a' }, { t: ATOM, atom: 'br' }, { t: 'b' }])).toBe('a\\\nb');
	});
	it('separates bold directly followed by italic', () => {
		const r: Run[] = [
			{ t: 'a', b: true },
			{ t: 'b', i: true }
		];
		expect(runsToMarkdown(r)).toBe('**a**_b_');
	});
	it('drops trailing breaks and collapses spaces', () => {
		expect(runsToMarkdown([{ t: ' a  b ' }, { t: ATOM, atom: 'br' }])).toBe('a b');
	});
});

describe('links', () => {
	it('adds and removes a link', () => {
		const linked = setLink(plain('go here now'), 3, 7, 'https://x.pl');
		expect(runsToMarkdown(linked)).toBe('go [here](https://x.pl) now');
		expect(formatsAt(linked, 3, 7).a).toBe('https://x.pl');
		expect(runsToMarkdown(setLink(linked, 3, 7, null))).toBe('go here now');
	});
});
