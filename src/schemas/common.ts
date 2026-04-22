import { z } from "zod";

export const uuidLike = z.string().min(1).describe("Buildin object ID (UUID-like).");

export const PaginationInput = z.object({
  start_cursor: z.string().optional().describe("Opaque cursor from a previous response's next_cursor."),
  page_size: z.number().int().min(1).max(100).optional().describe("1..100, default 50."),
});

export const IconSchema = z.union([
  z.object({ type: z.literal("emoji"), emoji: z.string() }),
  z.object({ type: z.literal("external"), external: z.object({ url: z.string().url() }) }),
  z.object({ emoji: z.string() }),
  z.object({ external: z.object({ url: z.string().url() }) }),
]).describe("Icon: emoji or external url. Both discriminator-less and typed forms accepted to match Buildin examples.");

export const CoverSchema = z.union([
  z.object({ type: z.literal("external"), external: z.object({ url: z.string().url() }) }),
  z.object({ external: z.object({ url: z.string().url() }) }),
]).describe("Cover image (external url only).");

export const ParentSchema = z.union([
  z.object({ type: z.literal("page_id"), page_id: uuidLike }),
  z.object({ type: z.literal("database_id"), database_id: uuidLike }),
  z.object({ type: z.literal("space_id"), space_id: uuidLike }),
  z.object({ type: z.literal("block_id"), block_id: uuidLike }),
  z.object({ page_id: uuidLike }),
  z.object({ database_id: uuidLike }),
  z.object({ space_id: uuidLike }),
  z.object({ block_id: uuidLike }),
]).describe("Parent reference. Accepts both {type, <id_field>} and the shorter {<id_field>} form.");

export const AnnotationsSchema = z.object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  strikethrough: z.boolean().optional(),
  underline: z.boolean().optional(),
  code: z.boolean().optional(),
  color: z.string().optional(),
}).describe("Inline rich-text annotations. Supported colors: default, gray, brown, orange, yellow, green, blue, purple, pink, red, plus *_background variants.");

export const RichTextItemSchema = z.object({
  type: z.literal("text").optional(),
  text: z.object({
    content: z.string(),
    link: z.union([z.object({ url: z.string().url() }), z.null()]).optional(),
  }),
  annotations: AnnotationsSchema.optional(),
  plain_text: z.string().optional(),
  href: z.string().nullable().optional(),
}).describe("Single rich-text run.");

export const RichTextArraySchema = z.array(RichTextItemSchema).describe("Array of rich-text runs.");
