import { randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { BuildinOAuthProvider } from "../auth/provider.js";
import { handleBuildinCallback } from "../auth/callback.js";
import { runWithToken } from "../util/token_context.js";
import { logger } from "../util/logger.js";

export async function startHttpServer(createServer: () => McpServer): Promise<void> {
  const port = parseInt(process.env.PORT ?? "5137", 10);
  const baseUrl = (process.env.BASE_URL ?? `http://localhost:${port}`).replace(/\/+$/, "");

  const provider = new BuildinOAuthProvider();
  const app = express();

  app.use(cors({
    origin: "*",
    exposedHeaders: ["WWW-Authenticate", "Mcp-Session-Id", "Mcp-Protocol-Version"],
  }));

  app.use(mcpAuthRouter({
    provider,
    issuerUrl: new URL(baseUrl),
    scopesSupported: ["all"],
  }));

  app.get("/buildin-callback", handleBuildinCallback);

  const bearerAuth = requireBearerAuth({ verifier: provider });
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const injectTokenContext: express.RequestHandler = (req, _res, next) => {
    const buildinToken = (req.auth?.extra as Record<string, unknown> | undefined)?.buildinToken;
    if (typeof buildinToken === "string") {
      runWithToken(buildinToken, () => next());
    } else {
      next();
    }
  };

  app.post("/mcp", bearerAuth, injectTokenContext, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      await transports.get(sessionId)!.handleRequest(req, res, req.body);
      return;
    }

    if (!sessionId && isInitializeRequest(req.body)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports.set(sid, transport);
          logger.debug("MCP session initialized", { sessionId: sid });
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId);
          logger.debug("MCP session closed", { sessionId: transport.sessionId });
        }
      };

      const server = createServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    res.status(400).json({ error: "Bad request: missing session or not an initialize request" });
  });

  app.get("/mcp", bearerAuth, injectTokenContext, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && transports.has(sessionId)) {
      await transports.get(sessionId)!.handleRequest(req, res);
      return;
    }
    res.status(400).json({ error: "Invalid or missing session" });
  });

  app.delete("/mcp", bearerAuth, injectTokenContext, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && transports.has(sessionId)) {
      await transports.get(sessionId)!.handleRequest(req, res);
      return;
    }
    res.status(400).json({ error: "Invalid or missing session" });
  });

  app.listen(port, () => {
    logger.info(`buildin-mcp HTTP server listening on ${baseUrl}`);
    logger.info(`OAuth authorize: ${baseUrl}/authorize`);
    logger.info(`MCP endpoint:   ${baseUrl}/mcp`);
  });
}
