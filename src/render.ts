import {
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  MarkdownRenderer,
  Menu,
  Notice,
  setIcon,
} from "obsidian";
import type { LatexCompileResult } from "./compiler";
import { buildHtmlDocument, svgToDataUrl, type HtmlTheme } from "./html";
import { isEquationSourceForCopy, wrapEquationEnvironment } from "./latex";
import { LANGUAGE_ICONS, LANGUAGE_LABELS, type RenderLanguage } from "./language";
import { highlightSource } from "./prism";
import type { DefaultView, LatexPreviewWidth } from "./settings";
import type FenceRenderPlugin from "./main";

export interface RenderRequest {
  plugin: FenceRenderPlugin;
  language: RenderLanguage;
  source: string;
  container: HTMLElement;
  ctx: MarkdownPostProcessorContext;
}

interface WindowOptions {
  doc: Document;
  language: RenderLanguage;
  showToolbar: boolean;
  initialView: DefaultView;
  copySourceText?: string;
  latexScale?: number;
  latexWidth?: LatexPreviewWidth;
}

/**
 * The chrome around one rendered fence. Both the preview and the source live in
 * the DOM; toggling only changes which pane is visible.
 */
export class FenceWindow {
  readonly root: HTMLElement;
  readonly preview: HTMLElement;
  readonly body: HTMLElement;
  readonly sourceCode: HTMLElement;

  private readonly doc: Document;
  private readonly language: RenderLanguage;
  private readonly source: string;
  private readonly copySourceText: string;
  private readonly sourcePane: HTMLElement;
  private readonly sourceNote: HTMLElement;
  private readonly latexScale: number;
  private readonly latexWidth: LatexPreviewWidth;
  private toggleButton: HTMLButtonElement | null = null;
  private copyButton: HTMLButtonElement | null = null;
  private expandButton: HTMLButtonElement | null = null;
  private fullscreenKeyHandler: ((event: KeyboardEvent) => void) | null = null;
  private view: DefaultView;

  constructor(source: string, options: WindowOptions) {
    this.doc = options.doc;
    this.language = options.language;
    this.source = source;
    this.copySourceText = options.copySourceText ?? source;
    this.latexScale = options.latexScale ?? 2;
    this.latexWidth = options.latexWidth ?? "fit";
    this.view = options.initialView;

    const root = this.doc.createElement("div");
    root.className = `fence-render-window fence-render-window--${options.language}`;
    root.dataset.fenceLanguage = options.language;
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", `${LANGUAGE_LABELS[options.language]} preview`);
    this.root = root;

    if (options.showToolbar) {
      root.append(this.buildToolbar());
    } else {
      root.classList.add("fence-render-window--bare");
    }

    const body = this.doc.createElement("div");
    body.className = "fence-render-body";
    this.body = body;

    const preview = this.doc.createElement("div");
    preview.className = `fence-render-preview fence-render-preview--${options.language} markdown-rendered`;
    this.preview = preview;

    const sourcePane = this.doc.createElement("div");
    sourcePane.className = "fence-render-pane fence-render-source";
    this.sourcePane = sourcePane;

    const sourceNote = this.doc.createElement("div");
    sourceNote.className = "fence-render-source-note";
    sourceNote.hidden = true;
    this.sourceNote = sourceNote;

    const pre = this.doc.createElement("pre");
    pre.className = "fence-render-source-pre";
    const code = this.doc.createElement("code");
    code.className = `fence-render-source-code language-${options.language}`;
    this.sourceCode = code;
    pre.append(code);
    sourcePane.append(sourceNote, pre);

    body.append(preview, sourcePane);
    root.append(body);

    this.setView(options.initialView);
    void highlightSource(code, source, options.language);
  }

  get isConnected(): boolean {
    return this.root.isConnected;
  }

  setLoading(message: string): void {
    const loading = this.doc.createElement("div");
    loading.className = "fence-render-loading";
    const spinner = this.doc.createElement("span");
    spinner.className = "fence-render-spinner";
    spinner.setAttribute("aria-hidden", "true");
    loading.append(spinner, this.doc.createTextNode(message));
    this.replacePreview(loading);
  }

  setEmpty(message: string): void {
    const empty = this.doc.createElement("div");
    empty.className = "fence-render-empty";
    empty.textContent = message;
    this.replacePreview(empty);
  }

  setError(message: string, title = "Rendering failed"): void {
    const wrapper = this.doc.createElement("div");
    wrapper.className = "fence-render-error";

    const heading = this.doc.createElement("div");
    heading.className = "fence-render-error-title";
    const icon = this.doc.createElement("span");
    icon.className = "fence-render-error-icon";
    setIcon(icon, "alert-triangle");
    heading.append(icon, this.doc.createTextNode(title));

    const detail = this.doc.createElement("pre");
    detail.className = "fence-render-error-detail";
    detail.textContent = message;

    wrapper.append(heading, detail);
    this.replacePreview(wrapper);
  }

  setSvg(svg: string): void {
    const paper = this.doc.createElement("div");
    paper.className = "fence-render-paper";

    const image = this.doc.createElement("img");
    image.className = "fence-render-latex-image";
    image.alt = "Rendered LaTeX";
    image.title = "Right-click to copy the equation image";
    image.draggable = false;

    const applyConfiguredSize = (): void => {
      if (this.latexWidth === "full") {
        image.style.width = "100%";
        return;
      }

      const naturalWidth = image.naturalWidth || image.width || 1;
      image.style.width = `${Math.max(1, Math.round(naturalWidth * this.latexScale))}px`;
    };

    image.addEventListener("load", applyConfiguredSize);
    image.src = svgToDataUrl(svg);
    if (image.complete && image.naturalWidth > 0) applyConfiguredSize();

    paper.addEventListener(
      "contextmenu",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.openLatexContextMenu(event, svg);
      },
      { capture: true },
    );

    paper.append(image);
    this.replacePreview(paper);
  }

  setSourceNote(message: string | null): void {
    this.sourceNote.textContent = message ?? "";
    this.sourceNote.hidden = !message;
  }

  setView(view: DefaultView): void {
    this.view = view;
    this.preview.classList.toggle("is-hidden", view !== "rendered");
    this.sourcePane.classList.toggle("is-hidden", view !== "source");
    this.root.dataset.view = view;

    if (this.toggleButton) {
      const showingSource = view === "source";
      setIcon(this.toggleButton, showingSource ? "eye" : "code");
      const label = showingSource ? "Show rendered preview" : "Show source";
      this.toggleButton.setAttribute("aria-label", label);
      this.toggleButton.setAttribute("data-tooltip", label);
    }
  }

  private replacePreview(element: HTMLElement): void {
    this.preview.empty();
    this.preview.append(element);
    this.setView(this.view);
  }

  private buildToolbar(): HTMLElement {
    const toolbar = this.doc.createElement("div");
    toolbar.className = "fence-render-titlebar";

    const title = this.doc.createElement("div");
    title.className = "fence-render-title";
    const icon = this.doc.createElement("span");
    icon.className = "fence-render-title-icon";
    setIcon(icon, LANGUAGE_ICONS[this.language]);
    const label = this.doc.createElement("span");
    label.className = "fence-render-title-label";
    label.textContent = LANGUAGE_LABELS[this.language];
    title.append(icon, label);

    const actions = this.doc.createElement("div");
    actions.className = "fence-render-actions";

    const toggle = this.makeButton("code", "Show source");
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      this.setView(this.view === "rendered" ? "source" : "rendered");
    });
    this.toggleButton = toggle;

    const copy = this.makeButton("copy", "Copy source");
    copy.addEventListener("click", (event) => {
      event.preventDefault();
      void this.copySource();
    });
    this.copyButton = copy;

    const expand = this.makeButton("maximize-2", "Full screen preview");
    expand.addEventListener("click", (event) => {
      event.preventDefault();
      this.toggleFullscreen();
    });
    this.expandButton = expand;

    actions.append(toggle, copy, expand);
    toolbar.append(title, actions);
    return toolbar;
  }

  private makeButton(icon: string, label: string): HTMLButtonElement {
    const button = this.doc.createElement("button");
    button.type = "button";
    button.className = "clickable-icon fence-render-action";
    button.setAttribute("aria-label", label);
    button.setAttribute("data-tooltip", label);
    setIcon(button, icon);
    return button;
  }

  private openLatexContextMenu(event: MouseEvent, svg: string): void {
    const menu = new Menu();
    menu.addItem((item) =>
      item
        .setTitle("Copy equation image")
        .setIcon("image")
        .onClick(() => {
          void copyEquationImage(svg, this.doc);
        }),
    );
    menu.addItem((item) =>
      item
        .setTitle("Copy LaTeX source")
        .setIcon("code")
        .onClick(() => {
          void this.copySource();
        }),
    );
    menu.showAtMouseEvent(event);
  }

  private async copySource(): Promise<void> {
    try {
      await copyText(this.doc, this.copySourceText);
      new Notice(`Copied ${LANGUAGE_LABELS[this.language]} source.`);
      if (this.copyButton) {
        setIcon(this.copyButton, "check");
        this.doc.defaultView?.setTimeout(() => {
          if (this.copyButton) setIcon(this.copyButton, "copy");
        }, 1200);
      }
    } catch (error) {
      console.error("Fence Render Utils: copy failed", error);
      new Notice("Could not copy the fence source.");
    }
  }

  private toggleFullscreen(): void {
    this.setFullscreen(!this.root.classList.contains("is-fullscreen"));
  }

  private setFullscreen(fullscreen: boolean): void {
    this.root.classList.toggle("is-fullscreen", fullscreen);

    if (this.expandButton) {
      const label = fullscreen ? "Exit full screen" : "Full screen preview";
      setIcon(this.expandButton, fullscreen ? "minimize-2" : "maximize-2");
      this.expandButton.setAttribute("aria-label", label);
      this.expandButton.setAttribute("data-tooltip", label);
      this.expandButton.setAttribute("aria-pressed", String(fullscreen));
    }

    if (fullscreen && !this.fullscreenKeyHandler) {
      this.fullscreenKeyHandler = (event: KeyboardEvent) => {
        if (event.key !== "Escape") return;
        if (!this.root.isConnected) {
          this.setFullscreen(false);
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        this.setFullscreen(false);
      };
      this.doc.addEventListener("keydown", this.fullscreenKeyHandler, true);
    } else if (!fullscreen && this.fullscreenKeyHandler) {
      this.doc.removeEventListener("keydown", this.fullscreenKeyHandler, true);
      this.fullscreenKeyHandler = null;
    }
  }
}

export async function copyText(doc: Document, text: string): Promise<void> {
  const navigator = doc.defaultView?.navigator;
  if (navigator?.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the legacy path.
    }
  }

  const textarea = doc.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  doc.body.append(textarea);
  textarea.select();
  const copied = doc.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard API unavailable");
}

export async function copyEquationImage(svg: string, doc: Document): Promise<void> {
  try {
    const { blob, dataUrl } = await rasterizeSvg(svg, doc);
    const view = doc.defaultView ?? window;

    if (view.navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      try {
        await view.navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        new Notice("Equation image copied to clipboard.");
        return;
      } catch (error) {
        console.debug("Fence Render Utils: browser image clipboard failed", error);
      }
    }

    // Electron's native clipboard is more reliable on some Windows setups.
    try {
      const electron = require("electron") as {
        clipboard?: { writeImage(image: unknown): void };
        nativeImage?: { createFromDataURL(url: string): unknown };
      };
      if (electron.clipboard && electron.nativeImage) {
        electron.clipboard.writeImage(
          electron.nativeImage.createFromDataURL(dataUrl),
        );
        new Notice("Equation image copied to clipboard.");
        return;
      }
    } catch (error) {
      console.debug("Fence Render Utils: Electron image clipboard failed", error);
    }

    throw new Error("No image clipboard backend available");
  } catch (error) {
    console.error("Fence Render Utils: could not copy equation image", error);
    new Notice("Could not copy the equation image.");
  }
}

interface RasterizedSvg {
  blob: Blob;
  dataUrl: string;
}

async function rasterizeSvg(svg: string, doc: Document): Promise<RasterizedSvg> {
  const image = await loadSvgImage(svgToDataUrl(svg), doc);
  const sourceWidth = Math.max(1, image.naturalWidth || 100);
  const sourceHeight = Math.max(1, image.naturalHeight || 100);

  // Use a high-DPI raster so the copy stays crisp in Word/PowerPoint.
  const scale = Math.min(4, Math.max(1, 2400 / Math.max(sourceWidth, sourceHeight)));
  const canvas = doc.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create a 2D canvas context");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("Could not rasterize the equation"));
    }, "image/png");
  });

  return { blob, dataUrl };
}

function loadSvgImage(src: string, doc: Document): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const view = doc.defaultView ?? window;
    const image = new view.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode the equation SVG"));
    image.src = src;
    if (image.complete && image.naturalWidth > 0) resolve(image);
  });
}

export async function renderFence(request: RenderRequest): Promise<void> {
  switch (request.language) {
    case "markdown":
      await renderMarkdownFence(request);
      break;
    case "latex":
      await renderLatexFence(request);
      break;
    case "html":
      renderHtmlFence(request);
      break;
  }
}

/**
 * Restore something that looks like Obsidian's normal code block when a format
 * is disabled, or when a fence is nested inside a preview we already rendered.
 */
export function renderNativeFallback(
  container: HTMLElement,
  source: string,
  language: RenderLanguage,
): void {
  const doc = container.ownerDocument;
  const pre = doc.createElement("pre");
  pre.className = "fence-render-fallback";
  const code = doc.createElement("code");
  code.className = `language-${language}`;
  code.textContent = source;
  pre.append(code);
  container.replaceChildren(pre);
  void highlightSource(code, source, language);
}

async function renderMarkdownFence(request: RenderRequest): Promise<void> {
  const { plugin, source, container, ctx } = request;
  const win = createWindow(plugin, container.ownerDocument, "markdown", source);
  container.replaceChildren(win.root);

  if (!source.trim()) {
    win.setEmpty("Empty Markdown fence.");
    return;
  }

  try {
    const child = new MarkdownRenderChild(win.preview);
    ctx.addChild(child);
    await MarkdownRenderer.render(plugin.app, source, win.preview, ctx.sourcePath, child);
  } catch (error) {
    console.error("Fence Render Utils: Markdown rendering failed", error);
    win.setError(error instanceof Error ? error.message : String(error));
  }
}

async function renderLatexFence(request: RenderRequest): Promise<void> {
  const { plugin, source, container } = request;
  const win = createWindow(plugin, container.ownerDocument, "latex", source);
  container.replaceChildren(win.root);
  win.setLoading("Compiling LaTeX…");

  if (!source.trim()) {
    win.setEmpty("Empty LaTeX fence.");
    return;
  }

  let result: LatexCompileResult;
  try {
    result = await plugin.compiler.compile(source);
  } catch (error) {
    result = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: 0,
      cached: false,
    };
  }

  if (!win.isConnected) return;

  if (result.ok && result.svg) {
    win.setSvg(result.svg);
  } else {
    win.setError(result.error ?? "Unknown LaTeX compilation error.", "LaTeX compilation failed");
  }
}

function renderHtmlFence(request: RenderRequest): void {
  const { plugin, source, container, ctx } = request;
  const settings = plugin.settings;
  const win = createWindow(plugin, container.ownerDocument, "html", source);
  container.replaceChildren(win.root);

  if (!source.trim()) {
    win.setEmpty("Empty HTML fence.");
    return;
  }

  const iframe = container.ownerDocument.createElement("iframe");
  iframe.className = "fence-render-html-frame";
  iframe.setAttribute("title", "HTML preview");
  iframe.setAttribute("sandbox", settings.allowHtmlScripts ? "allow-scripts" : "");
  iframe.setAttribute("referrerpolicy", "no-referrer");
  iframe.setAttribute("scrolling", "auto");
  iframe.style.height = `${settings.htmlHeight}px`;
  iframe.srcdoc = buildHtmlDocument(source, {
    allowScripts: settings.allowHtmlScripts,
    theme: readHtmlTheme(container.ownerDocument),
  });

  win.preview.classList.add("fence-render-preview--frame");
  win.preview.append(iframe);

  if (settings.allowHtmlScripts) {
    ctx.addChild(new HtmlFrameChild(win.preview, iframe, settings.htmlHeight));
  }
}

function createWindow(
  plugin: FenceRenderPlugin,
  doc: Document,
  language: RenderLanguage,
  source: string,
): FenceWindow {
  const copySourceText =
    language === "latex" &&
    plugin.settings.wrapEquationCopy &&
    isEquationSourceForCopy(source)
      ? wrapEquationEnvironment(source)
      : source;

  const win = new FenceWindow(source, {
    doc,
    language,
    showToolbar: plugin.settings.showToolbar,
    initialView: plugin.settings.defaultView,
    copySourceText,
    latexScale: plugin.settings.latexPreviewScale / 100,
    latexWidth: plugin.settings.latexPreviewWidth,
  });

  if (language === "latex" && plugin.settings.latexInvertDark) {
    win.root.classList.add("fence-render-invert-latex");
  }

  return win;
}

class HtmlFrameChild extends MarkdownRenderChild {
  private readonly iframe: HTMLIFrameElement;
  private readonly view: Window;
  private readonly onMessage: (event: MessageEvent) => void;
  private lastHeight: number;

  constructor(containerEl: HTMLElement, iframe: HTMLIFrameElement, initialHeight: number) {
    super(containerEl);
    this.iframe = iframe;
    this.view = iframe.ownerDocument.defaultView ?? window;
    this.lastHeight = initialHeight;
    this.onMessage = (event) => this.handleMessage(event);
    this.view.addEventListener("message", this.onMessage);
  }

  onunload(): void {
    this.view.removeEventListener("message", this.onMessage);
  }

  private handleMessage(event: MessageEvent): void {
    if (!this.iframe.isConnected || event.source !== this.iframe.contentWindow) return;

    const data = event.data as
      | { type?: unknown; height?: unknown; url?: unknown }
      | null
      | undefined;
    if (!data || typeof data !== "object") return;

    if (data.type === "fence-render:height") {
      const height = Number(data.height);
      if (!Number.isFinite(height) || height <= 0) return;
      const clamped = Math.min(6000, Math.max(80, Math.ceil(height)));
      if (Math.abs(clamped - this.lastHeight) < 1) return;
      this.lastHeight = clamped;
      this.iframe.style.height = `${clamped}px`;
      return;
    }

    if (data.type === "fence-render:open-url" && typeof data.url === "string") {
      let url: URL;
      try {
        url = new URL(data.url);
      } catch {
        return;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:" && url.protocol !== "mailto:") {
        return;
      }
      this.view.open(url.href, "_blank", "noopener,noreferrer");
    }
  }
}

function readHtmlTheme(doc: Document): HtmlTheme {
  const view = doc.defaultView ?? window;
  const style = view.getComputedStyle(doc.body);
  const read = (name: string, fallback: string): string => {
    const value = style.getPropertyValue(name).trim();
    return value || fallback;
  };

  return {
    background: read("--background-primary", "#ffffff"),
    text: read("--text-normal", "#222222"),
    muted: read("--text-muted", "#666666"),
    link: read("--link-color", "#2563eb"),
    font: read("--font-text", "system-ui, sans-serif"),
    mono: read("--font-monospace", "ui-monospace, monospace"),
    fontSize: read("--font-text-size", style.fontSize || "16px"),
    border: read("--background-modifier-border", "rgba(127,127,127,.3)"),
    isDark:
      doc.body.classList.contains("theme-dark") ||
      doc.documentElement.classList.contains("theme-dark"),
  };
}
