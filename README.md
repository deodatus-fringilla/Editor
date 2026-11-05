# Editor

A visual article editor for Svelte 5, written for the Lemiesz journal ("redakcja"). Editors see their text as it will
look (bold, headings, lists, quotes, images, source citations); what is stored is **Markdown**, and readers get safe
HTML made from it.

No third-party editor libraries: everything here is our own code on top of the browser's `contenteditable`.

## Try it on your computer

You need Git and Node.js 22.13 or newer.

```bash
git clone https://github.com/deodatus-fringilla/editor.git
cd editor
git checkout claude/editor-build
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173). On the left is the editor; on the right you can switch
between **What readers see** and **Markdown that is stored** (you can edit the Markdown there too, and the editor
follows).

To get newer work later:

```bash
git pull
npm install
```

Uploaded test images go to `static/uploads/` and are recorded in `data/editor.db` (SQLite). Both are ignored by Git.

## What it does

|                 |                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Text            | bold, italic, links, headings 2–4, bulleted and numbered lists, block quotes, separator lines                   |
| Kept as written | tables, code blocks and images from addresses that are not allowed show as locked boxes and are saved unchanged |
| Images          | pick a file, paste or drag one in; alt text (required) and caption; click an image to edit it                   |
| Citations       | `[[src:12]]` and `[[quote:3]]` show as chips in the editor and as numbered footnotes for readers                |
| Paste           | Word, Google Docs and web pages are cleaned to the supported formatting; plain text is read as Markdown         |
| Undo / redo     | its own history (the browser's is not used)                                                                     |
| Copy and paste  | inside the editor, citations and images are kept; other programs get clean HTML and plain text                  |
| Read-only       | `readonly` shows the text without allowing changes (copying still works)                                        |
| Languages       | Polish and English labels included; the host can pass any labels                                                |

### Keyboard shortcuts

|                                                         |                                  |
| ------------------------------------------------------- | -------------------------------- |
| Bold, italic, link                                      | Ctrl+B, Ctrl+I, Ctrl+K           |
| Paragraph, headings 2–4                                 | Ctrl+Alt+0, 2, 3, 4              |
| Bulleted, numbered list, quote                          | Ctrl+Shift+8, 7, 9               |
| Undo, redo                                              | Ctrl+Z, Ctrl+Shift+Z (or Ctrl+Y) |
| Backspace at the start of a heading, list item or quote | turns it into a plain paragraph  |
| Shift+Enter                                             | line break inside a paragraph    |

(On a Mac, use ⌘ instead of Ctrl.)

## Using the component

```svelte
<script>
	import { Editor, Preview, labelsPl } from 'editor';

	let markdown = $state('');
</script>

<Editor
	bind:value={markdown}
	labels={labelsPl}
	onUploadImage={async (file) => ({ src: '/where/it/is.png' })}
	onDeleteImage={async (src) => {}}
	onPickCitation={async () => ({ kind: 'src', id: 12 })}
/>

<Preview value={markdown} columns={2} />
```

| Prop                                       |                                                                                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `value` (bindable)                         | the article as Markdown                                                                                                                        |
| `onchange(markdown)`                       | called after each change                                                                                                                       |
| `onUploadImage(file)`                      | stores the image and returns `{ src, alt?, caption? }`. Without it the image button is hidden. The component never assumes where images live.  |
| `onDeleteImage(src)`                       | optional. When given, removing an image asks: remove from this article only, or also delete the file. It is called only for the second choice. |
| `onPickCitation()`                         | optional. Returns `{ kind: 'src' \| 'quote', id }`, or `null`. Without it the citation button is hidden.                                       |
| `labels`                                   | any of the texts (see `labelsEn`, `labelsPl`)                                                                                                  |
| `requireAlt`                               | default `true`: an image needs alt text                                                                                                        |
| `allowImage(src)`                          | which image addresses may appear; default: only this site's (starting with `/`)                                                                |
| `readonly`, `placeholder`, `lang`, `class` | as expected                                                                                                                                    |

While typing, `value` is updated after a short pause (immediately after any command and when the editor loses
focus). Before saving from a keyboard shortcut, call `flush()` on the component (`bind:this={editor}`, then
`editor.flush()`).

`Preview` also takes `columns`, `allowImage`, `idPrefix` (footnote ids, one per article on a page) and `backLabel`.

Colours and fonts are CSS variables (`--mde-bg`, `--mde-fg`, `--mde-accent`, `--mde-font`, `--mde-font-size`, …); light
and dark follow the system.

## The stored format (Markdown)

Paragraphs, `##`–`####` headings (`#` counts as `##`), `---` separators, `-` and `1.` lists, `>` quotes, `**bold**`, `*italic*`, `[text](url)`,
`![alt](src "caption")` for images (add `{.left}`, `{.right}` or `{.full}` for placement) and `[[src:ID]]` / `[[quote:ID]]` for citations. Raw HTML is never passed through: if
it appears in the Markdown it is shown as text. Links keep only `http(s)`, `mailto:`, `#` and relative addresses.

Tables and fenced code blocks are kept as written. Links keep only `http(s)`, `mailto:`, `/paths` and `#anchors`, the
same rule as the Lemiesz renderer.

See `docs/proposals/` for the decisions behind this, and `docs/audits/` for the quality audit.

## Tests and checks

```bash
npm test          # unit tests (the editing tests run in a real Chromium)
npm run check     # types
npm run lint
```

The first time, the browser tests need Playwright's Chromium: `npx playwright install chromium`.

## Layout

- `src/lib/markdown/`: the Markdown rules (reading, writing, formatting), with no browser needed
- `src/lib/core/`: the editing surface: serializer, paste cleaner, history, keyboard, controller
- `src/lib/commands/`: bold/italic/link and block commands (our own, no `execCommand`)
- `src/lib/ui/`: toolbar and dialogs
- `src/routes/`: the playground (not part of the package), including the example image endpoint and SQLite table
