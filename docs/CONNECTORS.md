# Connect a work or personal account

`lemmaduck connector list` shows the 15 platform families in the design and locally configured accounts. An account name such as `work.github` and one such as `personal.github` identify separate connections. The CLI supports **MCP over HTTPS** (or loopback HTTP) and **local stdio MCP servers**. Each server supplies its own platform integration and OAuth scopes. A missing integration stays unconfigured. A ChatGPT or Herdr login does not authorize any of these servers.

Create `~/.config/lemmaduck/connections.json` on the host where you run the CLI. Set permissions to `600` and keep it outside your Git projects. Only configure servers and tool names you have verified. For GitHub's official remote MCP endpoint, a read-only example is:

```json
{
  "work.github": {
    "platform": "github",
    "url": "https://api.githubcopilot.com/mcp/",
    "bearerEnv": "LEMMADUCK_WORK_GITHUB_TOKEN",
    "tools": { "get_me": "read" }
  }
}
```

Provide the environment variable through your host's credential manager. Keep the token limited to the intended account and repositories. Run `lemmaduck connector tools work.github` to see the intersection of the server's tools and your allowlist. The server must accept the credential you supply. [GitHub MCP server and authentication](https://github.com/github/github-mcp-server)

```sh
printf '{}\n' > query.json
lemmaduck connector call work.github get_me query.json
```

For a local MCP server use `"command": "/absolute/path/to/server"` with an optional `"args": []` and `"passEnv": ["ACCOUNT_SPECIFIC_VARIABLE"]` in place of `url` and `bearerEnv`. The command runs directly as the local user. Use one server and credentials per account. For Teams/Outlook/OneDrive use a tenant-approved Graph adapter. For Gmail/Drive/Calendar use an OAuth-scoped Google adapter. Naver and Daum mail require a separate IMAP/SMTP-to-MCP adapter and the account's supported authentication. See the [catalog](../catalog/full.json) for the protocol and action boundaries of every platform family.

Each allowed tool has a locally assigned effect, one of `read`, `draft`, `write` or `send`. Confirm its actual behavior before assigning the effect. The terminal operator supplies `--apply REQUEST-ID` for any effect other than read. Review the account, recipient, content and attachment before sending. A repeated request ID is refused within that account. The local receipt records the tool, argument digest and state. If the connection breaks, inspect the provider for the original effect before acting again.

```text
lemmaduck connector call ACCOUNT TOOL arguments.json --apply REQUEST-ID
lemmaduck connector receipt ACCOUNT REQUEST-ID
```

The connector CLI does not automatically expose all account tools to the Pi worker. Local receipts and project drafts can be selected as task inputs after reviewing their contents. Organization onboarding, background polling, scheduled sending and a native adapter for each platform are tracked in the full design.
