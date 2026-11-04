<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { EditorController, type EditorState } from './core/controller';
	import { labelsEn, type Labels } from './core/labels';
	import { currentRange } from './core/selection';
	import DeleteImageDialog from './ui/DeleteImageDialog.svelte';
	import ImageDialog from './ui/ImageDialog.svelte';
	import LinkDialog from './ui/LinkDialog.svelte';
	import Toolbar, { type Command } from './ui/Toolbar.svelte';

	export interface UploadedImage {
		src: string;
		alt?: string;
		caption?: string;
	}
	export interface Citation {
		kind: 'src' | 'quote';
		id: number;
	}

	let {
		value = $bindable(''),
		onchange,
		onUploadImage,
		onDeleteImage,
		onPickCitation,
		labels,
		requireAlt = true,
		readonly = false,
		placeholder = '',
		lang,
		class: className = ''
	}: {
		/** The article as Markdown. */
		value?: string;
		onchange?: (markdown: string) => void;
		/** Stores an image and returns where it can be found. Without it the image button is hidden. */
		onUploadImage?: (file: File) => Promise<UploadedImage>;
		/** Deletes the stored file. When given, removing an image asks whether to delete the file too. */
		onDeleteImage?: (src: string) => Promise<void>;
		/** Lets the user choose a source or quotation to cite. Without it the citation button is hidden. */
		onPickCitation?: () => Promise<Citation | null>;
		labels?: Partial<Labels>;
		requireAlt?: boolean;
		readonly?: boolean;
		placeholder?: string;
		lang?: string;
		class?: string;
	} = $props();

	const L = $derived<Labels>({ ...labelsEn, ...labels });
	const idle: EditorState = {
		bold: false,
		italic: false,
		link: false,
		kind: 'p',
		list: null,
		quote: false,
		canUndo: false,
		canRedo: false
	};

	let surface: HTMLDivElement;
	let fileInput: HTMLInputElement;
	let controller = $state.raw<EditorController>();
	let editorState = $state<EditorState>(idle);
	let status = $state('');
	let lastEmitted: string | undefined;

	type Draft = { src: string; alt: string; caption: string; figure: HTMLElement | null };
	let linkDraft = $state<{ href: string } | null>(null);
	let imageDraft = $state<Draft | null>(null);
	let removing = $state<HTMLElement | null>(null);

	onMount(() => {
		controller = new EditorController(surface, {
			labels: () => L,
			emit(md) {
				lastEmitted = md;
				value = md;
				onchange?.(md);
			},
			state: (s) => (editorState = s),
			imageFile: (file) => void takeImage(file),
			removeFigure: askRemove,
			openLink
		});
		const onSelection = () => currentRange(surface) && controller?.pushState();
		document.addEventListener('selectionchange', onSelection);
		return () => document.removeEventListener('selectionchange', onSelection);
	});

	// Load text that arrives from outside (the first value, or the host replacing it); ignore our own echoes.
	$effect(() => {
		const v = value ?? '';
		if (controller && v !== lastEmitted) {
			lastEmitted = v;
			untrack(() => controller!.load(v));
		}
	});

	function openLink() {
		if (!controller) return;
		controller.rememberSelection();
		linkDraft = { href: controller.currentLink().href };
	}

	async function takeImage(file: File) {
		if (!onUploadImage || !controller) return;
		controller.rememberSelection();
		status = L.uploading;
		try {
			const r = await onUploadImage(file);
			imageDraft = { src: r.src, alt: r.alt ?? '', caption: r.caption ?? '', figure: null };
			status = '';
		} catch {
			status = L.uploadFailed;
		}
	}

	function editFigure(fig: HTMLElement) {
		const img = fig.querySelector('img');
		controller?.rememberSelection();
		imageDraft = {
			src: img?.getAttribute('src') ?? '',
			alt: img?.getAttribute('alt') ?? '',
			caption: fig.querySelector('figcaption')?.textContent ?? '',
			figure: fig
		};
	}

	function askRemove(fig: HTMLElement) {
		if (onDeleteImage) removing = fig;
		else controller?.removeFigure(fig);
	}

	async function confirmRemove(alsoDeleteFile: boolean) {
		const fig = removing;
		removing = null;
		if (!fig || !controller) return;
		const src = fig.querySelector('img')?.getAttribute('src');
		controller.removeFigure(fig);
		if (alsoDeleteFile && src && onDeleteImage) {
			try {
				await onDeleteImage(src);
			} catch {
				status = L.deleteFailed;
			}
		}
	}

	async function command(c: Command) {
		const k = controller;
		if (!k) return;
		surface.focus();
		if (c === 'undo') k.undo();
		else if (c === 'redo') k.redo();
		else if (c === 'bold') k.bold();
		else if (c === 'italic') k.italic();
		else if (c === 'link') openLink();
		else if (c === 'p' || c === 'h2' || c === 'h3' || c === 'h4') k.block(c);
		else if (c === 'ul' || c === 'ol') k.list(c);
		else if (c === 'quote') k.quote();
		else if (c === 'image') {
			k.rememberSelection();
			fileInput.click();
		} else if (c === 'citation' && onPickCitation) {
			k.rememberSelection();
			const picked = await onPickCitation();
			if (picked) k.insertCitation(picked.kind, picked.id);
			else k.recall();
		}
	}

	function onSurfaceClick(e: MouseEvent) {
		const fig = (e.target as Element).closest('figure');
		if (fig && surface.contains(fig) && !readonly) editFigure(fig as HTMLElement);
	}

	function onSurfaceKey(e: KeyboardEvent) {
		const fig = (e.target as Element).closest?.('figure');
		if (fig && e.target === fig && e.key === 'Enter') {
			e.preventDefault();
			editFigure(fig as HTMLElement);
		} else controller?.keydown(e);
	}

	const closeLink = () => ((linkDraft = null), controller?.recall());
	const closeImage = () => ((imageDraft = null), controller?.recall());
</script>

<div class="mde {className}">
	{#if !readonly}
		<Toolbar
			labels={L}
			{editorState}
			canImage={!!onUploadImage}
			canCite={!!onPickCitation}
			oncommand={command}
		/>
	{/if}
	<div
		bind:this={surface}
		class="mde-surface"
		role="textbox"
		tabindex="0"
		aria-multiline="true"
		aria-label={L.editor}
		contenteditable={readonly ? 'false' : 'true'}
		spellcheck="true"
		{lang}
		data-placeholder={placeholder}
		onbeforeinput={(e) => controller?.beforeInput(e)}
		oninput={() => controller?.input()}
		onkeydown={onSurfaceKey}
		onpaste={(e) => controller?.paste(e)}
		ondrop={(e) => controller?.drop(e)}
		oncompositionstart={() => controller?.compositionStart()}
		oncompositionend={() => controller?.compositionEnd()}
		onblur={() => controller?.blur()}
		onclick={onSurfaceClick}
	></div>
	<p class="mde-status" role="status" aria-live="polite">{status}</p>
	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		hidden
		onchange={(e) => {
			const f = e.currentTarget.files?.[0];
			e.currentTarget.value = '';
			if (f) void takeImage(f);
		}}
	/>

	{#if linkDraft}
		<LinkDialog
			labels={L}
			href={linkDraft.href}
			onapply={(href) => controller?.setLink(href)}
			onremove={() => controller?.setLink(null)}
			onclose={closeLink}
		/>
	{/if}
	{#if imageDraft}
		{@const draft = imageDraft}
		<ImageDialog
			labels={L}
			src={draft.src}
			alt={draft.alt}
			caption={draft.caption}
			editing={!!draft.figure}
			{requireAlt}
			onsubmit={(d) => {
				try {
					if (draft.figure) controller?.updateFigure(draft.figure, d);
					else controller?.insertFigure({ src: draft.src, ...d });
				} catch {
					status = L.uploadFailed;
				}
			}}
			onremove={() => draft.figure && askRemove(draft.figure)}
			onclose={closeImage}
		/>
	{/if}
	{#if removing}
		<DeleteImageDialog
			labels={L}
			onconfirm={confirmRemove}
			onclose={() => ((removing = null), controller?.recall())}
		/>
	{/if}
</div>

<style>
	.mde {
		--mde-bg: light-dark(#ffffff, #16181d);
		--mde-fg: light-dark(#1b1f27, #e8eaef);
		--mde-muted: light-dark(#667085, #98a2b3);
		--mde-border: light-dark(#d0d5dd, #343a46);
		--mde-hover: light-dark(#f2f4f7, #242831);
		--mde-toolbar-bg: light-dark(#f9fafb, #1c1f26);
		--mde-accent: light-dark(#1d4ed8, #6e9bff);
		--mde-accent-soft: light-dark(#e8efff, #1f2b4a);
		--mde-accent-fg: light-dark(#1236a3, #c9d9ff);
		--mde-on-accent: light-dark(#ffffff, #0b1020);
		--mde-danger: light-dark(#b42318, #ff8a80);
		--mde-radius: 0.5rem;
		--mde-ui-font: system-ui, -apple-system, 'Segoe UI', sans-serif;
		--mde-font: Georgia, 'Times New Roman', serif;
		--mde-font-size: 1.125rem;
		--mde-line-height: 1.7;
		color-scheme: light dark;
		border: 1px solid var(--mde-border);
		border-radius: var(--mde-radius);
		background: var(--mde-bg);
		color: var(--mde-fg);
		font-family: var(--mde-ui-font);
	}
	.mde-surface {
		min-height: var(--mde-min-height, 16rem);
		padding: 1rem 1.25rem;
		outline: none;
		font-family: var(--mde-font);
		font-size: var(--mde-font-size);
		line-height: var(--mde-line-height);
		overflow-wrap: anywhere;
	}
	.mde-surface:focus-visible {
		box-shadow: inset 0 0 0 2px var(--mde-accent);
	}
	.mde-status {
		min-height: 1.25rem;
		margin: 0;
		padding: 0 1.25rem 0.5rem;
		font-size: 0.8125rem;
		color: var(--mde-danger);
	}
	.mde :global(.mde-surface[data-empty] > p:first-child) {
		position: relative;
	}
	.mde :global(.mde-surface[data-empty] > p:first-child::before) {
		content: attr(data-placeholder);
		color: var(--mde-muted);
		pointer-events: none;
		position: absolute;
	}
	.mde-surface :global(h2),
	.mde-surface :global(h3),
	.mde-surface :global(h4) {
		margin: 1.4em 0 0.4em;
		line-height: 1.25;
	}
	.mde-surface :global(h2) {
		font-size: 1.6em;
	}
	.mde-surface :global(h3) {
		font-size: 1.3em;
	}
	.mde-surface :global(h4) {
		font-size: 1.1em;
	}
	.mde-surface :global(p) {
		margin: 0 0 0.9em;
	}
	.mde-surface :global(ul),
	.mde-surface :global(ol) {
		margin: 0 0 0.9em;
		padding-left: 1.6em;
	}
	.mde-surface :global(blockquote) {
		margin: 0 0 0.9em;
		padding-left: 1em;
		border-left: 3px solid var(--mde-border);
		color: var(--mde-muted);
	}
	.mde-surface :global(a) {
		color: var(--mde-accent);
		text-decoration: underline;
	}
	.mde-surface :global(.mde-cite) {
		display: inline-block;
		padding: 0 0.4em;
		margin: 0 0.1em;
		border: 1px solid var(--mde-accent);
		border-radius: 999px;
		background: var(--mde-accent-soft);
		color: var(--mde-accent-fg);
		font: 600 0.72em/1.6 var(--mde-ui-font);
		vertical-align: 0.15em;
		cursor: default;
		user-select: all;
	}
	.mde-surface :global(figure) {
		margin: 1em 0;
		padding: 0.5rem;
		border: 1px solid transparent;
		border-radius: 0.375rem;
		cursor: pointer;
		text-align: center;
	}
	.mde-surface :global(figure:hover),
	.mde-surface :global(figure:focus-visible) {
		border-color: var(--mde-accent);
		outline: none;
	}
	.mde-surface :global(figure img) {
		max-width: 100%;
		height: auto;
		border-radius: 0.25rem;
	}
	.mde-surface :global(figcaption) {
		margin-top: 0.4em;
		font: 0.85em var(--mde-ui-font);
		color: var(--mde-muted);
	}
</style>
