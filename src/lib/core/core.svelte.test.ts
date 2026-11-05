import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../markdown/render';
import { domToMarkdown } from './serialize';
import { normalizeRoot } from './normalize';
import { sanitizeHtml, markdownToFragment } from './sanitize';
import { EditorController } from './controller';
import { labelsEn } from './labels';

const surface = (html: string) => {
	const el = document.createElement('div');
	el.innerHTML = html;
	return el;
};
/** What loading Markdown into the editor and saving it again gives (the editor tidies the structure on load). */
const roundTrip = (md: string) => {
	const el = surface(renderMarkdown(md, { mode: 'editor' }));
	normalizeRoot(el);
	return domToMarkdown(el);
};

describe('Markdown survives a trip through the editing surface', () => {
	const samples = [
		'## Heading\n\nA paragraph with **bold**, *italic* and ***both***.',
		'- one\n- two\n- three\n\n1. first\n2. second',
		'> quoted\n>\n> second paragraph',
		'A [link](https://example.pl/a%20b) and a citation[[src:12]] and another[[quote:3]].',
		'![An alt text](/uploads/a.png "A caption")',
		'![Left](/a.png "Cap"){.left}',
		'![Right](/a.png){.right}',
		'![Full](/a.png "Wide"){.full}',
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

describe('image placement and moving', () => {
	const make = (md: string) => {
		const root = document.createElement('div');
		root.contentEditable = 'true';
		root.innerHTML = renderMarkdown(md, { mode: 'editor' });
		document.body.append(root);
		normalizeRoot(root);
		const out: string[] = [];
		const k = new EditorController(root, {
			labels: () => labelsEn,
			emit: (m) => out.push(m),
			state: () => {},
			imageFile: () => {},
			removeFigure: () => {},
			openLink: () => {},
			allowImage: (src: string) => src.startsWith('/')
		});
		return { root, k, out };
	};

	it('changes the placement of an existing image and back', () => {
		const { root, k, out } = make('one\n\n![A](/a.png "Cap")\n\ntwo');
		const fig = root.querySelector('figure') as HTMLElement;
		k.updateFigure(fig, { alt: 'A', caption: 'Cap', place: 'right' });
		expect(out.at(-1)).toBe('one\n\n![A](/a.png "Cap"){.right}\n\ntwo');
		k.updateFigure(fig, { alt: 'A', caption: 'Cap', place: 'center' });
		expect(out.at(-1)).toBe('one\n\n![A](/a.png "Cap")\n\ntwo');
		root.remove();
	});

	it('moves an image above or below its neighbour', () => {
		const { root, k, out } = make('one\n\n![A](/a.png)\n\ntwo');
		const fig = root.querySelector('figure') as HTMLElement;
		expect(k.moveFigure(fig, -1)).toBe(true);
		expect(out.at(-1)).toBe('![A](/a.png)\n\none\n\ntwo');
		expect(k.moveFigure(fig, 1)).toBe(true);
		expect(k.moveFigure(fig, 1)).toBe(true);
		expect(out.at(-1)).toBe('one\n\ntwo\n\n![A](/a.png)');
		expect(k.moveFigure(fig, 1)).toBe(false);
		root.remove();
	});

	it('inserts a new image with a placement', () => {
		const { root, k, out } = make('text');
		k.insertFigure({ src: '/x.png', alt: 'X', caption: '', place: 'left' });
		expect(out.at(-1)).toBe('text\n\n![X](/x.png){.left}');
		root.remove();
	});
});

describe('audit fixes: nothing is lost on load', () => {
	const cases: [string, string][] = [
		['> - one\n> - two', '> - one\n> - two'],
		['> text\n>\n> ![alt](/a.png "cap")', '> text\n>\n> ![alt](/a.png "cap")'],
		['> > inner\n> outer', '> inner\n>\n> outer'],
		['- a\n  - b\n- c', '- a\n- b\n- c'],
		['__bold__', '**bold**'],
		['# Title', '## Title']
	];
	for (const [md, out] of cases) it(JSON.stringify(md), () => expect(roundTrip(md)).toBe(out));

	it('keeps the words apart in pasted list items with several paragraphs', () => {
		expect(
			domToMarkdown(sanitizeHtml('<ul><li><p>one</p></li><li><p>two</p><p>more</p></li></ul>'))
		).toBe('- one\n- two\\\n  more');
	});
	it('flattens pasted nested lists instead of merging their words', () => {
		expect(domToMarkdown(sanitizeHtml('<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>'))).toBe(
			'- a\n- b\n- c'
		);
	});
	it('drops relative links from pasted pages (they pointed into the other site)', () => {
		expect(
			domToMarkdown(sanitizeHtml('<p><a href="/about">x</a> <a href="https://x.pl">y</a></p>'))
		).toBe('x [y](https://x.pl)');
	});
});

describe('audit fixes: copy and paste inside the editor', () => {
	it('keeps citations and images when text is cut and pasted back', () => {
		const root = document.createElement('div');
		root.contentEditable = 'true';
		document.body.append(root);
		const out: string[] = [];
		const k = new EditorController(root, {
			labels: () => labelsEn,
			emit: (m) => out.push(m),
			state: () => {},
			imageFile: () => {},
			removeFigure: () => {},
			openLink: () => {},
			allowImage: (src: string) => src.startsWith('/')
		});
		k.load('First[[src:7]] para.\n\n![Alt](/a.png "Cap"){.left}\n\nLast.');
		const range = document.createRange();
		range.setStartBefore(root.firstElementChild!);
		range.setEndAfter(root.querySelector('figure')!);
		document.getSelection()!.removeAllRanges();
		document.getSelection()!.addRange(range);
		const clip = new DataTransfer();
		k.cut(new ClipboardEvent('cut', { clipboardData: clip, cancelable: true }));
		expect(out.at(-1)).toBe('Last.');
		expect(clip.getData('text/x-mde-markdown')).toBe(
			'First[[src:7]] para.\n\n![Alt](/a.png "Cap"){.left}'
		);
		// paste it back at the end
		const end = document.createRange();
		end.selectNodeContents(root.lastElementChild!);
		end.collapse(false);
		document.getSelection()!.removeAllRanges();
		document.getSelection()!.addRange(end);
		k.paste(new ClipboardEvent('paste', { clipboardData: clip, cancelable: true }));
		expect(out.at(-1)).toBe('Last.\n\nFirst[[src:7]] para.\n\n![Alt](/a.png "Cap"){.left}');
		root.remove();
	});
});

describe('kept blocks survive a trip through the editor unchanged', () => {
	const kept = [
		'Before\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nAfter',
		'```js\nconst a = "*x*";\n```',
		'a\n\n---\n\nb',
		'Text with `a*b` and ``x`y`` code.',
		'> quoted\n>\n> ---'
	];
	for (const md of kept) it(JSON.stringify(md).slice(0, 50), () => expect(roundTrip(md)).toBe(md));
	it('keeps backticks typed as text literal', () => {
		expect(domToMarkdown(surface('<p>a `b` c</p>'))).toBe('a \\`b\\` c');
	});
});

describe('list items with line breaks', () => {
	for (const md of ['- a\\\n  b\n- c', '1. one\\\n   two\n2. three', '- a\\\n  \\- not an item'])
		it(JSON.stringify(md), () => expect(roundTrip(md)).toBe(md));
});

describe('numbered list start', () => {
	it('survives the editor', () => expect(roundTrip('4. four\n5. five')).toBe('4. four\n5. five'));
	it('survives a paste', () =>
		expect(domToMarkdown(sanitizeHtml('<ol start="3"><li>c</li></ol>'))).toBe('3. c'));
});
