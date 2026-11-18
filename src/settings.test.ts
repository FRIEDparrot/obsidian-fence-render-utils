import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings } from "./settings-data";

describe("settings normalization", () => {
  it("returns defaults for missing data", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings("nonsense")).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.wrapEquationCopy).toBe(true);
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
    });

    expect(settings.renderMarkdown).toBe(false);
    expect(settings.defaultView).toBe("source");
    expect(settings.htmlHeight).toBe(900);
    expect(settings.latexTimeoutSec).toBe(10);
    expect(settings.latexPath).toBe("latex");
    expect(settings.latexInvertDark).toBe(false);
    expect(settings.wrapEquationCopy).toBe(false);
  });

  it("rejects unknown enum values", () => {
    expect(normalizeSettings({ defaultView: "sideways" }).defaultView).toBe("rendered");
  });

  it("preserves an intentionally empty package list", () => {
    expect(normalizeSettings({ latexPackages: "" }).latexPackages).toBe("");
  });
});
