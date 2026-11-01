import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

test("explicit MCP scope, effects and replay protection across processes", () => {
  const root = mkdtempSync(join(tmpdir(), "lemmaduck-mcp-"));
  try {
    const dir = join(root, ".config/lemmaduck"); mkdirSync(dir, { recursive: true });
    const effects = join(root, "effects"); const args = join(root, "args.json"); writeFileSync(args, "{}");
    writeFileSync(join(dir, "connections.json"), JSON.stringify({ "work.github": {
      platform: "github", command: process.execPath, args: [resolve("tests/fixtures/connector-server.mjs"), effects],
      tools: { read_demo: "read", write_demo: "write" }
    }}), { mode: 0o600 });
    const run = (...cmd: string[]) => spawnSync(process.execPath, [resolve("dist/cli.js"), "connector", ...cmd], {
      env: { ...process.env, LEMMADUCK_INSTALL_HOME: root, LEMMADUCK_STATE_DIR: join(root, "state") }, encoding: "utf8", timeout: 10000,
    });
    const listing = run("tools", "work.github"); assert.equal(listing.status, 0, listing.stderr);
    assert.match(listing.stdout, /read_demo/); assert.doesNotMatch(listing.stdout, /hidden_demo/);
    assert.equal(run("call", "personal.github", "read_demo", args).status, 1);
    assert.equal(run("call", "work.github", "hidden_demo", args).status, 1);
    assert.equal(run("call", "work.github", "read_demo", args).status, 0);
    assert.equal(run("call", "work.github", "write_demo", args).status, 1);
    const send = (id: string) => run("call", "work.github", "write_demo", args, "--apply", id);
    const first = send("task-1"); assert.equal(first.status, 0, first.stderr);
    assert.equal(send("task-1").status, 1); assert.equal(readFileSync(effects, "utf8"), "effect\n");
    assert.equal(JSON.parse(run("receipt", "work.github", "task-1").stdout).state, "completed");
    writeFileSync(args, '{"fail":true}');
    assert.equal(send("task-2").status, 1);
    assert.equal(JSON.parse(run("receipt", "work.github", "task-2").stdout).state, "unknown");
    assert.equal(send("task-2").status, 1); assert.equal(readFileSync(effects, "utf8"), "effect\neffect\n");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
