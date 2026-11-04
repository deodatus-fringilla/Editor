# Proposal 002: Markdown as the stored format

Status: accepted (amends 001)

## Context

The editor will be used by the Lemiesz journal ("redakcja") to publish articles. Lemiesz stores article text as
Markdown blocks, with `[[src:ID]]` and `[[quote:ID]]` citation markers and footnotes, and renders safe HTML on the
server. Its approval and citation checks work on that Markdown.

## Decision

- The editor is **visual (WYSIWYG)** but its value (`bind:value`) is **Markdown**, not an HTML string.
- Readers receive HTML rendered from the Markdown by a renderer that follows Lemiesz's rules: raw HTML is shown as
  text, only http(s)/mailto/#/relative links survive, footnotes are numbered across the article.
- Citation markers (`[[src:ID]]`, `[[quote:ID]]`) are preserved exactly and shown as chips in the editor.
- Pasted content (Word, web) goes through the in-house whitelist sanitizer, then is converted to Markdown.
- Images stay out of the component: the host supplies `onUploadImage`. The returned data may carry more than
  `{ src, alt }` (author, licence, per-language alt text), which the host defines.
- Labels and messages are props, so the host can supply its own translations (Polish and English).
- Components stay small (about 150 lines or less), Svelte 5 runes only.

## Out of scope for now

Lemiesz is not touched. The playground in this repo has a live preview so the editor can be tested alone;
integration comes afterwards.
