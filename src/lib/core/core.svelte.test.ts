import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../markdown/render';
import { domToMarkdown } from './serialize';
import { normalizeRoot } from './normalize';
import { sanitizeHtml, markdownToFragment } from './sanitize';

const surface = (html: string) => {
	const el = document.createElement('div');
	el.innerHTML = html;
	return el;
};
const roundTrip = (md: string) => domToMarkdown(surface(renderMarkdown(md, { mode: 'editor' })));

describe('Markdown survives a trip through the editing surface', () => {
	const samples = [
		'## Heading\n\nA paragraph with **bold**, *italic* and ***both***.',
		'- one\n- two\n- three\n\n1. first\n2. second',
		'> quoted\n>\n> second paragraph',
		'A [link](https://example.pl/a%20b) and a citation[[src:12]] and another[[quote:3]].',
		'![An alt text](/uploads/a.png "A caption")',
		'Line one\\\nline two',
		'2 \\* 3 \\[not a link\\] snake\\_case',
		'\\# not a heading\n\n\\- not a list\n\n1\\. not a number',
		'**a**_b_ and *c*'
	];
	for (const md of samples)
		it(JSON.stringify(md).slice(0, 50), () => expect(roundTrip(md)).toBe(md));
});

describe('serializer', () => {
	it('moves spaces outside bold markers and ignores placeholders', () => {
		expect(domToMarkdown(surface('<p>a<strong> b </strong>c</p><p><br></p>'))).toBe('a **b** c');
	});
	it('ignores zero-width placeholders and non-breaking spaces', () => {
		expect(domToMarkdown(surface('<p>a\u00a0b<strong>\u200b</strong></p>'))).toBe('a b');
	});
	it('drops links with unsafe addresses', () => {
		expect(domToMarkdown(surface('<p><a href="javascript:alert(1)">x</a></p>'))).toBe('x');
	});
	it('ignores unknown markup', () => {
		expect(
			domToMarkdown(surface('<p>a <span style="color:red">b</span><script>x</script></p>'))
		).toBe('a bx');
	});
});

describe('normalizeRoot', () => {
	it('wraps loose text and turns divs into paragraphs', () => {
		const el = surface('loose<div>in div</div><h1>H1</h1><h6>H6</h6>');
		normalizeRoot(el);
		expect(el.innerHTML).toBe('<p>loose</p><p>in div</p><h2>H1</h2><h4>H6</h4>');
	});
	it('keeps a stop for the caret around figures and never leaves the surface empty', () => {
		const el = surface('<figure><img src="/a.png" alt="x"></figure>');
		normalizeRoot(el);
		expect(el.firstElementChild?.tagName).toBe('P');
		expect(el.lastElementChild?.tagName).toBe('P');
		const empty = surface('');
		normalizeRoot(empty);
		expect(empty.innerHTML).toBe('<p><br></p>');
	});
	it('puts loose text inside quotes and lists into proper blocks', () => {
		const el = surface('<blockquote>quoted</blockquote><ul><li>a</li>stray</ul>');
		normalizeRoot(el);
		expect(el.innerHTML).toBe(
			'<blockquote><p>quoted</p></blockquote><ul><li>a</li><li>stray</li></ul>'
		);
	});
});

describe('sanitizeHtml (paste)', () => {
	const md = (html: string) => domToMarkdown(sanitizeHtml(html));
	it('keeps the supported formatting', () => {
		expect(
			md(
				'<p>Hello <b>bold</b> <i>it</i> <a href="https://x.pl">l</a></p><h3>T</h3><ul><li>a</li></ul>'
			)
		).toBe('Hello **bold** *it* [l](https://x.pl)\n\n### T\n\n- a');
	});
	it('removes scripts, styles, event handlers and images', () => {
		const out = sanitizeHtml(
			'<p onclick="x()">a<script>alert(1)</script><style>p{}</style><img src=x onerror=y></p>'
		);
		expect(out.innerHTML).toBe('<p>a</p>');
	});
	it('drops unsafe links but keeps their text', () => {
		expect(md('<p><a href="javascript:alert(1)">click</a></p>')).toBe('click');
	});
	it("does not treat Google Docs' wrapper as bold", () => {
		expect(
			md(
				'<b style="font-weight:normal" id="docs-internal-guid-1"><p>plain <span style="font-weight:700">bold</span></p></b>'
			)
		).toBe('plain **bold**');
	});
	it('reads bold and italic from Word-style spans', () => {
		expect(
			md(
				'<p class="MsoNormal"><span style="font-weight:bold">B</span> <span style="font-style:italic">I</span><o:p></o:p></p>'
			)
		).toBe('**B** *I*');
	});
	it('turns Word list paragraphs into lists', () => {
		const html =
			'<p class="MsoListParagraph" style="mso-list:l0 level1 lfo1"><!--[if !supportLists]--><span style="mso-list:Ignore">·<span>&nbsp;&nbsp;</span></span><!--[endif]-->One</p>' +
			'<p class="MsoListParagraph" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">·</span>Two</p>';
		expect(md(html)).toBe('- One\n- Two');
	});
	it('keeps paragraphs apart and wraps loose text', () => {
		expect(md('<div>one</div><div>two</div>loose')).toBe('one\n\ntwo\n\nloose');
	});
	it('maps every heading level into 2-4', () => {
		expect(md('<h1>a</h1><h5>b</h5>')).toBe('## a\n\n#### b');
	});
});

describe('plain-text paste is read as Markdown', () => {
	it('renders headings, lists and emphasis', () => {
		expect(domToMarkdown(markdownToFragment('## Title\n\ntext **b**\n\n- x'))).toBe(
			'## Title\n\ntext **b**\n\n- x'
		);
	});
	it('does not let raw HTML through', () => {
		const frag = markdownToFragment('<img src=x onerror=alert(1)>');
		expect(frag.querySelector('img')).toBeNull();
	});
});
