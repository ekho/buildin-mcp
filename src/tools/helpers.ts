import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildinFetch } from "../http/client.js";
import { formatErrorForTool } from "../http/errors.js";
import { uuidLike } from "../schemas/common.js";
import { markdownToBlocks } from "../markdown/md_to_blocks.js";
import { blocksToMarkdown } from "../markdown/blocks_to_md.js";
import { fetchAllPaginated } from "../util/pagination.js";
import type { BuildinBlockObject } from "../markdown/types.js";

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function textResult(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
}
function errResult(err: unknown) {
  return { isError: true, content: [{ type: "text" as const, text: formatErrorForTool(err) }] };
}

export function registerHelperTools(server: McpServer): void {
  server.registerTool(
    "buildin_append_markdown",
    {
      title: "Append Markdown to a Buildin page",
      description:
        "Convert a Markdown string into Buildin blocks and append them to the given page/block. " +
        "Supports headings (# ## ###), lists, task lists, code fences, blockquotes, dividers, " +
        "and inline bold/italic/code/link. Returns the Buildin response with the created block ids.",
      inputSchema: {
        block_id: uuidLike.describe("The page id or parent block id to append to."),
        markdown: z.string().min(1).describe("Markdown source. Each top-level block becomes one Buildin block."),
        after: z.string().optional().describe("Optional: id of the existing child to insert after."),
      },
    },
    async ({ block_id, markdown, after }) => {
      try {
        const children = markdownToBlocks(markdown);
        if (children.length === 0) {
          return errResult(new Error("markdown produced zero blocks"));
        }
        const body: Record<string, unknown> = { children };
        if (after) body.after = after;
        const res = await buildinFetch(
          "PATCH",
          `/blocks/${encodeURIComponent(block_id)}/children`,
          body,
        );
        return jsonResult(res);
      } catch (err) {
        return errResult(err);
      }
    },
  );

  server.registerTool(
    "buildin_get_page_markdown",
    {
      title: "Read a Buildin page as Markdown",
      description:
        "Fetch every child block of a page (walks pagination, follows has_children) and render " +
        "the result as Markdown. Useful for quickly summarising or ingesting a page.",
      inputSchema: {
        page_id: uuidLike.describe("Page id whose content to read."),
        max_depth: z.number().int().min(0).max(5).optional().describe("How deep to recurse into child blocks (default 2)."),
      },
    },
    async ({ page_id, max_depth }) => {
      try {
        const depth = max_depth ?? 2;
        const tree = await loadBlockTree(page_id, depth);
        const md = blocksToMarkdown(tree);
        return textResult(md);
      } catch (err) {
        return errResult(err);
      }
    },
  );

  server.registerTool(
    "buildin_search_and_fetch",
    {
      title: "Search Buildin and fetch top results as Markdown",
      description:
        "Run /v1/search and, for each hit that is a page, fetch its full content as Markdown. " +
        "Returns an array of { id, title, url, markdown }. Limit defaults to 3 to stay within rate limits.",
      inputSchema: {
        query: z.string().describe("Search query."),
        limit: z.number().int().min(1).max(10).optional().describe("Max pages to fetch (1..10, default 3)."),
        max_depth: z.number().int().min(0).max(5).optional().describe("Recursion depth for each page (default 1)."),
      },
    },
    async ({ query, limit, max_depth }) => {
      try {
        const max = limit ?? 3;
        const depth = max_depth ?? 1;
        const search = await buildinFetch<{ results?: unknown[] }>("POST", "/search", {
          query,
          page_size: max,
        });
        const results = Array.isArray(search.results) ? search.results : [];
        const out: Array<{ id: string; title: string; url?: string; markdown: string }> = [];
        for (const hit of results.slice(0, max)) {
          const h = hit as Record<string, unknown>;
          const id = typeof h.id === "string" ? h.id : "";
          const url = typeof h.url === "string" ? h.url : undefined;
          if (!id || h.object !== "page") continue;
          let markdown = "";
          try {
            const tree = await loadBlockTree(id, depth);
            markdown = blocksToMarkdown(tree);
          } catch (err) {
            markdown = `<!-- failed to fetch: ${formatErrorForTool(err)} -->`;
          }
          out.push({ id, title: extractTitle(h), ...(url ? { url } : {}), markdown });
        }
        return jsonResult(out);
      } catch (err) {
        return errResult(err);
      }
    },
  );
}

async function loadBlockTree(blockId: string, depth: number): Promise<BuildinBlockObject[]> {
  const kids = await fetchAllPaginated<BuildinBlockObject>(
    `/blocks/${encodeURIComponent(blockId)}/children`,
  );
  if (depth <= 0) return kids;
  for (const k of kids) {
    if (k.has_children && typeof k.id === "string") {
      k.children = await loadBlockTree(k.id, depth - 1);
    }
  }
  return kids;
}

function extractTitle(page: Record<string, unknown>): string {
  const props = page.properties as Record<string, unknown> | undefined;
  if (props) {
    for (const v of Object.values(props)) {
      const prop = v as Record<string, unknown>;
      if (prop && Array.isArray(prop.title)) {
        const runs = prop.title as Array<{ plain_text?: string; text?: { content?: string } }>;
        const text = runs.map((r) => r.plain_text ?? r.text?.content ?? "").join("");
        if (text) return text;
      }
    }
  }
  if (typeof page.title === "string") return page.title;
  return "(untitled)";
}
