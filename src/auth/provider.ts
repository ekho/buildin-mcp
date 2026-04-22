import type { Response } from "express";
import type { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { OAuthClientInformationFull, OAuthTokenRevocationRequest, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import {
  generateToken,
  generateMcpTokens,
  getClientRegistration,
  saveClientRegistration,
  savePendingAuth,
  readAuthCode,
  deleteAuthCode,
  readMcpInstallation,
  saveMcpInstallation,
  deleteMcpInstallation,
  readRefreshToken,
  saveRefreshToken,
  deleteRefreshToken,
} from "./store.js";
import { logger } from "../util/logger.js";

function getOAuthConfig() {
  const clientId = process.env.BUILDIN_OAUTH_CLIENT_ID;
  const clientSecret = process.env.BUILDIN_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("BUILDIN_OAUTH_CLIENT_ID and BUILDIN_OAUTH_CLIENT_SECRET must be set in HTTP/OAuth mode.");
  }
  const baseUrl = (process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? "5137"}`).replace(/\/+$/, "");
  return { clientId, clientSecret, baseUrl };
}

class BuildinOAuthClientsStore implements OAuthRegisteredClientsStore {
  getClient(clientId: string): OAuthClientInformationFull | undefined {
    return getClientRegistration(clientId);
  }

  registerClient(client: OAuthClientInformationFull): OAuthClientInformationFull {
    saveClientRegistration(client.client_id, client);
    return client;
  }
}

export class BuildinOAuthProvider implements OAuthServerProvider {
  private _clientsStore = new BuildinOAuthClientsStore();

  get clientsStore(): OAuthRegisteredClientsStore {
    return this._clientsStore;
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    const { clientId, baseUrl } = getOAuthConfig();
    const state = generateToken(24);

    savePendingAuth(state, {
      mcpRedirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      mcpState: params.state,
      clientId: client.client_id,
    });

    const callbackUrl = `${baseUrl}/buildin-callback`;
    const authorizeUrl = new URL("https://api.buildin.ai/oauth/authorize");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
    authorizeUrl.searchParams.set("scope", "all");
    authorizeUrl.searchParams.set("state", state);

    logger.debug("redirecting to Buildin.ai OAuth", { state: state.slice(0, 8) + "..." });
    res.redirect(authorizeUrl.toString());
  }

  async challengeForAuthorizationCode(_client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const data = readAuthCode(authorizationCode);
    if (!data) throw new Error("Authorization code not found");
    return data.codeChallenge;
  }

  async exchangeAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<OAuthTokens> {
    const data = readAuthCode(authorizationCode);
    if (!data) throw new Error("Invalid authorization code");
    if (data.clientId !== client.client_id) throw new Error("Client mismatch");

    deleteAuthCode(authorizationCode);

    const tokens = generateMcpTokens();

    saveMcpInstallation(tokens.access_token, {
      buildinToken: data.buildinToken,
      clientId: client.client_id,
      mcpTokens: tokens,
      issuedAt: Math.floor(Date.now() / 1000),
    });

    if (tokens.refresh_token) {
      saveRefreshToken(tokens.refresh_token, tokens.access_token);
    }

    return tokens;
  }

  async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string): Promise<OAuthTokens> {
    const oldAccessToken = readRefreshToken(refreshToken);
    if (!oldAccessToken) throw new Error("Invalid refresh token");

    const installation = readMcpInstallation(oldAccessToken);
    if (!installation) throw new Error("Installation not found");
    if (installation.clientId !== client.client_id) throw new Error("Client mismatch");

    deleteRefreshToken(refreshToken);
    deleteMcpInstallation(oldAccessToken);

    const newTokens = generateMcpTokens();

    saveMcpInstallation(newTokens.access_token, {
      buildinToken: installation.buildinToken,
      clientId: client.client_id,
      mcpTokens: newTokens,
      issuedAt: Math.floor(Date.now() / 1000),
    });

    if (newTokens.refresh_token) {
      saveRefreshToken(newTokens.refresh_token, newTokens.access_token);
    }

    return newTokens;
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const installation = readMcpInstallation(token);
    if (!installation) throw new InvalidTokenError("Invalid access token");

    const expiresAt = installation.mcpTokens.expires_in
      ? installation.issuedAt + installation.mcpTokens.expires_in
      : undefined;

    if (expiresAt && expiresAt < Math.floor(Date.now() / 1000)) {
      throw new InvalidTokenError("Token expired");
    }

    return {
      token,
      clientId: installation.clientId,
      scopes: ["all"],
      expiresAt,
      extra: { buildinToken: installation.buildinToken },
    };
  }

  async revokeToken(_client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    deleteMcpInstallation(request.token);
  }
}
