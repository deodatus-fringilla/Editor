<script lang="ts">
	import { onMount, type Snippet } from 'svelte';

	/** A modal dialog on the browser's own <dialog>: focus is trapped, Escape closes it. Mount it to open it. */
	let { title, children, onclose }: { title: string; children: Snippet; onclose: () => void } =
		$props();
	const uid = $props.id();
	let el: HTMLDialogElement;

	onMount(() => el.showModal());
</script>

<dialog
	bind:this={el}
	class="mde-dialog"
	aria-labelledby="{uid}-t"
	{onclose}
	onclick={(e) => e.target === el && el.close()}
>
	<h2 id="{uid}-t">{title}</h2>
	{@render children()}
</dialog>

<style>
	.mde-dialog {
		/* A host's CSS reset may remove the browser's own centring of a modal; set it here. */
		margin: auto;
		width: min(28rem, calc(100vw - 2rem));
		padding: 1.25rem;
		border: 1px solid var(--mde-border);
		border-radius: calc(var(--mde-radius) + 2px);
		background: var(--mde-bg, Canvas);
		color: var(--mde-fg, CanvasText);
		font-family: var(--mde-ui-font);
	}
	.mde-dialog::backdrop {
		background: rgb(0 0 0 / 0.45);
	}
	h2 {
		margin: 0 0 1rem;
		font-size: 1.0625rem;
		font-weight: 600;
	}
	.mde-dialog :global(label) {
		display: block;
		margin-bottom: 0.75rem;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.mde-dialog :global(input[type='text']),
	.mde-dialog :global(input[type='url']),
	.mde-dialog :global(textarea) {
		display: block;
		width: 100%;
		box-sizing: border-box;
		margin-top: 0.25rem;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--mde-border);
		border-radius: 0.375rem;
		background: var(--mde-bg);
		color: inherit;
		font: inherit;
		font-weight: 400;
	}
	.mde-dialog :global(.help) {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.8125rem;
		font-weight: 400;
		color: var(--mde-muted);
	}
	.mde-dialog :global(.error) {
		color: var(--mde-danger);
		font-size: 0.8125rem;
		margin: -0.25rem 0 0.75rem;
	}
	.mde-dialog :global(.actions) {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: flex-end;
		margin-top: 1rem;
	}
	.mde-dialog :global(button) {
		padding: 0.5rem 0.875rem;
		border: 1px solid var(--mde-border);
		border-radius: 0.375rem;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.mde-dialog :global(button.primary) {
		background: var(--mde-accent);
		border-color: var(--mde-accent);
		color: var(--mde-on-accent);
	}
	.mde-dialog :global(button.danger) {
		color: var(--mde-danger);
		border-color: var(--mde-danger);
		margin-right: auto;
	}
	.mde-dialog :global(button:disabled) {
		opacity: 0.45;
		cursor: default;
	}
	.mde-dialog :global(:focus-visible) {
		outline: 2px solid var(--mde-accent);
		outline-offset: 1px;
	}
</style>
