import {
  type Editor,
  MarkdownPostProcessorContext,
  MarkdownView,
  Menu,
  Notice,
  Plugin,
} from "obsidian";
import { LatexCompiler, type ToolchainStatus } from "./compiler";
import { wrapEquationEnvironment } from "./latex";
import type { RenderLanguage } from "./language";
import { extractMathSource } from "./math-source";
import { convertChatGptMath } from "./paste";
import {
  copyEquationImage,
  copyText,
  renderFence,
  renderNativeFallback,
} from "./render";
import {
  DEFAULT_SETTINGS,
  FenceRenderSettingTab,
  normalizeSettings,
  type FenceRenderSettings,
} from "./settings";
import { tableToLatex, tableToMarkdown, type TableData } from "./table";
import { extractTableData, resolveTable } from "./table-dom";

export default class FenceRenderPlugin extends Plugin {
  settings: FenceRenderSettings = { ...DEFAULT_SETTINGS };
  readonly compiler = new LatexCompiler(() => this.settings);

  private saveTimer: number | null = null;
  private refreshTimer: number | null = null;
  private compilerSignature = "";
  private pendingMathContext: {
    source: string;
    doc: Document;
    expiresAt: number;
  } | null = null;
  private pendingTableContext: {
    data: TableData;
    doc: Document;
    expiresAt: number;
  } | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.compilerSignature = this.currentCompilerSignature();

    this.addSettingTab(new FenceRenderSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on("editor-paste", (event, editor) => {
        if (!this.settings.convertChatGptPaste || event.defaultPrevented) return;
        if (isCursorInFencedCodeBlock(editor)) return;

        const text = event.clipboardData?.getData("text/plain");
        if (!text) return;

        const converted = convertChatGptMath(text);
        if (converted === text) return;

        event.preventDefault();
        editor.replaceSelection(converted);
      }),
    );

    // Normal `$$…$$` / `$…$` equations and Markdown tables are rendered by
    // Obsidian itself, not by a fence processor. Add the copy menus there too.
    this.registerContextMenu(window);
    this.registerEvent(
      this.app.workspace.on("window-open", (_workspaceWindow, win) => {
        this.registerContextMenu(win);
      }),
    );
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu) => {
        const table = this.pendingTableContext;
        this.pendingTableContext = null;
        if (table && table.expiresAt >= Date.now()) {
          menu.addSeparator();
          this.addTableMenuItems(menu, table.data, table.doc);
          return;
        }

        const math = this.pendingMathContext;
        this.pendingMathContext = null;
        if (!math || math.expiresAt < Date.now()) return;

        menu.addSeparator();
        this.addMathMenuItems(menu, math.source, math.doc);
      }),
    );

    // Code-block processors work in both Reading view and Live Preview. This
    // is what lets a fence render once the cursor leaves it.
    for (const [alias, language] of FENCE_ALIASES) {
      this.registerMarkdownCodeBlockProcessor(alias, (source, el, ctx) => {
        void this.handleFence(language, source, el, ctx);
      });
    }

    this.addCommand({
      id: "refresh-rendered-fences",
      name: "Refresh rendered fences",
      callback: () => this.refreshOpenViews(true),
    });

    this.addCommand({
      id: "clear-latex-render-cache",
      name: "Clear compiled LaTeX cache",
      callback: () => {
        this.clearLatexCache();
        new Notice("Fence Render Utils: LaTeX cache cleared.");
      },
    });
  }

  onunload(): void {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = normalizeSettings(await this.loadData());
  }

  async saveSettings(): Promise<void> {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    const nextSignature = this.currentCompilerSignature();
    if (nextSignature !== this.compilerSignature) {
      this.compilerSignature = nextSignature;
      this.compiler.clearCache();
    }

    await this.saveData(this.settings);
    this.refreshOpenViews();
  }

  scheduleSettingsSave(delay = 450): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.saveSettings();
    }, delay);
  }

  refreshOpenViews(showNotice = false): void {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (showNotice) {
      this.rerenderOpenViews();
      new Notice("Fence Render Utils: open previews refreshed.");
      return;
    }

    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      this.rerenderOpenViews();
    }, 180);
  }

  async testLatexToolchain(): Promise<ToolchainStatus> {
    return this.compiler.testToolchain();
  }

  clearLatexCache(): void {
    this.compiler.clearCache();
  }

  private rerenderOpenViews(): void {
    // This is the event Obsidian uses when post processors change. It rebuilds
    // both Reading view sections and Live Preview code-block widgets, unlike
    // Editor.refresh(), which only remeasures the existing DOM.
    this.app.workspace.trigger("post-processor-change");

    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) continue;

      try {
        if (view.getMode() === "preview") {
          view.previewMode.rerender(true);
        }
      } catch (error) {
        console.debug("Fence Render Utils: could not refresh a Markdown view", error);
      }
    }
  }

  private registerContextMenu(win: Window): void {
    this.registerDomEvent(
      win.document,
      "contextmenu",
      (event) => this.handleContextMenu(event),
      true,
    );
  }

  private handleContextMenu(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target || typeof target.closest !== "function") {
      this.pendingMathContext = null;
      this.pendingTableContext = null;
      return;
    }

    // A table cell may contain rendered math. Prefer the table menu there so
    // "Copy table as LaTeX" remains available when right-clicking a formula
    // inside a Markdown table.
    const tableEl = resolveTable(target, target.ownerDocument);
    if (tableEl) {
      this.handleTableContextMenu(event, tableEl);
      return;
    }

    const mathEl = target.closest<HTMLElement>(".math");
    if (mathEl) {
      this.handleMathContextMenu(event, mathEl);
      return;
    }

    this.pendingMathContext = null;
    this.pendingTableContext = null;
  }

  private handleMathContextMenu(event: MouseEvent, mathEl: HTMLElement): void {
    const source = extractMathSource(mathEl);
    if (!source) return;
    this.pendingTableContext = null;

    // In Live Preview the math sits inside CodeMirror. Reuse Obsidian's editor
    // context menu instead of fighting it with a second menu.
    if (mathEl.closest(".markdown-source-view")) {
      this.pendingMathContext = {
        source,
        doc: mathEl.ownerDocument,
        expiresAt: Date.now() + 1500,
      };
      return;
    }

    const doc = mathEl.ownerDocument;
    const menu = new Menu();
    this.addMathMenuItems(menu, source, doc);
    this.showDeferredMenu(event, doc, menu);
  }

  private handleTableContextMenu(
    event: MouseEvent,
    tableEl: HTMLTableElement,
  ): void {
    const data = extractTableData(tableEl);
    if (!data) return;
    this.pendingMathContext = null;

    if (tableEl.closest(".markdown-source-view")) {
      this.pendingTableContext = {
        data,
        doc: tableEl.ownerDocument,
        expiresAt: Date.now() + 1500,
      };
      return;
    }

    const doc = tableEl.ownerDocument;
    const menu = new Menu();
    this.addTableMenuItems(menu, data, doc);
    this.showDeferredMenu(event, doc, menu);
  }

  private showDeferredMenu(event: MouseEvent, doc: Document, menu: Menu): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // Showing a Menu while the reading-view contextmenu is still propagating
    // can be undone by Obsidian's menu housekeeping. Defer one task so our menu
    // is the final one on screen.
    const view = doc.defaultView ?? window;
    view.setTimeout(() => {
      hideOpenMenus(doc);
      menu.showAtMouseEvent(event);
    }, 0);
  }

  private addMathMenuItems(menu: Menu, source: string, doc: Document): void {
    menu.addItem((item) =>
      item
        .setTitle("Copy equation image")
        .setIcon("image")
        .onClick(() => {
          void this.copyMathEquationImage(source, doc);
        }),
    );
    menu.addItem((item) =>
      item
        .setTitle("Copy LaTeX source")
        .setIcon("code")
        .onClick(() => {
          void this.copyMathSource(source, doc);
        }),
    );
  }

  private async copyMathSource(source: string, doc: Document): Promise<void> {
    const text = this.settings.wrapEquationCopy
      ? wrapEquationEnvironment(source)
      : source;

    try {
      await copyText(doc, text);
      new Notice(
        this.settings.wrapEquationCopy
          ? "Equation source copied in an equation environment."
          : "Equation source copied to clipboard.",
      );
    } catch (error) {
      console.error("Fence Render Utils: could not copy equation source", error);
      new Notice("Could not copy the equation source.");
    }
  }

  private addTableMenuItems(menu: Menu, data: TableData, doc: Document): void {
    menu.addItem((item) =>
      item
        .setTitle("Copy table as Markdown")
        .setIcon("file-text")
        .onClick(() => {
          void this.copyTable(tableToMarkdown(data), doc, "Markdown");
        }),
    );
    menu.addItem((item) =>
      item
        .setTitle("Copy table as LaTeX")
        .setIcon("code")
        .onClick(() => {
          void this.copyTable(tableToLatex(data), doc, "LaTeX");
        }),
    );
  }

  private async copyTable(
    source: string,
    doc: Document,
    format: "Markdown" | "LaTeX",
  ): Promise<void> {
    try {
      await copyText(doc, source);
      new Notice(`Table copied as ${format}.`);
    } catch (error) {
      console.error(`Fence Render Utils: could not copy ${format} table`, error);
      new Notice(`Could not copy the table as ${format}.`);
    }
  }

  private async copyMathEquationImage(
    source: string,
    doc: Document,
  ): Promise<void> {
    const result = await this.compiler.compile(source, { forceMath: true });
    if (!result.ok || !result.svg) {
      new Notice(
        `Could not render equation: ${firstLine(result.error ?? "unknown error")}`,
        8000,
      );
      return;
    }

    await copyEquationImage(result.svg, doc);
  }

  private async handleFence(
    language: RenderLanguage,
    rawSource: string,
    container: HTMLElement,
    ctx: MarkdownPostProcessorContext,
  ): Promise<void> {
    const source = normalizeFenceSource(rawSource);

    // A Markdown preview can itself contain fences. Rendering those inside the
    // preview would recurse, so keep them as ordinary code blocks.
    if (container.closest(".fence-render-window") || !this.isEnabled(language)) {
      renderNativeFallback(container, source, language);
      return;
    }

    try {
      await renderFence({
        plugin: this,
        language,
        source,
        container,
        ctx,
      });
    } catch (error) {
      console.error("Fence Render Utils: could not render fence", error);
      renderNativeFallback(container, source, language);
    }
  }

  private isEnabled(language: RenderLanguage): boolean {
    switch (language) {
      case "markdown":
        return this.settings.renderMarkdown;
      case "latex":
        return this.settings.renderLatex;
      case "html":
        return this.settings.renderHtml;
    }
  }

  private currentCompilerSignature(): string {
    return JSON.stringify({
      latexPath: this.settings.latexPath,
      dvisvgmPath: this.settings.dvisvgmPath,
      pdftocairoPath: this.settings.pdftocairoPath,
      latexPackages: this.settings.latexPackages,
      latexPreamble: this.settings.latexPreamble,
      latexAutoInstall: this.settings.latexAutoInstall,
      latexWrapMath: this.settings.latexWrapMath,
    });
  }
}

const FENCE_ALIASES: ReadonlyArray<readonly [string, RenderLanguage]> = [
  ["md", "markdown"],
  ["markdown", "markdown"],
  ["mdown", "markdown"],
  ["mkd", "markdown"],
  ["mkdn", "markdown"],
  ["latex", "latex"],
  ["tex", "latex"],
  ["html", "html"],
  ["htm", "html"],
  ["xhtml", "html"],
];

function isCursorInFencedCodeBlock(editor: Editor): boolean {
  const cursor = editor.getCursor();
  let fences = 0;

  for (let line = 0; line <= cursor.line; line += 1) {
    if (/^\s*(?:`{3,}|~{3,})/.test(editor.getLine(line))) fences += 1;
  }

  return fences % 2 === 1;
}

function hideOpenMenus(doc: Document): void {
  for (const menuEl of Array.from(doc.querySelectorAll<HTMLElement>(".menu"))) {
    const hide = (menuEl as unknown as { hide?: () => void }).hide;
    if (typeof hide === "function") hide.call(menuEl);
  }
}

function firstLine(value: string): string {
  return value.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? value;
}

function normalizeFenceSource(source: string): string {
  return source.replace(/\r\n/g, "\n").replace(/\n$/, "");
}
