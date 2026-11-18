export type TableAlignment = "left" | "center" | "right";

export interface TableCell {
  /** Plain text, used for LaTeX output. */
  text: string;
  /** Inline Markdown, used for Markdown-table output. */
  markdown: string;
}

export interface TableData {
  headers: TableCell[];
  rows: TableCell[][];
  alignments: TableAlignment[];
}

function padCells(cells: TableCell[], count: number): TableCell[] {
  const result = cells.slice(0, count);
  while (result.length < count) {
    result.push({ text: "", markdown: "" });
  }
  return result;
}

function formatMarkdownCell(cell: TableCell): string {
  const value = (cell.markdown || cell.text)
    .replace(/\r\n?/g, "\n")
    .replace(/\n+/g, "<br>")
    .trim();
  // Escape pipes that aren't already escaped.
  return value.replace(/(^|[^\\])\|/g, "$1\\|");
}

function formatLatexCell(cell: TableCell): string {
  const value = (cell.text || cell.markdown)
    .replace(/\s+/g, " ")
    .trim();

  return value.replace(/[\\&%$#_{}~^]/g, (character) => {
    switch (character) {
      case "\\":
        return "\\textbackslash{}";
      case "&":
        return "\\&";
      case "%":
        return "\\%";
      case "$":
        return "\\$";
      case "#":
        return "\\#";
      case "_":
        return "\\_";
      case "{":
        return "\\{";
      case "}":
        return "\\}";
      case "~":
        return "\\textasciitilde{}";
      case "^":
        return "\\textasciicircum{}";
      default:
        return character;
    }
  });
}

function columnCount(data: TableData): number {
  return Math.max(
    1,
    data.headers.length,
    ...data.rows.map((row) => row.length),
  );
}

/**
 * Serialize extracted table data as a Markdown pipe table. Inline formatting is
 * preserved when the DOM extractor was able to recover it.
 */
export function tableToMarkdown(data: TableData): string {
  const count = columnCount(data);
  const headers = padCells(data.headers, count).map(formatMarkdownCell);
  const alignments = Array.from(
    { length: count },
    (_, index) => data.alignments[index] ?? "left",
  );

  const separators = alignments.map((alignment) => {
    if (alignment === "center") return ":---:";
    if (alignment === "right") return "---:";
    return "---";
  });

  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${separators.join(" | ")} |`,
    ...data.rows.map((row) => {
      const cells = padCells(row, count).map(formatMarkdownCell);
      return `| ${cells.join(" | ")} |`;
    }),
  ];

  return lines.join("\n");
}

/**
 * Serialize extracted table data as a complete LaTeX table environment. The
 * output deliberately uses only core LaTeX table commands (no booktabs) so it
 * can be pasted into most documents without extra packages.
 */
export function tableToLatex(data: TableData): string {
  const count = columnCount(data);
  const headers = padCells(data.headers, count).map(formatLatexCell);
  const alignments = Array.from(
    { length: count },
    (_, index) => data.alignments[index] ?? "left",
  );
  const columnSpec = alignments
    .map((alignment) => {
      if (alignment === "center") return "c";
      if (alignment === "right") return "r";
      return "l";
    })
    .join("");

  const lines = [
    "\\begin{table}[htbp]",
    "  \\centering",
    `  \\begin{tabular}{${columnSpec}}`,
    "    \\hline",
    `    ${headers.join(" & ")} \\\\`,
    "    \\hline",
    ...data.rows.map(
      (row) => `    ${padCells(row, count).map(formatLatexCell).join(" & ")} \\\\`,
    ),
    "    \\hline",
    "  \\end{tabular}",
    "\\end{table}",
  ];

  return lines.join("\n");
}
