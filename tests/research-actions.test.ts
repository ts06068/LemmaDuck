import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { compareResearchActions, type ResearchActions } from "../src/research-actions.js";
function plan(): ResearchActions {
 const outcomes = [{observation:"contrast attenuates", compatibleHypotheses:["confounding"]},{observation:"contrast persists",compatibleHypotheses:["mechanism"]}];
 return {question:"Which explanation survives a discriminating check?",hypotheses:["confounding","mechanism"],actions:[
  {id:"available-test",purpose:"learn",available:true,answerKnown:false,independentEvidence:false,cost:2,outcomes},
  {id:"known-answer",purpose:"learn",available:true,answerKnown:true,independentEvidence:false,cost:1,outcomes},
  {id:"unavailable-test",purpose:"learn",available:false,answerKnown:false,independentEvidence:false,cost:1,outcomes},
  {id:"reread-result",purpose:"replicate",available:true,answerKnown:true,independentEvidence:false,cost:1,outcomes},
  {id:"independent-replication",purpose:"replicate",available:true,answerKnown:true,independentEvidence:true,cost:1,outcomes},
 ]};
}
test("action comparison rejects ritual work but preserves independent replication",()=>{
 const result=compareResearchActions(plan());
 assert.deepEqual(result.rankings,{learn:["available-test"],replicate:["independent-replication"]});
 assert.equal(result.comparisons.filter(x=>x.eligible).length,2);
 assert.equal(result.comparisons.find(x=>x.id==="available-test")!.separatedPairs,1);
 assert.match(result.caveat,/declared assumptions/);
});
test("indistinguishable or incomplete outcomes cannot advertise discrimination",()=>{
 const p=plan(); p.actions=p.actions.slice(0,1);
 p.actions[0]!.outcomes=[{observation:"A",compatibleHypotheses:p.hypotheses},{observation:"B",compatibleHypotheses:p.hypotheses}];
 assert.deepEqual(compareResearchActions(p).rankings.learn,[]);
 p.actions[0]!.outcomes=[{observation:"A",compatibleHypotheses:["confounding"]},{observation:"B",compatibleHypotheses:[]}];
 assert.match(compareResearchActions(p).comparisons[0]!.reasons.join(" "),/omit an alternative/);
});
test("action ranking is invariant to input order and rejects invented alternatives and nonfinite costs",()=>{
 const p=plan(); const first=compareResearchActions(p);p.actions.reverse();assert.deepEqual(compareResearchActions(p).rankings,first.rankings);
 p.actions[0]!.outcomes[0]!.compatibleHypotheses=["invented"];
 assert.throws(()=>compareResearchActions(p),/unknown hypothesis/);
 assert.throws(()=>compareResearchActions({...plan(),actions:[{...plan().actions[0],cost:NaN}]}),/Invalid/);
 assert.throws(()=>compareResearchActions({...plan(),actions:[plan().actions[0],plan().actions[0]]}),/unique/);
});


test("owner action comparison runs without initializing state or requiring a model profile",{timeout:60000},t=>{
 const root=mkdtempSync(join(tmpdir(),"lemmaduck-action-cli-"));t.after(()=>rmSync(root,{recursive:true,force:true}));
 writeFileSync(join(root,"actions.json"),JSON.stringify(plan()));const state=join(root,"private-state");
 const output=execFileSync(process.execPath,[process.env.LEMMADUCK_TEST_CLI||resolve("dist/cli.js"),"research",root,"compare","actions.json"],{encoding:"utf8",env:{...process.env,LEMMADUCK_DATA_DIR:join(root,"data"),LEMMADUCK_STATE_DIR:state}});
 assert.deepEqual(JSON.parse(output).rankings,{learn:["available-test"],replicate:["independent-replication"]});assert.equal(existsSync(state),false);assert.equal(existsSync(join(root,"data")),false);
});
