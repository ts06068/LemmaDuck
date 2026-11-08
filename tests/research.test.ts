import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskStore, renderHandoff } from "../src/state.js";
import { ResearchStore, assess, type Experiment, type Run } from "../src/research.js";
import { ResearchRunner, executeAdapter } from "../src/research-runner.js";
import { researchToolDefinitions } from "../src/research-tools.js";

export function researchFixture(t: { after: (fn: () => void) => void }) {
  const root = mkdtempSync(join(tmpdir(), "lemmaduck-research-")); const project = join(root, "project"); mkdirSync(project);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(project, "data.json"), "[10,20,30]\n");
  writeFileSync(join(project, "transfer.json"), "[11,20,30]\n");
  writeFileSync(join(project, "method.mjs"), "export const mean = xs => xs.reduce((a,b)=>a+b,0)/xs.length;\n");
  writeFileSync(join(project, "analysis.mjs"), `import fs from 'node:fs'; import {mean} from './method.mjs';
const r=JSON.parse(fs.readFileSync(process.argv[2])); const xs=JSON.parse(fs.readFileSync(Object.values(r.inputs)[0]));
fs.writeFileSync(process.argv[3], JSON.stringify({mean:mean(xs)}));`);
  writeFileSync(join(project, "verifier.mjs"), `import fs from 'node:fs';
const r=JSON.parse(fs.readFileSync(process.argv[2])); const xs=JSON.parse(fs.readFileSync(Object.values(r.inputs)[0]));
let total=0; for (const x of xs) total+=x; const value=total/xs.length;
fs.writeFileSync(process.argv[3],JSON.stringify({valid:Math.abs(value-r.candidate.mean)<1e-10,metrics:{mean:value},reason:'Independent sum/count against frozen observations'}));`);
  const task = new TaskStore(project, join(root, "state")); const research = new ResearchStore(task); const runner = new ResearchRunner(research);
  const observation = research.record("observation", { statement: "Draft and observations disagree", files: ["data.json"], location: "data.json rows 1-3" });
  const question = research.record("question", { question: "Which mean is compatible with the data?", importance: 4, uncertainty: "Draft claims 25; observations need checking", observations: [observation.id] });
  const a = research.record("hypothesis", { question: question.id, mechanism: "Mean near 20", assumptions: ["complete observations"], rejection: "Independent mean outside 19..21" });
  const b = research.record("hypothesis", { question: question.id, mechanism: "Mean near 25", assumptions: ["draft correct"], rejection: "Independent mean outside 24..26" });
  const plan: Experiment = { question: question.id, predictions: [ { hypothesis: a.id, metric: "mean", lower: 19, upper: 21, rationale: "Direct recomputation" }, { hypothesis: b.id, metric: "mean", lower: 24, upper: 26, rationale: "Draft-compatible value" } ],
    inputs: ["data.json"], analysis: { executable: process.execPath, script: "analysis.mjs", files: ["method.mjs"] }, verifier: { executable: process.execPath, script: "verifier.mjs", files: [] },
    parameters: { endpoint: "arithmetic mean", units: "synthetic units" }, rationale: "Direct calculation distinguishes both claims", discrimination: 5, feasibility: 5, cost: 1, context: "development", mode: "confirmatory" };
  const experiment = research.record("experiment", plan);
  const approve = (experiments = [experiment.id], limits = {}) => runner.approve({ description: "Synthetic fixture only", experiments, maxRuns: experiments.length, timeoutMs: 10000, maxTotalMs: 30000, maxCostUnits: 10, expiresAt: new Date(Date.now() + 60000).toISOString(), stopOnAnomaly: true, ...limits });
  return { root, project, task, research, runner, observation, question, a, b, plan, experiment, approve };
}

test("scientific records validate structure, competing predictions, provenance, and task isolation", t => {
  const f = researchFixture(t);
  assert.throws(() => f.research.record("question", { question: "missing fields" }), /Invalid/);
  assert.throws(() => f.research.record("experiment", { ...f.plan, predictions: f.plan.predictions.map(p => ({ ...p, lower: 19, upper: 21 })) }), /distinct predictions/);
  assert.throws(() => f.research.record("experiment", { ...f.plan, inputs: ["../escape"] }), /outside/);
  assert.throws(() => f.research.record("experiment", { ...f.plan, verifier: f.plan.analysis }), /separate verifier/);
  assert.throws(() => f.research.record("experiment", { ...f.plan, predictions: [...f.plan.predictions, f.plan.predictions[0]] }), /exactly once/);
  const other = new ResearchStore(new TaskStore(f.project, join(f.root, "other-state")));
  assert.throws(() => other.get(f.observation.id), /Unknown/);
  const revised = f.research.record("hypothesis", { ...f.a.data, mechanism: "Revised explanation" }, "agent-proposal", f.a.id);
  assert.equal(revised.revision, 2); assert.equal(f.research.get(f.a.id, f.a.hash).data.mechanism, "Mean near 20");
  assert.equal(f.research.stale(f.experiment), true);
});

test("real adapters and separate verifier update hypotheses, preserve rejection, and support bounded claims", async t => {
  const f = researchFixture(t); const scope = f.approve();
  const record = await f.runner.run(f.experiment.id, scope.id); const run = record.data as Run;
  assert.equal(run.status, "verified"); assert.equal(run.measurement!.metrics.mean, 20);
  assert.equal(run.assessment![f.a.id], "compatible"); assert.equal(run.assessment![f.b.id], "contradicted");
  assert.ok(run.analysisArtifact && run.verifierArtifact && run.outputArtifact);
  const claim = f.research.record("claim", { statement: "The synthetic mean is 20", claimType: "descriptive", scope: "These three observations", runs: [record.id], limitations: ["No population inference"] });
  assert.equal(f.research.stale(claim), false);
  assert.throws(() => f.research.record("claim", { ...claim.data, claimType: "causal" }), /identification/);
  assert.ok(f.research.summary().assessments[f.b.id]!.some(row => row.assessment === "contradicted"));
  await assert.rejects(f.runner.run(f.experiment.id, f.approve().id), /already attempted/);
});

test("changed sources invalidate claims transitively and frozen approvals cannot follow revisions", async t => {
  const f = researchFixture(t); const scope = f.approve(); const run = await f.runner.run(f.experiment.id, scope.id);
  const claim = f.research.record("claim", { statement: "Mean", claimType: "descriptive", scope: "Fixture", runs: [run.id], limitations: [] });
  writeFileSync(join(f.project, "data.json"), "[2,4,6]");
  for (const record of [f.observation, f.question, f.a, f.experiment, run, claim]) assert.equal(f.research.stale(record), true);
  f.research.refreshHandoff(); assert.ok(f.task.task.research!.stale >= 6);
  assert.match(renderHandoff(f.task.task), /stale/);
  await assert.rejects(f.runner.run(f.experiment.id, scope.id), /stale dependencies/);
});

test("owner scope freezes predictions and verifier, rejects expiry and budgets without executing", async t => {
  const f = researchFixture(t);
  assert.throws(() => f.approve(undefined, { expiresAt: "invalid" }), /expired scope/);
  const budget = f.approve(undefined, { maxCostUnits: 1 });
  const revised = f.research.record("experiment", { ...f.plan, cost: 2 }, "agent-proposal", f.experiment.id);
  await assert.rejects(f.runner.run(revised.id, budget.id), /differs/);
  await assert.rejects(f.runner.run(revised.id, f.approve([revised.id], { maxCostUnits: 1 }).id), /budget exhausted/);
  const scope = f.approve([revised.id]); writeFileSync(join(f.project, "verifier.mjs"), "changed verifier");
  await assert.rejects(f.runner.run(revised.id, scope.id), /stale/); assert.equal(f.research.list("run").length, 0);
});

test("invalid measurements cannot support claims and generate an actionable anomaly", async t => {
  const f = researchFixture(t);
  writeFileSync(join(f.project, "verifier.mjs"), `import fs from 'node:fs'; fs.writeFileSync(process.argv[3],JSON.stringify({valid:false,metrics:{mean:20},reason:'Measurement unit is unknown'}));`);
  const experiment = f.research.record("experiment", f.plan, "owner", f.experiment.id); const scope = f.approve([experiment.id]);
  const run = await f.runner.run(experiment.id, scope.id);
  assert.equal(run.data.status, "invalid"); assert.equal(f.research.summary().openAnomalies.length, 1);
  assert.match(f.runner.usage(scope.id).stopped!, /owner review/);
  assert.throws(() => f.research.record("claim", { statement: "Unsupported", claimType: "descriptive", scope: "Fixture", runs: [run.id], limitations: [] }), /verified runs/);
});

test("overlapping predictions and missing metrics remain underdetermined", t => {
  const f = researchFixture(t); const predictions = [f.plan.predictions[0]!, { ...f.plan.predictions[1]!, lower: 20, upper: 30 }];
  assert.deepEqual(Object.values(assess({ ...f.plan, predictions }, { valid: true, metrics: { mean: 20 }, reason: "Fixture" })!), ["underdetermined", "underdetermined"]);
  assert.deepEqual(Object.values(assess(f.plan, { valid: true, metrics: {}, reason: "No measurement" })!), ["underdetermined", "underdetermined"]);
});

test("cancellation preserves partial output, consumes the trial, and requires observed reconciliation", async t => {
  const f = researchFixture(t);
  writeFileSync(join(f.project, "analysis.mjs"), `import fs from 'node:fs'; console.log('PARTIAL_OBSERVATION'); fs.writeFileSync('started','yes'); setTimeout(()=>{},30000);`);
  const experiment = f.research.record("experiment", f.plan, "owner", f.experiment.id); const scope = f.approve([experiment.id]);
  const stop = new AbortController(); const pending = f.runner.run(experiment.id, scope.id, stop.signal);
  const current = f.research.list("run")[0]!;
  for (let i = 0; i < 300 && !existsSync(join(f.research.dir, "runs", current.id, "analysis", "started")); i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(existsSync(join(f.research.dir, "runs", current.id, "analysis", "started"))); stop.abort();
  const record = await pending; assert.equal(record.data.status, "unknown");
  assert.match(readFileSync(join(f.task.dir, "artifacts", f.task.task.id, record.data.analysisArtifact + ".txt"), "utf8"), /PARTIAL_OBSERVATION/);
  assert.equal(f.task.unresolved().length, 1);
  await assert.rejects(f.runner.run(experiment.id, scope.id), /unknown operations/);
  f.runner.reconcile(record.id, "Observed the child process stopped; inspected its partial staging output");
  assert.equal(f.research.get(record.id).data.status, "failed"); assert.equal(f.task.unresolved().length, 0);
  await assert.rejects(f.runner.run(experiment.id, scope.id), /stopped/);
});

test("domain rules require owner feedback and subsequent transfer evidence; methods require reuse", async t => {
  const f = researchFixture(t); const first = await f.runner.run(f.experiment.id, f.approve().id);
  const proposed = f.research.record("feedback", { source: "Proposed domain correction", correction: "Specify the endpoint", rationale: "Avoid changing the target", affected: [f.experiment.id] });
  const { targetRevisions: _targets, ...correction } = proposed.data;
  const owner = f.research.record("feedback", correction, "owner");
  const transfer = f.research.record("experiment", { ...f.plan, inputs: ["transfer.json"], context: "independent-transfer" });
  const second = await f.runner.run(transfer.id, f.approve([transfer.id]).id);
  const rule = { feedback: proposed.id, description: "Require endpoint", requiredParameters: ["endpoint"], allowedClaimTypes: ["descriptive"], regressionRuns: [first.id], transferRuns: [second.id] };
  assert.throws(() => f.research.record("rule", rule, "owner"), /owner-attributed/);
  const promoted = f.research.record("rule", { ...rule, feedback: owner.id }, "owner"); assert.equal(promoted.authority, "owner");
  assert.throws(() => f.research.record("experiment", { ...f.plan, parameters: {} }), /requires experiment parameters/);
  const capability = { name: "mean", description: "Reusable arithmetic mean", files: ["method.mjs"], developmentRuns: [first.id], transferRuns: [second.id], limitations: ["Synthetic scalar data"] };
  assert.throws(() => f.research.record("capability", capability), /Only the owner/);
  assert.equal(f.research.record("capability", capability, "owner").kind, "capability");
  assert.throws(() => f.research.record("capability", { ...capability, transferRuns: [first.id] }, "owner"), /distinct experiments/);
  writeFileSync(join(f.project, "transfer.json"), "[99]");
  assert.throws(() => f.research.record("experiment", f.plan), /reviewed domain rule is stale/);
  assert.throws(() => f.research.record("rule", { ...promoted.data, status: "retired", retirementReason: "Transfer input corrected" }, "agent-proposal", promoted.id), /Only the owner/);
  f.research.record("rule", { ...promoted.data, status: "retired", retirementReason: "Transfer input corrected; rule will be re-evaluated" }, "owner", promoted.id);
  assert.equal(f.research.rules().length, 0);
  assert.equal(f.research.record("experiment", f.plan).kind, "experiment");
});

test("review and agent tools cannot approve scopes or promote domain rules", async t => {
  const f = researchFixture(t); const tools = researchToolDefinitions(f.task, () => true);
  assert.ok(!tools.some(tool => /approve|promote/.test(tool.name)));
  const invoke = (name: string, args: unknown) => tools.find(tool => tool.name === name)!.execute("outer-tool", args);
  await assert.rejects(invoke("record_research", { kind: "observation", data: {} }), /Read-only/);
  await assert.rejects(invoke("run_research_experiment", { scope: f.approve().id }), /Read-only/);
  const inspected = await invoke("inspect_research", {}); assert.match(JSON.stringify(inspected), /Mean near 20/);
});

test("timeouts are unknown outcomes and a candidate batch stops on inconclusive evidence", async t => {
  const f = researchFixture(t);
  writeFileSync(join(f.project, "analysis.mjs"), "setTimeout(()=>{},30000);");
  const timed = f.research.record("experiment", f.plan, "owner", f.experiment.id);
  const record = await f.runner.run(timed.id, f.approve([timed.id], { timeoutMs: 100 }).id);
  assert.equal(record.data.status, "unknown"); assert.match(String(record.data.error), /timeout/);
  f.runner.reconcile(record.id, "Observed process termination and inspected staging; no valid result");
});

test("inconclusive cycles preserve anomalies and cannot be resolved by an agent proposal", async t => {
  const f = researchFixture(t);
  const ambiguous = f.research.record("experiment", { ...f.plan, predictions: [f.plan.predictions[0], { ...f.plan.predictions[1], lower: 20, upper: 30 }], discrimination: 5 });
  const remaining = f.research.record("experiment", { ...f.plan, discrimination: 1 });
  const scope = f.approve([ambiguous.id, remaining.id]); const results = await f.runner.cycle(scope.id);
  assert.equal(results.length, 1); assert.equal((results[0]!.data as Run).experiment.id, ambiguous.id);
  assert.ok(Object.values((results[0]!.data as Run).assessment!).every(value => value === "underdetermined"));
  const anomaly = f.research.list("anomaly")[0]!;
  assert.throws(() => f.research.record("anomaly", { ...anomaly.data, status: "resolved", resolution: "Ignore this result" }, "agent-proposal", anomaly.id), /Only the owner/);
  assert.equal(f.research.summary().openAnomalies.length, 1);
});


test("scientific tools bind to the new task after an in-process task switch", async t => {
  const f = researchFixture(t); const tools = researchToolDefinitions(f.task, () => false);
  const inspect = tools.find(tool => tool.name === "inspect_research")!;
  assert.match(JSON.stringify(await inspect.execute("first", {})), /Mean near 20/);
  f.task.newTask("Independent research question");
  const response = await inspect.execute("second", {});
  const current = JSON.parse(response.content[0]!.text);
  assert.equal(current.records.length, 0); assert.equal(current.taskId, f.task.task.id);
  await assert.rejects(inspect.execute("foreign", { id: f.a.id }), /Unknown research record/);
});


test("an expired dispatch deadline refuses execution after integrity checks", async t => {
  const f = researchFixture(t);
  await assert.rejects(executeAdapter(f.experiment.plan!.analysis, f.project, {}, 10000, undefined, Date.now() - 1), /expired before dispatch/);
  assert.equal(existsSync(join(f.project, ".request.json")), false);
});

test("observational protocols preserve timing and prevent unsupported causal interpretation", async t => {
  const f = researchFixture(t);
  const specification = { question: f.question.id, design: "observational", objective: "description", population: "Synthetic study population", eligibility: "All three complete observations", unitOfAnalysis: "One participant",
    timeZero: "Baseline examination", exposure: "Exposure recorded during follow-up", comparator: "No exposure during follow-up", exposureWindow: "Baseline to outcome measurement", outcome: "Observed mean", outcomeUnits: "units", outcomeWindow: "Baseline to follow-up", followUp: "Fixed follow-up", censoring: "No censoring in fixture", competingEvents: "Not assessed", temporalAlignment: "ambiguous", estimand: "Observed mean contrast", confounders: ["Age"], exchangeability: "Unverified", consistency: "Versions unspecified", positivity: "Not assessed", interference: "Not assessed", missingData: "Complete-case illustration", sensitivityPlan: "Revisit timing before causal interpretation", claimPolicy: "associational", files: ["data.json"] };
  assert.throws(() => f.research.record("study", { ...specification, objective: "causal", claimPolicy: "conditional-causal" }, "owner"), /aligned time zero/);
  const study = f.research.record("study", specification, "owner");
  const experiment = f.research.record("experiment", { ...f.plan, study: study.id });
  const run = await f.runner.run(experiment.id, f.approve([experiment.id]).id);
  const claim = { statement: "Observed sample contrast", claimType: "descriptive", scope: "Fixture only", study: study.id, runs: [run.id], limitations: ["Confounding and time-zero ambiguity remain"] };
  assert.equal(f.research.record("claim", claim).kind, "claim");
  assert.throws(() => f.research.record("claim", { ...claim, claimType: "causal", identification: "Model agreement is not identification" }), /association only/);
  assert.throws(() => f.research.record("claim", { ...claim, study: undefined, claimType: "causal", identification: "Assumptions asserted" }), /registered study protocol/);
});


test("a future dispatch deadline bounds a running adapter before its longer timeout", async t => {
  const f = researchFixture(t);
  writeFileSync(join(f.project, "analysis.mjs"), "setInterval(() => {}, 1000)");
  const research = f.research;
  const adapter = research.freezeAdapter({ executable: process.execPath, script: "analysis.mjs", files: [] });
  const started = Date.now();
  const result = await executeAdapter(adapter, f.project, {}, 10000, undefined, started + 1000);
  assert.equal(result.interrupted, true); assert.equal(result.reason, "timeout");
  assert.ok(Date.now() - started < 7000, "the shorter approved deadline must terminate the adapter");
});
