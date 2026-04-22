/**
 * All logging MUST go to stderr. stdout is reserved for the MCP JSON-RPC channel.
 * Do NOT use console.log anywhere in this project.
 */

type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, msg: string, meta?: Record<string, unknown>): void {
  const line = meta && Object.keys(meta).length > 0
    ? `[buildin-mcp] ${level.toUpperCase()} ${msg} ${safeJson(meta)}`
    : `[buildin-mcp] ${level.toUpperCase()} ${msg}`;
  process.stderr.write(line + "\n");
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return "[unserializable]";
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => {
    if (process.env.BUILDIN_MCP_DEBUG === "1") emit("debug", msg, meta);
  },
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};
