<script lang="ts" module>
	export type Command =
		| 'undo'
		| 'redo'
		| 'bold'
		| 'italic'
		| 'link'
		| 'p'
		| 'h2'
		| 'h3'
		| 'h4'
		| 'ul'
		| 'ol'
		| 'quote'
		| 'separator'
		| 'image'
		| 'citation';
</script>

<script lang="ts">
	import type { EditorState } from '../core/controller';
	import type { Labels } from '../core/labels';
	import Icon from './Icon.svelte';

	let {
		labels,
		editorState,
		canImage,
		canCite,
		oncommand
	}: {
		labels: Labels;
		editorState: EditorState;
		canImage: boolean;
		canCite: boolean;
		oncommand: (c: Command) => void;
	} = $props();

	interface Item {
		id: Command;
		label: string;
		keys?: string;
		icon?: string;
		text?: string;
		pressed?: boolean;
		disabled?: boolean;
	}

	const inBlock = (k: string) => editorState.kind === k && !editorState.list;
	const groups = $derived<Item[][]>(
		[
			[
				{
					id: 'undo',
					label: labels.undo,
					keys: 'Ctrl+Z',
					icon: 'undo',
					disabled: !editorState.canUndo
				},
				{
					id: 'redo',
					label: labels.redo,
					keys: 'Ctrl+Shift+Z',
					icon: 'redo',
					disabled: !editorState.canRedo
				}
			],
			[
				{ id: 'bold', label: labels.bold, keys: 'Ctrl+B', icon: 'bold', pressed: editorState.bold },
				{
					id: 'italic',
					label: labels.italic,
					keys: 'Ctrl+I',
					icon: 'italic',
					pressed: editorState.italic
				},
				{ id: 'link', label: labels.link, keys: 'Ctrl+K', icon: 'link', pressed: editorState.link }
			],
			[
				{ id: 'p', label: labels.paragraph, keys: 'Ctrl+Alt+0', text: '¶', pressed: inBlock('p') },
				{
					id: 'h2',
					label: labels.heading2,
					keys: 'Ctrl+Alt+2',
					text: 'H2',
					pressed: inBlock('h2')
				},
				{
					id: 'h3',
					label: labels.heading3,
					keys: 'Ctrl+Alt+3',
					text: 'H3',
					pressed: inBlock('h3')
				},
				{ id: 'h4', label: labels.heading4, keys: 'Ctrl+Alt+4', text: 'H4', pressed: inBlock('h4') }
			],
			[
				{
					id: 'ul',
					label: labels.bulletList,
					keys: 'Ctrl+Shift+8',
					icon: 'ul',
					pressed: editorState.list === 'ul'
				},
				{
					id: 'ol',
					label: labels.numberedList,
					keys: 'Ctrl+Shift+7',
					icon: 'ol',
					pressed: editorState.list === 'ol'
				},
				{
					id: 'quote',
					label: labels.quote,
					keys: 'Ctrl+Shift+9',
					icon: 'quote',
					pressed: editorState.quote
				},
				{ id: 'separator', label: labels.separator, icon: 'separator' }
			],
			[
				...(canImage ? [{ id: 'image', label: labels.image, icon: 'image' } as Item] : []),
				...(canCite ? [{ id: 'citation', label: labels.citation, icon: 'citation' } as Item] : [])
			]
		].filter((g) => g.length) as Item[][]
	);

	const flat = $derived(groups.flat());
	let bar: HTMLElement;
	let current = $state(0);
	// The tab stop must be a button that can take focus: at start Undo is disabled.
	const stop = $derived(flat[current]?.disabled ? flat.findIndex((x) => !x.disabled) : current);

	// One tab stop for the whole toolbar; arrow keys move between buttons.
	function onkeydown(e: KeyboardEvent) {
		const buttons = Array.from(bar.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
		const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
		const next = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: buttons.length - 1 }[e.key];
		if (next === undefined || at < 0) return;
		e.preventDefault();
		buttons[(next + buttons.length) % buttons.length].focus();
	}
</script>

<!-- Buttons never take focus from the text, so the selection stays where it is. -->
<div
	bind:this={bar}
	class="mde-toolbar"
	role="toolbar"
	aria-label={labels.toolbar}
	tabindex="-1"
	{onkeydown}
>
	{#each groups as group, g (g)}
		<div class="group" role="group">
			{#each group as item (item.id)}
				{@const i = flat.indexOf(item)}
				<button
					type="button"
					class="btn"
					class:text={!!item.text}
					title={item.keys ? `${item.label} (${item.keys})` : item.label}
					aria-label={item.label}
					aria-pressed={item.pressed === undefined ? undefined : item.pressed}
					disabled={item.disabled}
					tabindex={i === stop ? 0 : -1}
					onmousedown={(e) => e.preventDefault()}
					onfocus={() => (current = i)}
					onclick={() => oncommand(item.id)}
				>
					{#if item.icon}<Icon name={item.icon} />{:else}{item.text}{/if}
				</button>
			{/each}
		</div>
	{/each}
</div>

<style>
	.mde-toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.75rem;
		padding: 0.375rem 0.5rem;
		border-bottom: 1px solid var(--mde-border);
		background: var(--mde-toolbar-bg);
		position: sticky;
		top: var(--mde-toolbar-top, 0);
		z-index: 2;
		border-radius: var(--mde-radius) var(--mde-radius) 0 0;
	}
	.group {
		display: flex;
		gap: 0.125rem;
	}
	.group + .group {
		padding-left: 0.75rem;
		border-left: 1px solid var(--mde-border);
	}
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2rem;
		height: 2rem;
		padding: 0 0.375rem;
		border: 1px solid transparent;
		border-radius: 0.375rem;
		background: transparent;
		color: var(--mde-fg);
		font: inherit;
		cursor: pointer;
	}
	.btn.text {
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.btn:hover:not(:disabled) {
		background: var(--mde-hover);
	}
	.btn[aria-pressed='true'] {
		background: var(--mde-accent-soft);
		border-color: var(--mde-accent);
		color: var(--mde-accent-fg);
	}
	.btn:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.btn:focus-visible {
		outline: 2px solid var(--mde-accent);
		outline-offset: 1px;
	}
</style>
