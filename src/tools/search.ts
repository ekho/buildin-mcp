import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildinFetch } from "../http/client.js";
import { formatErrorForTool } from "../http/errors.js";

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function errResult(err: unknown) {
  return { isError: true, content: [{ type: "text" as const, text: formatErrorForTool(err) }] };
}

export function registerSearchTools(server: McpServer): void {
  server.registerTool(
    "buildin_search",
    {
      title: "Search Buildin pages",
      description:
        "Search across all pages the bot has access to. Returns a paginated list of page objects. `query` is free-form; empty string returns recently-updated pages.",
      inputSchema: {
        query: z.string().optional().describe("Search keywords. Empty/omitted lists recent pages."),
        start_cursor: z.string().optional(),
        page_size: z.number().int().min(1).max(100).optional().describe("1..100, default 10."),
      },
    },
    async (args) => {
      try {
        const res = await buildinFetch("POST", "/search", args);
        return jsonResult(res);
      } catch (err) {
        return errResult(err);
      }
    },
  );
}
