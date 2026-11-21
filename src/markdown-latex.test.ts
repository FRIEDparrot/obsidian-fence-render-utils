import { describe, expect, it } from "vitest";
import { escapeLatexText, markdownInlineToLatex } from "./markdown-latex";

describe("Markdown inline to LaTeX", () => {
  it("converts bold, italics, and escaped percent", () => {
    expect(markdownInlineToLatex(String.raw`**bold** and *italic*: 50\%`)).toBe(
      String.raw`\textbf{bold} and \textit{italic}: 50\%`,
    );
  });

  it("escapes unescaped LaTeX specials", () => {
    expect(escapeLatexText("100% & a_b #1 <x>")).toBe(
      String.raw`100\% \& a\_b \#1 \textless{}x\textgreater{}`,
    );
  });

  it("preserves inline and display math", () => {
    expect(markdownInlineToLatex(String.raw`$x_1$ and $$y^2$$`)).toBe(
      String.raw`$x_1$ and $$y^2$$`,
    );
  });

  it("converts inline code and links", () => {
    expect(markdownInlineToLatex("`a_b` and [**label**](https://example.com)")).toBe(
      String.raw`\texttt{a\_b} and \textbf{label}`,
    );
  });

  it("converts underscore italics and leaves ordinary underscores alone", () => {
    expect(markdownInlineToLatex("_word_ and a_b")).toBe(
      String.raw`\textit{word} and a\_b`,
    );
  });

  it("handles nested bold and italics", () => {
    expect(markdownInlineToLatex("***both***")).toContain("both");
  });

  it("escapes literal table pipes", () => {
    expect(markdownInlineToLatex(String.raw`a \| b`)).toBe(
      String.raw`a \textbar{} b`,
    );
    expect(markdownInlineToLatex("a | b")).toBe(String.raw`a \textbar{} b`);
  });
});
