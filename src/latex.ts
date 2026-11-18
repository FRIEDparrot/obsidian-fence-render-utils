export const DEFAULT_LATEX_PACKAGES = [
  "amsmath",
  "amssymb",
  "amsfonts",
  "mathtools",
  "graphicx",
  "xcolor",
  "bm",
  "booktabs",
  "array",
].join("\n");

export interface LatexDocumentOptions {
  packages: string;
  preamble: string;
  /** Wrap bare math fragments such as `E = mc^2` in `\[ … \]`. */
  wrapMath?: boolean;
  /** The caller already knows this is math, so skip the heuristic. */
  forceMath?: boolean;
}

export interface LatexDocumentInfo {
  document: string;
  wrapped: boolean;
  mathWrapped: boolean;
  packageList: string[];
}

const PACKAGE_NAME = /^[A-Za-z0-9@._+-]+$/;

const DOCUMENT_ENVIRONMENTS = new Set([
  "document",
  "figure",
  "figure*",
  "table",
  "table*",
  "tabular",
  "tabular*",
  "tabularx",
  "tabulary",
  "longtable",
  "verbatim",
  "Verbatim",
  "lstlisting",
  "minted",
  "itemize",
  "enumerate",
  "description",
  "quote",
  "quotation",
  "verse",
  "abstract",
  "theorem",
  "lemma",
  "proof",
  "definition",
  "corollary",
  "proposition",
  "remark",
  "example",
  "center",
  "flushleft",
  "flushright",
  "minipage",
  "thebibliography",
  "titlepage",
  "tikzpicture",
  "axis",
]);

const DISPLAY_MATH_ENVIRONMENTS = new Set([
  "math",
  "displaymath",
  "equation",
  "equation*",
  "align",
  "align*",
  "alignat",
  "alignat*",
  "flalign",
  "flalign*",
  "gather",
  "gather*",
  "multline",
  "multline*",
  "eqnarray",
  "eqnarray*",
  "subequations",
]);

const INNER_MATH_ENVIRONMENTS = new Set([
  "cases",
  "dcases",
  "rcases",
  "matrix",
  "pmatrix",
  "bmatrix",
  "Bmatrix",
  "vmatrix",
  "Vmatrix",
  "smallmatrix",
  "array",
  "subarray",
  "split",
  "aligned",
  "alignedat",
  "gathered",
  "CD",
]);

const TEXT_COMMANDS = new Set([
  "documentclass",
  "usepackage",
  "title",
  "author",
  "date",
  "maketitle",
  "thanks",
  "affiliation",
  "email",
  "section",
  "subsection",
  "subsubsection",
  "paragraph",
  "subparagraph",
  "chapter",
  "part",
  "tableofcontents",
  "listoffigures",
  "listoftables",
  "bibliography",
  "bibliographystyle",
  "cite",
  "citep",
  "citet",
  "parencite",
  "textcite",
  "ref",
  "eqref",
  "autoref",
  "cref",
  "Cref",
  "pageref",
  "includegraphics",
  "caption",
  "captionof",
  "centering",
  "hfill",
  "vfill",
  "vspace",
  "hspace",
  "newpage",
  "clearpage",
  "pagebreak",
  "verb",
  "verbatim",
  "lstinline",
  "LaTeX",
  "TeX",
  "LaTeXe",
  "today",
  "footnote",
  "footnotetext",
  "footnotemark",
  "marginpar",
  "bmhead",
  "equalcont",
  "backmatter",
  "frontmatter",
  "mainmatter",
  "appendix",
  "item",
  "abstract",
  "keywords",
  "newcommand",
  "renewcommand",
  "providecommand",
  "def",
  "DeclareMathOperator",
  "graphicspath",
  "include",
  "input",
  "printbibliography",
  "addbibresource",
  "textbf",
  "textit",
  "emph",
  "underline",
  "texttt",
  "textsc",
  "textrm",
  "textsf",
]);

const MATH_COMMANDS = new Set([
  "frac",
  "dfrac",
  "tfrac",
  "cfrac",
  "sqrt",
  "root",
  "sum",
  "prod",
  "coprod",
  "int",
  "iint",
  "iiint",
  "iiiint",
  "oint",
  "oiint",
  "lim",
  "limsup",
  "liminf",
  "sup",
  "inf",
  "max",
  "min",
  "argmax",
  "argmin",
  "det",
  "exp",
  "log",
  "ln",
  "sin",
  "cos",
  "tan",
  "cot",
  "sec",
  "csc",
  "arcsin",
  "arccos",
  "arctan",
  "sinh",
  "cosh",
  "tanh",
  "infty",
  "partial",
  "nabla",
  "forall",
  "exists",
  "nexists",
  "emptyset",
  "varnothing",
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
  "varepsilon",
  "zeta",
  "eta",
  "theta",
  "vartheta",
  "iota",
  "kappa",
  "lambda",
  "mu",
  "nu",
  "xi",
  "pi",
  "varpi",
  "rho",
  "varrho",
  "sigma",
  "varsigma",
  "tau",
  "upsilon",
  "phi",
  "varphi",
  "chi",
  "psi",
  "omega",
  "Gamma",
  "Delta",
  "Theta",
  "Lambda",
  "Xi",
  "Pi",
  "Sigma",
  "Upsilon",
  "Phi",
  "Psi",
  "Omega",
  "mathbf",
  "mathrm",
  "mathit",
  "mathsf",
  "mathtt",
  "mathcal",
  "mathbb",
  "mathfrak",
  "boldsymbol",
  "bm",
  "operatorname",
  "text",
  "textnormal",
  "left",
  "right",
  "middle",
  "big",
  "Big",
  "bigg",
  "Bigg",
  "bigl",
  "bigr",
  "Bigl",
  "Bigr",
  "cdot",
  "cdots",
  "ldots",
  "dots",
  "vdots",
  "ddots",
  "times",
  "div",
  "pm",
  "mp",
  "ast",
  "star",
  "circ",
  "bullet",
  "oplus",
  "ominus",
  "otimes",
  "oslash",
  "odot",
  "leq",
  "le",
  "geq",
  "ge",
  "neq",
  "ne",
  "approx",
  "sim",
  "simeq",
  "cong",
  "equiv",
  "propto",
  "ll",
  "gg",
  "subset",
  "supset",
  "subseteq",
  "supseteq",
  "in",
  "notin",
  "ni",
  "cup",
  "cap",
  "setminus",
  "land",
  "lor",
  "lnot",
  "neg",
  "implies",
  "iff",
  "to",
  "rightarrow",
  "leftarrow",
  "leftrightarrow",
  "Rightarrow",
  "Leftarrow",
  "Leftrightarrow",
  "longrightarrow",
  "mapsto",
  "uparrow",
  "downarrow",
  "langle",
  "rangle",
  "lfloor",
  "rfloor",
  "lceil",
  "rceil",
  "vert",
  "Vert",
  "mid",
  "parallel",
  "perp",
  "hat",
  "bar",
  "vec",
  "dot",
  "ddot",
  "tilde",
  "widehat",
  "widetilde",
  "overline",
  "overbrace",
  "underbrace",
  "overset",
  "underset",
  "stackrel",
  "binom",
  "dbinom",
  "tbinom",
  "choose",
  "displaystyle",
  "textstyle",
  "scriptstyle",
  "scriptscriptstyle",
  "phantom",
  "hphantom",
  "vphantom",
  "quad",
  "qquad",
  "enspace",
  "thinspace",
  "medspace",
  "thickspace",
  "negthinspace",
  "mspace",
  "label",
  "tag",
  "notag",
  "nonumber",
  "begin",
  "end",
  "color",
  "textcolor",
  "colorbox",
  "fbox",
  "boxed",
  "ell",
  "hbar",
  "imath",
  "jmath",
  "wp",
  "Re",
  "Im",
  "aleph",
  "angle",
  "measuredangle",
  "triangle",
  "square",
  "diamond",
  "prime",
  "backslash",
  "because",
  "therefore",
  "ldotp",
  "cdotp",
]);

function stripComments(source: string): string {
  return source
    .split(/\r?\n/)
    .map((line) => {
      for (let index = 0; index < line.length; index += 1) {
        if (line[index] === "%" && (index === 0 || line[index - 1] !== "\\")) {
          return line.slice(0, index);
        }
      }
      return line;
    })
    .join("\n");
}

function beginsWithDocumentMarkers(source: string): boolean {
  return /\\documentclass\b|\\begin\s*\{document\}/.test(source);
}

function environmentNames(source: string): string[] {
  const names: string[] = [];
  const regex = /\\begin\s*\{([^{}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    names.push(match[1].trim());
  }
  return names;
}

function commandNames(source: string): string[] {
  const names: string[] = [];
  const regex = /\\([a-zA-Z@]+)\*?/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    names.push(match[1]);
  }
  return names;
}

/**
 * Decide whether a fence body is bare math that needs delimiters. Fences that
 * already contain math delimiters/environments are left alone.
 */
export function looksLikeBareMath(source: string): boolean {
  const value = stripComments(source).trim();
  if (!value) return false;
  if (beginsWithDocumentMarkers(value)) return false;
  if (/\$|\\\[|\\\]|\\\(|\\\)/.test(value)) return false;
  if (/(^|\n)\s*@[a-zA-Z]+\s*[{(]/.test(value)) return false;

  const environments = environmentNames(value);
  if (environments.some((name) => DOCUMENT_ENVIRONMENTS.has(name))) return false;
  if (environments.some((name) => DISPLAY_MATH_ENVIRONMENTS.has(name))) return false;
  if (environments.some((name) => INNER_MATH_ENVIRONMENTS.has(name))) return true;

  const commands = commandNames(value);
  if (commands.some((name) => TEXT_COMMANDS.has(name))) return false;

  let score = 0;
  for (const command of commands) {
    if (MATH_COMMANDS.has(command)) score += 2;
  }
  if (/[_^]/.test(value)) score += 2;
  if (/[=<>≤≥≠≈]/.test(value)) score += 1;

  const words = value.match(/[A-Za-z]{2,}/g) ?? [];
  if (words.length >= 10 && score < 4) return false;

  return score >= 2;
}

/**
 * Whether a fenced LaTeX source is a single equation that should receive the
 * equation-environment wrapper when its source is copied. Existing display
 * environments and full documents are left alone.
 */
export function isEquationSourceForCopy(source: string): boolean {
  const value = source.trim();
  if (!value) return false;
  if (/\\documentclass\b/.test(value)) return false;
  if (
    environmentNames(value).some(
      (name) =>
        DOCUMENT_ENVIRONMENTS.has(name) || DISPLAY_MATH_ENVIRONMENTS.has(name),
    )
  ) {
    return false;
  }

  if (/^\s*(?:\$\$|\\\[|\\\(|\$)/.test(value)) return true;
  return looksLikeBareMath(value);
}

/**
 * Wrap copied equation source in an `equation` environment. Existing
 * `equation`/`align`-style environments and complete documents are left
 * untouched; outer `$…$` / `\[…\]` delimiters are replaced by the environment.
 */
export function wrapEquationEnvironment(source: string): string {
  const value = source.trim();
  if (!value) return source;
  if (/\\documentclass\b/.test(value)) return source;

  const environments = environmentNames(value);
  if (
    environments.some(
      (name) =>
        DOCUMENT_ENVIRONMENTS.has(name) || DISPLAY_MATH_ENVIRONMENTS.has(name),
    )
  ) {
    return source;
  }

  let body = value;
  const dollar = body.match(/^\$\$([\s\S]*)\$\$$/);
  const bracket = body.match(/^\\\[([\s\S]*)\\\]$/);
  const paren = body.match(/^\\\(([\s\S]*)\\\)$/);
  const singleDollar = body.match(/^\$([\s\S]*)\$$/);

  if (dollar) body = dollar[1].trim();
  else if (bracket) body = bracket[1].trim();
  else if (paren) body = paren[1].trim();
  else if (singleDollar) body = singleDollar[1].trim();

  if (!body) return source;
  return `\\begin{equation}\n${body}\n\\end{equation}`;
}

export function wrapBareMath(source: string): string {
  const value = source.trim();
  if (!value) return value;
  // Display math cannot contain paragraph breaks; join multiple bare equations
  // with an explicit line break instead.
  const joined = value
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\\[0.6em]\n");
  return `\\[\n${joined}\n\\]`;
}

/**
 * Parse the package list setting. Both comma/newline separated names and
 * explicit `\usepackage{...}` lines are accepted.
 */
export function parsePackageList(raw: string): string[] {
  const packages: string[] = [];
  const seen = new Set<string>();

  for (const line of raw.split(/\r?\n|,/)) {
    const value = line.trim();
    if (!value) continue;

    if (/^\\usepackage\b/.test(value)) {
      const explicit = value.replace(/\s+/g, " ").trim();
      if (!seen.has(explicit)) {
        seen.add(explicit);
        packages.push(explicit);
      }
      continue;
    }

    // Allow names such as `[T1]{fontenc}` to be written without the command.
    const cleaned = value.replace(/^\{/, "").replace(/\}$/, "").trim();
    if (!PACKAGE_NAME.test(cleaned)) continue;
    if (!seen.has(cleaned)) {
      seen.add(cleaned);
      packages.push(cleaned);
    }
  }

  return packages;
}

export function formatPackageLines(packages: string[]): string {
  return packages.map((entry) => (entry.startsWith("\\usepackage") ? entry : `\\usepackage{${entry}}`)).join("\n");
}

export function isFullLatexDocument(source: string): boolean {
  return /\\documentclass\b/.test(source);
}

export function extractDocumentBody(source: string): string | null {
  const match = source.match(/\\begin\s*\{document\}([\s\S]*?)\\end\s*\{document\}/);
  return match ? match[1].trim() : null;
}

/**
 * Build a standalone LaTeX document around a fence. When the fence already has
 * a `\documentclass`, it is compiled as-is so the author keeps full control.
 */
export function buildLatexDocument(
  source: string,
  options: LatexDocumentOptions,
): LatexDocumentInfo {
  const body = source.replace(/\r\n/g, "\n").trim();
  const packages = parsePackageList(options.packages);
  const packageLines = formatPackageLines(packages);
  const preamble = options.preamble.trim();

  if (isFullLatexDocument(body)) {
    return {
      document: `${body}\n`,
      wrapped: false,
      mathWrapped: false,
      packageList: packages,
    };
  }

  // If someone pasted a document body without a class, don't nest documents.
  const extracted = extractDocumentBody(body);
  const rawContent = extracted ?? body;
  const alreadyDelimited =
    /^\s*(?:\$|\\\[|\\\()/.test(rawContent) ||
    environmentNames(rawContent).some((name) =>
      DISPLAY_MATH_ENVIRONMENTS.has(name),
    );
  const mathWrapped = options.forceMath
    ? !alreadyDelimited
    : options.wrapMath !== false && looksLikeBareMath(rawContent);
  const content = mathWrapped ? wrapBareMath(rawContent) : rawContent;

  const sections = [
    "\\documentclass[border=4pt,varwidth=true,12pt]{standalone}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
  ];
  if (packageLines) sections.push(packageLines);
  if (preamble) sections.push(preamble);
  sections.push("\\begin{document}", content, "\\end{document}", "");

  return {
    document: sections.join("\n"),
    wrapped: true,
    mathWrapped,
    packageList: packages,
  };
}

/**
 * Pull out the useful part of a TeX transcript instead of dumping thousands of
 * package-loading lines into the note.
 */
export function summarizeLatexFailure(
  log: string,
  stdout = "",
  stderr = "",
): string {
  const combined = [log, stdout, stderr]
    .filter(Boolean)
    .join("\n")
    .replace(/\u001b\[[0-9;]*m/g, "");

  const lines = combined.split(/\r?\n/);
  const important: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trimEnd();
    if (!line.trim()) continue;

    if (
      /^!\s/.test(line) ||
      /^l\.\d+/.test(line) ||
      /LaTeX Error:/i.test(line) ||
      /Package .* Error:/i.test(line) ||
      /Undefined control sequence/i.test(line) ||
      /File .* not found/i.test(line) ||
      /Missing .* inserted/i.test(line)
    ) {
      important.push(line.trim());
      if (index + 1 < lines.length && /^l\.\d+/.test(lines[index + 1].trim())) {
        important.push(lines[index + 1].trim());
        index += 1;
      }
      if (important.length >= 16) break;
    }
  }

  const uniqueImportant = [...new Set(important)];
  let message = uniqueImportant.join("\n");
  if (!message) {
    const tail = lines.filter((line) => line.trim()).slice(-18);
    message = tail.join("\n");
  }
  if (!message) message = "Unknown LaTeX compilation error.";
  if (/not found|not installed/i.test(message)) {
    message +=
      "\n\nHint: enable “Auto-install missing MiKTeX packages” in Fence Render Utils settings, or install the missing package in MiKTeX Console.";
  }

  return message.slice(0, 8000);
}
