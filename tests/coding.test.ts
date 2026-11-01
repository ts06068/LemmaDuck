import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { isClaudePlanStatus } from "../src/config.js";
import { assertRoute } from "../src/security.js";

test("Claude plan status requires official personal-account authentication and SDK transport", () => {
  assert.equal(isClaudePlanStatus({ loggedIn: true, authMethod: "claude.ai", apiProvider: "firstParty" }), true);
  for (const status of [{}, { loggedIn: false }, { loggedIn: true, authMethod: "api_key", apiProvider: "firstParty" }, { loggedIn: true, authMethod: "claude.ai", apiProvider: "bedrock" }]) {
    assert.equal(isClaudePlanStatus(status), false);
  }
  assert.doesNotThrow(() => assertRoute({ provider: "claude-bridge", api: "claude-bridge", baseUrl: "claude-bridge" }));
  assert.throws(() => assertRoute({ provider: "claude-bridge", api: "anthropic-messages", baseUrl: "https://api.anthropic.com" }), /Agent SDK/);
});

test("public coding entry point selects isolated OMP and requires explicit API registration and key", { timeout: 60000 }, () => {
  const root = mkdtempSync(join(tmpdir(), "lemmaduck-coding-"));
  try {
    const project = join(root, "project");
    const data = join(root, "data");
    mkdirSync(project); mkdirSync(join(data, "bin"), { recursive: true });
    const env = { ...process.env, LEMMADUCK_INSTALL_HOME: root, LEMMADUCK_DATA_DIR: data, LEMMADUCK_STATE_DIR: join(root, "state"),
      ANTHROPIC_API_KEY: "synthetic-unmanaged-key", CLAUDE_CODE_OAUTH_TOKEN: "synthetic-token", OMP_AUTH_BROKER_TOKEN: "synthetic-broker", LEMMADUCK_WORK_SECRET: "synthetic-work" };
    const captured = ["PI_CODING_AGENT_DIR", "ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN", "OMP_AUTH_BROKER_TOKEN", "LEMMADUCK_WORK_SECRET"];
    writeFileSync(join(data, "bin/omp"), `#!/usr/bin/env node\nconst env = Object.fromEntries(${JSON.stringify(captured)}.map(key => [key, process.env[key]]));\nconsole.log(JSON.stringify({args:process.argv.slice(2),cwd:process.cwd(),env}));\n`, { mode: 0o755 });
    const cli = (...args: string[]) => execFileSync(resolve("lemmaduck"), args, { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const config = () => JSON.parse(readFileSync(join(data, "config/omp-code.yml"), "utf8"));
    const models = () => JSON.parse(readFileSync(join(data, "omp/agent/models.yml"), "utf8"));
    writeFileSync(join(project, ".lemmaduck-kind"), "development\n");
    const launch = JSON.parse(cli("agent", project, "--rpc"));
    assert.deepEqual(launch.args, ["--mode", "rpc"]);
    assert.equal(launch.cwd, project);
    assert.equal(launch.env.PI_CODING_AGENT_DIR, join(data, "omp/agent"));
    for (const name of ["ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN", "OMP_AUTH_BROKER_TOKEN", "LEMMADUCK_WORK_SECRET"]) assert.equal(launch.env[name], undefined);
    assert.equal(existsSync(join(data, "pi")), false);
    assert.deepEqual(config().enabledModels, ["openai-codex/*"]);
    for (const provider of ["anthropic", "zenmux", "openrouter", "ollama"]) assert.ok(config().disabledProviders.includes(provider));
    assert.equal(config().retry.modelFallback, false);
    assert.deepEqual(JSON.parse(cli("code", project, "--mode", "rpc-ui")).args, ["--mode", "rpc-ui"]);
    const local = join(root, "local.json");
    writeFileSync(local, JSON.stringify({ id: "duck-local", label: "Fixture", billing: "local", baseUrl: "http://127.0.0.1:9876/v1", api: "openai-completions", models: [{ id: "synthetic-model" }] }));
    cli("providers", "add", local); cli("code", project, "--version");
    assert.deepEqual(models().providers["duck-local"].models, [{ id: "synthetic-model" }]);
    assert.equal(models().providers["duck-local"].auth, "none");
    assert.throws(() => cli("providers", "add", "anthropic", "--subscription", "--extra-usage-off"), /personal|own Claude plan/);
    assert.throws(() => cli("providers", "add", "anthropic"), /allow-paid-api/);
    cli("providers", "add", "anthropic", "--allow-paid-api"); cli("code", project, "--version");
    assert.ok(config().disabledProviders.includes("anthropic"));
    const paidEnv = { ...env, LEMMADUCK_MODEL_ANTHROPIC_KEY: "synthetic-explicit-api-key" };
    execFileSync(resolve("lemmaduck"), ["code", project, "--version"], { env: paidEnv, stdio: "pipe" });
    assert.ok(!config().disabledProviders.includes("anthropic"));
    assert.equal(models().providers.anthropic.auth, "apiKey");
    assert.equal(models().providers.anthropic.apiKey, "LEMMADUCK_MODEL_ANTHROPIC_KEY");
    assert.doesNotMatch(readFileSync(join(data, "omp/agent/models.yml"), "utf8"), /synthetic-explicit-api-key/);
    cli("providers", "remove", "anthropic");
    execFileSync(resolve("lemmaduck"), ["code", project, "--version"], { env: paidEnv, stdio: "pipe" });
    assert.ok(config().disabledProviders.includes("anthropic"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("legacy direct Anthropic OAuth stays inactive and can be removed without changing other routes", { timeout: 30000 }, () => {
  const root = mkdtempSync(join(tmpdir(), "lemmaduck-legacy-auth-"));
  try {
    const data = join(root, "data");
    mkdirSync(join(data, "config"), { recursive: true }); mkdirSync(join(data, "pi"));
    writeFileSync(join(data, "config/providers.json"), JSON.stringify([{ id: "anthropic", label: "Old route", billing: "subscription" }]));
    writeFileSync(join(data, "pi/auth.json"), JSON.stringify({ anthropic: { type: "oauth" }, "openai-codex": { type: "oauth" } }));
    const env = { ...process.env, LEMMADUCK_INSTALL_HOME: root, LEMMADUCK_DATA_DIR: data, LEMMADUCK_STATE_DIR: join(root, "state") };
    const cli = (...args: string[]) => execFileSync(process.execPath, [resolve("dist/cli.js"), ...args], { env, encoding: "utf8", stdio: "pipe" });
    assert.doesNotMatch(cli("providers", "list"), /Old route/);
    assert.throws(() => cli("login", "anthropic"), /not enabled/);
    cli("providers", "remove", "anthropic");
    assert.deepEqual(JSON.parse(readFileSync(join(data, "pi/auth.json"), "utf8")), { "openai-codex": { type: "oauth" } });
  } finally { rmSync(root, { recursive: true, force: true }); }
});
