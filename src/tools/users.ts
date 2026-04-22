import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildinFetch } from "../http/client.js";
import { formatErrorForTool } from "../http/errors.js";

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function errResult(err: unknown) {
  return { isError: true, content: [{ type: "text" as const, text: formatErrorForTool(err) }] };
}

export function registerUserTools(server: McpServer): void {
  server.registerTool(
    "buildin_get_me",
    {
      title: "Get current Buildin bot identity",
      description:
        "Return information about the bot that owns the current API token (GET /v1/users/me). Use this to verify authentication is working.",
      inputSchema: {},
    },
    async () => {
      try {
        const res = await buildinFetch("GET", "/users/me");
        return jsonResult(res);
      } catch (err) {
        return errResult(err);
      }
    },
  );
}
