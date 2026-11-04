/**
 * Playground-only image storage: files in static/uploads, one row per file in SQLite (Node's built-in node:sqlite,
 * no library). The editor itself knows nothing about this; it only calls the upload and delete functions it is given.
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const UPLOADS = join(process.cwd(), 'static', 'uploads');
const DATA = join(process.cwd(), 'data');
mkdirSync(UPLOADS, { recursive: true });
mkdirSync(DATA, { recursive: true });

const db = new DatabaseSync(join(DATA, 'editor.db'));
db.exec(`CREATE TABLE IF NOT EXISTS images (
	id INTEGER PRIMARY KEY,
	src TEXT NOT NULL UNIQUE,
	original_name TEXT NOT NULL,
	mime TEXT NOT NULL,
	bytes INTEGER NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

const TYPES = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif'
} as const;
export type ImageMime = keyof typeof TYPES;

/** The real type from the first bytes. The name and the declared type are never trusted. */
export function sniff(b: Uint8Array): ImageMime | null {
	const at = (i: number, ...v: number[]) => v.every((x, k) => b[i + k] === x);
	if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
	if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
	if (at(0, 0x47, 0x49, 0x46, 0x38)) return 'image/gif';
	if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
	return null;
}

export function saveImage(
	bytes: Uint8Array,
	mime: ImageMime,
	originalName: string
): { src: string } {
	const name = `${randomUUID()}.${TYPES[mime]}`;
	writeFileSync(join(UPLOADS, name), bytes);
	const src = `/uploads/${name}`;
	db.prepare('INSERT INTO images (src, original_name, mime, bytes) VALUES (?, ?, ?, ?)').run(
		src,
		originalName.slice(0, 200),
		mime,
		bytes.length
	);
	return { src };
}

const SAFE_SRC = /^\/uploads\/[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;

/** Deletes the file and its row. Returns false when the address is not one of ours. */
export function deleteImage(src: string): boolean {
	if (!SAFE_SRC.test(src)) return false;
	try {
		unlinkSync(join(UPLOADS, src.slice('/uploads/'.length)));
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
	}
	db.prepare('DELETE FROM images WHERE src = ?').run(src);
	return true;
}
