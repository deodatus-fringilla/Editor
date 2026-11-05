<script lang="ts">
	import { renderMarkdown, type RenderOptions } from './markdown/render';

	/** Shows an article exactly as readers get it, rendered from the Markdown. */
	let {
		value,
		citationLabel,
		columns = 1,
		allowImage,
		idPrefix,
		backLabel,
		class: className = ''
	}: {
		value: string;
		citationLabel?: RenderOptions['citationLabel'];
		/** 1 for a single column, 2 for a magazine-style layout where the text flows from one column into the next. */
		columns?: 1 | 2;
		allowImage?: RenderOptions['allowImage'];
		/** Prefix for footnote ids; give each article on a page its own. */
		idPrefix?: string;
		backLabel?: string;
		class?: string;
	} = $props();

	// The renderer escapes all text, shows raw HTML as text and keeps only safe links, so this HTML is safe to insert.
	const html = $derived(
		renderMarkdown(value, { mode: 'publish', citationLabel, allowImage, idPrefix, backLabel })
	);
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -->
<article class="mde-article {className}" class:cols2={columns === 2}>{@html html}</article>

<style>
	.mde-article {
		--mde-article-font: Georgia, 'Times New Roman', serif;
		font-family: var(--mde-article-font);
		font-size: var(--mde-font-size, 1.125rem);
		line-height: var(--mde-line-height, 1.7);
		color: var(--mde-fg, inherit);
		overflow-wrap: anywhere;
	}
	.mde-article :global(h2),
	.mde-article :global(h3),
	.mde-article :global(h4) {
		margin: 1.6em 0 0.5em;
		font-weight: 700;
		line-height: 1.25;
	}
	.mde-article :global(h2) {
		font-size: 1.6em;
	}
	.mde-article :global(h3) {
		font-size: 1.3em;
	}
	.mde-article :global(h4) {
		font-size: 1.1em;
	}
	.mde-article :global(p) {
		margin: 0 0 1em;
	}
	.mde-article :global(ul),
	.mde-article :global(ol) {
		margin: 0 0 1em;
		padding-left: 1.6em;
	}
	.mde-article :global(ul) {
		list-style: disc;
	}
	.mde-article :global(ol) {
		list-style: decimal;
	}
	.mde-article :global(blockquote) {
		display: flow-root;
		margin: 0 0 1em;
		padding-left: 1em;
		border-left: 3px solid currentColor;
		opacity: 0.8;
	}
	.mde-article :global(a) {
		color: var(--mde-accent, #1d4ed8);
	}
	.mde-article {
		display: flow-root;
	}
	.mde-article :global(figure[data-place='left']),
	.mde-article :global(figure[data-place='right']) {
		width: 45%;
		margin-top: 0.3em;
		margin-bottom: 0.6em;
	}
	.mde-article :global(figure[data-place='left']) {
		float: left;
		margin-right: 1.25em;
		margin-left: 0;
	}
	.mde-article :global(figure[data-place='right']) {
		float: right;
		margin-left: 1.25em;
		margin-right: 0;
	}
	.mde-article :global(figure[data-place='full']) {
		clear: both;
	}
	.mde-article :global(figure[data-place='full'] img) {
		width: 100%;
	}
	@media (max-width: 36rem) {
		.mde-article :global(figure[data-place='left']),
		.mde-article :global(figure[data-place='right']) {
			float: none;
			width: auto;
			margin-inline: 0;
		}
	}

	/* Magazine layout: one text that flows from the first column into the second. */
	@media (min-width: 48rem) {
		.cols2 {
			column-count: 2;
			column-gap: 2.5rem;
			column-rule: 1px solid color-mix(in srgb, currentColor 22%, transparent);
		}
		.cols2 :global(p) {
			orphans: 2;
			widows: 2;
		}
		.cols2 :global(h2),
		.cols2 :global(h3),
		.cols2 :global(h4) {
			break-after: avoid;
		}
		.cols2 :global(figure),
		.cols2 :global(blockquote),
		.cols2 :global(li) {
			break-inside: avoid;
		}
		.cols2 :global(figure[data-place='full']),
		.cols2 :global(.footnotes) {
			column-span: all;
		}
	}
	.mde-article :global(hr) {
		margin: 2em auto;
		width: 40%;
		border: 0;
		border-top: 1px solid currentColor;
		opacity: 0.4;
	}
	.mde-article :global(code) {
		padding: 0.1em 0.3em;
		border-radius: 0.25rem;
		background: color-mix(in srgb, currentColor 8%, transparent);
		font:
			0.88em ui-monospace,
			'SF Mono',
			Menlo,
			Consolas,
			monospace;
	}
	.mde-article :global(pre) {
		padding: 0.75rem;
		overflow-x: auto;
		border-radius: 0.375rem;
		background: color-mix(in srgb, currentColor 6%, transparent);
	}
	.mde-article :global(pre code) {
		padding: 0;
		background: none;
	}
	.mde-article :global(.table) {
		overflow-x: auto;
		margin: 0 0 1em;
	}
	.mde-article :global(table) {
		border-collapse: collapse;
		font-size: 0.9em;
	}
	.mde-article :global(th),
	.mde-article :global(td) {
		padding: 0.35em 0.6em;
		border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
		text-align: left;
		vertical-align: top;
	}
	.cols2 :global(.table),
	.cols2 :global(pre) {
		break-inside: avoid;
	}
	.mde-article :global(figure) {
		margin: 1.5em 0;
	}
	.mde-article :global(figure img) {
		display: block;
		max-width: 100%;
		height: auto;
		margin: 0 auto;
	}
	.mde-article :global(figcaption) {
		margin-top: 0.5em;
		font-size: 0.85em;
		text-align: center;
		opacity: 0.75;
	}
	.mde-article :global(sup.cite a) {
		text-decoration: none;
		font-size: 0.75em;
	}
	.mde-article :global(.footnotes) {
		margin-top: 2em;
		padding-top: 0.75em;
		border-top: 1px solid currentColor;
		font-size: 0.85em;
		opacity: 0.85;
	}
</style>
