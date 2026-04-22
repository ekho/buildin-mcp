import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownToBlocks, parseInline } from "../src/markdown/md_to_blocks.js";

test("headings h1/h2/h3", () => {
  const blocks = markdownToBlocks("# A\n## B\n### C\n");
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0]!.type, "heading_1");
  assert.equal(blocks[1]!.type, "heading_2");
  assert.equal(blocks[2]!.type, "heading_3");
});

test("bulleted and numbered lists", () => {
  const blocks = markdownToBlocks("- one\n- two\n\n1. first\n2. second\n");
  assert.equal(blocks[0]!.type, "bulleted_list_item");
  assert.equal(blocks[1]!.type, "bulleted_list_item");
  assert.equal(blocks[2]!.type, "numbered_list_item");
  assert.equal(blocks[3]!.type, "numbered_list_item");
});

test("to_do checked and unchecked", () => {
  const blocks = markdownToBlocks("- [ ] todo\n- [x] done\n");
  assert.equal(blocks[0]!.type, "to_do");
  assert.equal((blocks[0]!.data as { checked: boolean }).checked, false);
  assert.equal((blocks[1]!.data as { checked: boolean }).checked, true);
});

test("fenced code block with language", () => {
  const md = "```ts\nconst x = 1;\n```\n";
  const blocks = markdownToBlocks(md);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]!.type, "code");
  assert.equal((blocks[0]!.data as { language: string }).language, "ts");
});

test("divider", () => {
  const blocks = markdownToBlocks("para\n\n---\n\nmore\n");
  const types = blocks.map((b) => b.type);
  assert.deepEqual(types, ["paragraph", "divider", "paragraph"]);
});

test("quote collects consecutive lines", () => {
  const blocks = markdownToBlocks("> line1\n> line2\n\nnext\n");
  assert.equal(blocks[0]!.type, "quote");
  assert.equal(blocks[1]!.type, "paragraph");
});

test("inline bold, italic, code, link", () => {
  const runs = parseInline("plain **b** *i* `c` [x](http://e.com)");
  const hasBold = runs.some((r) => r.annotations?.bold);
  const hasItalic = runs.some((r) => r.annotations?.italic);
  const hasCode = runs.some((r) => r.annotations?.code);
  const hasLink = runs.some((r) => r.text?.link?.url === "http://e.com");
  assert.ok(hasBold && hasItalic && hasCode && hasLink);
});
