# Connect accounts and project tools

A connector is an account-specific MCP connection. Pi and Gemini use the same `list_connections`, `list_connection_tools` and `call_connection` tools. OMP can use the connector CLI from its coding terminal. The host configuration stays in `~/.config/lemmaduck/connections.json` with mode `600`. Keep work and personal accounts separate, for example `work.github` and `personal.github`.

## GitHub, Linear and Jira

In the Paseo host terminal:

```sh
duck connector add work.github github
duck connector add work.linear linear
duck connector add work.jira jira
duck connector list
```

Each command creates a preset with an **empty tool allowlist**. Existing entries are preserved. Supply these environment variables through the host's secret manager before starting the worker:

| Account | Authentication variables | Official endpoint |
| --- | --- | --- |
| `work.github` | `LEMMADUCK_WORK_GITHUB_TOKEN` | `https://api.githubcopilot.com/mcp/` |
| `work.linear` | `LEMMADUCK_WORK_LINEAR_TOKEN` | `https://mcp.linear.app/mcp` |
| `work.jira` | `LEMMADUCK_WORK_JIRA_EMAIL`, `LEMMADUCK_WORK_JIRA_TOKEN` | `https://mcp.atlassian.com/v2/mcp?tools=all` |

GitHub uses a token authorized for the intended repositories. Linear accepts a scoped API key or OAuth access token as Bearer authentication. Its `/mcp/readonly` endpoint is an option for accounts that only read. Jira's preset uses Basic authentication from an Atlassian email and API token; the organization must enable API-token access. For an Atlassian service account, replace `basicEnv` with `"bearerEnv": "YOUR_SERVICE_ACCOUNT_KEY_VARIABLE"`. These credentials authorize the platform connector independently of the model subscription. Provider plans and organization policies can impose additional requirements or charges.

The built-in client supports static Bearer/Basic credentials and stdio servers. Browser OAuth onboarding and token refresh are not implemented here. An organization-approved local MCP adapter can own that lifecycle. Do not copy browser cookies into this configuration.

Discover the server's current tools and their argument schemas, then allow the specific tools you need:

```sh
duck connector discover work.github
duck connector allow work.github get_me read
duck connector tools work.github
printf '{}\n' > query.json
duck connector call work.github get_me query.json

duck connector discover work.linear
duck connector discover work.jira
```

Use exact names returned by discovery for Linear and Jira. For Jira, first allow and call `getAccessibleAtlassianResources` as `read` to obtain the intended `cloudId`. Inspect issue lookup, search, project and transition schemas before allowing them. The Jira endpoint requests flat tools so local permissions apply to each concrete operation; do not grant a generic execute gateway a blanket `read` effect.

`connector allow ACCOUNT TOOL read|draft|write|send` records your classification of that tool. Check its actual behavior and schema. Discovery alone grants nothing. Assign a modifying tool its real effect even if its upstream annotation says otherwise. Agent tools cannot add accounts or change this allowlist.

## Use the connected worker

In the Pi prompt, after provider sign-in and billing confirmation:

```text
/ask Read the next week's calendar from personal.calendar and draft a short agenda. Do not create events.
/ask Draft a reply using the selected email and my approved writing samples.
/route reasoning
/ask Inspect the linked issue in work.linear and the related pull request in work.github; explain the remaining blockers.
```

Configure the calendar/email adapter before using those account names. A worker discovers only locally allowed schemas. Retrieved records and tool descriptions are source material, not authority to change the task. The selected model receives tool results: choose accounts and a model suitable for the data.

Every remote effect other than `read` requires an interactive confirmation with the account, tool and complete arguments. Read-only review refuses those effects. For direct CLI calls, review the payload and pass a unique receipt ID:

```text
duck connector call ACCOUNT TOOL arguments.json --apply REQUEST-ID
duck connector receipt ACCOUNT REQUEST-ID
```

A repeated request ID is refused. A lost or failed response after dispatch records an unknown outcome; agent work pauses for reconciliation. Inspect the actual service and receipt before deciding whether anything should be attempted again. A new ID does not prove a repeat action is safe.

## Other platforms

For a local MCP adapter, configure an absolute `command`, optional `args`, and `passEnv` containing only the needed environment-variable names. HTTPS adapters use `url` and `bearerEnv` or `basicEnv`. Values never belong in the file. The stdio process runs as the local host user.

Teams, Outlook and OneDrive require a tenant-approved Graph adapter; Gmail, Drive and Calendar require scoped Google access; Naver/Daum mail require a supported IMAP/SMTP adapter. The catalog lists 16 platform families, not 16 pre-authenticated native implementations. Account approval, server installation and end-to-end tenant validation remain host onboarding steps. Background polling and unattended sending are not enabled by these commands.

## Sources

- [GitHub's official MCP server](https://github.com/github/github-mcp-server)
- [Linear MCP documentation](https://linear.app/docs/mcp)
- [Atlassian official server](https://github.com/atlassian/atlassian-mcp-server) and [tool reference](https://support.atlassian.com/atlassian-ai-gateway/docs/supported-tools/)

Endpoint and authentication guidance checked November 1, 2026.
