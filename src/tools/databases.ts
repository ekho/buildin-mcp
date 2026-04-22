import type { z } from "zod";
import { z as zod } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildinFetch } from "../http/client.js";
import { formatErrorForTool } from "../http/errors.js";
import { ParentSchema, IconSchema, CoverSchema, RichTextArraySchema } from "../schemas/common.js";
import { DatabasePropertiesSchemaRecord } from "../schemas/properties.js";

const toolResult = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});
const errorResult = (err: unknown) => ({
  content: [{ type: "text" as const, text: formatErrorForTool(err) }],
  isError: true,
});

const CreateDatabaseInput = zod.object({
  parent: ParentSchema.describe("Usually a page parent: { page_id: '...' }."),
  title: RichTextArraySchema,
  properties: DatabasePropertiesSchemaRecord.describe("Map of property name -> schema definition. At least one property of type 'title' must be present."),
  icon: IconSchema.optional(),
  cover: CoverSchema.optional(),
  is_inline: zod.boolean().optional().describe("true for inline databases embedded on a page, false for full-page databases."),
});

const GetDatabaseInput = zod.object({ database_id: zod.string().min(1) });

const QueryDatabaseInput = zod.object({
  database_id: zod.string().min(1),
  filter: zod.record(zod.unknown()).optional().describe("Buildin filter object. Structure mirrors Notion-style filters."),
  sorts: zod.array(zod.record(zod.unknown())).optional().describe("Array of sort specs, e.g. [{ property: 'Name', direction: 'ascending' }]."),
  start_cursor: zod.string().optional(),
  page_size: zod.number().int().min(1).max(100).optional(),
});

const UpdateDatabaseInput = zod.object({
  database_id: zod.string().min(1),
  title: RichTextArraySchema.optional(),
  icon: IconSchema.nullable().optional(),
  cover: CoverSchema.nullable().optional(),
  properties: DatabasePropertiesSchemaRecord.optional().describe("Pass null for a property to remove it."),
  archived: zod.boolean().optional(),
});

export function registerDatabaseTools(server: McpServer): void {
  server.registerTool(
    "buildin_create_database",
    {
      title: "Create Buildin database",
      description:
        "Create a new Buildin.ai database under a page parent. Must include at least one property of type 'title'. Set is_inline=true for inline databases.",
      inputSchema: CreateDatabaseInput.shape,
    },
    async (args: z.infer<typeof CreateDatabaseInput>) => {
      try {
        const res = await buildinFetch("POST", "/databases", args);
        return toolResult(res);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "buildin_get_database",
    {
      title: "Get Buildin database",
      description: "Retrieve a Buildin.ai database by id, including its property schema.",
      inputSchema: GetDatabaseInput.shape,
    },
    async ({ database_id }: z.infer<typeof GetDatabaseInput>) => {
      try {
        const res = await buildinFetch("GET", `/databases/${encodeURIComponent(database_id)}`);
        return toolResult(res);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "buildin_query_database",
    {
      title: "Query Buildin database",
      description:
        "Query rows (pages) of a Buildin.ai database with optional filter and sort. Returns a paginated list; use next_cursor / has_more to continue.",
      inputSchema: QueryDatabaseInput.shape,
    },
    async ({ database_id, ...body }: z.infer<typeof QueryDatabaseInput>) => {
      try {
        const res = await buildinFetch("POST", `/databases/${encodeURIComponent(database_id)}/query`, body);
        return toolResult(res);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "buildin_update_database",
    {
      title: "Update Buildin database",
      description:
        "Update a database's title, icon, cover, properties schema, or archive flag. Only fields you pass are modified. To remove a property, set its value to null.",
      inputSchema: UpdateDatabaseInput.shape,
    },
    async ({ database_id, ...body }: z.infer<typeof UpdateDatabaseInput>) => {
      try {
        const res = await buildinFetch("PATCH", `/databases/${encodeURIComponent(database_id)}`, body);
        return toolResult(res);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
