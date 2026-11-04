<script lang="ts">
	import { Editor, Preview, labelsEn, labelsPl } from '#lib';
	import SourcePane from './SourcePane.svelte';
	import { sample } from './sample';
	import { deleteImage, pickCitation, uploadImage } from './uploader';

	let value = $state(sample);
	let lang = $state<'pl' | 'en'>('pl');
	let tab = $state<'preview' | 'markdown'>('preview');
	let confirmDelete = $state(true);
	let twoColumns = $state(false);
	const labels = $derived(lang === 'pl' ? labelsPl : labelsEn);
</script>

<svelte:head><title>Editor playground</title></svelte:head>

<main>
	<header>
		<h1>Editor playground</h1>
		<div class="controls">
			<label
				>Interface
				<select bind:value={lang}
					><option value="pl">Polski</option><option value="en">English</option></select
				>
			</label>
			<label class="check"
				><input type="checkbox" bind:checked={confirmDelete} /> Ask how to delete images</label
			>
			<label class="check"
				><input type="checkbox" bind:checked={twoColumns} /> Two columns (preview)</label
			>
			<button type="button" onclick={() => (value = '')}>Clear</button>
			<button type="button" onclick={() => (value = sample)}>Sample</button>
		</div>
	</header>

	<div class="cols" class:wide={twoColumns}>
		<section aria-label="Editor">
			<Editor
				bind:value
				{labels}
				{lang}
				placeholder={lang === 'pl' ? 'Zacznij pisać…' : 'Start writing…'}
				onUploadImage={uploadImage}
				onDeleteImage={confirmDelete ? deleteImage : undefined}
				onPickCitation={pickCitation}
			/>
		</section>

		<section aria-label="Output">
			<div class="tabs" role="tablist">
				<button role="tab" aria-selected={tab === 'preview'} onclick={() => (tab = 'preview')}
					>What readers see</button
				>
				<button role="tab" aria-selected={tab === 'markdown'} onclick={() => (tab = 'markdown')}
					>Markdown that is stored</button
				>
			</div>
			<div class="pane" role="tabpanel">
				{#if tab === 'preview'}<Preview
						{value}
						citationLabel={labels.citationLabel}
						columns={twoColumns ? 2 : 1}
					/>{:else}<SourcePane bind:value label="Markdown" />{/if}
			</div>
		</section>
	</div>
</main>

<style>
	:global(:root) {
		color-scheme: light dark;
		--line: light-dark(#d0d5dd, #343a46);
		--panel: light-dark(#ffffff, #16181d);
		--accent: light-dark(#1d4ed8, #6e9bff);
		--mde-fg: light-dark(#1b1f27, #e8eaef);
	}
	:global(body) {
		margin: 0;
		background: light-dark(#f2f4f7, #0e1014);
		color: var(--mde-fg);
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
	}
	main {
		max-width: 88rem;
		margin: 0 auto;
		padding: 1rem;
	}
	header {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1.5rem;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}
	h1 {
		margin: 0;
		font-size: 1.25rem;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		align-items: center;
		font-size: 0.875rem;
	}
	.controls button,
	select {
		padding: 0.35rem 0.7rem;
		border: 1px solid var(--line);
		border-radius: 0.375rem;
		background: var(--panel);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.cols {
		display: grid;
		gap: 1rem;
		grid-template-columns: 1fr;
	}
	@media (min-width: 64rem) {
		.cols:not(.wide) {
			grid-template-columns: 1fr 1fr;
			align-items: start;
		}
	}
	.tabs {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 0.5rem;
	}
	.tabs button {
		padding: 0.4rem 0.8rem;
		border: 1px solid var(--line);
		border-radius: 0.375rem;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.tabs button[aria-selected='true'] {
		border-color: var(--accent);
		background: var(--panel);
		font-weight: 600;
	}
	.pane {
		min-height: 20rem;
		padding: 1rem 1.25rem;
		border: 1px solid var(--line);
		border-radius: 0.5rem;
		background: var(--panel);
	}
</style>
