# Proposal 001: Editor architecture

Status: accepted

## Goal

A standalone, importable Svelte 5 component: a simple HTML editor for a publishing company that publishes articles with images in HTML format.

## Constraints

- No external libraries, unless they are written in Svelte 5.
- Images are stored locally in the `static` folder, with their links kept in SQLite.

## Architecture

- **The component stays storage-agnostic.** A published package cannot assume a `static/` folder or a database. The editor takes an `onUploadImage(file) => Promise<{ src, alt? }>` prop and inserts whatever URL comes back.
- **The playground app (`src/routes`) is the reference host.** It provides a `POST /api/images` endpoint that saves the file to `static/uploads/` and records the path and metadata in SQLite. Other hosts can plug in their own storage.
- **SQLite without a library.** Node 22 ships `node:sqlite`, so no package is needed. It is used only in playground server code, never in the component.

## Editor core (all our own code)

- A `contenteditable` surface with Selection/Range-based commands: bold, italic, headings, links, lists, blockquote, and images with alt text and caption (`<figure>`/`<figcaption>`).
- Avoid `document.execCommand`. It is deprecated and its HTML output varies between browsers. Own commands give clean, predictable HTML.
- A whitelist sanitizer, written in-house, runs on paste and on output to strip junk markup from Word and web pastes.
- API: `bind:value` for the HTML string, plus `onchange` and `onUploadImage`.
- Svelte 5 runes; toolbar and image dialog are separate components.

## Build order

1. Editor shell with `bind:value`, plus the sanitizer and its unit tests.
2. Inline formatting and block commands, with the toolbar.
3. Links.
4. Images: upload callback, drag/drop and paste, figure and caption, with the playground endpoint and SQLite table.
5. Polish: undo/redo, keyboard shortcuts, accessibility, CSS theming through variables.

## Decisions

- **Formatting set:** the list above is enough. No tables, embeds or text alignment.
- **Deleting an image:** when the user removes an image from the article, the editor asks how to delete it:
  - remove from this article only (file and database row are kept), or
  - remove from the article and also delete the file and its database row.

  The component shows the question and calls an optional `onDeleteImage(src)` callback only for the second choice. The host (playground endpoint) does the actual file and SQLite deletion. Without the callback, only the first choice is offered.
