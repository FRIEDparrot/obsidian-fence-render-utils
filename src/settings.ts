import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_LATEX_PACKAGES, latexPackageIssues } from "./latex";
import { DEFAULT_SETTINGS } from "./settings-data";
import type FenceRenderPlugin from "./main";

export { DEFAULT_SETTINGS, normalizeSettings } from "./settings-data";
export type {
  DefaultView,
  FenceRenderSettings,
  LatexPreviewWidth,
} from "./settings-data";

export class FenceRenderSettingTab extends PluginSettingTab {
  private readonly plugin: FenceRenderPlugin;

  constructor(app: App, plugin: FenceRenderPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("fence-render-settings");

    containerEl.createEl("h2", { text: "Fence Render Utils" });
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text:
        "Turn fenced code blocks into embedded previews. Markdown is rendered with Obsidian, " +
        "HTML runs in a sandboxed frame, and LaTeX is compiled with your local TeX installation. " +
        "Mermaid fences are never touched.",
    });

    new Setting(containerEl).setName("Formats").setHeading();

    new Setting(containerEl)
      .setName("Render Markdown fences")
      .setDesc("Languages: md, markdown.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.renderMarkdown).onChange(async (value) => {
          this.plugin.settings.renderMarkdown = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Render LaTeX fences")
      .setDesc("Languages: latex, tex. The fence is compiled as a standalone document.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.renderLatex).onChange(async (value) => {
          this.plugin.settings.renderLatex = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Render HTML fences")
      .setDesc("Languages: html, htm. Rendered in an isolated iframe.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.renderHtml).onChange(async (value) => {
          this.plugin.settings.renderHtml = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl).setName("Paste").setHeading();

    new Setting(containerEl)
      .setName("Convert ChatGPT math delimiters on paste")
      .setDesc(
        "When pasting into the editor, convert \\( … \\) to $ … $ and \\[ … \\] to " +
          "$$ … $$. Fenced code blocks and inline code are left untouched.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.convertChatGptPaste).onChange(async (value) => {
          this.plugin.settings.convertChatGptPaste = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Auto-format super/subscripts in pasted equations")
      .setDesc(
        "Add braces to ungrouped math scripts while pasting: r^k becomes r^{k}, " +
          "r_k becomes r_{k}, in both $…$ and $$…$$ equations.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoFormatMathScripts).onChange(async (value) => {
          this.plugin.settings.autoFormatMathScripts = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl).setName("Preview").setHeading();

    new Setting(containerEl)
      .setName("Default view")
      .setDesc("Each window also has a source toggle when the toolbar is visible.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("rendered", "Rendered")
          .addOption("source", "Source")
          .setValue(this.plugin.settings.defaultView)
          .onChange(async (value) => {
            this.plugin.settings.defaultView = value === "source" ? "source" : "rendered";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Show window toolbar")
      .setDesc("Shows the language label, fold, source toggle, copy, and fullscreen buttons.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showToolbar).onChange(async (value) => {
          this.plugin.settings.showToolbar = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Markdown preview font size")
      .setDesc("Font size in pixels for rendered Markdown fences.")
      .addSlider((slider) =>
        slider
          .setLimits(10, 30, 1)
          .setValue(this.plugin.settings.markdownPreviewFontSize)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.markdownPreviewFontSize = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("LaTeX preview size")
      .setDesc(
        "Scales the compiled LaTeX image. 100% is the natural size; increase it for easier review.",
      )
      .addSlider((slider) =>
        slider
          .setLimits(100, 400, 10)
          .setValue(this.plugin.settings.latexPreviewScale)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.latexPreviewScale = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("LaTeX preview width")
      .setDesc(
        "Fit content keeps the natural line length at the configured size. Full width stretches " +
          "the compiled image to the note/window width.",
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption("fit", "Fit content")
          .addOption("full", "Full width")
          .setValue(this.plugin.settings.latexPreviewWidth)
          .onChange(async (value) => {
            this.plugin.settings.latexPreviewWidth = value === "full" ? "full" : "fit";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Wrap copied equations in an equation environment")
      .setDesc(
        "When copying LaTeX source for an equation, add \\begin{equation} … \\end{equation}. " +
          "Already-wrapped environments and complete documents are left unchanged. On by default.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.wrapEquationCopy).onChange(async (value) => {
          this.plugin.settings.wrapEquationCopy = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Invert LaTeX colors in dark mode")
      .setDesc(
        "Shows compiled LaTeX as light-on-dark in Obsidian's dark theme by inverting the SVG. " +
          "Turn this off to keep a white paper preview in both themes.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.latexInvertDark).onChange(async (value) => {
          this.plugin.settings.latexInvertDark = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl).setName("HTML").setHeading();

    new Setting(containerEl)
      .setName("Allow scripts in HTML previews")
      .setDesc(
        "Scripts run in an opaque sandbox without access to Obsidian or the vault. " +
          "Turn this off for static markup only.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.allowHtmlScripts).onChange(async (value) => {
          this.plugin.settings.allowHtmlScripts = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("HTML preview height")
      .setDesc("Initial height in pixels. Rendered pages grow automatically when scripts are allowed.")
      .addSlider((slider) =>
        slider
          .setLimits(160, 900, 20)
          .setValue(this.plugin.settings.htmlHeight)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.htmlHeight = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl).setName("LaTeX toolchain").setHeading();

    containerEl.createEl("p", {
      cls: "setting-item-description",
      text:
        "Requires a desktop TeX installation with latex and dvisvgm available. " +
        "The fence body is wrapped in a standalone document; add packages here instead of " +
        "writing \\usepackage in every fence.",
    });

    new Setting(containerEl)
      .setName("LaTeX executable")
      .setDesc("Executable name or full path. Leave as latex when it is on PATH.")
      .addText((text) =>
        text
          .setPlaceholder("latex")
          .setValue(this.plugin.settings.latexPath)
          .onChange((value) => {
            this.plugin.settings.latexPath = value.trim() || "latex";
            this.plugin.scheduleSettingsSave();
          }),
      );

    new Setting(containerEl)
      .setName("dvisvgm executable")
      .setDesc(
        "Converts the generated PDF/DVI to SVG and is used as a fallback. " +
          "Leave as dvisvgm when it is on PATH.",
      )
      .addText((text) =>
        text
          .setPlaceholder("dvisvgm")
          .setValue(this.plugin.settings.dvisvgmPath)
          .onChange((value) => {
            this.plugin.settings.dvisvgmPath = value.trim() || "dvisvgm";
            this.plugin.scheduleSettingsSave();
          }),
      );

    new Setting(containerEl)
      .setName("pdftocairo executable")
      .setDesc(
        "Optional preferred PDF-to-SVG converter. It preserves equation tags such as " +
          "\\tag{1.1} better than dvisvgm. Falls back to dvisvgm when unavailable.",
      )
      .addText((text) =>
        text
          .setPlaceholder("pdftocairo")
          .setValue(this.plugin.settings.pdftocairoPath)
          .onChange((value) => {
            this.plugin.settings.pdftocairoPath = value.trim() || "pdftocairo";
            this.plugin.scheduleSettingsSave();
          }),
      );

    new Setting(containerEl)
      .setName("Wrap bare math")
      .setDesc(
        "If a fence looks like a bare equation such as E = mc^2, wrap it in \\[ … \\]. " +
          "Fences with $…$, equation environments, or prose are compiled as written.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.latexWrapMath).onChange(async (value) => {
          this.plugin.settings.latexWrapMath = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Auto-install missing MiKTeX packages")
      .setDesc(
        "Passes --enable-installer to MiKTeX. TeX Live users need to install packages with tlmgr.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.latexAutoInstall).onChange(async (value) => {
          this.plugin.settings.latexAutoInstall = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Packages")
      .setDesc(
        "One package per line, or comma separated. Full \\usepackage lines are also accepted. " +
          "These are added to every wrapped LaTeX fence.",
      )
      .addTextArea((text) => {
        text
          .setPlaceholder(DEFAULT_LATEX_PACKAGES)
          .setValue(this.plugin.settings.latexPackages)
          .onChange((value) => {
            this.plugin.settings.latexPackages = value;
            this.plugin.scheduleSettingsSave();
          });
        text.inputEl.rows = 9;
        text.inputEl.addClass("fence-render-settings-textarea");
      });

    new Setting(containerEl)
      .setName("Check package conflicts")
      .setDesc(
        "Checks known-bad combinations before compiling, such as loading both " +
          "algorithmic and algpseudocode.",
      )
      .addButton((button) =>
        button.setButtonText("Check").onClick(() => {
          const issues = latexPackageIssues(this.plugin.settings.latexPackages);
          new Notice(
            issues.length > 0
              ? issues.join("\n\n")
              : "No known LaTeX package conflicts detected.",
            10_000,
          );
        }),
      );

    new Setting(containerEl)
      .setName("Extra preamble")
      .setDesc(
        "Optional LaTeX inserted after the packages and before \\begin{document}. " +
          "Use this for document macros and formatting commands.",
      )
      .addTextArea((text) => {
        text
          .setPlaceholder("\\newcommand{\\R}{\\mathbb{R}}")
          .setValue(this.plugin.settings.latexPreamble)
          .onChange((value) => {
            this.plugin.settings.latexPreamble = value;
            this.plugin.scheduleSettingsSave();
          });
        text.inputEl.rows = 6;
        text.inputEl.addClass("fence-render-settings-textarea");
      });

    new Setting(containerEl)
      .setName("Compile timeout")
      .setDesc("Seconds before a LaTeX or dvisvgm process is stopped.")
      .addSlider((slider) =>
        slider
          .setLimits(10, 300, 10)
          .setValue(this.plugin.settings.latexTimeoutSec)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.latexTimeoutSec = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Test toolchain")
      .setDesc("Checks that both executables can be started.")
      .addButton((button) =>
        button.setButtonText("Test").onClick(async () => {
          button.setDisabled(true);
          button.setButtonText("Testing…");
          try {
            const status = await this.plugin.testLatexToolchain();
            new Notice(status.message, 10_000);
          } finally {
            button.setDisabled(false);
            button.setButtonText("Test");
          }
        }),
      );

    new Setting(containerEl).setName("Maintenance").setHeading();

    new Setting(containerEl)
      .setName("Refresh open previews")
      .setDesc("Re-renders fences in open Markdown views using the current settings.")
      .addButton((button) =>
        button.setButtonText("Refresh").onClick(() => {
          this.plugin.refreshOpenViews(true);
        }),
      );

    new Setting(containerEl)
      .setName("Compiled LaTeX cache")
      .setDesc("Cached SVGs make repeated renders fast. Clear the cache after changing your TeX setup.")
      .addButton((button) =>
        button.setButtonText("Clear cache").onClick(() => {
          this.plugin.clearLatexCache();
          new Notice("Fence Render Utils: LaTeX cache cleared.");
        }),
      );

    new Setting(containerEl)
      .setName("Reset settings")
      .setDesc("Restore all options to their defaults.")
      .addButton((button) =>
        button
          .setButtonText("Reset")
          .setWarning()
          .onClick(async () => {
            this.plugin.settings = { ...DEFAULT_SETTINGS };
            await this.plugin.saveSettings();
            this.display();
            new Notice("Fence Render Utils: settings reset.");
          }),
      );
  }
}
