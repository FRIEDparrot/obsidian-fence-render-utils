import { formatMathScripts } from "./math-format";

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
export interface ChatGptPasteOptions {
  /** Convert ChatGPT's \(...\) and \[...\] delimiters to dollar math. */
  convertDelimiters?: boolean;
  /** Add braces around ungrouped super/subscript arguments in pasted math. */
  formatScripts?: boolean;
}

export function convertChatGptMath(
  text: string,
  options: ChatGptPasteOptions = {},
): string {
  const convertDelimiters = options.convertDelimiters !== false;
  const formatScripts = options.formatScripts === true;
  const hasMath =
    (convertDelimiters && (text.includes("\\(") || text.includes("\\["))) ||
    (formatScripts && text.includes("$"));
  if (!hasMath) return text;

  const protectedChunks: string[] = [];
  const protect = (value: string): string => {
    const index = protectedChunks.length;
    protectedChunks.push(value);
    return `${TOKEN_PREFIX}${index}\u0000`;
  };
  const format = (content: string): string =>
    formatScripts ? formatMathScripts(content) : content;

  let working = text;

  // Fenced code blocks must be protected before inline code spans.
  working = working.replace(
    /^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\2\s*$/gm,
    (match) => protect(match),
  );

  // Single-line inline code spans.
  working = working.replace(/`+[^`\n]*?`+/g, (match) => protect(match));

  if (convertDelimiters) {
    // Display math first, then protect the replacement from inline conversion.
    working = working.replace(
      /(?<!\\)\\\[((?:(?!\\\[|\\\(|\n\s*\n)[\s\S])*?)\\\]/g,
      (match, inner: string) => {
        const content = inner.trim();
        return content ? protect(`$$\n${format(content)}\n$$`) : match;
      },
    );

    working = working.replace(
      /(?<!\\)\\\(((?:(?!\\\(|\\\[|\n\s*\n)[\s\S])*?)\\\)/g,
      (match, inner: string) => {
        const content = inner.trim();
        return content ? protect(`$${format(content)}$`) : match;
      },
    );
  }

  if (formatScripts) {
    // Also format equations that already use Obsidian's dollar delimiters.
    working = working.replace(/\$\$([\s\S]*?)\$\$/g, (_match, inner: string) =>
      protect(`$$${formatMathScripts(inner)}$$`),
    );
    working = working.replace(
      /(?<!\\)\$(?!\$)([^$\n]+?)\$(?!\$)/g,
      (_match, inner: string) => protect(`$${formatMathScripts(inner)}$`),
    );
  }

  return working.replace(
    new RegExp(`${TOKEN_PREFIX}(\\d+)\\u0000`, "g"),
    (_match, index: string) => protectedChunks[Number(index)] ?? "",
  );
}
