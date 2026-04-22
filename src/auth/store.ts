/**
 * In-memory token/session store for the OAuth authorization server.
 *
 * Stores:
 *   - Dynamic client registrations
 *   - Pending MCP authorization requests (before Buildin.ai callback)
 *   - Auth codes (after Buildin.ai callback, before MCP /token exchange)
 *   - Installations (maps MCP access tokens → Buildin.ai tokens)
 *   - Refresh tokens → MCP access tokens
 *
 * All data is ephemeral — lost on server restart. Sufficient for a local MCP server.
 */

import { randomBytes } from "node:crypto";
import type { OAuthClientInformationFull, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";

// ── Helpers ───────────────────────────────────────────────────────────

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function generateMcpTokens(expiresInSeconds = 3600): OAuthTokens {
  return {
    access_token: generateToken(),
    refresh_token: generateToken(),
    token_type: "Bearer",
    expires_in: expiresInSeconds,
  };
}

// ── Client registrations ─────────────────────────────────────────────

const clientRegistrations = new Map<string, OAuthClientInformationFull>();

export function getClientRegistration(clientId: string): OAuthClientInformationFull | undefined {
  return clientRegistrations.get(clientId);
}

export function saveClientRegistration(clientId: string, info: OAuthClientInformationFull): void {
  clientRegistrations.set(clientId, info);
}

// ── Pending authorizations ───────────────────────────────────────────
//  Keyed by our random `state` sent to Buildin.ai.

export interface PendingAuth {
  /** MCP client's redirect_uri */
  mcpRedirectUri: string;
  /** PKCE code_challenge from MCP client */
  codeChallenge: string;
  /** MCP client's original state */
  mcpState?: string;
  /** Registered MCP client id */
  clientId: string;
}

const pendingAuths = new Map<string, PendingAuth>();

export function savePendingAuth(state: string, data: PendingAuth): void {
  pendingAuths.set(state, data);
}

export function readPendingAuth(state: string): PendingAuth | undefined {
  return pendingAuths.get(state);
}

export function deletePendingAuth(state: string): void {
  pendingAuths.delete(state);
}

// ── Auth codes ───────────────────────────────────────────────────────
//  Keyed by our MCP auth code, created after Buildin.ai callback.

export interface AuthCodeData {
  buildinToken: string;
  codeChallenge: string;
  clientId: string;
  redirectUri: string;
}

const authCodes = new Map<string, AuthCodeData>();

export function saveAuthCode(code: string, data: AuthCodeData): void {
  authCodes.set(code, data);
}

export function readAuthCode(code: string): AuthCodeData | undefined {
  return authCodes.get(code);
}

export function deleteAuthCode(code: string): void {
  authCodes.delete(code);
}

// ── Installations (MCP token → Buildin.ai token) ────────────────────

export interface McpInstallation {
  buildinToken: string;
  clientId: string;
  mcpTokens: OAuthTokens;
  issuedAt: number; // epoch seconds
}

const installations = new Map<string, McpInstallation>();

export function saveMcpInstallation(mcpAccessToken: string, inst: McpInstallation): void {
  installations.set(mcpAccessToken, inst);
}

export function readMcpInstallation(mcpAccessToken: string): McpInstallation | undefined {
  return installations.get(mcpAccessToken);
}

export function deleteMcpInstallation(mcpAccessToken: string): void {
  installations.delete(mcpAccessToken);
}

// ── Refresh tokens ───────────────────────────────────────────────────

const refreshTokens = new Map<string, string>(); // refreshToken → mcpAccessToken

export function saveRefreshToken(refreshToken: string, mcpAccessToken: string): void {
  refreshTokens.set(refreshToken, mcpAccessToken);
}

export function readRefreshToken(refreshToken: string): string | undefined {
  return refreshTokens.get(refreshToken);
}

export function deleteRefreshToken(refreshToken: string): void {
  refreshTokens.delete(refreshToken);
}
