#!/usr/bin/env node
import { spawn, execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { billingConfirmed, claudeCLI, claudePlanSignedIn, configure, confirmBilling, googleACP, geminiHome, harnessEnv, piCLI } from "./config.js";
import { binDir, configDir, profileDir, projectPath, repoRoot } from "./paths.js";
import { assertManagedProject, assertPrivateAuthStore, assertProvider, billingEnvNames, PROVIDERS, type Provider } from "./security.js";
import { codingEnv, codingArgs } from "./coding.js";
import { acquireProjectLock, renderHandoff, TaskStore } from "./state.js";
import { workspaceName } from "./workspace-ui.js";
import { ALIASES, CLAUDE_API_KEY_ENV, enabledProviders, providerLabel, readProviders } from "./providers.js";
import { claudeExtensionPath } from "./dependencies.js";

function provider(value?: string): Provider { const p = ALIASES[value || ""] || value || ""; assertProvider(p); return p; }
async function run(command: string, args: string[], cwd: string, env = harnessEnv(), track?: (pid: number) => void): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: "inherit" });
    if (child.pid && track) track(child.pid);
    child.once("error", reject); child.once("exit", code => resolve(code ?? 1));
    const signal = () => child.kill("SIGTERM"); process.once("SIGTERM", signal);
    child.once("exit", () => process.removeListener("SIGTERM", signal));
  });
}
function version(command: string, args = ["--version"]): string {
  try { return execFileSync(command, args, { env: harnessEnv(), encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"] }).trim().split("\n")[0] || "unknown"; }
  catch { return "MISSING / FAILED"; }
}
function authStatus(): Record<string, boolean | null> {
  let gpt = false;
  const file = join(profileDir, "auth.json");
  if (existsSync(file)) { try { assertPrivateAuthStore(file); gpt = Boolean(JSON.parse(readFileSync(file, "utf8"))["openai-codex"]); } catch { /* doctor shows unverified */ } }
  // File presence is a local storage hint; only a live request validates auth.
  const googleStore = existsSync(join(geminiHome, ".gemini/antigravity-acp/acp_token.json"));
  return { "openai-codex": gpt, "claude-bridge": claudePlanSignedIn(), "gemini-cli-acp": googleStore ? true : null };
}

async function main(): Promise<number> {
  const [command = "help", ...argv] = process.argv.slice(2);
  let [arg, ...rest] = argv;
  if (command === "agent" || command === "code") {
    if (arg?.startsWith("-")) { arg = undefined; rest = argv; }
    const project = projectPath(arg || process.cwd());
    const marker = join(project, ".lemmaduck-kind");
    if (command === "code" || (!rest.includes("--pi") && existsSync(marker) && readFileSync(marker, "utf8").trim() === "development")) {
      const omp = join(binDir, "omp");
      if (!existsSync(omp)) throw new Error("OMP is missing. Run duck setup --full on the Paseo host.");
      const args = rest.flatMap(option => option === "--rpc" ? ["--mode", "rpc"] : [option]);
      return run(omp, codingArgs(args), project, codingEnv());
    }
  }
  if (command === "--version" || command === "version") { console.log(JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).version); return 0; }
  if (command === "setup") return run("python3", [join(repoRoot, "scripts/setup.py"), ...[arg, ...rest].filter((s): s is string => s !== undefined)], repoRoot, process.env);
  if (command === "providers") { await (await import("./provider-command.js")).providerCommand(arg, rest); configure(); return 0; }
  if (command === "connector") { await (await import("./connectors.js")).connectorCommand([arg, ...rest].filter((s): s is string => s !== undefined)); return 0; }
  if (command === "routing") { (await import("./routing.js")).routingCommand(arg); return 0; }
  if (command === "vcs") {
    const view = rest[0] || "status";
    if (!["status", "diff", "log"].includes(view) || rest.length > 1) throw new Error("Use: duck vcs PATH status|diff|log");
    console.log(JSON.stringify((await import("./vcs.js")).vcsRead(projectPath(arg || process.cwd()), view as "status" | "diff" | "log"), null, 2)); return 0;
  }
  if (command === "research") { await (await import("./research-command.js")).researchCommand(argv); return 0; }
  configure();
  if (command === "ui" && arg === "reload") throw new Error("Live layout replacement is unavailable: Zellij cannot reliably preserve running pane commands. New workspaces use the new bars; keep existing sessions until their work is saved and finished.");
  if (command === "doctor") {
    const report = { at: new Date().toISOString(), repo: repoRoot, tools: {
      node: process.version, pi: version(process.execPath, [piCLI, "--version"]),
      claude: version(claudeCLI), gemini: existsSync(googleACP) ? "Antigravity ACP 1.2.1 (installed; run install-google.py to verify hashes)" : "MISSING / FAILED",
      neovim: version(join(binDir, "nvim")), zellij: version(join(binDir, "zellij")),
      compiler: version(join(binDir, "cc")), treesitter: version(join(binDir, "tree-sitter")),
    }, credentialsPresent: authStatus(), billingConfirmed: Object.fromEntries(PROVIDERS.map(p => [p, billingConfirmed(p)])), registeredProviders: enabledProviders().map(id => ({ id, label: providerLabel(id) })), excludedEnvironmentVariableNames: billingEnvNames(),
      authenticationCheck: "Claude uses its official CLI auth status. Other entries are local storage hints. null means unknown.",
      liveProviderValidation: "Not inferred from installation or credentials. Run the verification protocol in VALIDATION.md.",
    };
    console.log(JSON.stringify(report, null, 2));
    const required = arg === "--agent-only" ? [report.tools.node, report.tools.pi, report.tools.claude, report.tools.gemini] : Object.values(report.tools);
    return required.includes("MISSING / FAILED") ? 1 : 0;
  }
  if (command === "billing" && arg === "confirm") {
    const p = provider(rest[0]);
    if (rest[1] !== "--extra-usage-off") throw new Error("First disable/check extra usage, paid credits and auto-refill in the account; then pass --extra-usage-off.");
    confirmBilling(p); console.log(`Recorded your account-side confirmation for ${p}. This is not an automatic billing audit.`); return 0;
  }
  if (command === "login") {
    const p = provider(arg);
    if (p === "anthropic") {
      const keyName = readProviders().find(extra => extra.id === p)?.apiKeyEnv || CLAUDE_API_KEY_ENV;
      console.log(`This route uses Console API billing. Supply ${keyName} through your host's secret manager. For a personal Claude plan run duck login claude.`); return 0;
    }
    if (p === "openai-codex" || readProviders().some(extra => extra.id === p)) {
      console.log(`In Pi, run /login ${p}, complete authentication, then /quit. Route: ${providerLabel(p)}.`);
      return run(process.execPath, [piCLI, "--no-extensions", "--no-skills", "--no-prompt-templates", "--no-context-files", "--no-tools", "--no-approve", "--provider", p], repoRoot);
    }
    if (p === "claude-bridge") return run(claudeCLI, ["auth", "login", "--claudeai"], repoRoot);
    if (!existsSync(googleACP)) throw new Error("Install the official Google server: python3 scripts/install-google.py");
    console.log("Google Antigravity ACP: personal subscription OAuth only. This is separate from Gemini CLI login.");
    await (await import("./google-login.js")).loginGoogle(); return 0;
  }
  if (["agent", "open", "status", "reconcile", "context"].includes(command)) {
    const project = projectPath(arg || process.cwd());
    if (command === "open") {
      const session = workspaceName(project);
      // attach --create recreates a missing workspace and reattaches a live one.
      const layout = join(configDir, "lemmaduck.kdl");
      if (!existsSync(layout)) throw new Error("Run python3 scripts/install-ui.py to install the managed transparent layout.");
      return run(join(binDir, "zellij"), ["--config", join(configDir, "zellij.kdl"), "attach", "--create", session, "options", "--default-layout", layout, "--default-mode", "locked", "--default-cwd", project], project, { ...harnessEnv(), LEMMADUCK_PROJECT: project, LEMMADUCK_REPO: repoRoot });
    }
    if (command === "status") { const store = new TaskStore(project); console.log(renderHandoff(store.task)); console.log(`State: ${store.dir}`); return 0; }
    const release = acquireProjectLock(project);
    try {
      const store = new TaskStore(project);
      if (command === "reconcile") {
        const [id, status, ...note] = rest;
        const operation = store.task.operations.find(op => op.id === id);
        if (!operation || !["completed", "failed"].includes(status || "") || !note.length) throw new Error("Usage: duck reconcile PROJECT OPERATION_ID completed|failed 'observed result'");
        store.reconcile(id!, status === "failed", note.join(" ")); store.checkpoint(); return 0;
      }
      if (command === "context") {
        const [file] = rest; if (!file) throw new Error("Usage: duck context PROJECT FILE");
        const { confinedPath } = await import("./security.js");
        const path = confinedPath(project, file); if (!existsSync(path)) throw new Error("Input file does not exist.");
        if (!store.task.inputs.includes(path)) store.task.inputs.push(path); store.checkpoint(); console.log("Input selected; use /task add while the agent is running."); return 0;
      }
      assertManagedProject(project); assertPrivateAuthStore(join(profileDir, "auth.json")); store.recoverInterrupted();
      const args = [piCLI, "--no-extensions", "--no-skills", "--no-prompt-templates", "--no-themes", "--no-context-files", "--no-approve",
        "--extension", join(repoRoot, "dist/extension.js"), "--extension", claudeExtensionPath,
        "--theme", join(repoRoot, "config/pi/lemmaduck-mono.json"), "--use-theme", "lemmaduck-mono",
        "--session-dir", join(store.dir, "sessions"), "--models", enabledProviders().map(id => `${id}/*`).join(","), "--tools", "read,bash,edit,write,grep,find,ls,read_task_artifact,propose_checkpoint"];
      if (rest.includes("--rpc")) args.push("--mode", "rpc");
      else console.log("LemmaDuck: /ask REQUEST routes a new segment; /switch selects manually; /task shows state; /workflow attaches a playbook. Escape cancels the active turn.");
      return await run(process.execPath, args, project, harnessEnv(), release.track);
    } finally { release(); }
  }
  console.log(`LemmaDuck — code, research, writing, and personal projects\n  duck setup [--dry-run]     Install workspace tools and settings\n  duck doctor\n  duck providers list|catalog|add|remove\n  duck login chatgpt|claude|gemini|REGISTERED_ID\n  duck billing confirm chatgpt|claude|gemini --extra-usage-off\n  duck open PROJECT          Zellij + LazyVim + agent\n  duck paseo [COMMAND]       Open or manage the Paseo host\n  duck agent [PROJECT]       Project worker (development: OMP; otherwise Pi)\n  duck code [PROJECT]        OMP coding in any project\n  duck agent PROJECT --pi    Managed research, writing or assistant worker\n  duck research PROJECT      Scientific records and approved experiments\n  duck status PROJECT        Task and handoff\n  duck reconcile PROJECT ID completed|failed 'observed result'\n  duck context PROJECT FILE  Select input before starting an agent\n\nIn Pi: /switch, /review, /task, /handoff, /usage, /instructions, /checkpoint, /ui motion full|reduced|off. No automatic fallback. Additional API routes require explicit registration.`);
  return 0;
}
main().then(code => { process.exitCode = code; }).catch(error => { console.error(String(error)); process.exitCode = 1; });
