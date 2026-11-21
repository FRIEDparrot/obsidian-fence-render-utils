import type { TableAlignment, TableCell, TableData } from "./table";

export interface SourceTable {
  data: TableData;
  startLine: number;
  endLine: number;
}

function splitRow(line: string): string[] {
  let value = line.trim();
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|") && !value.endsWith("\\|")) value = value.slice(0, -1);

  const cells: string[] = [];
  let current = "";
  let escaped = false;
  let codeDelimiter = 0;
  let mathDelimiter = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      current += character;
      escaped = true;
      continue;
    }

    if (character === "`") {
      let end = index;
      while (value[end] === "`") end += 1;
      const run = end - index;
      if (codeDelimiter === 0) codeDelimiter = run;
      else if (codeDelimiter === run) codeDelimiter = 0;
      current += value.slice(index, end);
      index = end - 1;
      continue;
    }

    if (character === "$" && codeDelimiter === 0) {
      let end = index;
      while (value[end] === "$") end += 1;
      const run = end - index;
      if (mathDelimiter === 0) mathDelimiter = run;
      else if (mathDelimiter === run) mathDelimiter = 0;
      current += value.slice(index, end);
      index = end - 1;
      continue;
    }

    if (character === "|" && codeDelimiter === 0 && mathDelimiter === 0) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current.trim());
  return cells;
}

function isSeparator(line: string): boolean {
  const cells = splitRow(line);
  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))
  );
}

function alignmentOf(separatorCell: string): TableAlignment {
  const value = separatorCell.trim();
  if (value.startsWith(":") && value.endsWith(":")) return "center";
  if (value.endsWith(":")) return "right";
  return "left";
}

function cell(value: string): TableCell {
  return { text: value, markdown: value };
}

function pad(cells: TableCell[], count: number): TableCell[] {
  const result = cells.slice(0, count);
  while (result.length < count) result.push(cell(""));
  return result;
}

function isFence(line: string): boolean {
  return /^\s*(?:`{3,}|~{3,})/.test(line);
}

/**
 * Parse the Markdown table containing `line` from raw editor lines. This is
 * used by Live Preview, where a table can be plain CodeMirror source instead of
 * a rendered <table> element.
 */
export function findMarkdownTableAtLine(
  lines: string[],
  line: number,
): SourceTable | null {
  let fence: string | null = null;

  for (let separatorLine = 0; separatorLine < lines.length; separatorLine += 1) {
    const currentLine = lines[separatorLine];

    if (isFence(currentLine)) {
      const marker = currentLine.trim().startsWith("~~~") ? "~~~" : "```";
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      continue;
    }

    if (fence !== null || !isSeparator(currentLine)) continue;

    const headerLine = separatorLine - 1;
    if (headerLine < 0 || !lines[headerLine].includes("|")) continue;

    const headers = splitRow(lines[headerLine]);
    const separators = splitRow(currentLine);
    if (headers.length === 0 || headers.length !== separators.length) continue;

    const rows: TableCell[][] = [];
    let endLine = separatorLine;

    for (let rowLine = separatorLine + 1; rowLine < lines.length; rowLine += 1) {
      const row = lines[rowLine];
      if (row.trim() === "" || isFence(row) || !row.includes("|")) break;
      rows.push(pad(splitRow(row).map(cell), headers.length));
      endLine = rowLine;
    }

    if (line >= headerLine && line <= endLine) {
      return {
        data: {
          headers: headers.map(cell),
          rows,
          alignments: separators.map(alignmentOf),
        },
        startLine: headerLine,
        endLine,
      };
    }
  }

  return null;
}
