# Registering model providers

Paseo is the default workbench. OMP handles coding. Pi handles research, writing, read-only review and assistant tasks. Each engine keeps its own credentials and sessions.

Pi's default routes are ChatGPT (`openai-codex`), Claude (`claude-bridge`) and Gemini (`gemini-cli-acp`). `chatgpt` is the user-facing command and `gpt` remains a compatibility alias. Saved provider and model IDs remain valid.

## Claude subscriptions and the current policy

Checked on November 1, 2026. Anthropic's official guidance says that the metering change planned for June 15 is paused. Signing into the official Claude Agent SDK or `claude -p` with your own Claude plan still draws on subscription limits. Using a Console API key follows API billing. Some plans include monthly Console API credits, whose availability depends on the linked account. [Claude plan and Agent SDK guidance](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)

Third-party login permission remains conditional. Anthropic recommends API keys for third-party tools and separately restricts credential brokerage, login services for other users and attempts to present a third-party client as an official product. This personal harness uses the published Claude Code executable through the official SDK. [Login policy](https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account) · [Claude Code compliance](https://code.claude.com/docs/en/legal-and-compliance)

On the host, run these commands for your own Claude account.

```sh
duck login claude
duck billing confirm claude --extra-usage-off
duck agent /path/to/project --pi
```

The login command invokes official `claude auth login --claudeai` in a dedicated profile. Confirm billing only after checking your account's extra-usage and auto-refill settings. In Pi enter `/switch claude` and choose a model. LemmaDuck checks official `claude auth status --json` before selecting Claude and before a request. This verifies the local authentication route. Live entitlement and remaining usage are determined by Anthropic. [Authentication](https://code.claude.com/docs/en/authentication)

The managed runtime removes API-key and alternate billing variables from the inherited environment, requires the `claude-bridge` SDK transport, and pauses on quota errors. It retains the existing task journal and handoffs. The pinned `pi-claude-bridge` 0.8.0 works with Pi 0.87.1. Loading it directly into OMP 18.14.2 fails an extension import, so Claude subscription sessions use Pi. OMP coding supports the separately enabled Console API route below.

If you previously registered `anthropic --subscription`, that old registration is inactive. To remove its local credential and use the official route, run `duck providers remove anthropic`, then `duck login claude`. Removal also handles an orphaned direct Anthropic OAuth credential. It preserves other accounts.

### Explicit Claude Console API use

```sh
duck providers add anthropic --allow-paid-api
duck login anthropic
```

The second command explains how to supply `LEMMADUCK_MODEL_ANTHROPIC_KEY` through your host's secret manager. It does not open an OAuth prompt. The API route is labeled as potentially chargeable even when your Console account has credits. In OMP, both registration and the dedicated key must be present. The generated model configuration stores only the variable name. A quota-limited subscription never automatically enables this route.

## OMP coding accounts

Run `duck code /path/to/repo` in Paseo's terminal. For ChatGPT, enter `/login openai-codex` in OMP and complete your own account login, then choose a model with `/model`. Pi login and billing confirmations are scoped to Pi. Check OMP's account-side paid-extra settings separately.

For local or compatible hosted models, register a JSON endpoint as described below. OMP imports explicitly registered loopback models and API endpoints with their dedicated `LEMMADUCK_MODEL_*` key present. It uses the same profile when launched from **New Agent → LemmaDuck Code**. OMP's normal development tools and project instructions apply to these sessions.

OMP keeps its profile at `omp/agent` inside the LemmaDuck data directory. Generated `models.yml` and `config/omp-code.yml` select the allowed providers and disable automatic cross-model fallback. Built-in provider discovery is disabled for unselected providers using the catalog pinned to OMP 18.14.2. Register local models explicitly instead of relying on automatic localhost discovery. The profile is configuration isolation. An operating-system network boundary is still required for a restricted execution host.

## Pi provider catalog

Run `duck providers catalog` to see the built-in provider IDs supported by the pinned Pi version. Registering a route enables its available model catalog; account entitlements still determine which requests succeed. This supports Pi providers and compatible endpoints, not every proprietary web app or undocumented model protocol.

## API accounts

```sh
duck providers add openrouter --allow-paid-api
duck login openrouter
```

Use Pi's `/login openrouter` prompt to store your API credential privately. Restart the harness, then `/switch openrouter`. The picker/footer identifies API routes. Registration persists your explicit opt-in; there is no automatic subscription-to-API fallback.

Other built-in IDs from `duck providers catalog` use the same commands. Cloud providers may require additional provider-scoped credential configuration supported by Pi; do not put credentials into project files.

## Additional subscription OAuth

For another built-in provider whose terms support your subscription through OAuth, use the following commands. Claude uses the dedicated SDK route above.

```sh
duck providers add PROVIDER_ID --subscription --extra-usage-off
duck login PROVIDER_ID
```

First check account entitlement and extra-usage settings. Choose OAuth during login. API-key credentials are rejected for a route marked subscription. A provider's presence in Pi is not evidence that an arbitrary web subscription works with it.

## Local model servers

Adapt [ollama.json](../examples/providers/ollama.json) with the actual model ID and context limits configured on your server, then:

```sh
duck providers add /path/to/ollama.json
```

Start Ollama, LM Studio, vLLM or another compatible server yourself. The installer does not download model weights or start an inference server. Local routes must use loopback addresses. In WSL, `127.0.0.1` refers to the WSL networking environment; the easiest arrangement is to run the server inside the same distribution. A server on the Windows host requires appropriate networking and a deliberately registered endpoint.

The dummy local key is only a protocol placeholder. A reverse proxy listening on localhost could still forward to a paid service; the harness cannot inspect what that server does.

## Compatible hosted endpoints

Adapt [compatible-api.json](../examples/providers/compatible-api.json), then register it with `--allow-paid-api`. Supported endpoint protocols are `openai-completions`, `openai-responses`, `anthropic-messages` and `google-generative-ai`. Correct model IDs, endpoint compatibility and tool support remain the server's responsibility.

Use `duck login PROVIDER_ID` to store credentials or the explicitly named `LEMMADUCK_MODEL_*` variable in your endpoint configuration. Plain API keys, credential commands and arbitrary headers are not accepted in provider-registration JSON. Existing OpenAI/Anthropic/Google API environment variables remain stripped so adding an API account cannot change the default subscription workers' authentication.

The private registry lives at `config/providers.json` inside the harness data directory. The launcher generates Pi's private `models.json` from it. Project-level model/engine overrides remain blocked. Direct edits to the private registry are treated as user configuration; this is not an OS sandbox against processes running as the same user.

Remove an additional route with `duck providers remove ID`. This removes its local credential; it does not revoke tokens at the provider. Finish the current turn and restart after changing provider configuration. Handoffs, instructions, checkpoint approval and managed review restrictions apply to additional workers too.
