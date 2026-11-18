import { htmlToMarkdown } from "obsidian";
import type {
  TableAlignment,
  TableCell,
  TableData,
} from "./table";

function plainCell(cell: HTMLTableCellElement): TableCell {
  return {
    text: (cell.innerText || cell.textContent || "").replace(/\s+/g, " ").trim(),
    markdown: markdownCell(cell),
  };
}

function markdownCell(cell: HTMLTableCellElement): string {
  try {
    return htmlToMarkdown(cell.innerHTML)
      .replace(/\r\n?/g, "\n")
      .replace(/\n+/g, "<br>")
      .trim();
  } catch {
    return (cell.innerText || cell.textContent || "").trim();
  }
}

function alignmentOf(cell: HTMLTableCellElement): TableAlignment {
  // Obsidian writes Markdown alignment to the HTML `align` attribute. A plain
  // `---` column has no attribute and must stay left even though `<th>` is
  // centered by the theme's default CSS.
  const attribute = cell.getAttribute("align")?.toLowerCase();
  if (attribute === "center") return "center";
  if (attribute === "right") return "right";
  if (attribute === "left") return "left";

  const style = cell.style.textAlign.toLowerCase();
  if (style === "center") return "center";
  if (style === "right" || style === "end") return "right";
  return "left";
}

function expandCells(
  cells: HTMLTableCellElement[],
): { cells: TableCell[]; alignments: TableAlignment[] } {
  const expanded: TableCell[] = [];
  const alignments: TableAlignment[] = [];

  for (const cell of cells) {
    const span = Math.max(1, Math.min(100, cell.colSpan || 1));
    expanded.push(plainCell(cell));
    alignments.push(alignmentOf(cell));
    for (let index = 1; index < span; index += 1) {
      expanded.push({ text: "", markdown: "" });
      alignments.push(alignmentOf(cell));
    }
  }

  return { cells: expanded, alignments };
}

function bodyRows(table: HTMLTableElement): HTMLTableRowElement[] {
  const rows = Array.from(table.tBodies).flatMap((body) =>
    Array.from(body.rows),
  );

  if (table.tHead?.rows.length) return rows;
  rows.shift();
  return rows;
}

/**
 * Extract the nearest table into a rectangular, Markdown/LaTeX-friendly model.
 * Colspans are expanded with empty cells; rowspans are intentionally flattened.
 */
export function extractTableData(table: HTMLTableElement): TableData | null {
  const headerRow = table.tHead?.rows[0] ?? table.rows[0];
  if (!headerRow) return null;

  const header = expandCells(Array.from(headerRow.cells));
  if (header.cells.length === 0) return null;

  const rows = bodyRows(table).map((row) => {
    const expanded = expandCells(Array.from(row.cells));
    return expanded.cells;
  });

  const columnTotal = Math.max(
    header.cells.length,
    ...rows.map((row) => row.length),
    1,
  );

  while (header.cells.length < columnTotal) {
    header.cells.push({ text: "", markdown: "" });
    header.alignments.push("left");
  }
  for (const row of rows) {
    while (row.length < columnTotal) {
      row.push({ text: "", markdown: "" });
    }
  }

  return {
    headers: header.cells,
    rows,
    alignments: header.alignments.slice(0, columnTotal),
  };
}

/**
 * Resolve a table from a context-menu target or, when the user has selected a
 * table and right-clicked just outside it, from the current text selection.
 */
export function resolveTable(
  eventTarget: EventTarget | null,
  doc: Document,
): HTMLTableElement | null {
  const target = eventTarget as HTMLElement | null;
  if (target && typeof target.closest === "function") {
    const direct = target.closest<HTMLTableElement>("table");
    if (direct) return direct;
  }

  const selection = doc.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const element =
    container.nodeType === Node.ELEMENT_NODE
      ? (container as Element)
      : container.parentElement;

  const selected = element?.closest<HTMLTableElement>("table");
  if (selected) return selected;

  const containing = element?.querySelector<HTMLTableElement>("table");
  return containing ?? null;
}
