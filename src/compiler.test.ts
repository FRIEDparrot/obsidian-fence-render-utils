import { describe, expect, it } from "vitest";
import { LatexCompiler, type LatexCompilerSettings } from "./compiler";
import { DEFAULT_LATEX_PACKAGES } from "./latex";

const runIntegration = process.env.FENCE_RENDER_TEST_TEX === "1";

const settings: LatexCompilerSettings = {
  latexPath: "latex",
  dvisvgmPath: "dvisvgm",
  pdftocairoPath: "pdftocairo",
  latexPackages: DEFAULT_LATEX_PACKAGES,
  latexPreamble: "",
  latexAutoInstall: true,
  latexTimeoutSec: 120,
  latexWrapMath: true,
};

describe.skipIf(!runIntegration)("LaTeX compiler integration", () => {
  it(
    "compiles a math fragment to SVG and caches it",
    async () => {
      const compiler = new LatexCompiler(() => settings);
      const first = await compiler.compile("E = mc^2");
      expect(first.ok, first.error).toBe(true);
      expect(first.svg).toContain("<svg");
      expect(first.cached).toBe(false);

      const second = await compiler.compile("E = mc^2");
      expect(second.ok).toBe(true);
      expect(second.cached).toBe(true);
      expect(second.svg).toBe(first.svg);
    },
    180_000,
  );

  it(
    "compiles prose through the standalone class",
    async () => {
      const compiler = new LatexCompiler(() => settings);
      const result = await compiler.compile(
        "The purpose of this work is to build a practical framework for heterogeneous lattice structures.",
      );
      expect(result.ok, result.error).toBe(true);
      expect(result.svg).toContain("<svg");
    },
    180_000,
  );

  it(
    "compiles a normal Markdown equation with a tag",
    async () => {
      const compiler = new LatexCompiler(() => settings);
      const result = await compiler.compile(
        "aX \\sim N (a\\mu, a\\sigma^{2}) \\tag{1.1}",
        { forceMath: true },
      );
      expect(result.ok, result.error).toBe(true);
      expect(result.svg).toContain("<svg");
    },
    180_000,
  );

  it(
    "leaves a complete document untouched",
    async () => {
      const compiler = new LatexCompiler(() => settings);
      const result = await compiler.compile(
        "\\documentclass{standalone}\n\\begin{document}\n$E=mc^2$\n\\end{document}",
      );
      expect(result.ok, result.error).toBe(true);
      expect(result.svg).toContain("<svg");
    },
    180_000,
  );
});
