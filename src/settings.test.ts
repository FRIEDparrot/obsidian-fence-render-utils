import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings } from "./settings-data";

describe("settings normalization", () => {
  it("returns defaults for missing data", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings("nonsense")).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.wrapEquationCopy).toBe(true);
    expect(DEFAULT_SETTINGS.latexPreviewScale).toBe(200);
    expect(DEFAULT_SETTINGS.latexPreviewWidth).toBe("fit");
  });

  it("keeps valid values and clamps numbers", () => {
    const settings = normalizeSettings({
      renderMarkdown: false,
      defaultView: "source",
      htmlHeight: 9999,
      latexTimeoutSec: 1,
      latexPath: "",
      latexInvertDark: false,
      wrapEquationCopy: false,
      latexPreviewScale: 9999,
      latexPreviewWidth: "full",
    });

    expect(settings.renderMarkdown).toBe(false);
    expect(settings.defaultView).toBe("source");
    expect(settings.htmlHeight).toBe(900);
    expect(settings.latexTimeoutSec).toBe(10);
    expect(settings.latexPath).toBe("latex");
    expect(settings.latexInvertDark).toBe(false);
    expect(settings.wrapEquationCopy).toBe(false);
    expect(settings.latexPreviewScale).toBe(400);
    expect(settings.latexPreviewWidth).toBe("full");
  });

  it("clamps low preview scales and rejects unknown widths", () => {
    const settings = normalizeSettings({
      latexPreviewScale: 10,
      latexPreviewWidth: "stretch",
    });

    expect(settings.latexPreviewScale).toBe(100);
    expect(settings.latexPreviewWidth).toBe("fit");
  });

  it("rejects unknown enum values", () => {
    expect(normalizeSettings({ defaultView: "sideways" }).defaultView).toBe("rendered");
  });

  it("preserves an intentionally empty package list", () => {
    expect(normalizeSettings({ latexPackages: "" }).latexPackages).toBe("");
  });
});
