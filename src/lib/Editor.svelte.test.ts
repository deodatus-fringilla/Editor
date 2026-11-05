import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import Editor from './Editor.svelte';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Editor with a host-managed image library', () => {
	it('asks the host for the image, shows its description read-only and limits the positions', async () => {
		const out: string[] = [];
		const asked: (File | undefined)[] = [];
		render(Editor, {
			value: 'Intro.',
			onchange: (m: string) => out.push(m),
			onPickImage: async (file?: File) => {
				asked.push(file);
				return { src: '/images/web/jez.webp', alt: 'Jeż pod dębem', caption: 'Dąb' };
			},
			altEditable: false,
			placements: ['center', 'left', 'right']
		});
		await page.getByRole('button', { name: 'Insert image' }).click();
		await expect.element(page.getByRole('dialog')).toBeVisible();
		expect(asked).toEqual([undefined]);
		// The description is shown but cannot be edited here, and a missing "full width" choice is not offered.
		await expect.element(page.getByText('Jeż pod dębem')).toBeVisible();
		expect(document.querySelectorAll('dialog input[type=text]')).toHaveLength(1); // caption only
		const options = Array.from(document.querySelectorAll('dialog .place label')).map((l) =>
			l.textContent?.trim()
		);
		expect(options).toEqual(['Centred', 'Left, text wraps', 'Right, text wraps']);
		await page.getByText('Left, text wraps').click();
		await page.getByRole('dialog').getByRole('button', { name: 'Insert', exact: true }).click();
		await wait(50);
		expect(out.at(-1)).toBe('Intro.\n\n![Jeż pod dębem](/images/web/jez.webp "Dąb"){.left}');
	});

	it('inserts nothing when the host returns null (the user cancelled)', async () => {
		const out: string[] = [];
		render(Editor, {
			value: 'Text.',
			onchange: (m: string) => out.push(m),
			onPickImage: async () => null
		});
		await page.getByRole('button', { name: 'Insert image' }).click();
		await wait(100);
		expect(document.querySelector('dialog')).toBeNull();
		expect(out).toEqual([]);
	});

	it('refuses an image address the host did not allow', async () => {
		render(Editor, {
			value: 'Text.',
			onPickImage: async () => ({ src: 'https://tracker.example/p.png', alt: 'x' })
		});
		await page.getByRole('button', { name: 'Insert image' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Insert', exact: true }).click();
		await expect.element(page.getByText('This image address is not allowed.')).toBeVisible();
	});
});

describe('Editor theme', () => {
	it('takes its colours from --ed-* variables set by the host', async () => {
		document.body.style.setProperty('--ed-bg', 'rgb(9, 9, 11)');
		document.body.style.setProperty('--ed-accent', 'rgb(251, 191, 36)');
		render(Editor, { value: 'x' });
		const box = document.querySelector('.mde') as HTMLElement;
		expect(getComputedStyle(box).backgroundColor).toBe('rgb(9, 9, 11)');
		expect(getComputedStyle(box).getPropertyValue('--mde-accent').trim()).toBe('rgb(251, 191, 36)');
		document.body.style.removeProperty('--ed-bg');
		document.body.style.removeProperty('--ed-accent');
	});
});
