import { test } from "node:test";
import assert from "node:assert/strict";
import { blocksToMarkdown } from "../src/markdown/blocks_to_md.js";

test("renders notion-style blocks", () => {
  const md = blocksToMarkdown([
    { type: "heading_1", heading_1: { rich_text: [{ plain_text: "Title" }] } },
    {
      type: "paragraph",
      paragraph: { rich_text: [{ plain_text: "hello ", annotations: {} }, { plain_text: "world", annotations: { bold: true } }] },
    },
    { type: "divider", divider: {} },
    { type: "to_do", to_do: { rich_text: [{ plain_text: "done" }], checked: true } },
  ]);
  assert.match(md, /^# Title/m);
  assert.match(md, /hello \*\*world\*\*/);
  assert.match(md, /^---$/m);
  assert.match(md, /- \[x\] done/);
});

test("renders append-style data blocks", () => {
  const md = blocksToMarkdown([
    { type: "bulleted_list_item", data: { rich_text: [{ plain_text: "a" }] } },
    { type: "code", data: { rich_text: [{ plain_text: "const x=1" }], language: "ts" } },
  ]);
  assert.match(md, /- a/);
  assert.match(md, /```ts\nconst x=1\n```/);
});

test("round trip preserves basic structure", async () => {
  const { markdownToBlocks } = await import("../src/markdown/md_to_blocks.js");
  const input = "# H1\n\npara with **bold** text\n\n- a\n- b\n\n1. one\n2. two\n\n- [x] done\n- [ ] todo\n\n> quote\n\n```js\nx\n```\n\n---\n";
  const blocks = markdownToBlocks(input);
  const rendered = blocksToMarkdown(blocks);
  assert.match(rendered, /^# H1/m);
  assert.match(rendered, /\*\*bold\*\*/);
  assert.match(rendered, /- a/);
  assert.match(rendered, /1\. one/);
  assert.match(rendered, /- \[x\] done/);
  assert.match(rendered, /- \[ \] todo/);
  assert.match(rendered, /> quote/);
  assert.match(rendered, /```js/);
  assert.match(rendered, /^---$/m);
});

test("unknown block type does not crash", () => {
  const md = blocksToMarkdown([
    { type: "mystery", data: { rich_text: [{ plain_text: "x" }] } },
  ]);
  assert.match(md, /unsupported block mystery/);
});
