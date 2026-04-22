import type { z } from "zod";
import { z as zod } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildinFetch } from "../http/client.js";
import { formatErrorForTool } from "../http/errors.js";
import { ParentSchema, IconSchema, CoverSchema } from "../schemas/common.js";
import { PropertiesRecordSchema } from "../schemas/properties.js";
import { BlockInputSchema } from "../schemas/blocks.js";

const toolResult = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});

const errorResult = (err: unknown) => ({
  content: [{ type: "text" as const, text: formatErrorForTool(err) }],
  isError: true,
});

const CreatePageInput = zod.object({
  parent: ParentSchema,
  properties: PropertiesRecordSchema.describe(
    "Page properties. For database children, must match the database schema. For other parents, typically { title: { title: [{ text: { content: '...' } }] } }.",
  ),
  icon: IconSchema.optional(),
  cover: CoverSchema.optional(),
  children: zod.array(BlockInputSchema).optional().describe("Initial child blocks to append after creation."),
});

const GetPageInput = zod.object({ page_id: zod.string().min(1) });

const UpdatePageInput = zod.object({
  page_id: zod.string().min(1),
  properties: PropertiesRecordSchema.optional(),
  icon: IconSchema.nullable().optional(),
  cover: CoverSchema.nullable().optional(),
  archived: zod.boolean().optional().describe("Set true to soft-delete (archive) the page."),
});

const ArchivePageInput = zod.object({
  page_id: zod.string().min(1),
  archived: zod.boolean().default(true).describe("Defaults to true (archive). Pass false to unarchive."),
});

const GetPageChildrenInput = zod.object({
  page_id: zod.string().min(1).describe("The page id — Buildin exposes page children through /v1/blocks/{page_id}/children."),
  start_cursor: zod.string().optional(),
  page_size: zod.number().int().min(1).max(100).optional(),
});

export function registerPageTools(server: McpServer): void {
  server.registerTool(
    "buildin_create_page",
    {
      title: "Create Buildin page",
      description:
        "Create a new page in Buildin.ai. The parent may be a page_id, database_id, space_id, or block_id. When parent is a database, properties must match the database schema. Returns the created page object.",
      inputSchema: CreatePageInput.shape,
    },
    async (args: z.infer<typeof CreatePageInput>) => {
      try {
        const res = await buildinFetch("POST", "/pages", args);
        return toolResult(res);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "buildin_get_page",
    {
      title: "Get Buildin page",
      description: "Retrieve a Buildin.ai page by its id. Returns the page object including properties, icon, cover, parent and url.",
      inputSchema: GetPageInput.shape,
    },
    async ({ page_id }: z.infer<typeof GetPageInput>) => {
      try {
        const res = await buildinFetch("GET", `/pages/${encodeURIComponent(page_id)}`);
        return toolResult(res);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "buildin_update_page",
    {
      title: "Update Buildin page",
      description:
        "Update a Buildin.ai page: change properties, icon, cover, or archive/unarchive it. Only the fields you pass are modified. Pass archived=true to soft-delete.",
      inputSchema: UpdatePageInput.shape,
    },
    async ({ page_id, ...body }: z.infer<typeof UpdatePageInput>) => {
      try {
        const res = await buildinFetch("PATCH", `/pages/${encodeURIComponent(page_id)}`, body);
        return toolResult(res);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "buildin_archive_page",
    {
      title: "Archive or unarchive Buildin page",
      description:
        "Convenience wrapper over update_page: sets archived=true by default (pass archived=false to restore). Buildin.ai does not expose hard-delete for pages.",
      inputSchema: ArchivePageInput.shape,
    },
    async ({ page_id, archived }: z.infer<typeof ArchivePageInput>) => {
      try {
        const res = await buildinFetch("PATCH", `/pages/${encodeURIComponent(page_id)}`, { archived });
        return toolResult(res);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "buildin_get_page_children",
    {
      title: "Get Buildin page children",
      description:
        "List top-level children blocks of a page using GET /v1/blocks/{page_id}/children. Returns a paginated list with next_cursor and has_more.",
      inputSchema: GetPageChildrenInput.shape,
    },
    async ({ page_id, start_cursor, page_size }: z.infer<typeof GetPageChildrenInput>) => {
      try {
        const res = await buildinFetch("GET", `/blocks/${encodeURIComponent(page_id)}/children`, undefined, {
          query: { start_cursor, page_size },
        });
        return toolResult(res);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
