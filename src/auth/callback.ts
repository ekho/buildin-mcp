import type { Request, Response } from "express";
import {
  generateToken,
  readPendingAuth,
  deletePendingAuth,
  saveAuthCode,
} from "./store.js";
import { logger } from "../util/logger.js";

const BUILDIN_TOKEN_URL = "https://api.buildin.ai/oauth/token";

export async function handleBuildinCallback(req: Request, res: Response): Promise<void> {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;

  if (!code || !state) {
    res.status(400).send("Missing code or state parameter");
    return;
  }

  const pending = readPendingAuth(state);
  if (!pending) {
    res.status(400).send("Unknown or expired state parameter");
    return;
  }

  deletePendingAuth(state);

  const clientId = process.env.BUILDIN_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.BUILDIN_OAUTH_CLIENT_SECRET!;
  const baseUrl = (process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? "5137"}`).replace(/\/+$/, "");
  const callbackUrl = `${baseUrl}/buildin-callback`;

  let buildinToken: string;
  try {
    const tokenRes = await fetch(BUILDIN_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      logger.error("Buildin.ai token exchange failed", { status: tokenRes.status, body: body.slice(0, 500) });
      res.status(502).send("Failed to exchange token with Buildin.ai");
      return;
    }

    const tokenData = (await tokenRes.json()) as { data?: { access_token?: string }; access_token?: string };
    buildinToken = tokenData.data?.access_token ?? tokenData.access_token ?? "";
    if (!buildinToken) {
      logger.error("No access_token in Buildin.ai response", { body: JSON.stringify(tokenData).slice(0, 500) });
      res.status(502).send("No access_token in Buildin.ai response");
      return;
    }
  } catch (err) {
    logger.error("Buildin.ai token exchange network error", { err: String(err) });
    res.status(502).send("Network error exchanging token with Buildin.ai");
    return;
  }

  const mcpAuthCode = generateToken(24);

  saveAuthCode(mcpAuthCode, {
    buildinToken,
    codeChallenge: pending.codeChallenge,
    clientId: pending.clientId,
    redirectUri: pending.mcpRedirectUri,
  });

  const redirect = new URL(pending.mcpRedirectUri);
  redirect.searchParams.set("code", mcpAuthCode);
  if (pending.mcpState) redirect.searchParams.set("state", pending.mcpState);

  logger.debug("Buildin.ai token obtained, redirecting to MCP client", { mcpAuthCode: mcpAuthCode.slice(0, 8) + "..." });
  res.redirect(redirect.toString());
}
