import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { TaskStore } from "../src/state.js";
import { Instructions } from "../src/workflow.js";
import { seedExperiment } from "./fixtures/research-plan.js";
import { ResearchRunner } from "../src/research-runner.js";
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
    assert.ok(tools.tools.some(tool => tool.name === "compare_research_actions" && tool.annotations?.readOnlyHint));
    const before = task.task.research;
    const compared: any = await client.callTool({ name: "compare_research_actions", arguments: { question: "New evidence?", hypotheses: ["A", "B"], actions: [{ id: "reread", purpose: "learn", available: true, answerKnown: true, independentEvidence: false, cost: 1, outcomes: [{ observation: "same", compatibleHypotheses: ["A", "B"] }] }] } });
    assert.ok(!compared.isError); assert.match(JSON.stringify(compared), /already supplied/); assert.equal(task.task.research, before);
    assert.equal(tools.tools.some(tool => tool.name === "run_research_experiment"), !review);
    const schema: any = await client.callTool({ name: "inspect_research", arguments: { kind: "experiment" } }); assert.match(JSON.stringify(schema), /predictions/);
    const recorded: any = await client.callTool({ name: "record_research", arguments: { kind: "observation", data: { statement: "Synthetic measurement", files: ["data.csv"], location: "row 2" } } });
    if (review) assert.equal(recorded.isError, true);
    else { assert.ok(!recorded.isError); assert.match(JSON.stringify(recorded), /agent-proposal/); }
    const denied: any = await client.callTool({ name: "record_research", arguments: { kind: "rule", data: {} } }); assert.equal(denied.isError, true);
    const approval: any = await client.callTool({ name: "approve_research_scope", arguments: {} }); assert.equal(approval.isError, true);
  } finally { await client.close(); await host.close(); }
});


test("Gemini interrupts when an unknown experiment is nested beneath a completed MCP wrapper", {timeout:60000}, async t=>{
 const root=mkdtempSync(join(tmpdir(),"lemmaduck-nested-mcp-"));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const task=new TaskStore(root,join(root,"state"));const {research,plan}=seedExperiment(task,"timeout");const runner=new ResearchRunner(research);
 const scope=runner.approve({description:"Controlled timeout fixture",experiments:[plan.id],maxRuns:1,timeoutMs:200,maxTotalMs:30000,maxCostUnits:1,expiresAt:new Date(Date.now()+120000).toISOString(),stopOnAnomaly:true});
 let interrupted=0;const host=await startGeminiTools(task,{review:false,instructions:new Instructions(root,task.dir),signal:()=>undefined,approve:async()=>false,interrupt:()=>{interrupted++;}});
 const server=host.server as any;const client=new Client({name:"nested-research-fixture",version:"1"});
 try {
  await client.connect(new StreamableHTTPClientTransport(new URL(server.url),{requestInit:{headers:Object.fromEntries(server.headers.map((h:any)=>[h.name,h.value]))}}));
  await client.callTool({name:"run_research_experiment",arguments:{scope:scope.id,experiment:plan.id}});
  assert.equal(research.list("run")[0]!.data.status,"unknown");assert.equal(task.task.status,"needs_reconciliation");assert.equal(interrupted,1);
  const next:any=await client.callTool({name:"record_research",arguments:{kind:"observation",data:{statement:"must not advance",files:[],location:"fixture"}}});assert.equal(next.isError,true);
 }finally{await client.close();await host.close();}
});
