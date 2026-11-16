import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildLatexDocument, summarizeLatexFailure } from "./latex";

export interface LatexCompilerSettings {
  latexPath: string;
  dvisvgmPath: string;
  pdftocairoPath: string;
  latexPackages: string;
  latexPreamble: string;
  latexAutoInstall: boolean;
  latexTimeoutSec: number;
  latexWrapMath: boolean;
}

export interface LatexCompileResult {
  ok: boolean;
  svg?: string;
  error?: string;
  log?: string;
  durationMs: number;
  cached: boolean;
}

export interface LatexCompileOptions {
  /** Treat the source as math even if the heuristic would not. */
  forceMath?: boolean;
}

export interface ToolchainStatus {
  ok: boolean;
  message: string;
  latexVersion?: string;
  dvisvgmVersion?: string;
}

interface ProcessResult {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  spawnError?: string;
}

const MAX_CAPTURE = 256 * 1024;
const CACHE_LIMIT = 80;

function appendLimited(current: string, chunk: Buffer | string): string {
  if (current.length >= MAX_CAPTURE) return current;
  const next = current + chunk.toString();
  return next.length > MAX_CAPTURE ? next.slice(0, MAX_CAPTURE) : next;
}

function runProcess(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<ProcessResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (result: ProcessResult): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };

    let child;
    try {
      child = spawn(command, args, {
        cwd,
        env: process.env,
        windowsHide: true,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      finish({
        code: -1,
        stdout: "",
        stderr: "",
        timedOut: false,
        spawnError: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout = appendLimited(stdout, chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = appendLimited(stderr, chunk);
    });

    child.on("error", (error) => {
      finish({
        code: -1,
        stdout,
        stderr,
        timedOut,
        spawnError: error.message,
      });
    });

    child.on("close", (code) => {
      finish({
        code: code ?? -1,
        stdout,
        stderr,
        timedOut,
      });
    });

    timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGKILL");
      } catch {
        // The child may already have exited.
      }
    }, Math.max(5_000, timeoutMs));
  });
}

export class LatexCompiler {
  private readonly getSettings: () => LatexCompilerSettings;
  private readonly cache = new Map<string, string>();
  private readonly inFlight = new Map<string, Promise<LatexCompileResult>>();
  private readonly miktexChecks = new Map<string, Promise<boolean>>();
  private active = 0;
  private readonly queue: Array<() => void> = [];
  // One compiler at a time avoids MiKTeX package-manager lock races when
  // several fences appear in the same note for the first time.
  private readonly maxParallel = 1;

  constructor(getSettings: () => LatexCompilerSettings) {
    this.getSettings = getSettings;
  }

  clearCache(): void {
    this.cache.clear();
    this.miktexChecks.clear();
  }

  get cachedCount(): number {
    return this.cache.size;
  }

  async compile(
    source: string,
    options: LatexCompileOptions = {},
  ): Promise<LatexCompileResult> {
    const settings = { ...this.getSettings() };
    const built = buildLatexDocument(source, {
      packages: settings.latexPackages,
      preamble: settings.latexPreamble,
      wrapMath: settings.latexWrapMath,
      forceMath: options.forceMath,
    });
    const key = createHash("sha256")
      .update(
        JSON.stringify({
          version: 2,
          document: built.document,
          latexPath: settings.latexPath,
          dvisvgmPath: settings.dvisvgmPath,
          autoInstall: settings.latexAutoInstall,
        }),
      )
      .digest("hex");

    const cached = this.cache.get(key);
    if (cached) {
      // Refresh LRU order.
      this.cache.delete(key);
      this.cache.set(key, cached);
      return { ok: true, svg: cached, durationMs: 0, cached: true };
    }

    const running = this.inFlight.get(key);
    if (running) return running;

    const promise = this.withSlot(() => this.compileUncached(built.document, settings, key)).finally(
      () => {
        this.inFlight.delete(key);
      },
    );
    this.inFlight.set(key, promise);
    return promise;
  }

  async testToolchain(): Promise<ToolchainStatus> {
    const settings = this.getSettings();
    const cwd = tmpdir();
    const timeout = 20_000;

    const latex = await runProcess(settings.latexPath, ["--version"], cwd, timeout);
    if (latex.spawnError || latex.code !== 0) {
      return {
        ok: false,
        message: `Could not run “${settings.latexPath}”. Set the LaTeX executable path in settings. ${
          latex.spawnError ?? ""
        }`.trim(),
      };
    }

    const dvisvgm = await runProcess(settings.dvisvgmPath, ["--version"], cwd, timeout);
    if (dvisvgm.spawnError || dvisvgm.code !== 0) {
      return {
        ok: false,
        message: `LaTeX was found, but dvisvgm could not run. Check the dvisvgm path in settings. ${
          dvisvgm.spawnError ?? ""
        }`.trim(),
        latexVersion: firstLine(latex.stdout || latex.stderr),
      };
    }

    const cairo = await runProcess(
      settings.pdftocairoPath,
      ["--version"],
      cwd,
      timeout,
    );
    const hasCairo = !cairo.spawnError && cairo.code === 0;

    return {
      ok: true,
      message: hasCairo
        ? "LaTeX, dvisvgm, and pdftocairo are available."
        : "LaTeX and dvisvgm are available. pdftocairo was not found; equation tags may be clipped. Set its path if your TeX distribution includes it.",
      latexVersion: firstLine(latex.stdout || latex.stderr),
      dvisvgmVersion: firstLine(dvisvgm.stdout || dvisvgm.stderr),
    };
  }

  private async compileUncached(
    document: string,
    settings: LatexCompilerSettings,
    key: string,
  ): Promise<LatexCompileResult> {
    const started = Date.now();
    let tempDir: string | undefined;

    try {
      tempDir = await mkdtemp(join(tmpdir(), "fence-render-"));
      const texPath = join(tempDir, "document.tex");
      const pdfPath = join(tempDir, "document.pdf");
      const dviPath = join(tempDir, "document.dvi");
      const svgPath = join(tempDir, "document.svg");
      const logPath = join(tempDir, "document.log");
      await writeFile(texPath, document, "utf8");

      const timeoutMs = Math.max(10, settings.latexTimeoutSec) * 1000;
      const latexArgs = [
        "-interaction=nonstopmode",
        "-halt-on-error",
        "-file-line-error",
        "-no-shell-escape",
        // PDF output keeps tags such as \tag{1.1} inside the rendered page.
        // If the engine doesn't support this switch, the DVI path below is
        // used as a fallback.
        "-output-format=pdf",
      ];
      if (settings.latexAutoInstall && (await this.isMiKTeX(settings.latexPath))) {
        latexArgs.push("--enable-installer");
      }
      latexArgs.push("document.tex");

      const latex = await runProcess(settings.latexPath, latexArgs, tempDir, timeoutMs);
      const log = await readTextIfExists(logPath);

      if (latex.timedOut) {
        return {
          ok: false,
          error: `LaTeX compilation timed out after ${settings.latexTimeoutSec} seconds.`,
          log,
          durationMs: Date.now() - started,
          cached: false,
        };
      }

      if (latex.spawnError) {
        return {
          ok: false,
          error: `Could not start LaTeX at “${settings.latexPath}”. Check the executable path in settings.\n\n${latex.spawnError}`,
          log,
          durationMs: Date.now() - started,
          cached: false,
        };
      }

      if (latex.code !== 0) {
        return {
          ok: false,
          error: summarizeLatexFailure(log, latex.stdout, latex.stderr),
          log,
          durationMs: Date.now() - started,
          cached: false,
        };
      }

      const hasPdf = await fileExists(pdfPath);
      const hasDvi = await fileExists(dviPath);
      if (!hasPdf && !hasDvi) {
        return {
          ok: false,
          error: "LaTeX finished without producing a PDF or DVI file.",
          log,
          durationMs: Date.now() - started,
          cached: false,
        };
      }

      let svgReady = false;

      // pdftocairo keeps display tags such as \tag{1.1} in the SVG; dvisvgm's
      // PDF backend currently drops them. Prefer pdftocairo when available and
      // fall back to dvisvgm on systems that don't ship it.
      if (hasPdf) {
        const cairo = await runProcess(
          settings.pdftocairoPath,
          ["-f", "1", "-l", "1", "-svg", "document.pdf", "document.svg"],
          tempDir,
          timeoutMs,
        );
        if (
          !cairo.spawnError &&
          !cairo.timedOut &&
          cairo.code === 0 &&
          (await fileExists(svgPath))
        ) {
          svgReady = true;
        } else if (cairo.spawnError) {
          console.debug("Fence Render Utils: pdftocairo unavailable, using dvisvgm");
        }
      }

      if (!svgReady) {
        const dvisvgmArgs = [
          "--no-fonts",
          "--exact-bbox",
          "--page=1",
          "--verbosity=0",
          "-o",
          "document.svg",
        ];
        if (hasPdf) dvisvgmArgs.unshift("--pdf");
        dvisvgmArgs.push(hasPdf ? "document.pdf" : "document.dvi");

        const dvisvgm = await runProcess(
          settings.dvisvgmPath,
          dvisvgmArgs,
          tempDir,
          timeoutMs,
        );

        if (dvisvgm.timedOut) {
          return {
            ok: false,
            error: `dvisvgm timed out after ${settings.latexTimeoutSec} seconds.`,
            log,
            durationMs: Date.now() - started,
            cached: false,
          };
        }

        if (dvisvgm.spawnError) {
          return {
            ok: false,
            error: `Could not start dvisvgm at “${settings.dvisvgmPath}”. Check the executable path in settings.\n\n${dvisvgm.spawnError}`,
            log,
            durationMs: Date.now() - started,
            cached: false,
          };
        }

        if (dvisvgm.code !== 0) {
          return {
            ok: false,
            error: summarizeLatexFailure("", dvisvgm.stdout, dvisvgm.stderr),
            log,
            durationMs: Date.now() - started,
            cached: false,
          };
        }
      }

      const svg = await readFile(svgPath, "utf8");
      if (!svg.includes("<svg")) {
        return {
          ok: false,
          error: "The LaTeX converter did not produce an SVG file.",
          log,
          durationMs: Date.now() - started,
          cached: false,
        };
      }

      this.cache.set(key, svg);
      if (this.cache.size > CACHE_LIMIT) {
        const oldest = this.cache.keys().next().value;
        if (oldest) this.cache.delete(oldest);
      }

      return {
        ok: true,
        svg,
        durationMs: Date.now() - started,
        cached: false,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - started,
        cached: false,
      };
    } finally {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  }

  private async isMiKTeX(latexPath: string): Promise<boolean> {
    if (/miktex/i.test(latexPath)) return true;

    const existing = this.miktexChecks.get(latexPath);
    if (existing) return existing;

    const check = (async (): Promise<boolean> => {
      try {
        const result = await runProcess(latexPath, ["--version"], tmpdir(), 15_000);
        return /miktex/i.test(result.stdout + result.stderr);
      } catch {
        return false;
      }
    })();

    this.miktexChecks.set(latexPath, check);
    return check;
  }

  private async withSlot<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxParallel) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }

    this.active += 1;
    try {
      return await work();
    } finally {
      this.active -= 1;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

async function readTextIfExists(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

function firstLine(value: string): string {
  return value.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? "";
}
