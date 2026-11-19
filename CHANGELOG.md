# Changelog

## 1.1.1

- Restored a fold/collapse control in the preview toolbar, so multi-line
  previews can be collapsed to the header and expanded again.
- Markdown fences with no visible rendered output (for example, only footnote
  definitions) now show their source instead of an empty window.
- Removed the inner-preview scroll containment; when the preview reaches its
  scroll boundary, further scrolling continues through the outer note.
- Kept the fullscreen and LaTeX size/width controls.

## 1.1.0

- Added **LaTeX preview size** (100%–400%, default 200%) and **LaTeX preview
  width** (fit content or full width) settings.
- Scaled LaTeX SVGs are now measured and rendered at the configured size, so
  equations are easier to review and can use the full note width.
- Replaced the inert **Expand preview** toggle with a true **fullscreen**
  preview that fills the viewport.
- Fullscreen closes with Escape or the toolbar button.
- Fullscreen uses the available width for LaTeX and HTML previews.

## 1.0.3

- Added **Wrap copied equations in an equation environment**, enabled by
  default.
- Copied LaTeX source for normal Markdown equations and equation-like fenced
  LaTeX previews now uses `\begin{equation} … \end{equation}`.
- Existing equation/align environments, prose, tables, and full documents are
  left unchanged.
- The option can be disabled to copy raw source again.

## 1.0.2

- Added **Copy table as Markdown** and **Copy table as LaTeX** to the
  right-click menu for rendered Markdown tables.
- The table menu uses only the clicked table, or the table containing the
  current selection, even when a note contains several tables.
- Markdown output preserves inline formatting, escapes pipes, and restores
  column alignment.
- LaTeX output produces a complete `table`/`tabular` environment with escaped
  special characters and aligned columns.

## 1.0.1

- Added **Copy equation image** and **Copy LaTeX source** to the right-click menu
  for rendered LaTeX fences.
- Added the same right-click actions to normal Markdown equations (`$$…$$` and
  `$…$`) in Reading view and Live Preview.
- Equation images are copied as high-DPI PNGs with a white background.
- Added optional `pdftocairo` support so display tags such as `\tag{1.1}` are
  preserved; dvisvgm remains the fallback.
- Improved LaTeX PDF output and full-document handling.
- Added `pdftocairo` path setting and toolchain reporting.

## 1.0.0

- Initial release.
- Render `md` / `markdown`, `latex` / `tex`, and `html` / `htm` fences as
  embedded previews.
- Reading view and Live Preview support.
- Per-window source, copy, and expand controls.
- Per-format settings, default view, HTML sandbox/script settings, and LaTeX
  package/preamble configuration.
- Dark-mode LaTeX inversion.
