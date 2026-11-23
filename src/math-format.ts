function isEscaped(text: string, index: number): boolean {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function skipBalanced(
  text: string,
  start: number,
  open: string,
  close: string,
): number {
  let depth = 0;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (character === "\\") {
      index += 1;
      continue;
    }

    if (character === open) {
      depth += 1;
    } else if (character === close) {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }

  return text.length;
}

function commandEnd(text: string, start: number): number {
  let index = start + 1;
  if (index >= text.length) return text.length;

  if (/[A-Za-z]/.test(text[index])) {
    while (index < text.length && /[A-Za-z]/.test(text[index])) index += 1;
  } else {
    index += 1;
  }

  while (text[index] === "{") {
    index = skipBalanced(text, index, "{", "}");
  }

  return index;
}

function scriptEnd(text: string, start: number): number {
  const first = text[start];
  if (first === undefined || first === " " || first === "\n" || first === "\t") {
    return start;
  }

  if (first === "{") {
    // Already explicitly grouped.
    return start;
  }

  if (first === "\\") {
    return commandEnd(text, start);
  }

  if (first === "(") {
    return skipBalanced(text, start, "(", ")");
  }

  if (first === "[") {
    return skipBalanced(text, start, "[", "]");
  }

  if (/[A-Za-z0-9+\-']/.test(first)) {
    let index = start + 1;
    while (index < text.length && /[A-Za-z0-9+\-']/.test(text[index])) {
      index += 1;
    }
    return index;
  }

  return start + 1;
}

/**
 * Add explicit braces around ungrouped superscript/subscript arguments:
 *
 *   r^k -> r^{k}, r_k -> r_{k}, x^\frac{1}{2} -> x^{\frac{1}{2}}
 *
 * Already-grouped scripts are left untouched.
 */
export function formatMathScripts(math: string): string {
  let result = "";

  for (let index = 0; index < math.length; ) {
    const character = math[index];

    if (
      (character === "^" || character === "_") &&
      !isEscaped(math, index) &&
      math[index + 1] !== "{"
    ) {
      const end = scriptEnd(math, index + 1);
      if (end > index + 1) {
        result += `${character}{${math.slice(index + 1, end)}}`;
        index = end;
        continue;
      }
    }

    result += character;
    index += 1;
  }

  return result;
}
