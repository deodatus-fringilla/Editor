import { error, json } from '@sveltejs/kit';
import { deleteImage, saveImage, sniff } from './store';
import type { RequestHandler } from './$types';

const MAX_BYTES = 8 * 1024 * 1024;

export const POST: RequestHandler = async ({ request }) => {
	const file = (await request.formData()).get('file');
	if (!(file instanceof File)) error(400, 'No file');
	if (file.size > MAX_BYTES) error(413, 'The image is larger than 8 MB');
	const bytes = new Uint8Array(await file.arrayBuffer());
	const mime = sniff(bytes);
	if (!mime) error(415, 'Only JPEG, PNG, WebP and GIF images are accepted');
	return json(saveImage(bytes, mime, file.name));
};

export const DELETE: RequestHandler = ({ url }) => {
	if (!deleteImage(url.searchParams.get('src') ?? '')) error(400, 'Not an uploaded image');
	return new Response(null, { status: 204 });
};
