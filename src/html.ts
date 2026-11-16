export interface HtmlTheme {
  background: string;
  text: string;
  muted: string;
  link: string;
  font: string;
  mono: string;
  fontSize: string;
  border: string;
  isDark: boolean;
}

export interface HtmlDocumentOptions {
  allowScripts: boolean;
  theme: HtmlTheme;
}

function cssValue(value: string, fallback: string): string {
  const cleaned = value.replace(/[\r\n;{}<>]/g, " ").trim();
  return cleaned || fallback;
}

function buildBaseStyle(theme: HtmlTheme): string {
  const background = cssValue(theme.background, "#ffffff");
  const text = cssValue(theme.text, "#222222");
  const muted = cssValue(theme.muted, "#666666");
  const link = cssValue(theme.link, "#2563eb");
  const font = cssValue(theme.font, "system-ui, -apple-system, Segoe UI, sans-serif");
  const mono = cssValue(theme.mono, "ui-monospace, SFMono-Regular, Consolas, monospace");
  const fontSize = cssValue(theme.fontSize, "16px");
  const border = cssValue(theme.border, "rgba(127, 127, 127, .3)");
  const scheme = theme.isDark ? "dark" : "light";

  return `<style id="fence-render-base-style">
:root { color-scheme: ${scheme}; }
html, body { margin: 0; padding: 0; }
body {
  box-sizing: border-box;
  min-height: 1px;
  padding: 12px 14px;
  background: ${background};
  color: ${text};
  font-family: ${font};
  font-size: ${fontSize};
  line-height: 1.55;
  overflow-wrap: anywhere;
  -webkit-font-smoothing: antialiased;
}
*, *::before, *::after { box-sizing: border-box; }
img, svg, video, canvas, iframe { max-width: 100%; }
img, video { height: auto; }
a { color: ${link}; }
pre, code, kbd, samp { font-family: ${mono}; }
pre {
  margin: 0.8em 0;
  padding: 10px 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  background: rgba(127, 127, 127, .12);
  border-radius: 6px;
}
code { font-size: 0.92em; }
blockquote {
  margin: 0.8em 0;
  padding: 0.1em 0 0.1em 12px;
  border-left: 3px solid ${border};
  color: ${muted};
}
table { border-collapse: collapse; max-width: 100%; }
th, td { padding: 4px 8px; border: 1px solid ${border}; }
hr { border: 0; border-top: 1px solid ${border}; }
h1, h2, h3, h4, h5, h6 { line-height: 1.25; }
</style>`;
}

function buildInjectedScript(): string {
  return `<script id="fence-render-frame-script">
(function () {
  "use strict";

  var lastHeight = 0;
  var frame = 0;

  function post(type, data) {
    try {
      window.parent.postMessage(Object.assign({ type: type }, data || {}), "*");
    } catch (error) {
      /* The parent may have gone away. */
    }
  }

  function reportHeight() {
    frame = 0;
    var html = document.documentElement;
    var body = document.body;
    var height = Math.max(
      html ? html.scrollHeight : 0,
      html ? html.offsetHeight : 0,
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0
    );
    if (!height || Math.abs(height - lastHeight) < 1) return;
    lastHeight = height;
    post("fence-render:height", { height: height });
  }

  function scheduleHeight() {
    if (frame) return;
    frame = window.requestAnimationFrame(reportHeight);
  }

  if (window.ResizeObserver) {
    try {
      new ResizeObserver(scheduleHeight).observe(document.documentElement);
    } catch (error) {
      /* Fall back to the load/paint events below. */
    }
  }

  document.addEventListener("DOMContentLoaded", scheduleHeight);
  window.addEventListener("load", scheduleHeight);
  document.addEventListener("load", scheduleHeight, true);
  document.addEventListener("error", scheduleHeight, true);
  scheduleHeight();

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var anchor = target.closest("a[href]");
    if (!anchor) return;

    var href = anchor.getAttribute("href");
    if (!href || href.charAt(0) === "#") return;

    var url;
    try {
      url = new URL(href, document.baseURI);
    } catch (error) {
      event.preventDefault();
      return;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:" && url.protocol !== "mailto:") {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    post("fence-render:open-url", { url: url.href });
  }, true);
})();
</script>`;
}

function injectIntoHead(html: string, injection: string): string {
  const head = html.match(/<head\b[^>]*>/i);
  if (head && head.index !== undefined) {
    const at = head.index + head[0].length;
    return `${html.slice(0, at)}\n${injection}\n${html.slice(at)}`;
  }

  const htmlTag = html.match(/<html\b[^>]*>/i);
  if (htmlTag && htmlTag.index !== undefined) {
    const at = htmlTag.index + htmlTag[0].length;
    return `${html.slice(0, at)}\n<head>\n${injection}\n</head>${html.slice(at)}`;
  }

  return `<head>\n${injection}\n</head>\n${html}`;
}

function injectBeforeClosingTag(html: string, tag: string, injection: string): string {
  const closing = new RegExp(`</${tag}\\s*>`, "i");
  if (closing.test(html)) return html.replace(closing, `${injection}\n</${tag}>`);
  return `${html}\n${injection}`;
}

/**
 * Build a complete HTML document for a sandboxed iframe. The user's own
 * document is preserved; base styling and the resize/link bridge are injected
 * without turning the source into a string of escaped text.
 */
export function buildHtmlDocument(
  source: string,
  options: HtmlDocumentOptions,
): string {
  const baseStyle = buildBaseStyle(options.theme);
  const meta = '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer">';
  const headInjection = `${meta}\n${baseStyle}`;
  const script = options.allowScripts ? buildInjectedScript() : "";
  const looksLikeDocument = /<!doctype\s+html|<html\b/i.test(source);

  if (!looksLikeDocument) {
    return `<!doctype html>
<html>
<head>
${headInjection}
</head>
<body>
${source}
${script}
</body>
</html>`;
  }

  let html = source;
  html = injectIntoHead(html, headInjection);
  if (script) html = injectBeforeClosingTag(html, "body", script);
  return html;
}

/**
 * Convert an SVG document to an image data URL. Rendering the TeX result as an
 * <img> keeps its internal IDs/styles from colliding with the Obsidian page.
 */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}
