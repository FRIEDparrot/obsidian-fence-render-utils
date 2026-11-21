import type { LatexCompilerSettings } from "./compiler";
import { DEFAULT_LATEX_PACKAGES } from "./latex";

export type DefaultView = "rendered" | "source";
export type LatexPreviewWidth = "fit" | "full";

export interface FenceRenderSettings extends LatexCompilerSettings {
  renderMarkdown: boolean;
  renderLatex: boolean;
  renderHtml: boolean;
  defaultView: DefaultView;
  showToolbar: boolean;
  allowHtmlScripts: boolean;
  htmlHeight: number;
  latexInvertDark: boolean;
  wrapEquationCopy: boolean;
  latexPreviewScale: number;
  latexPreviewWidth: LatexPreviewWidth;
  convertChatGptPaste: boolean;
}

export const DEFAULT_SETTINGS: FenceRenderSettings = {
  renderMarkdown: true,
  renderLatex: true,
  renderHtml: true,
  defaultView: "rendered",
  showToolbar: true,
  allowHtmlScripts: true,
  htmlHeight: 360,
  latexInvertDark: true,
  wrapEquationCopy: true,
  latexPreviewScale: 200,
  latexPreviewWidth: "fit",
  convertChatGptPaste: true,
  latexPath: "latex",
  dvisvgmPath: "dvisvgm",
  pdftocairoPath: "pdftocairo",
  latexPackages: DEFAULT_LATEX_PACKAGES,
  latexPreamble: "",
  latexAutoInstall: true,
  latexTimeoutSec: 120,
  latexWrapMath: true,
};

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function normalizeSettings(raw: unknown): FenceRenderSettings {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    renderMarkdown: booleanOr(value.renderMarkdown, DEFAULT_SETTINGS.renderMarkdown),
    renderLatex: booleanOr(value.renderLatex, DEFAULT_SETTINGS.renderLatex),
    renderHtml: booleanOr(value.renderHtml, DEFAULT_SETTINGS.renderHtml),
    defaultView:
      value.defaultView === "source" || value.defaultView === "rendered"
        ? value.defaultView
        : DEFAULT_SETTINGS.defaultView,
    showToolbar: booleanOr(value.showToolbar, DEFAULT_SETTINGS.showToolbar),
    allowHtmlScripts: booleanOr(value.allowHtmlScripts, DEFAULT_SETTINGS.allowHtmlScripts),
    htmlHeight: clampNumber(value.htmlHeight, DEFAULT_SETTINGS.htmlHeight, 160, 900),
    latexInvertDark: booleanOr(value.latexInvertDark, DEFAULT_SETTINGS.latexInvertDark),
    wrapEquationCopy: booleanOr(
      value.wrapEquationCopy,
      DEFAULT_SETTINGS.wrapEquationCopy,
    ),
    latexPreviewScale: clampNumber(
      value.latexPreviewScale,
      DEFAULT_SETTINGS.latexPreviewScale,
      100,
      400,
    ),
    latexPreviewWidth:
      value.latexPreviewWidth === "full" || value.latexPreviewWidth === "fit"
        ? value.latexPreviewWidth
        : DEFAULT_SETTINGS.latexPreviewWidth,
    convertChatGptPaste: booleanOr(
      value.convertChatGptPaste,
      DEFAULT_SETTINGS.convertChatGptPaste,
    ),
    latexPath: stringOr(value.latexPath, DEFAULT_SETTINGS.latexPath) || DEFAULT_SETTINGS.latexPath,
    dvisvgmPath:
      stringOr(value.dvisvgmPath, DEFAULT_SETTINGS.dvisvgmPath) || DEFAULT_SETTINGS.dvisvgmPath,
    pdftocairoPath:
      stringOr(value.pdftocairoPath, DEFAULT_SETTINGS.pdftocairoPath) ||
      DEFAULT_SETTINGS.pdftocairoPath,
    latexPackages: stringOr(value.latexPackages, DEFAULT_SETTINGS.latexPackages),
    latexPreamble: stringOr(value.latexPreamble, DEFAULT_SETTINGS.latexPreamble),
    latexAutoInstall: booleanOr(value.latexAutoInstall, DEFAULT_SETTINGS.latexAutoInstall),
    latexTimeoutSec: clampNumber(
      value.latexTimeoutSec,
      DEFAULT_SETTINGS.latexTimeoutSec,
      10,
      300,
    ),
    latexWrapMath: booleanOr(value.latexWrapMath, DEFAULT_SETTINGS.latexWrapMath),
  };
}
