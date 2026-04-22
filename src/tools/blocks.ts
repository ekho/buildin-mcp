import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildinFetch } from "../http/client.js";
import { formatErrorForTool } from "../http/errors.js";
import { uuidLike } from "../schemas/common.js";
import { BlockInputSchema } from "../schemas/blocks.js";

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function errResult(err: unknown) {
  return { isError: true, content: [{ type: "text" as const, text: formatErrorForTool(err) }] };
}

export function registerBlockTools(server: McpServer): void {
  server.registerTool(
    "buildin_get_block",
    {
      title: "Get Buildin block",
      description: "Retrieve a single block object by ID. Does not include children.",
      inputSchema: { block_id: uuidLike },
    },
    async ({ block_id }) => {
      try {
        const res = await buildinFetch("GET", `/blocks/${encodeURIComponent(block_id)}`);
        return jsonResult(res);
      } catch (err) {
        return errResult(err);
      }
    },
  );

  server.registerTool(
    "buildin_get_block_children",
    {
      title: "List children of a block",
      description:
        "List immediate children of a block (or page) with pagination. Use this instead of scraping a page to render its contents.",
      inputSchema: {
        block_id: uuidLike,
        page_size: z.number().int().min(1).max(100).optional(),
        start_cursor: z.string().optional(),
      },
    },
    async ({ block_id, page_size, start_cursor }) => {
      try {
        const res = await buildinFetch("GET", `/blocks/${encodeURIComponent(block_id)}/children`, undefined, {
          query: { page_size, start_cursor },
        });
        return jsonResult(res);
      } catch (err) {
        return errResult(err);
      }
    },
  );

  server.registerTool(
    "buildin_append_block_children",
    {
      title: "Append children blocks",
      description:
        "Append one or more child blocks to a parent block (or page). `children` is an array of block objects ({type, data}). Returns the list of created blocks.",
      inputSchema: {
        block_id: uuidLike,
        children: z.array(BlockInputSchema).min(1),
        after: z.string().optional().describe("Optional: ID of the child to insert the new children after."),
      },
    },
    async ({ block_id, children, after }) => {
      try {
        const body: Record<string, unknown> = { children };
        if (after) body.after = after;
        const res = await buildinFetch("PATCH", `/blocks/${encodeURIComponent(block_id)}/children`, body);
        return jsonResult(res);
      } catch (err) {
        return errResult(err);
      }
    },
  );

  server.registerTool(
    "buildin_update_block",
    {
      title: "Update Buildin block",
      description:
        "Update a block's content or state. For text blocks, pass `data: { rich_text: [...] }`. To toggle a to_do, pass `data: { checked: true }`. To archive, pass `archived: true`.",
      inputSchema: {
        block_id: uuidLike,
        data: z.record(z.unknown()).optional().describe("Partial data for the block's type-specific payload."),
        archived: z.boolean().optional(),
      },
    },
    async ({ block_id, ...body }) => {
      try {
        const res = await buildinFetch("PATCH", `/blocks/${encodeURIComponent(block_id)}`, body);
        return jsonResult(res);
      } catch (err) {
        return errResult(err);
      }
    },
  );

  server.registerTool(
    "buildin_delete_block",
    {
      title: "Delete Buildin block",
      description:
        "Hard-delete a block by ID (DELETE /v1/blocks/{block_id}). This is NOT the same as archiving a page — it's a permanent removal.",
      inputSchema: { block_id: uuidLike },
    },
    async ({ block_id }) => {
      try {
        const res = await buildinFetch("DELETE", `/blocks/${encodeURIComponent(block_id)}`);
        return jsonResult(res ?? { ok: true });
      } catch (err) {
        return errResult(err);
      }
    },
  );
}
