# Quality audit, 2026-11-05

Audit of the editor before it is used in Lemiesz: code review, targeted tests in a real browser, and a compatibility
run over Lemiesz's own Markdown. Everything listed under "Fixed" has a regression test.

## How it was checked

- **Code review** of every file in `src/lib`.
- **Probes in Chromium** for each suspected bug, using the editor's own modules.
- **Browser sessions** driving the playground like a user (typing, shortcuts, paste, cut, drag, images, dialogs,
  read-only, language switch): 21 + 10 + 17 checks, all passing at the end.
- **Compatibility run**: all 47 Markdown files in Lemiesz's `corpus/` and `docs/` were loaded into the editor and saved
  again, and both versions were rendered with **marked** using the same link and image rules as Lemiesz's
  `journal-render.ts`, to compare what readers would see.

## Fixed

### Data loss or corruption

| Problem                                                                                  | Effect before the fix                                    |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Quote containing a list                                                                  | `> - one` / `> - two` came back as `> onetwo`            |
| Quote containing an image                                                                | the image was dropped, only its caption was kept as text |
| `__bold__` (marked syntax)                                                               | garbled into `*\_bold*\_`                                |
| Tables and fenced code blocks                                                            | flattened into one paragraph of pipes and backticks      |
| Separator lines `---`                                                                    | became the literal text "---"                            |
| Inline `` `code` ``                                                                      | backslashes were added inside it on save                 |
| Indented quote or code block inside a list item                                          | shown as literal `>` and ` ``` ` text                    |
| Numbered list starting at another number (`5. …`), or continuing after a bullet sub-list | numbering restarted at 1                                 |
| List item with indented continuation lines or several paragraphs                         | the list was split, numbering restarted                  |
| Pasted nested lists, Google Docs items with several paragraphs                           | words of different items ran together ("twomore")        |
| Copy, cut and paste **inside** the editor                                                | citations became plain text and images disappeared       |
| An image whose address is not allowed                                                    | the address was lost on save and a stray "!" remained    |
| Two Ctrl+B presses with nothing selected                                                 | an extra space appeared in the saved text                |
| Leading line breaks                                                                      | saved as an empty first line                             |

Content the editor cannot edit (a table, a code block, an image from a disallowed address) is now **kept exactly as
written**, shown in the editor as a locked, labelled box, and rendered properly in the preview.

### Security and privacy

| Problem                                                                        | Fix                                                                       |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `/\evil.com` was accepted as a local link (browsers read it as `//evil.com`)   | backslashes are refused in addresses                                      |
| Bare words such as `google` were accepted as relative links                    | only `http(s)`, `mailto`, `/path` and `#anchor`, the same rule as Lemiesz |
| Images from any site were shown (third-party tracking; Lemiesz forbids it)     | only this site's images by default; `allowImage` to change                |
| Pasted relative links pointed into the page they were copied from              | dropped on paste, the text is kept                                        |
| Read-only mode: keyboard shortcuts, paste, cut and drop still changed the text | all blocked; copying still works                                          |

### Behaviour and usability

| Problem                                                                                             | Fix                                                                                                                             |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Typing in a long article (300 paragraphs) took 44 ms per key, mostly in whatever listens to `value` | `value` is updated after a 150 ms typing pause (immediately after commands, on blur, and through `flush()`): now 6.5 ms per key |
| Long paragraphs with many unmatched `**` or `[` took up to 2.5 s to render                          | the parser no longer rescans: well under 0.3 s                                                                                  |
| Dragging an image did nothing; dropping image files from the computer was refused                   | images can be dragged to a new place; files can be dropped                                                                      |
| Toolbar unreachable with Tab at start (its only tab stop was the disabled Undo button)              | the tab stop is always an enabled button                                                                                        |
| Deleting the file of an image that appears again in the article broke the other copy                | the file is kept, and the user is told why                                                                                      |
| An uploaded image whose dialog was cancelled stayed on the server, unused                           | it is deleted again (when `onDeleteImage` is given)                                                                             |
| Citation chips kept their old language after a language switch                                      | they follow the labels                                                                                                          |
| `# Title` stayed literal text; `Title` underlined with `===`/`---` was not a heading                | both become level-2 headings (the article title lives elsewhere)                                                                |
| Footnote ids clashed with several articles on one page                                              | `idPrefix`; the back link's name is configurable                                                                                |

## Compatibility with Lemiesz's Markdown (after the fixes)

- **Text readers see**: identical in 43 of 47 files. The 4 others contain checkbox lists (`- [x]`), which the editor
  shows as plain "[x]" text.
- **Structure**: the remaining differences all come from the editor having **flat lists only**. A nested list comes
  out as a separate list after its parent item (numbering is kept), and loose lists become tight.
- **Stability**: saving twice gives the same Markdown in all 47 files.

These were technical documents and canon texts, not journal articles. Journal articles written in the editor contain
only what the editor makes, so they are not affected.

## Proposals before integration (not done: they need a decision)

1. **Images in Lemiesz (decision needed).** Lemiesz shows images inside text as plain links and keeps real images as
   separate `image` blocks from its library, with approval, alt text per language and licence. The editor's
   `![alt](src "caption"){.left}` would appear in Lemiesz as a link followed by `{.left}`. Options:
   - **a.** In Lemiesz, hide the editor's image button and keep Lemiesz's image blocks (no text wrap).
   - **b.** Teach Lemiesz's renderer the editor's image line, resolving it to an _approved library image_ and
     applying the same checks as image blocks. This keeps text wrap. **Recommended.**
   - **c.** Split the editor's content into Lemiesz blocks when saving.
2. **Lemiesz's own link check accepts `/\evil.com`** (`safeHref` in `journal-render.ts`). That is a Lemiesz bug, to fix
   on the Lemiesz side.
3. **Citation picker.** The playground's prompt box is only a stand-in; Lemiesz should pass its source picker
   (approved sources only) through `onPickCitation`.
4. **Polish typography.** Optionally keep single-letter words ("w", "z", "i", "o") on the same line as the next word
   (non-breaking space) when rendering for readers. The editor currently turns non-breaking spaces into normal ones,
   because browsers insert them on their own while typing.
5. **Automated browser tests in the repository.** The browser sessions used in this audit live outside the repo.
   Turning them into `npm run e2e` would catch regressions in typing, paste and drag.
6. **Phones and tablets.** Android keyboards do not report most keys, so some keyboard behaviour (Enter in a heading,
   Backspace next to an image) falls back to the browser's. To be tested on real devices.
7. **Not supported, on purpose for now:** nested lists, checkbox lists, footnotes written as `[^1]`, tables edited in
   place. Each could be added if articles need it.
8. **Undo after "remove and delete the file"** brings the image back with its file gone. A warning, or not offering
   file deletion until the article is saved, would avoid that.
