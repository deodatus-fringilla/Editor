import type { UploadedImage } from '#lib';

/** The playground's way of storing images: the /api/images endpoint. Other hosts plug in their own. */
export async function uploadImage(file: File): Promise<UploadedImage> {
	const body = new FormData();
	body.append('file', file);
	const res = await fetch('/api/images', { method: 'POST', body });
	if (!res.ok) throw new Error(await res.text());
	return res.json();
}

export async function deleteImage(src: string): Promise<void> {
	const res = await fetch(`/api/images?src=${encodeURIComponent(src)}`, { method: 'DELETE' });
	if (!res.ok) throw new Error(await res.text());
}

/** A very plain citation picker for testing: type "src:12" or "quote:3". */
export async function pickCitation() {
	const answer = prompt('Citation, for example src:12 or quote:3');
	const m = /^\s*(src|quote)\s*:\s*(\d{1,9})\s*$/i.exec(answer ?? '');
	return m ? { kind: m[1].toLowerCase() as 'src' | 'quote', id: Number(m[2]) } : null;
}
