import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './render';

const pub = (md: string) => renderMarkdown(md, { mode: 'publish' });

describe('blocks', () => {
	it('renders paragraphs, headings (2-4) and lists', () => {
		expect(pub('## Title\n\nText one\ncontinues\n\n- a\n- b\n\n1. x\n2. y')).toBe(
			'<h2>Title</h2>\n<p>Text one continues</p>\n<ul><li>a</li><li>b</li></ul>\n<ol><li>x</li><li>y</li></ol>'
		);
	});
	it('reads a level-1 heading as level 2 (the article title lives elsewhere)', () => {
		expect(pub('# Title')).toBe('<h2>Title</h2>');
		expect(pub('\\# not a title')).toBe('<p># not a title</p>');
	});
	it('renders blockquotes with paragraphs', () => {
		expect(pub('> one\n>\n> two')).toBe('<blockquote><p>one</p><p>two</p></blockquote>');
	});
	it('renders a hard line break', () => {
		expect(pub('a\\\nb')).toBe('<p>a<br>b</p>');
	});
});

describe('inline', () => {
	it('renders bold, italic, nested and underscore italic', () => {
		expect(pub('**a** *b* ***c*** _d_')).toBe(
			'<p><strong>a</strong> <em>b</em> <strong><em>c</em></strong> <em>d</em></p>'
		);
	});
	it('keeps escaped characters literal', () => {
		expect(pub('2 \\* 3 \\[x\\] a\\_b snake_case_name')).toBe(
			'<p>2 * 3 [x] a_b snake_case_name</p>'
		);
	});
	it('does not read stars around spaces as emphasis', () => {
		expect(pub('2 * 3 * 4')).toBe('<p>2 * 3 * 4</p>');
	});
});

describe('safety', () => {
	it('shows raw HTML as text', () => {
		expect(pub('<script>alert(1)</script> <b>x</b>')).toBe(
			'<p>&lt;script&gt;alert(1)&lt;/script&gt; &lt;b&gt;x&lt;/b&gt;</p>'
		);
	});
	it('drops unsafe link addresses but keeps the text', () => {
		expect(pub('[x](javascript:alert(1))')).toBe('<p>x</p>');
		expect(pub('[x](data:text/html,hi)')).toBe('<p>x</p>');
		expect(pub('[x](//evil.example)')).toBe('<p>x</p>');
	});
	it('keeps safe links; readers get a safe rel on web links', () => {
		expect(pub('[a](https://x.pl/a)')).toContain(
			'<a href="https://x.pl/a" target="_blank" rel="noopener noreferrer nofollow">a</a>'
		);
		expect(pub('[a](/local)')).toBe('<p><a href="/local">a</a></p>');
		expect(pub('[a](mailto:x@y.pl)')).toContain('href="mailto:x@y.pl"');
	});
	it('refuses an image with an unsafe address', () => {
		expect(pub('![x](javascript:alert(1))')).not.toContain('<img');
	});
	it('escapes quotes in alt text and captions', () => {
		const html = pub('![a \\"q\\"](/i.png "cap <b>")');
		expect(html).toContain('alt="a &quot;q&quot;"');
		expect(html).toContain('<figcaption>cap &lt;b&gt;</figcaption>');
	});
});

describe('images', () => {
	it('renders a figure with caption', () => {
		expect(pub('![Alt text](/uploads/a.png "A caption")')).toBe(
			'<figure><img src="/uploads/a.png" alt="Alt text" loading="lazy"><figcaption>A caption</figcaption></figure>'
		);
	});
	it('omits the caption when there is none', () => {
		expect(pub('![Alt](/a.png)')).not.toContain('figcaption');
	});
});

describe('image placement', () => {
	it('reads left, right and full', () => {
		expect(pub('![A](/a.png "Cap"){.left}')).toContain('<figure data-place="left">');
		expect(pub('![A](/a.png){.right}')).toContain('<figure data-place="right">');
		expect(pub('![A](/a.png){.full}')).toContain('<figure data-place="full">');
	});
	it('centres by default and ignores unknown placements', () => {
		expect(pub('![A](/a.png)')).toContain('<figure>');
		expect(pub('![A](/a.png){.bogus}')).toContain('<figure>');
		expect(pub('![A](/a.png){.center}')).toContain('<figure>');
	});
	it('marks the editing surface too', () => {
		expect(renderMarkdown('![A](/a.png){.left}', { mode: 'editor' })).toContain(
			'data-place="left"'
		);
	});
});

describe('citations', () => {
	it('numbers citations in order and lists them for readers', () => {
		const html = pub('One[[src:12]] two[[quote:3]] again[[src:12]]');
		expect(html).toContain('<sup class="cite"><a href="#cite-1" id="cite-ref-1">1</a></sup>');
		expect(html).toContain('href="#cite-2"');
		expect(html.match(/<li id="cite-/g)).toHaveLength(2);
		expect(html).toContain('Source 12');
		expect(html).toContain('Quote 3');
	});
	it('keeps numbering across blockquotes', () => {
		const html = pub('A[[src:1]]\n\n> B[[src:2]]\n\nC[[src:1]]');
		expect(html).toContain('href="#cite-2"');
		expect(html.match(/<li id="cite-/g)).toHaveLength(2);
	});
	it('shows an editable-surface chip in editor mode', () => {
		const html = renderMarkdown('x[[src:5]]', { mode: 'editor' });
		expect(html).toContain(
			'<span class="mde-cite" data-cite="src:5" contenteditable="false">Source 5</span>'
		);
	});
	it('leaves malformed markers as text', () => {
		expect(pub('[[src:abc]] [[foo:1]]')).toBe('<p>[[src:abc]] [[foo:1]]</p>');
	});
});

describe('editor mode', () => {
	it('gives an empty document one empty paragraph', () => {
		expect(renderMarkdown('', { mode: 'editor' })).toBe('<p><br></p>');
	});
});

describe('audit fixes', () => {
	it('accepts only http(s), mailto, /paths and #anchors as addresses (like Lemiesz)', async () => {
		const { safeUrl } = await import('./escape');
		for (const ok of [
			'https://x.pl',
			'http://x.pl/a?b=1#c',
			'mailto:a@b.pl',
			'/uploads/a.png',
			'#sec'
		])
			expect(safeUrl(ok)).toBe(ok);
		for (const bad of [
			'/\\evil.com',
			'\\\\evil.com',
			'//evil.com',
			'google',
			'javascript:alert(1)',
			'https:/x',
			'data:x',
			'a b'
		])
			expect(safeUrl(bad)).toBeNull();
	});
	it('reads __bold__ as bold but leaves snake__case alone', () => {
		expect(pub('__bold__ and snake__case__name')).toBe(
			'<p><strong>bold</strong> and snake__case__name</p>'
		);
		expect(pub('_it_ and ___both___')).toBe(
			'<p><em>it</em> and <strong><em>both</em></strong></p>'
		);
	});
	it('keeps indented (nested) list items in the list', () => {
		expect(pub('- a\n  - b\n- c')).toBe('<ul><li>a</li><li>b</li><li>c</li></ul>');
	});
	it('does not show images from other sites unless allowed', () => {
		expect(pub('![t](https://tracker.example/p.png)')).not.toContain('<img');
		expect(renderMarkdown('![t](https://cdn.example/p.png)', { allowImage: () => true })).toContain(
			'<img'
		);
	});
	it('can prefix footnote ids and name the back link', () => {
		const html = renderMarkdown('a[[src:1]]', { idPrefix: 'art7', backLabel: 'Powrót' });
		expect(html).toContain('href="#art7-1" id="art7-ref-1"');
		expect(html).toContain('aria-label="Powrót"');
	});
	it('stays fast on long paragraphs full of unmatched markers', () => {
		const t = performance.now();
		for (const s of ['**a ', '*a ', '[a ', '__a ', '_a ']) pub(s.repeat(20000));
		expect(performance.now() - t).toBeLessThan(1500);
	});
});

describe('content the editor keeps but does not edit', () => {
	it('renders a table for readers and a locked box in the editor', () => {
		const md = '| A | B |\n|---|---|\n| 1 | **2** |';
		expect(pub(md)).toBe(
			'<div class="table"><table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td><strong>2</strong></td></tr></tbody></table></div>'
		);
		expect(renderMarkdown(md, { mode: 'editor' })).toContain(
			'<pre class="mde-raw" contenteditable="false" data-kind="table">'
		);
	});
	it('renders fenced code as code, never as Markdown', () => {
		expect(pub('```\n**not bold** <b>\n```')).toBe(
			'<pre><code>**not bold** &lt;b&gt;</code></pre>'
		);
	});
	it('renders separators and underlined headings', () => {
		expect(pub('a\n\n---\n\nb')).toBe('<p>a</p>\n<hr>\n<p>b</p>');
		expect(pub('Title\n=====\n\nSub\n---')).toBe('<h2>Title</h2>\n<h2>Sub</h2>');
	});
	it('does not pair emphasis markers with stars inside code', () => {
		expect(pub('a *b and `*c` d')).toBe('<p>a *b and <code>*c</code> d</p>');
		expect(pub('[x `]` y](/p)')).toBe('<p><a href="/p">x <code>]</code> y</a></p>');
	});
	it('renders inline code literally', () => {
		expect(pub('use `a*b*c` and `` x`y ``')).toBe(
			'<p>use <code>a*b*c</code> and <code>x`y</code></p>'
		);
	});
});

describe('numbered lists keep their first number', () => {
	it('starts where the Markdown says', () => {
		expect(pub('5. five\n6. six')).toBe('<ol start="5"><li>five</li><li>six</li></ol>');
		expect(pub('1. one')).toBe('<ol><li>one</li></ol>');
	});
	it('keeps numbering after a bullet sub-list', () => {
		expect(pub('3. three\n   - sub\n4. four')).toBe(
			'<ol start="3"><li>three</li></ol>\n<ul><li>sub</li></ul>\n<ol start="4"><li>four</li></ol>'
		);
	});
});
