import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskStore } from "../src/state.js";
import { ModelGateway, type ModelBudget } from "../src/research-model.js";
const identity = { provider: "openai-codex", model: "test-fixture" };
const budget: ModelBudget = { maxCalls: 1, maxToolCalls: 1, maxOutputTokens: 256, maxReportedTokens: 1024, reasoning: "low" };
const message = () => ({ role: "assistant", provider: identity.provider, model: identity.model, content: [{ type: "text", text: "{}" }], stopReason: "stop", usage: { input: 30, output: 10, totalTokens: 40 } });
function fixture(t: {after(fn: () => void): void}) {
 const root=mkdtempSync(join(tmpdir(),"lemmaduck-model-test-")); const project=join(root,"project"); mkdirSync(project); t.after(()=>rmSync(root,{recursive:true,force:true}));
 return new TaskStore(project,join(root,"state"));
}
async function send(trial: any, body: unknown, headers = {}) {
 const response=await fetch(trial.control.url,{method:"POST",headers:{Authorization:"Bearer "+trial.control.token,"Content-Type":"application/json",...headers},body:JSON.stringify(body)});
 return {status:response.status,body:await response.text()};
}
test("live gateway pins identity, records reported usage, and enforces per-trial call/tool ceilings", async t=>{
 const contexts: any[]=[]; const gateway=new ModelGateway(identity,budget,async context=>{contexts.push(context);return message();});
 const trial=await gateway.trial(fixture(t),"candidate",{source:"frozen case"});
 try {
  assert.equal((await send(trial,{action:"tool",name:"read_case_material",arguments:{}})).status,200);
  const call=await send(trial,{action:"complete",messages:[{role:"user",content:"review",timestamp:1}]});
  assert.equal(call.status,200,call.body); assert.equal(trial.usage.calls,1); assert.equal(trial.usage.reportedTokens,40);
  assert.equal(trial.usage.receipts[0]!.provider,identity.provider); assert.equal(trial.usage.receipts[0]!.requestHash.length,64);
  assert.match(contexts[0].systemPrompt,/Preserve negative/); assert.equal(contexts[0].tools.length,4);
  assert.equal((await send(trial,{action:"complete",messages:[]})).status,400);
  assert.equal((await send(trial,{action:"tool",name:"read_case_material",arguments:{}})).status,400);
  assert.equal(trial.usage.limitExceeded,true);
 } finally {await trial.close();}
});
test("live gateway rejects invalid access, wrong model identity, and unavailable token accounting", async t=>{
 for(const mode of ["identity","usage"]){
  const gateway=new ModelGateway(identity,budget,async()=>({...message(),...(mode==="identity"?{model:"wrong"}:{usage:{totalTokens:0}})}));
  const trial=await gateway.trial(fixture(t),"baseline",{});
  try {
   assert.equal((await send(trial,{}, {Authorization:"Bearer invalid"})).status,403);
   assert.equal((await send(trial,{}, {Origin:"https://external.example"})).status,403);
   assert.equal(trial.usage.calls,0);
   const call=await send(trial,{action:"complete",messages:[]}); assert.equal(call.status,400); assert.match(call.body,mode==="identity"?/identity/:/token usage/);
  } finally {await trial.close();}
 }
});
test("live gateway flags provider output-budget overruns", async t=>{
 const gateway=new ModelGateway(identity,budget,async()=>({...message(),usage:{input:10,output:257,totalTokens:267}}));
 const trial=await gateway.trial(fixture(t),"baseline",{});
 try {assert.equal((await send(trial,{action:"complete",messages:[]})).status,400);assert.equal(trial.usage.limitExceeded,true);} finally {await trial.close();}
});


test("a quota failure stops further model dispatch across planned trials", async t => {
 let calls = 0;
 const gateway = new ModelGateway(identity, budget, async () => { calls++; return { ...message(), stopReason: "error", errorMessage: "429 rate limit fixture" }; });
 for (let i = 0; i < 2; i++) {
  const trial = await gateway.trial(fixture(t), "baseline", {});
  try { assert.equal((await send(trial, { action: "complete", messages: [] })).status, 400); }
  finally { await trial.close(); }
 }
 assert.equal(calls, 1);
});
