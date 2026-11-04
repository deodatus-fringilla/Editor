<script lang="ts">
	import type { Labels } from '../core/labels';
	import Dialog from './Dialog.svelte';

	let {
		labels,
		src,
		alt,
		caption,
		editing,
		requireAlt,
		onsubmit,
		onremove,
		onclose
	}: {
		labels: Labels;
		src: string;
		alt: string;
		caption: string;
		editing: boolean;
		requireAlt: boolean;
		onsubmit: (data: { alt: string; caption: string }) => void;
		onremove: () => void;
		onclose: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	let altText = $state(alt);
	// svelte-ignore state_referenced_locally
	let captionText = $state(caption);
	let form: HTMLFormElement;
	const ready = $derived(!requireAlt || altText.trim().length > 0);
	const close = () => (form.closest('dialog') as HTMLDialogElement).close();

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!ready) return;
		close();
		onsubmit({ alt: altText.trim(), caption: captionText.trim() });
	}
</script>

<Dialog title={labels.imageTitle} {onclose}>
	<form bind:this={form} onsubmit={submit}>
		<img {src} alt="" class="preview" />
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
		<label>
			{labels.imageCaption}
			<input type="text" bind:value={captionText} />
		</label>
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
	.preview {
		display: block;
		max-width: 100%;
		max-height: 12rem;
		margin: 0 auto 1rem;
		border-radius: 0.375rem;
		object-fit: contain;
	}
</style>
