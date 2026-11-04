<script lang="ts">
	let { value = $bindable(''), label }: { value: string; label: string } = $props();
</script>

<label class="source">
	<span class="sr">{label}</span>
	<textarea bind:value spellcheck="false"></textarea>
</label>

<style>
	.source textarea {
		width: 100%;
		min-height: 24rem;
		box-sizing: border-box;
		padding: 0.75rem;
		border: 1px solid var(--line);
		border-radius: 0.5rem;
		background: var(--panel);
		color: inherit;
		font:
			0.875rem/1.55 ui-monospace,
			'SF Mono',
			Menlo,
			Consolas,
			monospace;
		resize: vertical;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
