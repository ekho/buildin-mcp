# buildin-mcp

An MCP (Model Context Protocol) server exposing the [Buildin.ai](https://buildin.ai) REST API to LLMs (Claude Desktop, Claude Code, Cursor, etc.).

Covers the full public API surface: **pages, databases, blocks, search, and users** — create, read, update, archive, query — plus three convenience helpers that work with Markdown.

## Tools (19 total)

### Pages (5)
- `buildin_create_page` — POST /v1/pages
- `buildin_get_page` — GET /v1/pages/{id}
- `buildin_update_page` — PATCH /v1/pages/{id}
- `buildin_archive_page` — PATCH /v1/pages/{id} with `archived=true`
- `buildin_get_page_children` — GET /v1/blocks/{page_id}/children

### Databases (4)
- `buildin_create_database` — POST /v1/databases
- `buildin_get_database` — GET /v1/databases/{id}
- `buildin_query_database` — POST /v1/databases/{id}/query
- `buildin_update_database` — PATCH /v1/databases/{id}

### Blocks (5)
- `buildin_get_block` — GET /v1/blocks/{id}
- `buildin_get_block_children` — GET /v1/blocks/{id}/children
- `buildin_append_block_children` — PATCH /v1/blocks/{id}/children
- `buildin_update_block` — PATCH /v1/blocks/{id}
- `buildin_delete_block` — DELETE /v1/blocks/{id}

### Search & Users (2)
- `buildin_search` — POST /v1/search
- `buildin_get_me` — GET /v1/users/me

### Markdown helpers (3)
- `buildin_append_markdown` — convert Markdown to Buildin blocks and append
- `buildin_get_page_markdown` — read a page's contents as Markdown
- `buildin_search_and_fetch` — search + auto-fetch contents of the top N pages

> Buildin.ai does not expose a Comments API or a hard-delete for pages — archive is the documented way to remove pages.

## Quick start (npx — no install needed)

```bash
BUILDIN_API_TOKEN=sk-... npx buildin-mcp
```

That's it. The server starts on stdio and is ready to accept MCP requests.

## Usage with MCP clients

### Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "buildin": {
      "command": "npx",
      "args": ["-y", "buildin-mcp"],
      "env": {
        "BUILDIN_API_TOKEN": "sk-..."
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add buildin -e BUILDIN_API_TOKEN=sk-... -- npx -y buildin-mcp
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "buildin": {
      "command": "npx",
      "args": ["-y", "buildin-mcp"],
      "env": {
        "BUILDIN_API_TOKEN": "sk-..."
      }
    }
  }
}
```

### Windsurf / OpenCode / any stdio MCP client

```bash
BUILDIN_API_TOKEN=sk-... npx -y buildin-mcp
```

## Install from source (optional)

If you prefer a local clone instead of npx:

```bash
git clone https://github.com/ekho/buildin-mcp.git
cd buildin-mcp
npm install
npm run build
node dist/index.js
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `BUILDIN_API_TOKEN` | **yes** | Buildin.ai bot/integration token |
| `BUILDIN_API_BASE_URL` | no | Override API base (default: `https://api.buildin.ai/v1`) |
| `BUILDIN_MCP_DEBUG` | no | Set to `1` for verbose debug logging to stderr |

## Verify

```bash
npm run typecheck        # tsc --noEmit
npm run build            # compiles to dist/
npm test                 # unit tests for markdown converters
npm run smoke            # stdio JSON-RPC: initialize + tools/list must return 19 tools
```

Live smoke against Buildin.ai (optional):

```bash
BUILDIN_API_TOKEN=... node -e "
  import('./dist/tools/users.js').then(async () => {
    const { buildinFetch } = await import('./dist/http/client.js');
    console.log(await buildinFetch('GET', '/users/me'));
  });
"
```

## Development

- **Runtime:** Node 18+, TypeScript 5.6, ESM.
- **Transport:** stdio only.
- **Logging:** stderr only — stdout is reserved for MCP JSON-RPC. Never `console.log`.
- **Retries:** automatic on 429 and 5xx (except 501), exponential backoff, 3 attempts.

## License

MIT
