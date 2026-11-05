<script lang="ts">
	/** Small line icons, drawn here so the editor needs no icon library. */
	const PATHS: Record<string, string[]> = {
		undo: ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11'],
		redo: ['m15 14 5-5-5-5', 'M20 9H9.5a5.5 5.5 0 0 0 0 11H13'],
		bold: ['M6 4h8a4 4 0 0 1 0 8H6z', 'M6 12h9a4 4 0 0 1 0 8H6z'],
		italic: ['M19 4h-9', 'M14 20H5', 'M15 4 9 20'],
		link: [
			'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
			'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'
		],
		ul: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
		ol: [
			'M10 6h11',
			'M10 12h11',
			'M10 18h11',
			'M4 6h1v4',
			'M4 10h2',
			'M6 18H4c0-1 2-2 2-3s-1-1.5-2-1'
		],
		quote: [
			'M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z',
			'M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z'
		],
		image: [
			'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
			'm21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21',
			'M9 8h.01'
		],
		citation: ['M6 3h12v18l-6-4-6 4z'],
		separator: ['M3 12h18', 'M8 7h8', 'M8 17h8']
	};
	let { name }: { name: string } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	width="18"
	height="18"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#each PATHS[name] ?? [] as d (d)}<path {d} />{/each}
</svg>
