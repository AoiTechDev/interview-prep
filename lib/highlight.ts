/**
 * A small JS/TS highlighter for answers written in markdown-ish prose with
 * ``` fenced code blocks. Token classes follow VS Code's Dark+ groupings:
 *
 *   control   if / return / await / import        pink
 *   keyword   const / function / class / this     blue
 *   type      string / Array / PascalCase names   teal
 *   fn        an identifier followed by "("       yellow
 *   var       every other identifier              light blue
 *   string / number / comment                     salmon / green / green
 *
 * The one hard rule: the returned HTML must contain every character of the
 * input, exactly once, in order. The output is painted as a layer directly
 * behind a transparent textarea, so if a single character were dropped or
 * added the two would wrap differently and the overlay would drift out of
 * alignment. `stripTags(highlightAnswer(x)) === escapeHtml(x)` is the invariant,
 * and it is covered by scripts/highlight.test.ts.
 */

/** Flow control — Dark+ paints these pink. */
const CONTROL = new Set([
  "if", "else", "for", "while", "do", "switch", "case", "default", "break",
  "continue", "return", "try", "catch", "finally", "throw", "yield", "async",
  "await", "import", "export", "from",
]);

/** Declarations, operators and language constants — blue. */
const KEYWORD = new Set([
  "const", "let", "var", "function", "class", "interface", "type", "enum",
  "extends", "implements", "static", "readonly", "public", "private",
  "protected", "declare", "abstract", "new", "typeof", "instanceof", "in", "of",
  "delete", "void", "as", "satisfies", "keyof", "infer", "super", "this",
  "true", "false", "null", "undefined", "NaN", "Infinity",
]);

/** Primitives and well-known constructors — teal. */
const TYPE = new Set([
  "string", "number", "boolean", "any", "unknown", "never", "object", "symbol",
  "bigint", "Array", "Object", "Promise", "Map", "Set", "WeakMap", "WeakSet",
  "Date", "RegExp", "Error", "String", "Number", "Boolean", "Function", "Math",
  "JSON", "Record", "Partial", "Pick", "Omit", "Readonly", "Required",
]);

export function escapeHtml(value: string): string {
  return value.replace(/[&<>]/g, (char) =>
    char === "&" ? "&amp;" : char === "<" ? "&lt;" : "&gt;",
  );
}

/**
 * PascalCase reads as a type; SCREAMING_CASE does not. Matches how Dark+ shows
 * `SeedFile` in teal but a `TOKEN` constant in variable blue.
 */
function looksLikeType(name: string): boolean {
  return /^[A-Z]/.test(name) && /[a-z]/.test(name);
}

// Order matters: comments, then strings, then numbers, then identifiers. An
// unterminated string still matches so a half-typed line stays sane.
const TOKEN =
  /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|(`(?:\\[\s\S]|[^`\\])*`?|"(?:\\[\s\S]|[^"\\\n])*"?|'(?:\\[\s\S]|[^'\\\n])*'?)|(\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b)|([A-Za-z_$][A-Za-z0-9_$]*)/g;

function classifyIdentifier(name: string, before: string, after: string): string {
  // A property access borrows the name of a keyword often enough (obj.type,
  // res.status) that keywords must not win after a dot.
  const isProperty = /\.\s*$/.test(before);
  const isCall = /^\s*\(/.test(after);

  if (isProperty) return isCall ? "hl-fn" : "hl-var";

  // Keywords and types are checked before the call test, because `if (`,
  // `for (` and `new Error(` are all followed by a paren without being
  // function names — that mistake turned `if` and `for` yellow.
  if (CONTROL.has(name)) return "hl-control";
  if (KEYWORD.has(name)) return "hl-keyword";
  if (TYPE.has(name) || looksLikeType(name)) return "hl-type";

  return isCall ? "hl-fn" : "hl-var";
}

function highlightCode(code: string): string {
  let out = "";
  let last = 0;
  TOKEN.lastIndex = 0;

  for (let match = TOKEN.exec(code); match !== null; match = TOKEN.exec(code)) {
    const [full, comment, str, num, ident] = match;
    out += escapeHtml(code.slice(last, match.index));

    if (comment) {
      out += `<span class="hl-comment">${escapeHtml(full)}</span>`;
    } else if (str) {
      out += `<span class="hl-string">${escapeHtml(full)}</span>`;
    } else if (num) {
      out += `<span class="hl-number">${escapeHtml(full)}</span>`;
    } else if (ident) {
      const cls = classifyIdentifier(
        ident,
        code.slice(0, match.index),
        code.slice(match.index + full.length),
      );
      out += `<span class="${cls}">${escapeHtml(full)}</span>`;
    }

    last = match.index + full.length;
  }

  return out + escapeHtml(code.slice(last));
}

/** True for a line that opens or closes a fenced block. */
export function isFenceLine(line: string): boolean {
  return /^\s*```/.test(line);
}

/**
 * Highlights only what is inside ``` fences; prose outside them is left plain,
 * because most answers here are half explanation and half code. Code lines are
 * wrapped so punctuation picks up the editor foreground rather than the page's.
 */
export function highlightAnswer(text: string): string {
  let inCode = false;

  return text
    .split("\n")
    .map((line) => {
      if (isFenceLine(line)) {
        inCode = !inCode;
        return `<span class="hl-fence">${escapeHtml(line)}</span>`;
      }
      if (!inCode) return escapeHtml(line);
      return `<span class="hl-code">${highlightCode(line)}</span>`;
    })
    .join("\n");
}

/** Whether the caret sits inside an open fence, used to decide auto-closing. */
export function fenceIsOpen(textBeforeCaret: string): boolean {
  let open = false;
  for (const line of textBeforeCaret.split("\n")) {
    if (isFenceLine(line)) open = !open;
  }
  return open;
}
