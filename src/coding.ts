import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { configDir, dataRoot, privateDir, repoRoot } from "./paths.js";
import { CLAUDE_API_KEY_ENV, readProviders } from "./providers.js";
import { subscriptionEnv } from "./security.js";
import { atomicJson } from "./state.js";
import { connectorCredentialNames } from "./connectors.js";
import { readRouting, providerId } from "./routing.js";

export function codingArgs(args: string[]): string[] {
  if (args.some(arg => ["--help", "-h", "--version"].includes(arg))) return args;
  const has = (name: string) => args.some(arg => arg === name || arg.startsWith(name + "="));
  const extra: string[] = [];
  const policy = readRouting().profiles.coding;
  if (!has("--model") && !has("--provider")) {
    const provider = providerId(policy.providers[0]!);
    if (["claude-bridge", "gemini-cli-acp"].includes(provider)) throw new Error("This subscription transport runs in Pi. Select an OMP-compatible coding provider in lemmaduck routing.");
    const exact = Object.entries(policy.models).find(([id]) => providerId(id) === provider)?.[1];
    extra.push(exact ? "--model" : "--provider", exact ? `${provider}/${exact}` : provider);
  }
  if (!has("--thinking")) extra.push("--thinking", policy.thinking);
  if (!has("--append-system-prompt")) extra.push("--append-system-prompt", join(repoRoot, "config/coding.md"));
  return [...extra, ...args];
}

export function codingEnv(): NodeJS.ProcessEnv {
  const env = subscriptionEnv();
  const connectorNames = new Set(connectorCredentialNames());
  for (const key of Object.keys(env)) {
    if (key === "OMP_PROFILE" || key.startsWith("OMP_AUTH_BROKER_") || key === "CLAUDE_CONFIG_DIR" ||
        key === "PI_PROXY" || key.startsWith("PI_PROXY_") || (/^LEMMADUCK_(WORK|PERSONAL)_/.test(key) && !connectorNames.has(key))) delete env[key];
  }
  env.PI_CONFIG_DIR = privateDir(join(dataRoot, "omp"));
  env.PI_CODING_AGENT_DIR = privateDir(join(env.PI_CONFIG_DIR, "agent"));
  env.PI_CONFIG_FILES = join(privateDir(configDir), "omp-code.yml");
  const registered = readProviders();
  const consoleApi = Boolean(env[CLAUDE_API_KEY_ENV]) && registered.some(p => p.id === "anthropic" && p.billing === "api" && !p.baseUrl);
  const routes = registered.filter(p => p.baseUrl && p.id !== "anthropic" &&
    (p.billing === "local" || (p.billing === "api" && p.apiKeyEnv && env[p.apiKeyEnv])));
  const models = Object.fromEntries(routes.map(p => [p.id, {
    baseUrl: p.baseUrl, api: p.api, models: p.models,
    ...(p.apiKeyEnv ? { apiKey: p.apiKeyEnv } : { auth: "none" }),
  }]));
  const allowed = ["openai-codex", ...(consoleApi ? ["anthropic"] : []), ...routes.map(p => p.id)];
  const catalog: { providers: string[] } = JSON.parse(readFileSync(join(repoRoot, "locks/omp-providers.json"), "utf8"));
  // OMP reads JSON as YAML. Avoid waking an active session's file watcher on every CLI probe.
  const write = (file: string, value: object) => {
    if (!existsSync(file) || readFileSync(file, "utf8") !== JSON.stringify(value, null, 2) + "\n") atomicJson(file, value);
  };
  write(join(env.PI_CODING_AGENT_DIR, "models.yml"), { providers: {
    ...models, ...(consoleApi ? { anthropic: { baseUrl: "https://api.anthropic.com", apiKey: CLAUDE_API_KEY_ENV, auth: "apiKey" } } : {}),
  } });
  write(env.PI_CONFIG_FILES, {
    // enabledModels filters selection. disabledProviders also stops built-in catalog discovery.
    disabledProviders: [...new Set([...catalog.providers, "ollama", "lm-studio", "llama.cpp", "apple", "local", "web", "claude", "claude-plugins"])].filter(id => !allowed.includes(id)),
    enabledModels: allowed.map(id => id + "/*"),
    retry: { modelFallback: false, usageAwareFallback: false }, contextPromotion: { enabled: false },
  });
  return env;
}
