import { describe, expect, it } from "vitest";
import { formatMathScripts } from "./math-format";

describe("Auto-format math scripts", () => {
  it("wraps simple superscripts and subscripts", () => {
    expect(formatMathScripts(String.raw`r^k + r_k + G_k + b_j`)).toBe(
      String.raw`r^{k} + r_{k} + G_{k} + b_{j}`,
    );
  });

  it("leaves already grouped scripts alone", () => {
    expect(formatMathScripts(String.raw`r^{k} + r_{k} + x^{-1}`)).toBe(
      String.raw`r^{k} + r_{k} + x^{-1}`,
    );
  });

  it("handles multi-character and command arguments", () => {
    expect(formatMathScripts(String.raw`x^12 + x^\alpha + x^\frac{1}{2}`)).toBe(
      String.raw`x^{12} + x^{\alpha} + x^{\frac{1}{2}}`,
    );
  });

  it("wraps scripts after primes and inside groups", () => {
    expect(formatMathScripts(String.raw`(\mathbf r_k)_i + \mathbf r'_k`)).toBe(
      String.raw`(\mathbf r_{k})_{i} + \mathbf r'_{k}`,
    );
  });

  it("formats a multi-line aligned block", () => {
    const input = String.raw`\operatorname{IoU}(\mathbf b_i,\mathbf r_k)&\geq\eta,\\
(\mathbf r_k)_i&=1,\\
\lVert\mathbf r'_k\rVert_1
&\geq \eta\max_{j\in G_k\cup\{i\}}\lVert\mathbf b_j\rVert_1.`;

    expect(formatMathScripts(input)).toBe(
      String.raw`\operatorname{IoU}(\mathbf b_{i},\mathbf r_{k})&\geq\eta,\\
(\mathbf r_{k})_{i}&=1,\\
\lVert\mathbf r'_{k}\rVert_{1}
&\geq \eta\max_{j\in G_{k}\cup\{i\}}\lVert\mathbf b_{j}\rVert_{1}.`,
    );
  });

  it("does not touch escaped underscores or bare markers", () => {
    expect(formatMathScripts(String.raw`a\_b + x^ + y_`)).toBe(
      String.raw`a\_b + x^ + y_`,
    );
  });
});
