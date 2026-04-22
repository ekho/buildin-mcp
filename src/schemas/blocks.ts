import { z } from "zod";
import { RichTextArraySchema } from "./common.js";

const BlockColor = z.string().optional();

const TextData = z.object({
  rich_text: RichTextArraySchema,
  text_color: BlockColor,
  background_color: BlockColor,
});

const ToDoData = TextData.extend({ checked: z.boolean().optional() });

const CodeData = z.object({
  rich_text: RichTextArraySchema,
  language: z.string().optional(),
  caption: RichTextArraySchema.optional(),
});

const ExternalUrlData = z.object({
  external: z.object({ url: z.string().url() }),
  caption: RichTextArraySchema.optional(),
});

const EmbedData = z.object({ url: z.string().url(), caption: RichTextArraySchema.optional() });

export const BlockInputSchema = z.object({
  type: z.enum([
    "paragraph",
    "heading_1",
    "heading_2",
    "heading_3",
    "bulleted_list_item",
    "numbered_list_item",
    "to_do",
    "toggle",
    "code",
    "quote",
    "callout",
    "divider",
    "image",
    "video",
    "audio",
    "file",
    "pdf",
    "embed",
    "bookmark",
    "table",
    "table_row",
    "column_list",
    "column",
    "breadcrumb",
    "synced_block",
  ]),
  data: z.union([
    TextData.partial({ rich_text: true }),
    ToDoData.partial({ rich_text: true }),
    CodeData.partial({ rich_text: true }),
    ExternalUrlData,
    EmbedData,
    z.record(z.unknown()),
  ]),
  children: z.array(z.lazy((): z.ZodTypeAny => BlockInputSchema)).optional(),
}).describe("A Buildin block. 'type' determines the shape of 'data'. For plain paragraphs and headings, data = { rich_text: [...] }.");

export const BlockUpdateSchema = z.object({
  data: z.record(z.unknown()).describe("Partial block data to update. Shape depends on block type."),
  archived: z.boolean().optional(),
}).describe("Patch body for PATCH /v1/blocks/{block_id}.");
