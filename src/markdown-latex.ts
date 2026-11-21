const TOKEN_PREFIX = "\u0000ML";

const LATEX_ESCAPES: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  "$": "\\$",
  "#": "\\#",
  "_": "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
  "<": "\\textless{}",
  ">": "\\textgreater{}",
  "|": "\\textbar{}",
};

export function escapeLatexText(value: string): string {
  return value.replace(/[\\&%$#_{}~^<>|]/g, (character) => LATEX_ESCAPES[character] ?? character);
}

function protectedMath(value: string): string {
  return value;
}

/**
 * Small, dependency-free Markdown-inline to LaTeX converter. It is not a full
 * CommonMark parser; it is targeted at table cells: bold, italics, inline code,
 * links, escaped characters, and inline/display math.
 */
export function markdownInlineToLatex(markdown: string): string {
  const chunks: string[] = [];
  const token = (value: string): string => {
    const index = chunks.length;
    chunks.push(value);
    return `${TOKEN_PREFIX}${index}\u0000`;
  };

  let text = markdown.replace(/\r\n?/g, "\n").replace(/<br\s*\/?>/gi, " ");

  // Preserve Markdown backslash escapes before generic LaTeX escaping.
  text = text.replace(/\\([&%$#_{}~^*<>|\\])/g, (_match, character: string) => {
    if (character === "\\") return token("\\textbackslash{}");
    if (character === "~") return token("\\textasciitilde{}");
    if (character === "^") return token("\\textasciicircum{}");
    if (character === "<") return token("\\textless{}");
    if (character === ">") return token("\\textgreater{}");
    if (character === "|") return token("\\textbar{}");
    if (character === "*") return token("*");
    return token(`\\${character}`);
  });

  // Math is already LaTeX: preserve it and do not escape its contents.
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match) => token(protectedMath(match)));
  text = text.replace(/(?<!\\)\$([^$\n]+?)\$/g, (match) => token(protectedMath(match)));

  // Inline code becomes \texttt with escaped contents.
  text = text.replace(/`([^`\n]+?)`/g, (_match, code: string) =>
    token(`\\texttt{${escapeLatexText(code)}}`),
  );

  // Images: keep alt text only.
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_match, alt: string) =>
    token(markdownInlineToLatex(alt)),
  );

  // Links: keep the visible label, which may contain formatting.
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, (_match, label: string) =>
    token(markdownInlineToLatex(label)),
  );

  // Bold first, then italics.
  text = text.replace(/\*\*([\s\S]+?)\*\*/g, (_match, inner: string) =>
    token(`\\textbf{${markdownInlineToLatex(inner)}}`),
  );
  text = text.replace(/__([\s\S]+?)__/g, (_match, inner: string) =>
    token(`\\textbf{${markdownInlineToLatex(inner)}}`),
  );
  text = text.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, (_match, inner: string) =>
    token(`\\textit{${markdownInlineToLatex(inner)}}`),
  );
  text = text.replace(/(?<![\w])_([^_\n]+?)_(?![\w])/g, (_match, inner: string) =>
    token(`\\textit{${markdownInlineToLatex(inner)}}`),
  );
  text = text.replace(/~~([\s\S]+?)~~/g, (_match, inner: string) =>
    token(markdownInlineToLatex(inner)),
  );

  text = escapeLatexText(text);

  return text.replace(
    new RegExp(`${TOKEN_PREFIX}(\\d+)\\u0000`, "g"),
    (_match, index: string) => chunks[Number(index)] ?? "",
  );
}
