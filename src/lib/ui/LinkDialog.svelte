<script lang="ts">
	import { safeUrl } from '../markdown/escape';
	import type { Labels } from '../core/labels';
	import Dialog from './Dialog.svelte';

	let {
		labels,
		href,
		onapply,
		onremove,
		onclose
	}: {
		labels: Labels;
		href: string;
		onapply: (href: string) => void;
		onremove: () => void;
		onclose: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	let value = $state(href);
	let invalid = $state(false);
	let dialog: HTMLElement;

	/** "example.pl/page" is taken to mean a web address. */
	function normalise(raw: string): string {
		const v = raw.trim();
		return /^[\w-]+(\.[\w-]+)+(\/|$)/.test(v) && !/^[a-z][a-z0-9+.-]*:/i.test(v)
			? `https://${v}`
			: v;
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const url = safeUrl(normalise(value));
		if (!url) return (invalid = true);
		(dialog.closest('dialog') as HTMLDialogElement).close();
		onapply(url);
	}
</script>

<Dialog title={labels.linkTitle} {onclose}>
	<form bind:this={dialog} onsubmit={submit} novalidate>
		<label>
			{labels.linkAddress}
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="text"
				inputmode="url"
				autocomplete="off"
				autofocus
				bind:value
				aria-invalid={invalid}
				aria-describedby={invalid ? 'mde-link-err' : undefined}
				oninput={() => (invalid = false)}
			/>
		</label>
		{#if invalid}<p class="error" id="mde-link-err" role="alert">{labels.linkInvalid}</p>{/if}
		<div class="actions">
			{#if href}
				<button
					type="button"
					class="danger"
					onclick={() => ((dialog.closest('dialog') as HTMLDialogElement).close(), onremove())}
					>{labels.removeLink}</button
				>
			{/if}
			<button type="button" onclick={() => (dialog.closest('dialog') as HTMLDialogElement).close()}
				>{labels.cancel}</button
			>
			<button type="submit" class="primary">{labels.apply}</button>
		</div>
	</form>
</Dialog>
