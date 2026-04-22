import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPageTools } from "./tools/pages.js";
import { registerDatabaseTools } from "./tools/databases.js";
import { registerBlockTools } from "./tools/blocks.js";
import { registerUserTools } from "./tools/users.js";
import { registerSearchTools } from "./tools/search.js";
import { registerHelperTools } from "./tools/helpers.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "buildin-mcp",
    version: "0.1.0",
  });

  registerPageTools(server);
  registerDatabaseTools(server);
  registerBlockTools(server);
  registerUserTools(server);
  registerSearchTools(server);
  registerHelperTools(server);

  return server;
}
