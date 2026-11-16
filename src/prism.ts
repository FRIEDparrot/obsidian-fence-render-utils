import { loadPrism } from "obsidian";
import { LANGUAGE_GRAMMARS, type RenderLanguage } from "./language";

const HIGHLIGHT_LIMIT = 120_000;

/**
 * Fill a source code element with Prism-highlighted HTML. Obsidian already
 * ships Prism and its common languages, so this adds no dependency to the
 * bundle and keeps the source view consistent with native code blocks.
 */
export async function highlightSource(
  codeEl: HTMLElement,
  source: string,
  language: RenderLanguage,
): Promise<void> {
  codeEl.textContent = source;
  codeEl.classList.add(`language-${language}`);

  if (!source || source.length > HIGHLIGHT_LIMIT) return;

  try {
    const prism = await loadPrism();
    const grammars = prism?.languages;
    if (!grammars) return;

    for (const name of LANGUAGE_GRAMMARS[language]) {
      const grammar = grammars[name];
      if (!grammar) continue;
      codeEl.innerHTML = prism.highlight(source, grammar, name);
      codeEl.classList.add(`language-${name}`);
      return;
    }
  } catch (error) {
    console.debug("Fence Render Utils: Prism highlighting failed", error);
  }
}
