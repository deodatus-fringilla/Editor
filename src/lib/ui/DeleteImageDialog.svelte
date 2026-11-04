<script lang="ts">
	import type { Labels } from '../core/labels';
	import Dialog from './Dialog.svelte';

	let {
		labels,
		onconfirm,
		onclose
	}: { labels: Labels; onconfirm: (alsoDeleteFile: boolean) => void; onclose: () => void } =
		$props();

	let choice = $state<'article' | 'file'>('article');
	let form: HTMLFormElement;
	const close = () => (form.closest('dialog') as HTMLDialogElement).close();
</script>

<Dialog title={labels.removeImageTitle} {onclose}>
	<form
		bind:this={form}
		onsubmit={(e) => {
			e.preventDefault();
			close();
			onconfirm(choice === 'file');
		}}
	>
		<fieldset>
			<legend class="sr">{labels.removeImageTitle}</legend>
			<label class="choice">
				<input type="radio" name="mde-delete" value="article" bind:group={choice} />
				<span
					>{labels.removeFromArticle}<span class="help">{labels.removeFromArticleHelp}</span></span
				>
			</label>
			<label class="choice">
				<input type="radio" name="mde-delete" value="file" bind:group={choice} />
				<span>{labels.removeAndDelete}<span class="help">{labels.removeAndDeleteHelp}</span></span>
			</label>
		</fieldset>
		<div class="actions">
			<button type="button" onclick={close}>{labels.cancel}</button>
			<button type="submit" class="primary">{labels.removeImage}</button>
		</div>
	</form>
</Dialog>

<style>
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
	}
	.choice {
		display: flex;
		gap: 0.625rem;
		align-items: flex-start;
		padding: 0.625rem;
		border: 1px solid var(--mde-border);
		border-radius: 0.375rem;
	}
	.choice:has(input:checked) {
		border-color: var(--mde-accent);
		background: var(--mde-accent-soft);
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
