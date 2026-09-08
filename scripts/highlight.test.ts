import { escapeHtml, highlightAnswer, fenceIsOpen } from "../lib/highlight";

/** Strip our own spans back out; what remains must equal the escaped input. */
function stripTags(html: string): string {
  return html.replace(/<span class="hl-[a-z]+">/g, "").replace(/<\/span>/g, "");
}

const cases: string[] = [
  "",
  "plain prose with no code at all",
  "```\nconst a = 1;\n```",
  "```ts\ninterface User { name: string }\n```",
  "prose\n```js\n// a comment with ``` inside\nconst s = \"he said \\\"hi\\\"\";\n```\nmore prose",
  "unterminated fence\n```\nconst x = 'open string",
  "html-ish: <div class=\"x\"> & </div> 5 < 6",
  "```\nconst re = /a<b/g; // 3 > 2 & true\n```",
  "tabs\tand  spaces\n\n\nblank lines",
  "```\n`template ${literal}`\n0x1f 1_000 3.14e-2\n```",
  "trailing newline\n",
  "```\n/* block\ncomment */\n```",
];

let failures = 0;
for (const input of cases) {
  const out = stripTags(highlightAnswer(input));
  const want = escapeHtml(input);
  if (out !== want) {
    failures++;
    console.log("MISMATCH for:", JSON.stringify(input.slice(0, 45)));
    console.log("  got :", JSON.stringify(out.slice(0, 90)));
    console.log("  want:", JSON.stringify(want.slice(0, 90)));
  }
}

// Random fuzz over characters likely to break a tokenizer.
const alphabet = "abc const {}();\"'`\\n\t<>&/*#$_019.".split("");
for (let i = 0; i < 3000; i++) {
  const len = 1 + Math.floor(Math.random() * 60);
  let s = "";
  for (let j = 0; j < len; j++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  if (i % 3 === 0) s = "```\n" + s + "\n```";
  if (stripTags(highlightAnswer(s)) !== escapeHtml(s)) {
    failures++;
    console.log("FUZZ MISMATCH:", JSON.stringify(s));
    if (failures > 5) break;
  }
}

console.log(fenceIsOpen("a\n```\nb") === true ? "fenceIsOpen open  ok" : "fenceIsOpen open  FAIL");
console.log(fenceIsOpen("a\n```\nb\n```\nc") === false ? "fenceIsOpen closed ok" : "fenceIsOpen closed FAIL");
console.log(failures === 0 ? "ALL PASS — every character preserved" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
