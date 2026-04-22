import type { BuildinBlockObject, BuildinRichText } from "./types.js";

export interface BlocksToMarkdownOptions {
  indent?: number;
}

export function blocksToMarkdown(
  blocks: BuildinBlockObject[],
  options: BlocksToMarkdownOptions = {},
): string {
  const indent = options.indent ?? 0;
  const pad = "  ".repeat(indent);
  const lines: string[] = [];

  for (const block of blocks) {
    const rendered = renderBlock(block, indent, pad);
    if (rendered !== null) lines.push(rendered);
  }

  return lines.join("\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function renderBlock(block: BuildinBlockObject, indent: number, pad: string): string | null {
  const type = block.type;
  const nested = (block[type] as Record<string, unknown> | undefined) ?? {};
  const data = nested && Object.keys(nested).length > 0 ? nested : (block.data as Record<string, unknown> | undefined) ?? {};
  const rich = coerceRichText(data.rich_text);
  const text = richToMarkdown(rich);
  const childMd = renderChildren(block, indent + 1);

  switch (type) {
    case "heading_1":
      return `${pad}# ${text}${childMd}`;
    case "heading_2":
      return `${pad}## ${text}${childMd}`;
    case "heading_3":
      return `${pad}### ${text}${childMd}`;
    case "paragraph":
      return `${pad}${text}${childMd}`;
    case "bulleted_list_item":
      return `${pad}- ${text}${childMd}`;
    case "numbered_list_item":
      return `${pad}1. ${text}${childMd}`;
    case "to_do": {
      const checked = data.checked === true ? "x" : " ";
      return `${pad}- [${checked}] ${text}${childMd}`;
    }
    case "toggle":
      return `${pad}- ${text}${childMd}`;
    case "quote":
      return `${pad}> ${text.split("\n").join(`\n${pad}> `)}${childMd}`;
    case "callout":
      return `${pad}> ${text}${childMd}`;
    case "divider":
      return `${pad}---`;
    case "code": {
      const lang = typeof data.language === "string" ? data.language : "";
      return `${pad}\`\`\`${lang}\n${text}\n${pad}\`\`\``;
    }
    case "bookmark":
    case "embed":
    case "image":
    case "video":
    case "audio":
    case "file":
    case "pdf": {
      const url = extractUrl(data);
      return url ? `${pad}[${type}](${url})` : `${pad}<!-- ${type} -->`;
    }
    default:
      return `${pad}<!-- unsupported block ${type}: ${safeJson(block)} -->`;
  }
}

function renderChildren(block: BuildinBlockObject, indent: number): string {
  const children = block.children;
  if (!Array.isArray(children) || children.length === 0) return "";
  const md = blocksToMarkdown(children as BuildinBlockObject[], { indent });
  return `\n${md.trimEnd()}`;
}

function coerceRichText(v: unknown): BuildinRichText[] {
  return Array.isArray(v) ? (v as BuildinRichText[]) : [];
}

function extractUrl(data: Record<string, unknown>): string | null {
  if (typeof data.url === "string") return data.url;
  const ext = data.external as { url?: string } | undefined;
  if (ext && typeof ext.url === "string") return ext.url;
  const file = data.file as { url?: string } | undefined;
  if (file && typeof file.url === "string") return file.url;
  return null;
}

export function richToMarkdown(rich: BuildinRichText[]): string {
  let out = "";
  for (const run of rich) {
    const raw = run.plain_text ?? run.text?.content ?? "";
    let chunk = raw;
    const a = run.annotations ?? {};
    if (a.code) chunk = `\`${chunk}\``;
    if (a.bold) chunk = `**${chunk}**`;
    if (a.italic) chunk = `*${chunk}*`;
    if (a.strikethrough) chunk = `~~${chunk}~~`;
    const link = run.text?.link?.url ?? run.href ?? null;
    if (link) chunk = `[${chunk}](${link})`;
    out += chunk;
  }
  return out;
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return "[unserializable]";
  }
}
