<script lang="ts">
	import type { Labels } from '../core/labels';
	import type { Placement } from '../markdown/render';
	import Dialog from './Dialog.svelte';

	let {
		labels,
		src,
		alt,
		caption,
		place,
		placements,
		altEditable,
		editing,
		requireAlt,
		onsubmit,
		onmove,
		onremove,
		onclose
	}: {
		labels: Labels;
		src: string;
		alt: string;
		caption: string;
		place: Placement;
		placements: Placement[];
		altEditable: boolean;
		editing: boolean;
		requireAlt: boolean;
		onsubmit: (data: { alt: string; caption: string; place: Placement }) => void;
		onmove: (direction: -1 | 1) => void;
		onremove: () => void;
		onclose: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	let altText = $state(alt);
	// svelte-ignore state_referenced_locally
	let captionText = $state(caption);
	// svelte-ignore state_referenced_locally
	let placeChoice = $state<Placement>(place);
	const choices = $derived(
		(
			[
				['center', labels.placeCenter],
				['left', labels.placeLeft],
				['right', labels.placeRight],
				['full', labels.placeFull]
			] as [Placement, string][]
		).filter(([p]) => placements.includes(p))
	);
	let form: HTMLFormElement;
	const ready = $derived(!requireAlt || !altEditable || altText.trim().length > 0);
	const close = () => (form.closest('dialog') as HTMLDialogElement).close();

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!ready) return;
		close();
		onsubmit({ alt: altText.trim(), caption: captionText.trim(), place: placeChoice });
	}
</script>

<Dialog title={labels.imageTitle} {onclose}>
	<form bind:this={form} onsubmit={submit}>
		<img {src} alt="" class="preview" />
		{#if altEditable}
			<label>
				{labels.imageAlt}
				<!-- svelte-ignore a11y_autofocus -->
				<input
					type="text"
					bind:value={altText}
					autofocus
					required={requireAlt}
					aria-describedby="mde-alt-help"
				/>
				<span class="help" id="mde-alt-help">{labels.imageAltHelp}</span>
			</label>
		{:else}
			<div class="alt-readonly">
				<span class="alt-label">{labels.imageAlt}</span>
				{#if alt.trim()}
					<p class="alt-text">{alt}</p>
					<span class="help">{labels.imageAltFromHost}</span>
				{:else}
					<p class="error">{labels.imageAltMissing}</p>
				{/if}
			</div>
		{/if}
		<label>
			{labels.imageCaption}
			<input type="text" bind:value={captionText} />
		</label>
		<fieldset class="place" hidden={choices.length < 2}>
			<legend>{labels.placement}</legend>
			{#each choices as [value, text] (value)}
				<label class:on={placeChoice === value}>
					<input type="radio" name="mde-place" {value} bind:group={placeChoice} />
					{text}
				</label>
			{/each}
		</fieldset>
		{#if editing}
			<div class="move">
				<button type="button" onclick={() => onmove(-1)}>↑ {labels.moveUp}</button>
				<button type="button" onclick={() => onmove(1)}>↓ {labels.moveDown}</button>
			</div>
		{/if}
		<div class="actions">
			{#if editing}
				<button type="button" class="danger" onclick={() => (close(), onremove())}
					>{labels.removeImage}</button
				>
			{/if}
			<button type="button" onclick={close}>{labels.cancel}</button>
			<button type="submit" class="primary" disabled={!ready}
				>{editing ? labels.update : labels.insert}</button
			>
		</div>
	</form>
</Dialog>

<style>
	.alt-readonly {
		margin-bottom: 0.75rem;
	}
	.alt-label {
		font-size: 0.875rem;
		font-weight: 600;
	}
	.alt-text {
		margin: 0.25rem 0 0;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--mde-border);
		border-radius: 0.375rem;
		background: var(--mde-hover);
		font-size: 0.875rem;
	}
	.place {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin: 0 0 0.75rem;
		padding: 0;
		border: 0;
	}
	.place legend {
		margin-bottom: 0.25rem;
		padding: 0;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.place label {
		display: inline-flex;
		align-items: center;
		margin: 0;
		padding: 0.375rem 0.625rem;
		border: 1px solid var(--mde-border);
		border-radius: 0.375rem;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
	}
	.place label.on {
		border-color: var(--mde-accent);
		background: var(--mde-accent-soft);
		color: var(--mde-accent-fg);
	}
	.place input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.place label:has(input:focus-visible) {
		outline: 2px solid var(--mde-accent);
		outline-offset: 1px;
	}
	.move {
		display: flex;
		gap: 0.375rem;
		margin-bottom: 0.25rem;
	}
	.move button {
		font-size: 0.8125rem;
		padding: 0.3rem 0.6rem;
	}
	.preview {
		display: block;
		max-width: 100%;
		max-height: 12rem;
		margin: 0 auto 1rem;
		border-radius: 0.375rem;
		object-fit: contain;
	}
</style>
