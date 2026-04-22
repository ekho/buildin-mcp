/**
 * Error types for the Buildin.ai API and mapping helpers for MCP tool responses.
 */

export class BuildinApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly body: unknown;
  readonly method: string;
  readonly path: string;

  constructor(args: {
    method: string;
    path: string;
    status: number;
    code?: string;
    body: unknown;
    message: string;
  }) {
    super(args.message);
    this.name = "BuildinApiError";
    this.method = args.method;
    this.path = args.path;
    this.status = args.status;
    this.code = args.code;
    this.body = args.body;
  }

  toUserMessage(): string {
    const codeFragment = this.code ? ` code=${this.code}` : "";
    return `Buildin API ${this.method} ${this.path} failed: HTTP ${this.status}${codeFragment} — ${this.message}`;
  }
}

export class BuildinConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BuildinConfigError";
  }
}

/**
 * Convert any thrown value into a string suitable for returning to the LLM.
 * Never leaks stack traces to the caller.
 */
export function formatErrorForTool(err: unknown): string {
  if (err instanceof BuildinApiError) return err.toUserMessage();
  if (err instanceof BuildinConfigError) return `Configuration error: ${err.message}`;
  if (err instanceof Error) return `Unexpected error: ${err.message}`;
  return `Unexpected error: ${String(err)}`;
}
