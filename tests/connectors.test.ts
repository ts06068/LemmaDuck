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
    const discovered = run("discover", "work.github"); assert.match(discovered.stdout, /hidden_demo/);
    assert.equal(run("add", "work.linear", "linear").status, 0);
    assert.equal(run("add", "work.jira", "jira").status, 0);
    assert.equal(run("add", "work.jira", "jira").status, 1);
    const configured = JSON.parse(readFileSync(join(dir, "connections.json"), "utf8"));
    assert.equal(configured["work.jira"].url, "https://mcp.atlassian.com/v2/mcp?tools=all");
    assert.deepEqual(configured["work.linear"].tools, {});
    assert.equal(run("allow", "work.github", "hidden_demo", "read").status, 0);
    assert.equal(run("call", "work.github", "hidden_demo", args).status, 0);
    assert.equal(run("allow", "work.github", "hidden_demo", "execute").status, 1);
    delete configured["work.github"].tools.hidden_demo;
    writeFileSync(join(dir, "connections.json"), JSON.stringify(configured));
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

test("agent connectors share schemas, separate accounts, deny review writes and journal uncertain effects", () => {
  const root = mkdtempSync(join(tmpdir(), "lemmaduck-agent-connectors-"));
  try {
    const dir = join(root, ".config/lemmaduck"); mkdirSync(dir, { recursive: true });
    const effects = join(root, "effects");
    writeFileSync(join(dir, "connections.json"), JSON.stringify({ "work.jira": {
      platform: "jira", command: process.execPath, args: [resolve("tests/fixtures/connector-server.mjs"), effects], tools: { read_demo: "read", write_demo: "write" },
    } }), { mode: 0o600 });
    const script = `
      import assert from 'node:assert/strict';
      import {existsSync,readFileSync} from 'node:fs';
      import {TaskStore} from './dist/state.js';
      import {connectionToolDefinitions} from './dist/connection-tools.js';
      import {connectionHeaders} from './dist/connectors.js';
      const store = new TaskStore(${JSON.stringify(root)});
      let review = true, approved = false, prompts = 0;
      const tools = connectionToolDefinitions(store, { review: () => review, approve: async () => { prompts++; return approved; } });
      const invoke = (name, id, args) => { store.beginOperation(id, name); return tools.find(t=>t.name===name).execute(id, args); };
      assert.match(JSON.stringify(await invoke('list_connections','list',{})), /work.jira/);
      assert.match(JSON.stringify(await invoke('list_connection_tools','schema',{account:'work.jira'})), /inputSchema/);
      await invoke('call_connection','read',{account:'work.jira',tool:'read_demo',arguments:{}});
      await assert.rejects(invoke('call_connection','other',{account:'personal.jira',tool:'read_demo',arguments:{}}), /Configure/);
      const write = id => invoke('call_connection',id,{account:'work.jira',tool:'write_demo',arguments:{}});
      await assert.rejects(write('review'), /Read-only/); assert.equal(prompts,0);
      review = false; await assert.rejects(write('denied'), /declined/);
      assert.equal(existsSync(${JSON.stringify(effects)}), false);
      approved = true; const done = JSON.parse((await write('once')).content[0].text);
      assert.match(done.requestId,/^agent-/);
      await assert.rejects(write('once'), /already exists/);
      assert.equal(readFileSync(${JSON.stringify(effects)},'utf8'), 'effect\\n');
      await assert.rejects(invoke('call_connection','uncertain',{account:'work.jira',tool:'write_demo',arguments:{fail:true}}), /Outcome unknown/);
      assert.equal(store.task.operations.find(op=>op.id==='uncertain').status,'unknown');
      assert.equal(store.task.status,'needs_reconciliation');
      process.env.FIXTURE_EMAIL='person@example.invalid'; process.env.FIXTURE_TOKEN='synthetic';
      assert.equal(connectionHeaders({platform:'jira',tools:{},basicEnv:{username:'FIXTURE_EMAIL',token:'FIXTURE_TOKEN'}}).Authorization, 'Basic '+Buffer.from('person@example.invalid:synthetic').toString('base64'));
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], { env: { ...process.env, LEMMADUCK_INSTALL_HOME: root, LEMMADUCK_STATE_DIR: join(root, "state") }, encoding: "utf8", timeout: 15000 });
    assert.equal(result.status, 0, result.stderr);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
