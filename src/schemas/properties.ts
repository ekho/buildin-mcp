import { z } from "zod";
import { RichTextArraySchema } from "./common.js";

const SelectOption = z.object({
  id: z.string().optional(),
  name: z.string(),
  color: z.string().optional(),
});

export const PropertyValueSchema = z.record(z.unknown()).describe(
  "Property value. Shape depends on the property type (title, rich_text, number, select, multi_select, date, people, files, checkbox, url, email, phone_number, relation, rollup, formula, created_time, created_by, last_edited_time, last_edited_by). Pass the exact JSON the API expects.",
);

export const TitlePropertySchema = z.object({
  type: z.literal("title").optional(),
  title: RichTextArraySchema,
});

export const PropertySchemaDef = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  type: z.enum([
    "title",
    "rich_text",
    "number",
    "select",
    "multi_select",
    "date",
    "people",
    "files",
    "checkbox",
    "url",
    "email",
    "phone_number",
    "formula",
    "relation",
    "rollup",
    "created_time",
    "created_by",
    "last_edited_time",
    "last_edited_by",
  ]),
  number: z.object({ format: z.string().optional() }).optional(),
  select: z.object({ options: z.array(SelectOption).optional() }).optional(),
  multi_select: z.object({ options: z.array(SelectOption).optional() }).optional(),
  formula: z.object({ expression: z.string() }).optional(),
  relation: z.object({ database_id: z.string() }).optional(),
  rollup: z.object({
    relation_property_name: z.string().optional(),
    rollup_property_name: z.string().optional(),
    function: z.string().optional(),
  }).optional(),
}).describe("Database property schema definition. Used when creating or updating a database.");

export const PropertiesRecordSchema = z.record(PropertyValueSchema).describe(
  "Record of page properties keyed by property name or id.",
);

export const DatabasePropertiesSchemaRecord = z.record(PropertySchemaDef).describe(
  "Record of database property schema definitions keyed by property name or id.",
);
