import { describe, expect, it } from "vitest";
import {
  buildLatexDocument,
  extractDocumentBody,
  formatPackageLines,
  looksLikeBareMath,
  parsePackageList,
  summarizeLatexFailure,
  wrapBareMath,
} from "./latex";

describe("LaTeX package parsing", () => {
  it("accepts names, commas, and explicit usepackage lines", () => {
    expect(
      parsePackageList("amsmath, amssymb\n\\usepackage[table]{xcolor}\n\n  bm  "),
    ).toEqual(["amsmath", "amssymb", "\\usepackage[table]{xcolor}", "bm"]);
  });

  it("ignores invalid package names", () => {
    expect(parsePackageList("amsmath\nbad package\n")).toEqual(["amsmath"]);
  });

  it("formats package lines", () => {
    expect(formatPackageLines(["amsmath", "\\usepackage{xcolor}"])).toBe(
      "\\usepackage{amsmath}\n\\usepackage{xcolor}",
    );
  });
});

describe("LaTeX document wrapping", () => {
  it("wraps a fragment in a standalone document", () => {
    const result = buildLatexDocument("E = mc^2", {
      packages: "amsmath\nbm",
      preamble: "\\newcommand{\\R}{\\mathbb{R}}",
    });

    expect(result.wrapped).toBe(true);
    expect(result.mathWrapped).toBe(true);
    expect(result.packageList).toEqual(["amsmath", "bm"]);
    expect(result.document).toContain(
      "\\documentclass[border=4pt,varwidth=true,12pt]{standalone}",
    );
    expect(result.document).toContain("\\usepackage{amsmath}");
    expect(result.document).toContain("\\usepackage{bm}");
    expect(result.document).toContain("\\newcommand{\\R}{\\mathbb{R}}");
    expect(result.document).toContain("\\begin{document}\n\\[\nE = mc^2\n\\]\n\\end{document}");
  });

  it("does not wrap prose", () => {
    const result = buildLatexDocument("The purpose of this work is to build a framework.", {
      packages: "",
      preamble: "",
    });

    expect(result.mathWrapped).toBe(false);
    expect(result.document).toContain(
      "\\begin{document}\nThe purpose of this work is to build a framework.\n\\end{document}",
    );
  });

  it("can disable bare-math wrapping", () => {
    const result = buildLatexDocument("E = mc^2", {
      packages: "",
      preamble: "",
      wrapMath: false,
    });

    expect(result.mathWrapped).toBe(false);
    expect(result.document).toContain("\\begin{document}\nE = mc^2\n\\end{document}");
  });

  it("can force wrapping for an inline MathJax expression", () => {
    const result = buildLatexDocument("x", {
      packages: "",
      preamble: "",
      forceMath: true,
    });

    expect(result.mathWrapped).toBe(true);
    expect(result.document).toContain("\\begin{document}\n\\[\nx\n\\]\n\\end{document}");
  });

  it("does not double-wrap already delimited math", () => {
    const result = buildLatexDocument("\\[x\\]", {
      packages: "",
      preamble: "",
      forceMath: true,
    });

    expect(result.mathWrapped).toBe(false);
    expect(result.document.match(/\\\[/g)).toHaveLength(1);
  });

  it("keeps a complete document unchanged", () => {
    const source = "\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}";
    const result = buildLatexDocument(source, { packages: "amsmath", preamble: "" });

    expect(result.wrapped).toBe(false);
    expect(result.document.trim()).toBe(source);
  });

  it("unwraps a pasted document environment", () => {
    const result = buildLatexDocument(
      "\\begin{document}\nHello\n\\end{document}",
      { packages: "", preamble: "" },
    );

    expect(result.wrapped).toBe(true);
    expect(result.document.match(/\\begin\{document\}/g)).toHaveLength(1);
    expect(result.document).toContain("Hello");
  });

  it("extracts a document body", () => {
    expect(
      extractDocumentBody("preamble\n\\begin{document}\nBody\n\\end{document}\ntrailing"),
    ).toBe("Body");
    expect(extractDocumentBody("no document")).toBeNull();
  });
});

describe("bare math detection", () => {
  it("detects raw equations", () => {
    expect(looksLikeBareMath("E = mc^2")).toBe(true);
    expect(looksLikeBareMath("\\alpha = \\frac{1}{2}")).toBe(true);
    expect(looksLikeBareMath("x^2 + y^2 = z^2")).toBe(true);
  });

  it("leaves prose and already-delimited math alone", () => {
    expect(looksLikeBareMath("The purpose of this work is to build a framework.")).toBe(false);
    expect(looksLikeBareMath("$E = mc^2$")).toBe(false);
    expect(looksLikeBareMath("\\begin{equation}E=mc^2\\end{equation}")).toBe(false);
    expect(looksLikeBareMath("\\begin{aligned}a&=b\\end{aligned}")).toBe(true);
    expect(looksLikeBareMath("\\begin{cases}a&b\\\\c&d\\end{cases}")).toBe(true);
    expect(looksLikeBareMath("\\section{Introduction}")).toBe(false);
    expect(looksLikeBareMath("@article{key, title={X}}")).toBe(false);
    expect(looksLikeBareMath("\\includegraphics{fig.png}")).toBe(false);
  });

  it("joins paragraphs when wrapping", () => {
    expect(wrapBareMath("a=b\n\nc=d")).toBe("\\[\na=b\n\\[0.6em]\nc=d\n\\]");
  });
});

describe("LaTeX error summaries", () => {
  it("includes the first TeX error and missing package hint", () => {
    const summary = summarizeLatexFailure(
      "This is a log\n! LaTeX Error: File `standalone.cls' not found.\n\nl.3 \\documentclass",
      "",
      "",
    );

    expect(summary).toContain("LaTeX Error");
    expect(summary).toContain("Auto-install missing MiKTeX packages");
  });

  it("falls back to the end of the transcript", () => {
    const summary = summarizeLatexFailure("line one\nline two\nline three");
    expect(summary).toBe("line one\nline two\nline three");
  });
});
