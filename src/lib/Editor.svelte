<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { EditorController, type EditorState } from './core/controller';
	import { labelsEn, type Labels } from './core/labels';
	import { currentRange } from './core/selection';
	import { isLocalImage } from './markdown/escape';
	import DeleteImageDialog from './ui/DeleteImageDialog.svelte';
	import ImageDialog from './ui/ImageDialog.svelte';
	import LinkDialog from './ui/LinkDialog.svelte';
	import Toolbar, { type Command } from './ui/Toolbar.svelte';
	import type { Placement } from './markdown/render';

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
		onPickImage,
		altEditable = true,
		placements = ['center', 'left', 'right', 'full'],
		onDeleteImage,
		onPickCitation,
		labels,
		requireAlt = true,
		readonly = false,
		allowImage = isLocalImage,
		placeholder = '',
		lang,
		class: className = ''
	}: {
		/** The article as Markdown. */
		value?: string;
		onchange?: (markdown: string) => void;
		/** Stores an image and returns where it can be found. Without it the image button is hidden. */
		onUploadImage?: (file: File) => Promise<UploadedImage>;
		/**
		 * Lets the host choose the image itself (for example from its own image library, with its own upload form).
		 * Called when the image button is pressed (no file) and when an image file is pasted or dropped (with the
		 * file). Return the image, or null when the user cancels. Used instead of `onUploadImage` when both are given.
		 */
		onPickImage?: (file?: File) => Promise<UploadedImage | null>;
		/** False when the host owns the description (alt text), which is then shown but not edited here. */
		altEditable?: boolean;
		/** Which positions the image dialog offers. */
		placements?: Placement[];
		/** Deletes the stored file. When given, removing an image asks whether to delete the file too. */
		onDeleteImage?: (src: string) => Promise<void>;
		/** Lets the user choose a source or quotation to cite. Without it the citation button is hidden. */
		onPickCitation?: () => Promise<Citation | null>;
		labels?: Partial<Labels>;
		requireAlt?: boolean;
		readonly?: boolean;
		/** Which image addresses may appear. Default: only this site's own (starting with `/`). */
		allowImage?: (src: string) => boolean;
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
	let statusTimer: ReturnType<typeof setTimeout> | undefined;
	let lastEmitted: string | undefined;

	/** Shows a short message for a few seconds. */
	function say(message: string, keep = false) {
		clearTimeout(statusTimer);
		status = message;
		if (message && !keep) statusTimer = setTimeout(() => (status = ''), 8000);
	}

	type Draft = {
		src: string;
		alt: string;
		caption: string;
		place: Placement;
		figure: HTMLElement | null;
		/** Uploaded just for this dialog (and so removable again if the dialog is cancelled). */
		fresh?: boolean;
	};
	let linkDraft = $state<{ href: string } | null>(null);
	let imageDraft = $state<Draft | null>(null);
	/** Set when the image dialog's result was used, so a cancelled fresh upload can be cleaned up. */
	let imageUsed = false;
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
			openLink,
			allowImage: (src) => allowImage(src)
		});
		const onSelection = () => currentRange(surface) && controller?.pushState();
		document.addEventListener('selectionchange', onSelection);
		return () => {
			document.removeEventListener('selectionchange', onSelection);
			// Text typed just before the editor goes away must not be lost.
			controller?.flushPending();
			controller?.destroy();
		};
	});

	// When the host switches language, citation chips follow.
	$effect(() => {
		void L;
		untrack(() => controller?.relabel());
	});

	// Load text that arrives from outside (the first value, or the host replacing it); ignore our own echoes.
	$effect(() => {
		const v = value ?? '';
		if (controller && v !== lastEmitted) {
			lastEmitted = v;
			untrack(() => controller!.load(v));
		}
	});

	/**
	 * Sends any text typed in the last moment to `value` right away. While typing, the editor updates `value` after a
	 * short pause; call this before saving from a keyboard shortcut that does not take focus out of the editor.
	 */
	export function flush() {
		controller?.flush();
	}

	function openLink() {
		if (!controller) return;
		controller.rememberSelection();
		linkDraft = { href: controller.currentLink().href };
	}

	/** An image to insert: chosen by the host (`onPickImage`) or uploaded (`onUploadImage`). */
	async function takeImage(file?: File) {
		if (!controller || !(onPickImage || (onUploadImage && file))) return;
		controller.rememberSelection();
		if (!onPickImage) say(L.uploading, true);
		try {
			const r = onPickImage ? await onPickImage(file) : await onUploadImage!(file!);
			if (!r) {
				say('');
				return controller.recall();
			}
			imageUsed = false;
			imageDraft = {
				src: r.src,
				alt: r.alt ?? '',
				caption: r.caption ?? '',
				place: placements.includes('center') ? 'center' : placements[0],
				figure: null,
				fresh: !onPickImage
			};
			say('');
		} catch {
			say(L.uploadFailed);
		}
	}

	function editFigure(fig: HTMLElement) {
		const img = fig.querySelector('img');
		controller?.rememberSelection();
		imageDraft = {
			src: img?.getAttribute('src') ?? '',
			alt: img?.getAttribute('alt') ?? '',
			caption: fig.querySelector('figcaption')?.textContent ?? '',
			place: (fig.dataset.place as Placement | undefined) ?? 'center',
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
		if (!alsoDeleteFile || !src || !onDeleteImage) return;
		// The same file may appear again further down: then deleting it would break that copy.
		const stillUsed = Array.from(surface.querySelectorAll('figure img')).some(
			(img) => img.getAttribute('src') === src
		);
		if (stillUsed) return say(L.imageStillUsed);
		try {
			await onDeleteImage(src);
		} catch {
			say(L.deleteFailed);
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
		else if (c === 'separator') k.separator();
		else if (c === 'image') {
			k.rememberSelection();
			if (onPickImage) void takeImage();
			else fileInput.click();
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
		if (readonly) return;
		const fig = (e.target as Element).closest?.('figure');
		if (fig && e.target === fig && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
			e.preventDefault();
			if (controller?.moveFigure(fig as HTMLElement, e.key === 'ArrowUp' ? -1 : 1)) fig.focus();
		} else if (fig && e.target === fig && e.key === 'Enter') {
			e.preventDefault();
			editFigure(fig as HTMLElement);
		} else controller?.keydown(e);
	}

	const closeLink = () => ((linkDraft = null), controller?.recall());
	function closeImage() {
		const draft = imageDraft;
		imageDraft = null;
		controller?.recall();
		// A picture uploaded for this dialog and then not inserted would stay behind as an unused file.
		if (draft?.fresh && !draft.figure && !imageUsed && onDeleteImage)
			void onDeleteImage(draft.src).catch(() => {});
	}

	/** In read-only mode nothing may change the text; copying is still allowed. */
	const editable =
		<E extends Event>(fn: (e: E) => void) =>
		(e: E) => {
			if (!readonly) fn(e);
			else if (e.type !== 'beforeinput') e.preventDefault();
		};
</script>

<div class="mde {className}">
	{#if !readonly}
		<Toolbar
			labels={L}
			{editorState}
			canImage={!!(onUploadImage || onPickImage)}
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
		aria-readonly={readonly}
		aria-label={L.editor}
		contenteditable={readonly ? 'false' : 'true'}
		spellcheck="true"
		{lang}
		data-placeholder={placeholder}
		onbeforeinput={(e) => (readonly ? e.preventDefault() : controller?.beforeInput(e))}
		oninput={() => controller?.input()}
		onkeydown={onSurfaceKey}
		onpaste={editable((e: ClipboardEvent) => controller?.paste(e))}
		ondrop={editable((e: DragEvent) => controller?.drop(e))}
		oncut={editable((e: ClipboardEvent) => controller?.cut(e))}
		oncopy={(e) => controller?.copy(e)}
		ondragstart={(e) => controller?.dragStart(e)}
		ondragover={editable((e: DragEvent) => controller?.dragOver(e))}
		ondragend={() => controller?.dragEnd()}
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
			place={draft.place}
			{placements}
			{altEditable}
			editing={!!draft.figure}
			{requireAlt}
			onsubmit={(d) => {
				try {
					if (draft.figure) controller?.updateFigure(draft.figure, d);
					else controller?.insertFigure({ src: draft.src, ...d });
					imageUsed = true;
				} catch {
					say(L.imageNotAllowed);
				}
			}}
			onmove={(dir) => draft.figure && controller?.moveFigure(draft.figure, dir)}
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
	/*
	 * Theme. Every value can be overridden from outside with the same name under --ed-, for example
	 * `--ed-bg: #09090b; --ed-accent: #fbbf24;` on a parent element. Other settings: --mde-min-height (the text
	 * area's least height) and --mde-toolbar-top (where the toolbar sticks while scrolling).
	 */
	.mde {
		--mde-bg: var(--ed-bg, light-dark(#ffffff, #16181d));
		--mde-fg: var(--ed-fg, light-dark(#1b1f27, #e8eaef));
		--mde-muted: var(--ed-muted, light-dark(#667085, #98a2b3));
		--mde-border: var(--ed-border, light-dark(#d0d5dd, #343a46));
		--mde-hover: var(--ed-hover, light-dark(#f2f4f7, #242831));
		--mde-toolbar-bg: var(--ed-toolbar-bg, light-dark(#f9fafb, #1c1f26));
		--mde-accent: var(--ed-accent, light-dark(#1d4ed8, #6e9bff));
		--mde-accent-soft: var(--ed-accent-soft, light-dark(#e8efff, #1f2b4a));
		--mde-accent-fg: var(--ed-accent-fg, light-dark(#1236a3, #c9d9ff));
		--mde-on-accent: var(--ed-on-accent, light-dark(#ffffff, #0b1020));
		--mde-danger: var(--ed-danger, light-dark(#b42318, #ff8a80));
		--mde-radius: var(--ed-radius, 0.5rem);
		--mde-ui-font: var(--ed-ui-font, system-ui, -apple-system, 'Segoe UI', sans-serif);
		--mde-font: var(--ed-font, Georgia, 'Times New Roman', serif);
		--mde-font-size: var(--ed-font-size, 1.125rem);
		--mde-line-height: var(--ed-line-height, 1.7);
		color-scheme: var(--ed-color-scheme, light dark);
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
		display: flow-root;
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
	/* Written out in full so a host's CSS reset (Tailwind's, for one) cannot flatten headings, lists and emphasis. */
	.mde-surface :global(h2),
	.mde-surface :global(h3),
	.mde-surface :global(h4) {
		margin: 1.4em 0 0.4em;
		font-weight: 700;
		line-height: 1.25;
	}
	.mde-surface :global(strong) {
		font-weight: 700;
	}
	.mde-surface :global(em) {
		font-style: italic;
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
	.mde-surface :global(ul) {
		list-style: disc;
	}
	.mde-surface :global(ol) {
		list-style: decimal;
	}
	.mde-surface :global(li) {
		margin: 0.2em 0;
	}
	.mde-surface :global(blockquote) {
		display: flow-root;
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
	.mde-surface :global(hr) {
		margin: 1.5em 0;
		border: 0;
		border-top: 2px solid var(--mde-border);
	}
	.mde-surface :global(code) {
		padding: 0.1em 0.3em;
		border-radius: 0.25rem;
		background: var(--mde-hover);
		font:
			0.88em ui-monospace,
			'SF Mono',
			Menlo,
			Consolas,
			monospace;
	}
	.mde-surface :global(pre.mde-raw) {
		position: relative;
		margin: 1em 0;
		padding: 1.75rem 0.75rem 0.75rem;
		border: 1px dashed var(--mde-border);
		border-radius: 0.375rem;
		background: var(--mde-hover);
		color: var(--mde-muted);
		font:
			0.8em/1.5 ui-monospace,
			'SF Mono',
			Menlo,
			Consolas,
			monospace;
		white-space: pre;
		overflow-x: auto;
		cursor: default;
	}
	.mde-surface :global(pre.mde-raw)::before {
		content: attr(data-label);
		position: absolute;
		top: 0.4rem;
		left: 0.75rem;
		font: 600 0.72rem var(--mde-ui-font);
		color: var(--mde-muted);
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
	.mde-surface :global(figure[data-place='left']),
	.mde-surface :global(figure[data-place='right']) {
		width: 45%;
		margin-top: 0.3em;
		margin-bottom: 0.6em;
	}
	.mde-surface :global(figure[data-place='left']) {
		float: left;
		margin-right: 1.25em;
		margin-left: 0;
	}
	.mde-surface :global(figure[data-place='right']) {
		float: right;
		margin-left: 1.25em;
		margin-right: 0;
	}
	.mde-surface :global(figure[data-place='full']) {
		clear: both;
	}
	.mde-surface :global(figure[data-place='full'] img) {
		width: 100%;
	}
	@media (max-width: 36rem) {
		.mde-surface :global(figure[data-place='left']),
		.mde-surface :global(figure[data-place='right']) {
			float: none;
			width: auto;
			margin-inline: 0;
		}
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
