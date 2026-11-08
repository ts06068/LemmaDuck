#!/usr/bin/env node
import {mkdirSync,copyFileSync,writeFileSync,readFileSync} from "node:fs";
import {resolve,join,dirname,isAbsolute} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync,execFileSync} from "node:child_process";
const [flag,target,model]=process.argv.slice(2);
if(flag!=="--live"||!target||!isAbsolute(target)||!model) throw Error("Use: node scripts/evaluate-medical.mjs --live /absolute/new-pilot-root EXACT_MODEL");
const repo=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const source=join(repo,"examples/observational-evaluation");
mkdirSync(target,{mode:0o700}); const project=join(target,"project"); mkdirSync(project,{mode:0o700});
const cases=["timing","overlap","prediction","aligned"];
for(const name of ["driver.mjs","score.py",...cases.map(x=>x+".json")]) copyFileSync(join(source,name),join(project,name));
const rubric=JSON.parse(readFileSync(join(source,"rubric.json"),"utf8"));
for(const name of cases) writeFileSync(join(target,name+"-truth.json"),JSON.stringify(rubric.cases[name]),{mode:0o600});
const python=execFileSync("python3",["-c","import sys;print(sys.executable)"],{encoding:"utf8"}).trim();
const adapter={executable:process.execPath,script:"driver.mjs",files:[]};
const config={purpose:"research-evaluation",identity:{provider:"openai-codex",model,tools:["inspect_research","record_research","run_research_experiment","read_case_material"]},baseline:adapter,candidate:adapter,evaluator:{executable:python,script:"score.py",files:[]},tasks:cases.map(id=>({id,input:id+".json",truth:join(target,id+"-truth.json"),context:"constructed-observational-method-"+id})),outcomes:Object.fromEntries(["issue_f1","critical_recall","claim_restraint","next_check"].map(x=>[x,{direction:"higher",minimum:0,maximum:1,failureScore:0}])),repeats:3,seed:20261109,timeoutMs:180000,live:{maxCalls:3,maxToolCalls:8,maxOutputTokens:4096,maxReportedTokens:24000,reasoning:"low"}};
writeFileSync(join(project,"evaluation.json"),JSON.stringify(config,null,2));
writeFileSync(join(target,"protocol.json"),JSON.stringify({config,rubric,scope:"Component review pilot only; independent human utility review remains separate"},null,2));
const run=spawnSync(process.execPath,[join(repo,"dist/cli.js"),"research",project,"evaluate","evaluation.json"],{env:process.env,encoding:"utf8",maxBuffer:8*1024*1024});
writeFileSync(join(target,"report.json"),run.stdout||""); writeFileSync(join(target,"stderr.log"),run.stderr||"");
if(run.error) throw run.error;
if(run.status!==0) {process.stderr.write(run.stderr||"Evaluation failed");process.exit(run.status||1);}
const report=JSON.parse(run.stdout); console.log(JSON.stringify({root:target,id:report.id,hash:report.hash,trials:report.trials.length,successful:report.trials.filter(x=>x.success).length,paired:report.paired,reportedTokens:report.trials.reduce((n,t)=>n+(t.modelUsage?.reportedTokens||0),0)},null,2));
