/**
 * Thin HTTP client for the Buildin.ai REST API.
 *
 * Features:
 *   - Reads BUILDIN_API_TOKEN / BUILDIN_API_BASE_URL from env (lazy, so tests can set env after import).
 *   - Automatic JSON encode/decode.
 *   - Retries on 429 and 5xx (excluding 501) with exponential backoff, up to 3 tries.
 *   - Maps non-2xx responses to BuildinApiError with the server's message/code when present.
 */

import { BuildinApiError, BuildinConfigError } from "./errors.js";
import { logger } from "../util/logger.js";

const DEFAULT_BASE_URL = "https://api.buildin.ai/v1";
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 400;

type Method = "GET" | "POST" | "PATCH" | "DELETE";

export interface BuildinFetchOptions {
  query?: Record<string, string | number | boolean | undefined>;
  /** Override base url / token for tests. */
  baseUrl?: string;
  token?: string;
  /** Disable retries (useful for tests). */
  noRetry?: boolean;
}

function getConfig(opts: BuildinFetchOptions = {}): { baseUrl: string; token: string } {
  const baseUrl = (opts.baseUrl ?? process.env.BUILDIN_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const token = opts.token ?? process.env.BUILDIN_API_TOKEN ?? "";
  if (!token) {
    throw new BuildinConfigError(
      "BUILDIN_API_TOKEN is not set. Export it in the environment or in your MCP client config before starting buildin-mcp.",
    );
  }
  return { baseUrl, token };
}

function buildUrl(baseUrl: string, path: string, query?: BuildinFetchOptions["query"]): string {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(baseUrl + normalised);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.append(k, String(v));
    }
  }
  return url.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(status: number): boolean {
  return status === 429 || (status >= 500 && status !== 501);
}

export async function buildinFetch<T = unknown>(
  method: Method,
  path: string,
  body?: unknown,
  options: BuildinFetchOptions = {},
): Promise<T> {
  const { baseUrl, token } = getConfig(options);
  const url = buildUrl(baseUrl, path, options.query);

  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  const maxAttempts = options.noRetry ? 1 : MAX_ATTEMPTS;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (networkErr) {
      lastErr = networkErr;
      logger.warn("network error", { method, path, attempt, err: String(networkErr) });
      if (attempt >= maxAttempts) {
        throw new BuildinApiError({
          method,
          path,
          status: 0,
          body: null,
          message: `network error: ${String(networkErr)}`,
        });
      }
      await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
      continue;
    }

    // Parse response body. Some endpoints (DELETE) may return empty or non-JSON.
    const rawText = await response.text();
    let parsed: unknown;
    if (rawText.length === 0) {
      parsed = null;
    } else {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = rawText;
      }
    }

    if (response.ok) {
      return parsed as T;
    }

    const { message, code } = extractApiError(parsed, response.statusText);

    if (shouldRetry(response.status) && attempt < maxAttempts) {
      const delay = BASE_BACKOFF_MS * 2 ** (attempt - 1);
      logger.warn("retrying buildin request", {
        method,
        path,
        attempt,
        status: response.status,
        delay_ms: delay,
      });
      await sleep(delay);
      continue;
    }

    throw new BuildinApiError({
      method,
      path,
      status: response.status,
      code,
      body: parsed,
      message,
    });
  }

  // Should be unreachable but keeps TS happy.
  throw lastErr ?? new BuildinApiError({ method, path, status: 0, body: null, message: "unknown error" });
}

function extractApiError(body: unknown, fallback: string): { message: string; code?: string } {
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    const message =
      typeof obj.message === "string" ? obj.message :
      typeof obj.error === "string" ? obj.error :
      typeof (obj.error as { message?: unknown } | undefined)?.message === "string" ? (obj.error as { message: string }).message :
      fallback;
    const code =
      typeof obj.code === "string" ? obj.code :
      typeof (obj.error as { code?: unknown } | undefined)?.code === "string" ? (obj.error as { code: string }).code :
      undefined;
    return { message, code };
  }
  if (typeof body === "string" && body.length > 0) return { message: body.slice(0, 500) };
  return { message: fallback };
}
