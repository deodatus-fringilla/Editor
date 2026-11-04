# Proposal 003: Image placement and magazine-style columns

Status: accepted (amends 001, which ruled out text alignment)

## Decisions

- **Image placement.** An image can be centred (the default), floated **left** or **right** with the text flowing
  around it, or span the **full width**. It is chosen in the image dialog and can be changed later by clicking the image.
  Text alignment (left, centre, right, justify) is still not offered.
- **Stored in Markdown** as a suffix on the image line: `![alt](src "caption"){.left}`, `{.right}` or `{.full}`.
  No suffix means centred. Unknown suffixes are ignored. The host maps these to its own image sizes if it has any
  (lemiesz: `column` / `wide` / `full`).
- **Moving an image.** The image dialog has "move up" and "move down", and Alt+Up / Alt+Down move a focused image, so
  an image can be put next to the paragraph that should wrap around it.
- **Two columns (magazine style)** is a **reader-side layout**, not content. `<Preview columns={2}>` flows one text
  from the first column into the second; full-width images and the footnotes span both columns; headings, images and
  quotes are not split across columns. On narrow screens it falls back to one column. The editing surface stays a single
  column, because editing is easier that way.
- **Side-by-side columns** (separate texts next to each other) are not part of the editor. In lemiesz, the existing
  `columns` block holds several blocks, so each column would be its own editor.
