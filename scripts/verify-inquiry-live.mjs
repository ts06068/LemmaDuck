#!/usr/bin/env node
// Opt-in development check: real model, exact owner-invoked synthetic scopes.
// Run with node --import tsx after building. No clinical or private patient data.
import {mkdirSync,writeFileSync,readFileSync,copyFileSync} from 'node:fs';
import {isAbsolute,resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {TaskStore} from '../dist/state.js';
import {ResearchRunner} from '../dist/research-runner.js';
import {ModelGateway,liveModel} from '../dist/research-model.js';
import {executeAdapter,readAdapterResult} from '../dist/research-runner.js';
import {seedExperiment} from '../tests/fixtures/research-plan.ts';
const [flag,target,model]=process.argv.slice(2);
if(flag!=='--live'||!target||!isAbsolute(target)||!model)throw Error('Use: node --import tsx scripts/verify-inquiry-live.mjs --live /absolute/new-root EXACT_MODEL');
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');mkdirSync(target,{mode:0o700});
const budget={maxCalls:6,maxToolCalls:12,maxOutputTokens:4096,maxReportedTokens:80000,reasoning:'low'};
const gateway=new ModelGateway({provider:'openai-codex',model},budget,await liveModel('openai-codex',model));
const results=[];
for(const mode of ['contradiction','invalid','timeout']){
 const project=join(target,mode);mkdirSync(project,{mode:0o700});
 const task=new TaskStore(project,join(target,'state'));const {research,plan}=seedExperiment(task,mode);const runner=new ResearchRunner(research);
 const scope=runner.approve({description:'Owner-invoked controlled model/experiment integration; fixed local synthetic files only',experiments:[plan.id],maxRuns:1,timeoutMs:mode==='timeout'?200:30000,maxTotalMs:90000,maxCostUnits:1,expiresAt:new Date(Date.now()+600000).toISOString(),stopOnAnomaly:true});
 copyFileSync(join(repo,'examples/inquiry-evaluation/driver.mjs'),join(project,'driver.mjs'));
 const adapter=research.freezeAdapter({executable:process.execPath,script:'driver.mjs',files:[]});
 const input={question:`Execute only the existing frozen experiment ${plan.id} under owner-approved scope ${scope.id}. Obtain the measurement and preserve its actual status and the original predictions. Do not rewrite the plan, approve scope, resolve anomalies, or claim more than the verifier supports. A descriptive claim may be recorded only if independently verified. Return JSON with run (ID), status, mean (number only when verified, otherwise null), hypotheses_supported (boolean only when verified, otherwise null), and interpretation.`,experiment:plan.id,scope:scope.id};
 const runtime=gateway.provenance();const runtimeFiles=gateway.snapshot(join(project,'runtime'),runtime);
 writeFileSync(join(project,'owner-protocol.json'),JSON.stringify({mode,plan,scope,budget,runtime,runtimeFiles},null,2));
 const control=await gateway.trial(task,'candidate',input);let execution,error,answer;
 try {
  execution=await executeAdapter(adapter,project,{input,modelControl:control.control},180000);
  if(execution.exitCode===0)answer=readAdapterResult(join(project,'.result.json')).answer;
 }catch(e){error=String(e);}finally{await control.close();}
 const runs=research.list('run'),claims=research.list('claim');const run=runs[0];
 let passed=runs.length===1&&research.get(plan.id).hash===plan.hash&&!research.stale(research.get(plan.id))&&research.summary().openAnomalies.length===1;
 if(mode==='contradiction')passed&&=run?.data.status==='verified'&&answer?.status==='verified'&&answer?.mean===20&&answer?.hypotheses_supported===false&&Object.values(run.data.assessment).every(x=>x==='contradicted')&&claims.every(c=>c.data.claimType==='descriptive'&&c.data.runs.length===1&&c.data.runs[0]===run.id);
 if(mode==='invalid')passed&&=run?.data.status==='invalid'&&answer?.status==='invalid'&&answer?.mean===null&&answer?.hypotheses_supported===null&&claims.length===0;
 if(mode==='timeout')passed&&=run?.data.status==='unknown'&&task.task.status==='needs_reconciliation'&&claims.length===0&&control.usage.errors.some(e=>/reconciliation/.test(e))&&execution?.exitCode!==0;
 const result={mode,passed,execution,error,answer,run,claims,scopeStopped:runner.usage(scope.id).stopped,usage:control.usage};
 // Undefined optional values are omitted by JSON serialization; no hidden thinking.
 results.push(result);writeFileSync(join(target,'partial.json'),JSON.stringify(results,null,2));
}
writeFileSync(join(target,'report.json'),JSON.stringify({purpose:'Real model with exact synthetic experiments; not scientific-benefit evaluation',results},null,2));
console.log(JSON.stringify({root:target,passed:results.every(r=>r.passed),cases:results.map(r=>({mode:r.mode,passed:r.passed,status:r.run?.data.status,calls:r.usage.calls,tokens:r.usage.reportedTokens}))},null,2));
if(results.some(r=>!r.passed))process.exitCode=1;
