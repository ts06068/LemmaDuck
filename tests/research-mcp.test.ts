import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { TaskStore } from "../src/state.js";
import { Instructions } from "../src/workflow.js";
import { startGeminiTools } from "../src/gemini-tools.js";

for (const review of [false, true]) test(`Gemini MCP shares scientific schemas and enforces owner/review boundaries with review=${review}`, { timeout: 60000 }, async t => {
  const root = mkdtempSync(join(tmpdir(), "lemmaduck-research-mcp-"));
  t.after(() => rmSync(root, { recursive: true, force: true })); writeFileSync(join(root, "data.csv"), "value\n20\n");
  const task = new TaskStore(root, join(root, "state"));
  const host = await startGeminiTools(task, { review, instructions: new Instructions(root, task.dir), signal: () => undefined, approve: async () => { throw new Error("Scientific recording must not invoke a shell approval"); } });
  const server = host.server as any; const client = new Client({ name: "research-fixture", version: "1" });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(server.url), { requestInit: { headers: Object.fromEntries(server.headers.map((header: any) => [header.name, header.value])) } }));
    const tools = await client.listTools(); assert.ok(tools.tools.some(tool => tool.name === "inspect_research"));
    assert.equal(tools.tools.some(tool => tool.name === "run_research_experiment"), !review);
    const schema: any = await client.callTool({ name: "inspect_research", arguments: { kind: "experiment" } }); assert.match(JSON.stringify(schema), /predictions/);
    const recorded: any = await client.callTool({ name: "record_research", arguments: { kind: "observation", data: { statement: "Synthetic measurement", files: ["data.csv"], location: "row 2" } } });
    if (review) assert.equal(recorded.isError, true);
    else { assert.ok(!recorded.isError); assert.match(JSON.stringify(recorded), /agent-proposal/); }
    const denied: any = await client.callTool({ name: "record_research", arguments: { kind: "rule", data: {} } }); assert.equal(denied.isError, true);
    const approval: any = await client.callTool({ name: "approve_research_scope", arguments: {} }); assert.equal(approval.isError, true);
  } finally { await client.close(); await host.close(); }
});
