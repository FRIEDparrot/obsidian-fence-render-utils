import { describe, expect, it } from "vitest";
import { buildHtmlDocument, svgToDataUrl, type HtmlTheme } from "./html";

const theme: HtmlTheme = {
  background: "#ffffff",
  text: "#222222",
  muted: "#666666",
  link: "#0000ee",
  font: "sans-serif",
  mono: "monospace",
  fontSize: "16px",
  border: "#dddddd",
  isDark: false,
};

describe("HTML sandbox documents", () => {
  it("wraps fragments in a complete document", () => {
    const html = buildHtmlDocument("<h1>Hello</h1>", { allowScripts: true, theme });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<h1>Hello</h1>");
    expect(html).toContain('id="fence-render-base-style"');
    expect(html).toContain('id="fence-render-frame-script"');
    expect(html).toContain("ResizeObserver");
  });

  it("preserves full documents and injects head content", () => {
    const source =
      "<!doctype html><html><head><title>X</title></head><body><p>Body</p></body></html>";
    const html = buildHtmlDocument(source, { allowScripts: true, theme });

    expect(html).toContain("<title>X</title>");
    expect(html).toContain('name="referrer"');
    expect(html.match(/<head>/gi)).toHaveLength(1);
    expect(html.indexOf("fence-render-base-style")).toBeLessThan(html.indexOf("<title>"));
  });

  it("does not inject scripts when scripts are disabled", () => {
    const html = buildHtmlDocument("<p>Static</p>", { allowScripts: false, theme });

    expect(html).toContain("<p>Static</p>");
    expect(html).not.toContain("fence-render-frame-script");
  });

  it("uses the theme color scheme", () => {
    const dark = buildHtmlDocument("<p>Dark</p>", {
      allowScripts: false,
      theme: { ...theme, isDark: true },
    });
    expect(dark).toContain("color-scheme: dark");
  });

  it("turns SVG into a data URL", () => {
    const url = svgToDataUrl("<svg xmlns='http://www.w3.org/2000/svg'/>");
    expect(url.startsWith("data:image/svg+xml;base64,")).toBe(true);
    expect(Buffer.from(url.split(",")[1], "base64").toString("utf8")).toContain("<svg");
  });
});
