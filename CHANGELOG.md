# Changelog

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
