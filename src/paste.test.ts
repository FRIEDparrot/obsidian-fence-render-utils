import { describe, expect, it } from "vitest";
import { convertChatGptMath } from "./paste";

describe("ChatGPT math paste conversion", () => {
  it("converts inline and display delimiters", () => {
    const input = String.raw`For option \(j\) of block \(b\), let \(d_{bj}\) be its sum.

\[
\min \sum_{b,j} c_{bj}z_{bj}, \qquad \sum_j z_{bj}=1
\]`;
    const output = convertChatGptMath(input);

    expect(output).toContain("For option $j$ of block $b$");
    expect(output).toContain("$d_{bj}$");
    expect(output).toContain("$$\n\\min \\sum_{b,j} c_{bj}z_{bj}, \\qquad \\sum_j z_{bj}=1\n$$");
  });

  it("leaves existing dollar math untouched", () => {
    const input = String.raw`Inline $x$ and display $$y$$ stay, but \(z\) becomes $z$.`;
    expect(convertChatGptMath(input)).toBe(
      String.raw`Inline $x$ and display $$y$$ stay, but $z$ becomes $z$.`,
    );
  });

  it("preserves fenced code blocks", () => {
    const input = [
      "Before \\(x\\)",
      "```latex",
      "\\(y\\)",
      "\\[",
      "z",
      "\\]",
      "```",
      "After \\(q\\)",
    ].join("\n");

    const output = convertChatGptMath(input);
    expect(output).toContain("Before $x$");
    expect(output).toContain("```latex\n\\(y\\)\n\\[\nz\n\\]\n```");
    expect(output).toContain("After $q$");
  });

  it("preserves inline code", () => {
    const input = String.raw`Use \(a\) but keep \`\(b\)\` as code.`;
    expect(convertChatGptMath(input)).toBe(
      String.raw`Use $a$ but keep \`\(b\)\` as code.`,
    );
  });

  it("does not rewrite already escaped opening delimiters", () => {
    const input = String.raw`Literal \\(x\\) remains and \(y\) converts.`;
    expect(convertChatGptMath(input)).toBe(
      String.raw`Literal \\(x\\) remains and $y$ converts.`,
    );
  });

  it("leaves unmatched or empty delimiters alone", () => {
    const input = String.raw`Unmatched \(x and empty \(\) stay.`;
    expect(convertChatGptMath(input)).toBe(input);
  });

  it("returns text unchanged when no ChatGPT delimiters exist", () => {
    const input = "No math here.";
    expect(convertChatGptMath(input)).toBe(input);
  });

  it("formats scripts in converted display math", () => {
    const input = String.raw`\[
r^k + \mathbf r_k
\]`;
    expect(convertChatGptMath(input, { formatScripts: true })).toBe(
      String.raw`$$
r^{k} + \mathbf r_{k}
$$`,
    );
  });

  it("formats existing dollar math when enabled", () => {
    const input = String.raw`Inline $r^k$ and block $$x_i$$.`;
    expect(convertChatGptMath(input, { formatScripts: true })).toBe(
      String.raw`Inline $r^{k}$ and block $$x_{i}$$.`,
    );
  });

  it("can disable script formatting while converting delimiters", () => {
    const input = String.raw`\(r^k\)`;
    expect(convertChatGptMath(input, { formatScripts: false })).toBe("$r^k$");
  });

  it("can format dollar math without converting delimiters", () => {
    const input = String.raw`\(r^k\) and $x_i$`;
    expect(
      convertChatGptMath(input, {
        convertDelimiters: false,
        formatScripts: true,
      }),
    ).toBe(String.raw`\(r^k\) and $x_{i}$`);
  });
});
