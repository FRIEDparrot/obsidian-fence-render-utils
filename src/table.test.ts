import { describe, expect, it } from "vitest";
import {
  tableToLatex,
  tableToMarkdown,
  transposeTable,
  type TableData,
} from "./table";

const data: TableData = {
  headers: [
    { text: "Name", markdown: "**Name**" },
    { text: "Value", markdown: "Value" },
    { text: "Notes", markdown: "Notes" },
  ],
  rows: [
    [
      { text: "alpha", markdown: "alpha" },
      { text: "1", markdown: "`1`" },
      { text: "first | row", markdown: "first | row" },
    ],
    [
      { text: "beta", markdown: "beta" },
      { text: "2", markdown: "2" },
      { text: "line one line two", markdown: "line one<br>line two" },
    ],
  ],
  alignments: ["left", "center", "right"],
};

describe("Transpose Markdown table", () => {
  it("swaps headers and body rows", () => {
    const transposed = transposeTable({
      headers: [
        { text: "Name", markdown: "Name" },
        { text: "A", markdown: "A" },
        { text: "B", markdown: "B" },
      ],
      rows: [
        [
          { text: "x", markdown: "x" },
          { text: "1", markdown: "1" },
          { text: "2", markdown: "2" },
        ],
        [
          { text: "y", markdown: "y" },
          { text: "3", markdown: "3" },
          { text: "4", markdown: "4" },
        ],
      ],
      alignments: ["left", "center", "right"],
    });

    expect(transposed).not.toBeNull();
    expect(transposed && tableToMarkdown(transposed)).toBe(
      [
        "| Name | x | y |",
        "| --- | --- | --- |",
        "| A | 1 | 3 |",
        "| B | 2 | 4 |",
      ].join("\n"),
    );
  });

  it("returns null when there are no body rows", () => {
    expect(
      transposeTable({
        headers: [
          { text: "A", markdown: "A" },
          { text: "B", markdown: "B" },
        ],
        rows: [],
        alignments: ["left", "left"],
      }),
    ).toBeNull();
  });
});

describe("Markdown table output", () => {
  it("preserves inline Markdown and alignment markers", () => {
    expect(tableToMarkdown(data)).toBe(
      [
        "| **Name** | Value | Notes |",
        "| --- | :---: | ---: |",
        "| alpha | `1` | first \\| row |",
        "| beta | 2 | line one<br>line two |",
      ].join("\n"),
    );
  });

  it("pads short rows and handles an empty body", () => {
    expect(
      tableToMarkdown({
        headers: [
          { text: "A", markdown: "A" },
          { text: "B", markdown: "B" },
        ],
        rows: [[{ text: "1", markdown: "1" }]],
        alignments: ["left"],
      }),
    ).toBe(["| A | B |", "| --- | --- |", "| 1 |  |"].join("\n"));
  });

  it("escapes pipes but not already-escaped pipes", () => {
    const output = tableToMarkdown({
      headers: [
        { text: "A", markdown: "A" },
        { text: "B", markdown: "B" },
      ],
      rows: [
        [
          { text: "", markdown: "one \\| two" },
          { text: "", markdown: "x | y" },
        ],
      ],
      alignments: ["left", "left"],
    });

    expect(output).toContain("| one \\| two | x \\| y |");
  });
});

describe("LaTeX table output", () => {
  it("emits a complete table with column alignment and escaped values", () => {
    const output = tableToLatex({
      headers: [
        { text: "Cost & Value", markdown: "Cost & Value" },
        { text: "%", markdown: "%" },
      ],
      rows: [
        [
          { text: "a_b", markdown: "a_b" },
          { text: "x^2", markdown: "x^2" },
        ],
      ],
      alignments: ["center", "right"],
    });

    expect(output).toBe(
      [
        "\\begin{table}[htbp]",
        "  \\centering",
        "  \\begin{tabular}{cr}",
        "    \\hline",
        "    Cost \\& Value & \\% \\\\",
        "    \\hline",
        "    a\\_b & x\\textasciicircum{}2 \\\\",
        "    \\hline",
        "  \\end{tabular}",
        "\\end{table}",
      ].join("\n"),
    );
  });

  it("converts inline Markdown formatting in cells", () => {
    const output = tableToLatex({
      headers: [
        { text: "Bold", markdown: "**Bold**" },
        { text: "Italic", markdown: "*Italic*" },
        { text: "Percent", markdown: String.raw`50\%` },
      ],
      rows: [
        [
          { text: "code", markdown: "`a_b`" },
          { text: "link", markdown: "[label](https://example.com)" },
          { text: "plain", markdown: "100%" },
        ],
      ],
      alignments: ["left", "center", "right"],
    });

    expect(output).toContain(
      String.raw`\textbf{Bold} & \textit{Italic} & 50\% \\`,
    );
    expect(output).toContain(
      String.raw`\texttt{a\_b} & label & 100\% \\`,
    );
  });

  it("does not require a body row", () => {
    const output = tableToLatex({
      headers: [{ text: "Only", markdown: "Only" }],
      rows: [],
      alignments: ["left"],
    });

    expect(output).toContain("\\begin{tabular}{l}");
    expect(output).toContain("Only \\\\");
  });
});
