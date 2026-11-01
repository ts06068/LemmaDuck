# Task-level model routing

Paseo is the workbench. OMP runs code development; Pi runs research, writing and assistant work. VS Code remains an editor and project browser. Model choice happens inside those workers.

## Default policy

| Work | Worker | Provider preference | Requested reasoning |
| --- | --- | --- | --- |
| Schedules, email and routine assistance | Pi | Gemini | low |
| Manuscript sentences, translation and editing | Pi | Gemini | medium |
| Proofs, analysis and research design | Pi | ChatGPT, then Claude | high |
| Abduction and competing explanations | Pi | ChatGPT, then Claude | high |
| Code development | OMP | ChatGPT | medium |

In Pi, `/ask REQUEST` classifies a new task segment using Korean/English task cues, picks the first ready provider in that profile, resolves an available model, checkpoints the task, and opens a fresh session with the request exactly once. Ordinary follow-ups stay with the active worker. `/route writing`, `/route reasoning` or `/route abduction` overrides classification for subsequent `/ask` requests; `/route auto` restores it. `/route` shows the last decision.

The router checks local authentication availability, subscription billing confirmation and configured models. It does not make a trial cloud request. An expired token can still fail on first use. If no eligible route exists, it stops and explains how to configure one. Quota errors pause work; there is no automatic error-driven switch to another account or paid API. `/switch` and `/review` remain explicit manual choices.

Classification is a transparent heuristic. It cannot establish that a model is optimal, measure problem difficulty reliably, or replace a domain evaluation. Mixed requests may need an explicit profile. Coding requests detected in Pi direct you to `duck code PATH`.

## Customize providers, models and effort

```sh
duck routing show
duck routing init
duck routing path
```

`init` creates an owner-only file and refuses to overwrite an existing one. Edit the path it prints. Defaults are in [config/routing.json](../config/routing.json). A partial override can prefer Claude for abduction:

```json
{
  "version": 1,
  "profiles": {
    "abduction": { "providers": ["claude", "chatgpt"], "thinking": "high" }
  }
}
```

Each profile can also set `models` to an object mapping a provider alias to an **exact available model ID**. Obtain IDs from the worker's model picker; registered providers must be added with `duck providers add` first. An unavailable exact ID is never silently replaced by another model from that provider. With no override, Pi uses its pinned runtime default if present, otherwise the first available model for the provider.

Reasoning values are `off`, `minimal`, `low`, `medium`, `high`, `xhigh`. Pi clamps the requested level to the selected model's supported levels. The task journal records both requested and applied values. Models without a reasoning control record `unsupported (off)`. The current Gemini ACP route records **provider-managed**: its account runtime chooses the actual model/effort, and observed model IDs are recorded when reported. A requested Gemini level is a policy preference, not a verified setting sent to Google.

OMP receives the coding profile's first provider, optional exact model and thinking level at launch. Explicit `--model`, `--provider`, `--thinking`, and the Paseo model selection take precedence. OMP handles later `/model` changes. Its native `--smol`, `--slow` and `--plan` roles are available for explicitly chosen models; this release does not add an independent per-token difficulty judge or automatic billing fallback. Claude subscription routing remains through the official Claude Code/Agent SDK route in Pi. An OMP Anthropic API route requires explicit paid-API registration and credentials.

## Task instructions

Writing/routine routes receive [writing rules](../config/writing.md); abduction receives [hypothesis rules](../config/abduction.md). Coding launches append [development rules](../config/coding.md). Approved project instructions and attached workflows continue to supply subject-specific context. Use `/instructions` to review project instructions. The writing rules do not send mail or publish a manuscript by themselves.
