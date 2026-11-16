export type RenderLanguage = "markdown" | "latex" | "html";

export const LANGUAGE_LABELS: Record<RenderLanguage, string> = {
  markdown: "Markdown",
  latex: "LaTeX",
  html: "HTML",
};

export const LANGUAGE_ICONS: Record<RenderLanguage, string> = {
  markdown: "file-text",
  latex: "sigma",
  html: "code-2",
};

export const LANGUAGE_GRAMMARS: Record<RenderLanguage, string[]> = {
  markdown: ["markdown"],
  latex: ["latex", "tex"],
  html: ["markup", "html"],
};

const LANGUAGE_ALIASES: Record<string, RenderLanguage> = {
  md: "markdown",
  mdown: "markdown",
  mkd: "markdown",
  mkdn: "markdown",
  markdown: "markdown",
  latex: "latex",
  tex: "latex",
  html: "html",
  htm: "html",
  xhtml: "html",
};

/**
 * Resolve the fence language from a `<code>` element. Obsidian normally emits
 * `language-<tag>`, but live preview and third-party plugins can be less
 * consistent, so also inspect the parent `<pre>` and data attributes.
 */
export function detectFenceLanguage(code: HTMLElement): string | null {
  const candidates: string[] = [];

  for (const element of [code, code.parentElement]) {
    if (!element) continue;
    for (const className of Array.from(element.classList)) {
      if (className.startsWith("language-")) {
        candidates.push(className.slice("language-".length));
      } else if (className.startsWith("lang-")) {
        candidates.push(className.slice("lang-".length));
      }
    }
    const dataLanguage = element.getAttribute("data-language");
    if (dataLanguage) candidates.push(dataLanguage);
    const lang = element.getAttribute("lang");
    if (lang) candidates.push(lang);
  }

  for (const candidate of candidates) {
    const normalized = normalizeLanguageTag(candidate);
    if (normalized) return normalized;
  }

  return null;
}

export function normalizeLanguageTag(tag: string): string | null {
  const cleaned = tag
    .trim()
    .toLowerCase()
    .replace(/^\{\.?/, "")
    .replace(/\}$/, "")
    .split(/[\s,;:]/)[0];

  return cleaned || null;
}

export function formatForLanguage(tag: string | null): RenderLanguage | null {
  if (!tag) return null;
  return LANGUAGE_ALIASES[normalizeLanguageTag(tag) ?? ""] ?? null;
}

export function isMermaidFence(tag: string | null): boolean {
  if (!tag) return false;
  return normalizeLanguageTag(tag) === "mermaid";
}
