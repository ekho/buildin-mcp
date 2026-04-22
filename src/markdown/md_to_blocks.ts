/**
 * Minimal Markdown → Buildin block converter.
 *
 * Supported block-level constructs:
 *   - ATX headings (# .. ###) → heading_1/2/3
 *   - Unordered list (-, *, +) → bulleted_list_item
 *   - Ordered list (1. 2.)    → numbered_list_item
 *   - Task list ([ ]/[x])     → to_do
 *   - Fenced code block (```) → code
 *   - Blockquote (>)          → quote
 *   - Horizontal rule (---)   → divider
 *   - Everything else         → paragraph
 *
 * Inline: **bold**, *italic* / _italic_, `code`, [text](url). Escapes honour backslash.
 *
 * The converter deliberately keeps a small surface — it's intended to seed a Buildin page,
 * not to be a fully-featured CommonMark implementation.
 */
import type { BuildinBlockInput, BuildinRichText } from "./types.js";

const HEADING_RE = /^(#{1,3})\s+(.+)$/;
const UL_RE = /^\s*[-*+]\s+(.*)$/;
const OL_RE = /^\s*\d+\.\s+(.*)$/;
const TODO_RE = /^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/;
const FENCE_RE = /^```(\w+)?\s*$/;
const BQ_RE = /^>\s?(.*)$/;
const HR_RE = /^(\s*)(-{3,}|\*{3,}|_{3,})\s*$/;

export function markdownToBlocks(md: string): BuildinBlockInput[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: BuildinBlockInput[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    // blank line → skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // fenced code block
    const fence = line.match(FENCE_RE);
    if (fence) {
      const lang = fence[1] ?? "plain_text";
      const buf: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").match(/^```\s*$/)) {
        buf.push(lines[i] ?? "");
        i++;
      }
      if (i < lines.length) i++; // consume closing fence
      out.push({
        type: "code",
        data: {
          rich_text: [plainText(buf.join("\n"))],
          language: lang,
        },
      });
      continue;
    }

    // horizontal rule
    if (HR_RE.test(line)) {
      out.push({ type: "divider", data: {} });
      i++;
      continue;
    }

    // heading
    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1]!.length; // 1..3
      const text = heading[2]!.trim();
      out.push({
        type: `heading_${level}` as "heading_1" | "heading_2" | "heading_3",
        data: { rich_text: parseInline(text) },
      });
      i++;
      continue;
    }

    // task list
    const todo = line.match(TODO_RE);
    if (todo) {
      const checked = todo[1]!.toLowerCase() === "x";
      const text = todo[2]!;
      out.push({
        type: "to_do",
        data: { rich_text: parseInline(text), checked },
      });
      i++;
      continue;
    }

    // unordered list
    const ul = line.match(UL_RE);
    if (ul) {
      out.push({
        type: "bulleted_list_item",
        data: { rich_text: parseInline(ul[1]!) },
      });
      i++;
      continue;
    }

    // ordered list
    const ol = line.match(OL_RE);
    if (ol) {
      out.push({
        type: "numbered_list_item",
        data: { rich_text: parseInline(ol[1]!) },
      });
      i++;
      continue;
    }

    // blockquote (group consecutive > lines)
    const bq = line.match(BQ_RE);
    if (bq) {
      const buf: string[] = [bq[1] ?? ""];
      i++;
      while (i < lines.length) {
        const m = (lines[i] ?? "").match(BQ_RE);
        if (!m) break;
        buf.push(m[1] ?? "");
        i++;
      }
      out.push({
        type: "quote",
        data: { rich_text: parseInline(buf.join("\n")) },
      });
      continue;
    }

    // paragraph: merge with following non-blank, non-structural lines
    const buf: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i] ?? "";
      if (
        next.trim() === "" ||
        HEADING_RE.test(next) ||
        UL_RE.test(next) ||
        OL_RE.test(next) ||
        FENCE_RE.test(next) ||
        BQ_RE.test(next) ||
        HR_RE.test(next)
      ) break;
      buf.push(next);
      i++;
    }
    out.push({
      type: "paragraph",
      data: { rich_text: parseInline(buf.join(" ")) },
    });
  }

  return out;
}

function plainText(content: string): BuildinRichText {
  return { type: "text", text: { content } };
}

/**
 * Inline tokenizer for **bold**, *italic* / _italic_, `code`, [text](url), and plain runs.
 * Keeps the implementation intentionally linear — chunks text into non-overlapping runs.
 */
export function parseInline(text: string): BuildinRichText[] {
  const out: BuildinRichText[] = [];
  let buf = "";
  let i = 0;

  const flushPlain = () => {
    if (buf.length > 0) {
      out.push({ type: "text", text: { content: buf } });
      buf = "";
    }
  };

  while (i < text.length) {
    const ch = text[i]!;

    // backslash escape → emit next char verbatim
    if (ch === "\\" && i + 1 < text.length) {
      buf += text[i + 1];
      i += 2;
      continue;
    }

    // inline code
    if (ch === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        flushPlain();
        out.push({
          type: "text",
          text: { content: text.slice(i + 1, end) },
          annotations: { code: true },
        });
        i = end + 1;
        continue;
      }
    }

    // bold **...**
    if (ch === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        flushPlain();
        out.push({
          type: "text",
          text: { content: text.slice(i + 2, end) },
          annotations: { bold: true },
        });
        i = end + 2;
        continue;
      }
    }

    // italic *...* or _..._
    if ((ch === "*" || ch === "_") && text[i + 1] !== ch) {
      const end = text.indexOf(ch, i + 1);
      if (end !== -1 && end > i + 1) {
        flushPlain();
        out.push({
          type: "text",
          text: { content: text.slice(i + 1, end) },
          annotations: { italic: true },
        });
        i = end + 1;
        continue;
      }
    }

    // link [text](url)
    if (ch === "[") {
      const close = text.indexOf("]", i + 1);
      if (close !== -1 && text[close + 1] === "(") {
        const urlEnd = text.indexOf(")", close + 2);
        if (urlEnd !== -1) {
          flushPlain();
          const label = text.slice(i + 1, close);
          const url = text.slice(close + 2, urlEnd);
          out.push({
            type: "text",
            text: { content: label, link: { url } },
            href: url,
          });
          i = urlEnd + 1;
          continue;
        }
      }
    }

    buf += ch;
    i++;
  }

  flushPlain();
  return out;
}
