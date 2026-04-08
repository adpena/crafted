# Crafted Action Pages — MCP Server

Crafted exposes a JSON-RPC 2.0 Model Context Protocol (MCP) endpoint so AI
agents — Claude Desktop, Claude Code, or any MCP-compatible client — can
create, inspect, and manage campaign action pages directly.

- **Endpoint:** `https://adpena.com/api/mcp/actions`
- **Protocol:** JSON-RPC 2.0 over HTTPS
- **Auth:** `Authorization: Bearer $MCP_ADMIN_TOKEN` header (required for
  writes; read-only tools work unauthenticated)

---

## Connecting Claude Desktop

Claude Desktop uses the `mcp-remote` bridge to talk to remote MCP servers.
Add the following block to your `claude_desktop_config.json` (located at
`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "crafted-action-pages": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://adpena.com/api/mcp/actions"],
      "env": {
        "MCP_ADMIN_TOKEN": "your-token-here"
      }
    }
  }
}
```

Restart Claude Desktop. The `crafted-action-pages` server should appear in
the tools menu, and Claude will be able to call any of the tools listed
below.

### Claude Code

Claude Code reads MCP servers from `.mcp.json` at the project root:

```json
{
  "mcpServers": {
    "crafted-action-pages": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://adpena.com/api/mcp/actions"],
      "env": {
        "MCP_ADMIN_TOKEN": "your-token-here"
      }
    }
  }
}
```

### Generating a token

```bash
openssl rand -hex 32
```

Store the value in Cloudflare with
`wrangler secret put MCP_ADMIN_TOKEN` and paste the same value into your
client config.

---

## Available tools

| Tool              | Auth  | Purpose                                                        |
| ----------------- | ----- | -------------------------------------------------------------- |
| `list_templates`  | read  | Enumerate the 5 hero/layout templates and their prop schemas.  |
| `list_actions`    | read  | Enumerate supported action types and required `action_props`.  |
| `list_themes`     | read  | Enumerate preset themes (editorial, neon, muted, etc.).        |
| `generate_theme`  | read  | Derive a theme from a seed URL or brand color.                 |
| `list_pages`      | read  | List every published action page with slugs and basic meta.    |
| `get_page`        | read  | Fetch a single page's full config by slug.                     |
| `create_page`     | write | Create a new action page from template + action + theme.      |
| `get_submissions` | write | Query submissions for a page (sensitive — treated as write).   |

---

## Example conversations

### Create a petition

> "Create a petition page about fully funding public schools, targeting
> Congress. Use the hero-story template, the editorial theme, and set the
> signature goal to 50,000."

Claude will call `list_templates` and `list_actions` to confirm schemas,
then `create_page` with the resolved props.

### Audit your pages

> "List all my action pages and show me which ones have the most
> signatures. Sort by descending submission count and include the creation
> date."

Claude will call `list_pages`, then `get_submissions` per page, and roll
the results up into a table.

### A/B test review

> "Show me the conversion rate on the climate-action-now page's A/B
> test. Which variant is winning?"

Claude will call `get_page` to pull the variant config, `get_submissions`
for each variant, and compute the conversion rate as submissions /
unique visitors.

### Theme from a brand URL

> "Generate a theme that matches https://example.org and apply it to a
> new GOTV pledge page for the November election."

Claude will call `generate_theme` with the URL, then `create_page`
passing the derived theme tokens.

---

## Raw JSON-RPC

If you'd rather poke the endpoint directly:

```bash
curl -sS https://adpena.com/api/mcp/actions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MCP_ADMIN_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "list_pages",
    "params": {}
  }'
```

Read-only tools (`list_pages`, `get_page`, `list_templates`,
`list_actions`, `list_themes`, `generate_theme`) work without the
`Authorization` header. Everything else returns `-32001 Unauthorized`
unless the bearer token matches `MCP_ADMIN_TOKEN`.

---

## Security

- Writes are gated behind `MCP_ADMIN_TOKEN` with constant-time comparison
  to prevent timing attacks.
- All URL-shaped inputs are forced through HTTPS validation.
- String inputs are sanitized (HTML stripped, control characters removed,
  clamped to 200 chars) before they hit D1.
- Rotate `MCP_ADMIN_TOKEN` on a schedule — anyone with the token can
  create pages and read submitter PII.
