#!/usr/bin/env node
import { createServer } from "./server.js";
import { logger } from "./util/logger.js";

const httpMode = process.argv.includes("--http") || process.env.BUILDIN_MCP_HTTP === "1";

async function main(): Promise<void> {
  if (httpMode) {
    const { startHttpServer } = await import("./transport/http.js");
    await startHttpServer(createServer);
  } else {
    const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("buildin-mcp started on stdio");
  }
}

main().catch((err) => {
  logger.error("fatal", { err: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
