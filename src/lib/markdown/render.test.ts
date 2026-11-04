import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './render';

const pub = (md: string) => renderMarkdown(md, { mode: 'publish' });

describe('blocks', () => {
	it('renders paragraphs, headings (2-4) and lists', () => {
		expect(pub('## Title\n\nText one\ncontinues\n\n- a\n- b\n\n1. x\n2. y')).toBe(
			'<h2>Title</h2>\n<p>Text one continues</p>\n<ul><li>a</li><li>b</li></ul>\n<ol><li>x</li><li>y</li></ol>'
		);
	});
	it('does not treat a single # as a heading', () => {
		expect(pub('# not a title')).toBe('<p># not a title</p>');
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
