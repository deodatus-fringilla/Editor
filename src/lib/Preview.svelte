<script lang="ts">
	import { renderMarkdown, type RenderOptions } from './markdown/render';

	/** Shows an article exactly as readers get it, rendered from the Markdown. */
	let {
		value,
		citationLabel,
		class: className = ''
	}: { value: string; citationLabel?: RenderOptions['citationLabel']; class?: string } = $props();

	// The renderer escapes all text, shows raw HTML as text and keeps only safe links, so this HTML is safe to insert.
	const html = $derived(renderMarkdown(value, { mode: 'publish', citationLabel }));
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -->
<article class="mde-article {className}">{@html html}</article>

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
	.mde-article :global(blockquote) {
		margin: 0 0 1em;
		padding-left: 1em;
		border-left: 3px solid currentColor;
		opacity: 0.8;
	}
	.mde-article :global(a) {
		color: var(--mde-accent, #1d4ed8);
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
