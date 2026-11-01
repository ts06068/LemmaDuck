import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyRequest, chooseRoute, readRouting } from "../src/routing.js";
import { codingArgs } from "../src/coding.js";
import { detectVcs, vcsArgs, vcsRead } from "../src/vcs.js";
import { snapshot } from "../src/state.js";

test("routing distinguishes requested work and respects readiness, preference and exact-model overrides", () => {
  for (const [request, expected] of [
    ["내일 일정 알려줘", "routine"], ["Write an email reply", "routine"], ["논문 문장 교정", "writing"],
    ["이 결과를 설명할 경쟁 가설과 판별 실험", "abduction"], ["Check this proof and causal argument", "reasoning"],
    ["Fix the bug in this code", "coding"], ["Unclassified request", "reasoning"],
  ]) assert.equal(classifyRequest(request!).profile, expected);
  const models = [{ provider: "openai-codex", id: "default", reasoning: true }, { provider: "openai-codex", id: "exact", reasoning: true }, { provider: "claude-bridge", id: "fixture", reasoning: true }, { provider: "gemini-cli-acp", id: "cli-default", reasoning: false }];
  const config = readRouting();
  assert.equal(chooseRoute("routine", models, () => true, {}, config).route.provider, "gemini-cli-acp");
  assert.equal(chooseRoute("abduction", models, () => true, { "openai-codex": "default" }, config).route.requestedThinking, "high");
  assert.equal(chooseRoute("reasoning", models, p => p !== "openai-codex", {}, config).route.provider, "claude-bridge");
  assert.throws(() => chooseRoute("writing", models, () => false, {}, config), /No ready model/);
  config.profiles.reasoning.models = { chatgpt: "exact" };
  assert.equal(chooseRoute("reasoning", models, () => true, {}, config).route.model, "exact");
  config.profiles.reasoning.models.chatgpt = "missing";
  config.profiles.reasoning.providers = ["chatgpt"];
  assert.throws(() => chooseRoute("reasoning", models, () => true, {}, config), /No ready model/);
  const args = codingArgs(["--model", "local/exact", "--thinking=high", "--mode", "rpc"]);
  assert.ok(!args.includes("--provider")); assert.equal(args.filter(arg => arg.startsWith("--thinking")).length, 1);
});

test("Git inspection includes staged changes and checkpoints detect missing Jujutsu without claiming a clean tree", () => {
  const root = mkdtempSync(join(tmpdir(), "lemmaduck-vcs-"));
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
  try {
    git("init"); git("config", "user.email", "fixture@example.invalid"); git("config", "user.name", "Fixture");
    writeFileSync(join(root, "sample.txt"), "one\n"); git("add", "."); git("commit", "-m", "fixture");
    writeFileSync(join(root, "sample.txt"), "two\n"); git("add", ".");
    assert.equal(detectVcs(root).backend, "git"); assert.match(vcsRead(root, "status").output, /sample/);
    assert.match(vcsRead(root, "diff").output, /\+two/); assert.ok(snapshot(root).head);
    mkdirSync(join(root, ".jj")); assert.equal(detectVcs(root).backend, "jj");
    assert.ok(snapshot(root).error); // deliberately invalid jj metadata
    assert.ok(vcsArgs("jj", "status").includes("--ignore-working-copy"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("real Jujutsu inspection preserves the operation and reports recorded-state limitations", { skip: spawnSync("jj", ["--version"], { stdio: "ignore" }).status !== 0 }, () => {
  const root = mkdtempSync(join(tmpdir(), "lemmaduck-jj-"));
  const jj = (...args: string[]) => execFileSync("jj", args, { cwd: root, encoding: "utf8", stdio: "pipe" });
  try {
    jj("git", "init", "--colocate"); writeFileSync(join(root, "sample.txt"), "recorded\n"); jj("status");
    const op = () => jj("--ignore-working-copy", "op", "log", "--no-graph", "--limit", "1", "-T", "id");
    const before = op(); writeFileSync(join(root, "sample.txt"), "unsnapshotted\n");
    assert.equal(detectVcs(root).backend, "jj");
    assert.match(vcsRead(root, "status").note!, /Recorded/);
    assert.match(vcsRead(root, "diff").output, /recorded/);
    assert.doesNotMatch(vcsRead(root, "diff").output, /unsnapshotted/);
    assert.ok(vcsRead(root, "log").output); assert.equal(op(), before);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
