const TOKEN_PREFIX = "\u0000FR";

/**
 * Convert the math delimiters emitted by ChatGPT into Obsidian's delimiters:
 *
 *   \(inline\)  ->  $inline$
 *   \[display\] ->  $$
 *                  display
 *                  $$
 *
 * Fenced code blocks, inline code, and already escaped `\\(` / `\\[` are left
 * untouched.
 */
export function convertChatGptMath(text: string): string {
  if (!text.includes("\\(") && !text.includes("\\[")) return text;

  const protectedChunks: string[] = [];
  const protect = (value: string): string => {
    const index = protectedChunks.length;
    protectedChunks.push(value);
    return `${TOKEN_PREFIX}${index}\u0000`;
  };

  let working = text;

  // Fenced code blocks must be protected before inline code spans.
  working = working.replace(
    /^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\2\s*$/gm,
    (match) => protect(match),
  );

  // Single-line inline code spans.
  working = working.replace(/`+[^`\n]*?`+/g, (match) => protect(match));

  // Display math first, then protect the replacement from inline conversion.
  working = working.replace(
    /(?<!\\)\\\[((?:(?!\\\[|\\\(|\n\s*\n)[\s\S])*?)\\\]/g,
    (match, inner: string) => {
      const content = inner.trim();
      return content ? protect(`$$\n${content}\n$$`) : match;
    },
  );

  working = working.replace(
    /(?<!\\)\\\(((?:(?!\\\(|\\\[|\n\s*\n)[\s\S])*?)\\\)/g,
    (match, inner: string) => {
      const content = inner.trim();
      return content ? `$${content}$` : match;
    },
  );

  return working.replace(
    new RegExp(`${TOKEN_PREFIX}(\\d+)\\u0000`, "g"),
    (_match, index: string) => protectedChunks[Number(index)] ?? "",
  );
}
