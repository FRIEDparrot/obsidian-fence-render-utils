import { describe, expect, it } from "vitest";
import { findMarkdownTableAtLine } from "./table-source";

describe("Markdown table source parser", () => {
  const lines = [
    "# Table",
    "",
    "| Name | Value | Note |",
    "| :--- | :---: | ---: |",
    "| **Bold** | $x_1$ | 50\\% |",
    "| *Italic* | `a|b` | a \\| b |",
    "",
    "After.",
  ];

  it("finds the table containing the cursor", () => {
    const table = findMarkdownTableAtLine(lines, 4);
    expect(table).not.toBeNull();
    expect(table?.data.headers.map((cell) => cell.markdown)).toEqual([
      "Name",
      "Value",
      "Note",
    ]);
    expect(table?.data.alignments).toEqual(["left", "center", "right"]);
    expect(table?.data.rows).toHaveLength(2);
    expect(table?.data.rows[0][0].markdown).toBe("**Bold**");
    expect(table?.data.rows[0][1].markdown).toBe("$x_1$");
    expect(table?.startLine).toBe(2);
    expect(table?.endLine).toBe(5);
  });

  it("keeps escaped and code-span pipes inside one cell", () => {
    const table = findMarkdownTableAtLine(lines, 5);
    expect(table?.data.rows[1][1].markdown).toBe("`a|b`");
    expect(table?.data.rows[1][2].markdown).toBe("a \\| b");
  });

  it("finds a table from its header or separator line", () => {
    expect(findMarkdownTableAtLine(lines, 2)).not.toBeNull();
    expect(findMarkdownTableAtLine(lines, 3)).not.toBeNull();
  });

  it("does not treat code fences as tables", () => {
    const fenced = [
      "```md",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "```",
    ];
    expect(findMarkdownTableAtLine(fenced, 2)).toBeNull();
  });

  it("returns null outside a table", () => {
    expect(findMarkdownTableAtLine(lines, 0)).toBeNull();
    expect(findMarkdownTableAtLine(lines, 7)).toBeNull();
  });

  it("handles a table with no body rows", () => {
    const table = findMarkdownTableAtLine(
      ["| Name | Value |", "| --- | --- |"],
      1,
    );
    expect(table?.data.rows).toEqual([]);
  });

  it("keeps math pipes in one cell", () => {
    const table = findMarkdownTableAtLine(
      ["| Norm |", "| --- |", "| $|x|$ |"],
      2,
    );
    expect(table?.data.rows[0][0].markdown).toBe("$|x|$");
  });
});
