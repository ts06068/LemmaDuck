import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// Load the cold runtime before timing the MCP protocol. Slow source-filesystem
// imports are not part of the 20-second connector interaction contract.
const root = mkdtempSync(join(tmpdir(), "lemmaduck-connector-mcp-"));
process.env.LEMMADUCK_INSTALL_HOME = root; process.env.LEMMADUCK_STATE_DIR = join(root, "state");
const { TaskStore } = await import("../src/state.js");
const { Instructions } = await import("../src/workflow.js");
const { startGeminiTools } = await import("../src/gemini-tools.js");

test("Gemini's real MCP surface exposes scoped connector schemas and enforces review effects", { timeout: 20000 }, async () => {
  mkdirSync(join(root, ".config/lemmaduck"), { recursive: true });
  writeFileSync(join(root, ".config/lemmaduck/connections.json"), JSON.stringify({ "work.linear": {
    platform: "linear", command: process.execPath, args: [resolve("tests/fixtures/connector-server.mjs"), join(root, "effects")], tools: { read_demo: "read", write_demo: "write" },
  } }), { mode: 0o600 });
  const store = new TaskStore(root);
  const host = await startGeminiTools(store, { review: true, instructions: new Instructions(root, store.dir), signal: () => undefined, approve: async () => { throw new Error("No confirmation in read-only review"); } });
  const server = host.server as any; const client = new Client({ name: "connector-mcp-fixture", version: "1" });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(server.url), { requestInit: { headers: Object.fromEntries(server.headers.map((h: any) => [h.name, h.value])) } }));
    const listed = await client.listTools(); assert.ok(listed.tools.some(t => t.name === "call_connection"));
    const inspect: any = await client.callTool({ name: "inspect_vcs", arguments: { view: "status" } }); assert.ok(!inspect.isError);
    const schemas: any = await client.callTool({ name: "list_connection_tools", arguments: { account: "work.linear" } });
    assert.ok(!schemas.isError); assert.match(schemas.content[0].text, /inputSchema/);
    const read: any = await client.callTool({ name: "call_connection", arguments: { account: "work.linear", tool: "read_demo", arguments: {} } }); assert.ok(!read.isError);
    const write: any = await client.callTool({ name: "call_connection", arguments: { account: "work.linear", tool: "write_demo", arguments: {} } });
    assert.equal(write.isError, true); assert.match(write.content[0].text, /Read-only/);
    assert.equal(store.task.operations.at(-1)!.status, "failed");
  } finally { await client.close(); await host.close(); rmSync(root, { recursive: true, force: true }); }
});
