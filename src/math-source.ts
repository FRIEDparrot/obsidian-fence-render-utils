export function extractMathSource(mathEl: HTMLElement): string | null {
  const annotation = mathEl.querySelector<HTMLElement>(
    'annotation[encoding="application/x-tex"]',
  )?.textContent;
  if (annotation?.trim()) return annotation.trim();

  const mjxMath = mathEl.matches("mjx-math[data-latex]")
    ? mathEl
    : mathEl.querySelector<HTMLElement>("mjx-math[data-latex]");
  const latex = mjxMath?.getAttribute("data-latex");
  return latex?.trim() || null;
}

export function isDisplayMath(mathEl: HTMLElement): boolean {
  return (
    mathEl.classList.contains("math-block") ||
    mathEl.classList.contains("math-display") ||
    mathEl.querySelector('mjx-container[display="true"]') !== null
  );
}

export function mathElementToMarkdown(mathEl: HTMLElement): string | null {
  const source = extractMathSource(mathEl);
  if (!source) return null;
  return isDisplayMath(mathEl) ? `$$${source}$$` : `$${source}$`;
}
