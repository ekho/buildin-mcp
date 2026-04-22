/**
 * stdio JSON-RPC smoke test.
 * Spawns `node dist/index.js`, sends MCP `initialize` + `tools/list`,
 * and asserts that all 18 tools are registered. Does NOT call Buildin.ai.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

const EXPECTED_TOOLS = [
  "buildin_create_page",
  "buildin_get_page",
  "buildin_update_page",
  "buildin_archive_page",
  "buildin_get_page_children",
  "buildin_create_database",
  "buildin_get_database",
  "buildin_query_database",
  "buildin_update_database",
  "buildin_get_block",
  "buildin_get_block_children",
  "buildin_append_block_children",
  "buildin_update_block",
  "buildin_delete_block",
  "buildin_get_me",
  "buildin_search",
  "buildin_append_markdown",
  "buildin_get_page_markdown",
  "buildin_search_and_fetch",
];

async function run(): Promise<void> {
  const child = spawn(process.execPath, ["dist/index.js"], {
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, BUILDIN_API_TOKEN: process.env.BUILDIN_API_TOKEN ?? "dummy-token-for-smoke" },
  });

  let buf = "";
  const pending = new Map<number, (msg: Record<string, unknown>) => void>();
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buf += chunk;
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as Record<string, unknown>;
        const id = msg.id as number | undefined;
        if (typeof id === "number" && pending.has(id)) {
          pending.get(id)!(msg);
          pending.delete(id);
        }
      } catch {
        // ignore non-JSON noise
      }
    }
  });

  const send = <T>(id: number, method: string, params: unknown): Promise<T> => {
    return new Promise((resolve) => {
      pending.set(id, (msg) => resolve(msg as T));
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  };

  try {
    await delay(200);
    const init = await send<{ result: unknown }>(1, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "smoke", version: "0.0.1" },
    });
    if (!init.result) throw new Error("initialize failed: " + JSON.stringify(init));

    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

    const list = await send<{ result: { tools: Array<{ name: string }> } }>(2, "tools/list", {});
    const names = (list.result?.tools ?? []).map((t) => t.name).sort();
    const expected = [...EXPECTED_TOOLS].sort();

    const missing = expected.filter((n) => !names.includes(n));
    const extra = names.filter((n) => !expected.includes(n));
    if (missing.length > 0 || extra.length > 0) {
      throw new Error(
        `tool set mismatch. missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)} got=${JSON.stringify(names)}`,
      );
    }
    if (names.length !== 19) {
      throw new Error(`expected 19 tools, got ${names.length}: ${JSON.stringify(names)}`);
    }
    process.stderr.write(`ok: ${names.length} tools registered\n`);
  } finally {
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), delay(1000)]);
  }
}

run().then(
  () => process.exit(0),
  (err) => {
    process.stderr.write("smoke failed: " + (err instanceof Error ? err.message : String(err)) + "\n");
    process.exit(1);
  },
);
