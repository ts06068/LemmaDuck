#!/usr/bin/env node
import {mkdirSync,copyFileSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join,dirname,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync,execFileSync} from 'node:child_process';
import {liveResearchToolNames} from '../dist/research-model.js';
import {RESEARCH_INSTRUCTIONS} from '../dist/research-tools.js';
const [flag,target,model,stage='confirmation']=process.argv.slice(2);
if(flag!=='--live'||!target||!isAbsolute(target)||!model||!['development','transfer','calibration','confirmation'].includes(stage)) throw Error('Use: node scripts/evaluate-inquiry.mjs --live /absolute/new-root EXACT_MODEL [development|transfer|calibration|confirmation]');
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');const source=join(repo,'examples/inquiry-evaluation');
const manifest=JSON.parse(readFileSync(join(source,'rubric.json'),'utf8'));
const scorer=['calibration','confirmation'].includes(stage)?'score-propositions.py':'score.py';
const cases=manifest.cases.filter(c=>c.stage===stage);
mkdirSync(target,{mode:0o700});const project=join(target,'project');mkdirSync(project,{mode:0o700});
for(const name of ['driver.mjs',scorer,...cases.map(c=>c.id+'.json')]) copyFileSync(join(source,name),join(project,name));
for(const c of cases) writeFileSync(join(target,c.id+'-truth.json'),JSON.stringify(manifest.rubric[c.id]),{mode:0o600});
const python=execFileSync('python3',['-c','import sys;print(sys.executable)'],{encoding:'utf8'}).trim();
const adapter={executable:process.execPath,script:'driver.mjs',files:[]};
const metrics=['critical_recall','evidence_precision','claim_scope','next_information','operational_plan','joint_validity'];
const config={purpose:'research-evaluation',identity:{provider:'openai-codex',model,tools:liveResearchToolNames},baseline:adapter,candidate:adapter,evaluator:{executable:python,script:scorer,files:[]},
 tasks:cases.map(c=>({id:c.id,input:c.id+'.json',truth:join(target,c.id+'-truth.json'),context:'inquiry-'+stage+'-'+c.id})),
 outcomes:Object.fromEntries(metrics.map(m=>[m,{direction:'higher',minimum:0,maximum:1,failureScore:0}])),repeats:2,seed:20261110,timeoutMs:180000,
 live:{maxCalls:3,maxToolCalls:8,maxOutputTokens:4096,maxReportedTokens:24000,reasoning:'low'},
 policies:{baseline:{name:'Previous production inquiry policy at 7c9b135',text:readFileSync(join(source,'previous-policy.txt'),'utf8').trim()},candidate:{name:stage==='confirmation'?'Compact inquiry policy':stage==='calibration'?'Policy with proposition calibration':'Inquiry policy',text:RESEARCH_INSTRUCTIONS}}};
writeFileSync(join(project,'evaluation.json'),JSON.stringify(config,null,2));
writeFileSync(join(target,'protocol.json'),JSON.stringify({config,manifest,stage,scope:'Same-author methodological component evaluation, not independent field validation'},null,2));
const result=spawnSync(process.execPath,[join(repo,'dist/cli.js'),'research',project,'evaluate','evaluation.json'],{encoding:'utf8',env:process.env,maxBuffer:8*1024*1024});
writeFileSync(join(target,'report.json'),result.stdout||'');writeFileSync(join(target,'stderr.log'),result.stderr||'');
if(result.error)throw result.error;if(result.status!==0){process.stderr.write(result.stderr||'Evaluation failed');process.exit(result.status||1);}
const r=JSON.parse(result.stdout);console.log(JSON.stringify({root:target,stage,id:r.id,hash:r.hash,trials:r.trials.length,successful:r.trials.filter(t=>t.success).length,paired:r.paired,reportedTokens:r.trials.reduce((n,t)=>n+(t.modelUsage?.reportedTokens||0),0)},null,2));
