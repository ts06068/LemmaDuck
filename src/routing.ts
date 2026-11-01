import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { configDir, repoRoot, privateDir } from "./paths.js";
import { ALIASES } from "./providers.js";

export const PROFILES = ["routine", "writing", "reasoning", "abduction", "coding"] as const;
export type Profile = typeof PROFILES[number];
export const THINKING = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;
export type Thinking = typeof THINKING[number];
export type RoutingPolicy = { providers: string[]; thinking: Thinking; models: Record<string, string> };
export type RoutingConfig = { version: 1; defaultProfile: Profile; profiles: Record<Profile, RoutingPolicy> };
export type Route = { profile: Profile; provider: string; model: string; requestedThinking: Thinking; appliedThinking?: string; reason: string; at: string };
export const routingFile = join(configDir, "routing.json");
export const providerId = (value: string) => ALIASES[value] || value;

export function readRouting(): RoutingConfig {
  const defaults = JSON.parse(readFileSync(join(repoRoot, "config/routing.json"), "utf8")) as RoutingConfig;
  if (!existsSync(routingFile)) return defaults;
  const supplied = JSON.parse(readFileSync(routingFile, "utf8"));
  if (!supplied || Array.isArray(supplied) || supplied.version !== 1 || Object.keys(supplied).some(k => !["version", "defaultProfile", "profiles"].includes(k)) || (supplied.defaultProfile !== undefined && !PROFILES.includes(supplied.defaultProfile))) throw new Error("Invalid routing configuration version, fields or defaultProfile.");
  if (supplied.profiles === null || (supplied.profiles !== undefined && (typeof supplied.profiles !== "object" || Array.isArray(supplied.profiles)))) throw new Error("routing.profiles must be an object.");
  for (const [key, value] of Object.entries(supplied.profiles || {})) {
    if (!PROFILES.includes(key as Profile) || !value || typeof value !== "object" || Array.isArray(value)) throw new Error("Unknown routing profile.");
    const patch = value as Partial<RoutingPolicy>;
    if (Object.keys(patch).some(k => !["providers", "thinking", "models"].includes(k))) throw new Error("Unknown routing policy field.");
    const policy = { ...defaults.profiles[key as Profile], ...patch };
    if (!Array.isArray(policy.providers) || !policy.providers.length || policy.providers.some(id => typeof id !== "string" || !/^[a-z][a-z0-9-]*$/.test(id))) throw new Error("A route needs provider IDs in preference order.");
    if (!THINKING.includes(policy.thinking)) throw new Error("Unsupported reasoning level in routing configuration.");
    if (!policy.models || typeof policy.models !== "object" || Array.isArray(policy.models) || Object.entries(policy.models).some(([id, model]) => !policy.providers.some(p => providerId(p) === providerId(id)) || typeof model !== "string" || !model.trim() || /[\r\n]/.test(model))) throw new Error("Model overrides must map a configured provider to an exact model ID.");
    defaults.profiles[key as Profile] = policy;
  }
  if (supplied.defaultProfile) defaults.defaultProfile = supplied.defaultProfile;
  return defaults;
}

export function classifyRequest(text: string, fallback: Profile = "reasoning"): { profile: Profile; reason: string } {
  const rules: [Profile, RegExp][] = [
    ["abduction", /\babduct(?:ion|ive)\b|귀추|가설|hypothes(?:is|es)|competing explanations/i],
    ["reasoning", /\breason(?:ing)?\b|causal|counterfactual|\bproof\b|research design|statistical|인과|추론|추리|논증|증명|기전|통계|연구\s*설계/i],
    ["writing", /manuscript|proofread|deslop|translate|translation|문장|퇴고|번역|교정|원고|문체/i],
    ["routine", /\be-?mail\b|\breply\b|calendar|schedule|remind|메일|답장|회신|일정|미팅|회의|알림/i],
    ["coding", /\bcode\b|coding|\bbug\b|debug|refactor|implement|코드|코딩|개발|버그|구현|리팩터/i],
  ];
  const match = rules.find(([, pattern]) => pattern.test(text));
  return { profile: match?.[0] || fallback, reason: match ? "Task cues in the user's request (heuristic)" : "Configured default; no task cue matched" };
}

export function chooseRoute<T extends { provider: string; id: string; reasoning: boolean }>(profile: Profile, models: T[], ready: (provider: string) => boolean, defaults: Record<string, string>, config = readRouting()): { route: Route; model: T } {
  const policy = config.profiles[profile];
  for (const name of policy.providers) {
    const provider = providerId(name);
    if (!ready(provider)) continue;
    const candidates = models.filter(model => model.provider === provider);
    const exact = Object.entries(policy.models).find(([id]) => providerId(id) === provider)?.[1];
    const model = exact ? candidates.find(model => model.id === exact) : candidates.find(model => model.id === defaults[provider]) || candidates[0];
    if (model) return { model, route: { profile, provider, model: model.id, requestedThinking: policy.thinking, reason: exact ? "Configured model override" : "Configured provider order and runtime model default", at: new Date().toISOString() } };
  }
  throw new Error(`No ready model for ${profile}. Check login, billing confirmation and the exact model IDs in ${routingFile}.`);
}

export function routeInstructions(profile?: Profile): string {
  const file = profile === "writing" || profile === "routine" ? "writing.md" : profile === "abduction" ? "abduction.md" : undefined;
  return file ? readFileSync(join(repoRoot, "config", file), "utf8") : "";
}

export function routingCommand(op = "show"): void {
  if (op === "path") { console.log(routingFile); return; }
  if (op === "init") {
    privateDir(configDir);
    writeFileSync(routingFile, readFileSync(join(repoRoot, "config/routing.json")), { flag: "wx", mode: 0o600 });
    console.log(`Created ${routingFile}. Edit provider order, exact model IDs and reasoning levels, then use /ask.`); return;
  }
  if (op !== "show") throw new Error("Use: duck routing show|path|init");
  console.log(JSON.stringify(readRouting(), null, 2));
}
