/**
 * Shared shapes used by the markdown converters and helper tools.
 * Kept separate from the Zod schemas so the converters have no runtime dependency on zod.
 */

export interface BuildinRichText {
  type?: "text";
  text: { content: string; link?: { url: string } | null };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
  plain_text?: string;
  href?: string | null;
}

export interface BuildinBlockInput {
  type: string;
  data: Record<string, unknown>;
  children?: BuildinBlockInput[];
  [key: string]: unknown;
}

export interface BuildinBlockObject {
  id?: string;
  type: string;
  data?: Record<string, unknown>;
  has_children?: boolean;
  children?: BuildinBlockObject[];
  [key: string]: unknown;
}
