import { describe, expect, it } from "vitest";
import { formatForLanguage, isMermaidFence, normalizeLanguageTag } from "./language";

describe("language aliases", () => {
  it("normalizes fence tags", () => {
    expect(normalizeLanguageTag(" Markdown ")).toBe("markdown");
    expect(normalizeLanguageTag("{.md}")).toBe("md");
    expect(normalizeLanguageTag("md title:foo")).toBe("md");
    expect(normalizeLanguageTag("")).toBeNull();
  });

  it("maps all supported aliases", () => {
    expect(formatForLanguage("md")).toBe("markdown");
    expect(formatForLanguage("Markdown")).toBe("markdown");
    expect(formatForLanguage("tex")).toBe("latex");
    expect(formatForLanguage("LaTeX")).toBe("latex");
    expect(formatForLanguage("html")).toBe("html");
    expect(formatForLanguage("HTM")).toBe("html");
  });

  it("does not claim unsupported languages", () => {
    expect(formatForLanguage("mermaid")).toBeNull();
    expect(formatForLanguage("python")).toBeNull();
    expect(formatForLanguage(null)).toBeNull();
  });

  it("recognizes mermaid explicitly", () => {
    expect(isMermaidFence("mermaid")).toBe(true);
    expect(isMermaidFence("Mermaid")).toBe(true);
    expect(isMermaidFence("md")).toBe(false);
  });
});
