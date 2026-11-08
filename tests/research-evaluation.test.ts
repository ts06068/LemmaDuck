import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskStore } from "../src/state.js";
import { ResearchEvaluation, type EvaluationConfig } from "../src/research-evaluation.js";

function fixture(t: { after: (fn: () => void) => void }) {
  const root = mkdtempSync(join(tmpdir(), "lemmaduck-evaluation-")); const project = join(root, "project"); mkdirSync(project);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [name, values, answer] of [["a", [1, 2, 3], 6], ["b", [3, 5, 7], 15]] as const) {
    writeFileSync(join(project, name + ".json"), JSON.stringify({ values })); writeFileSync(join(root, name + "-truth.json"), JSON.stringify({ answer }));
  }
  const method = `import fs from 'node:fs'; const r=JSON.parse(fs.readFileSync(process.argv[2])); if ('truth' in r) throw Error('Truth exposed'); fs.writeFileSync(process.argv[3],JSON.stringify({answer:r.input.values.reduce((a,b)=>a+b,0),uncertainty:'Exact finite fixture calculation'}));`;
  writeFileSync(join(project, "baseline.mjs"), method); writeFileSync(join(project, "candidate.mjs"), method);
  writeFileSync(join(project, "score.mjs"), `import fs from 'node:fs'; const r=JSON.parse(fs.readFileSync(process.argv[2])); fs.writeFileSync(process.argv[3],JSON.stringify({valid:true,metrics:{correctness:r.candidate.answer===r.truth.answer?1:0,error:Math.min(100,Math.abs(r.candidate.answer-r.truth.answer))},reason:'Hidden fixture arithmetic answer'}));`);
  const task = new TaskStore(project, join(root, "state")); const evaluation = new ResearchEvaluation(task);
  const config: EvaluationConfig = { purpose: "fixture-contract", identity: { provider: "none", model: "deterministic arithmetic fixture", tools: ["local arithmetic"] },
    baseline: { executable: process.execPath, script: "baseline.mjs", files: [] }, candidate: { executable: process.execPath, script: "candidate.mjs", files: [] }, evaluator: { executable: process.execPath, script: "score.mjs", files: [] },
    tasks: ["a", "b"].map(id => ({ id, input: id + ".json", truth: join(root, id + "-truth.json"), context: "synthetic-" + id })),
    outcomes: { correctness: { direction: "higher", minimum: 0, maximum: 1, failureScore: 0 }, error: { direction: "lower", minimum: 0, maximum: 100, failureScore: 100 } }, repeats: 2, seed: 7, timeoutMs: 10000 };
  return { root, project, task, evaluation, config };
}

test("paired evaluation freezes independent truth, repeats both methods equally, and groups differences by task", async t => {
  const f = fixture(t); const report = await f.evaluation.evaluate(f.config);
  assert.equal(report.trials.length, 8); assert.ok(report.trials.every(trial => trial.success && trial.metrics.correctness === 1));
  assert.equal(report.paired.correctness!.distinctTasks, 2); assert.equal(report.paired.correctness!.meanDifference, 0);
  assert.equal(report.paired.error!.meanDifference, 0); assert.equal(report.budget.tokenUsage, "unknown");
  assert.equal(f.evaluation.report(report.id).hash, report.hash);
  const review = f.evaluation.review(report.id); assert.ok(review.cases.every(item => item.inputArtifact && item.outputArtifact));
  assert.ok(!JSON.stringify(review).includes('"baseline"')); assert.ok(!JSON.stringify(review).includes('"metrics"'));
  assert.throws(() => f.evaluation.reveal(report.id), /blinded ratings/);
  const rating = { reviewer: "Synthetic reviewer fixture", qualification: "Contract test only", reportHash: report.hash!, ratings: review.cases.map(item => ({ blindId: item.blindId, validity: 5, importance: 1, utility: 2, notes: "Synthetic arithmetic; no scientific novelty" })) };
  assert.throws(() => f.evaluation.rate(report.id, { ...rating, ratings: rating.ratings.slice(1) }), /every blinded trial/);
  f.evaluation.rate(report.id, rating); const revealed = f.evaluation.reveal(report.id);
  assert.equal(Object.values(revealed.mapping).filter(value => value === "baseline").length, 4);
  assert.throws(() => f.evaluation.rate(report.id, rating), /EEXIST/);
});

test("evaluation failures stay in the denominator with preregistered worst-case scores", async t => {
  const f = fixture(t); writeFileSync(join(f.project, "baseline.mjs"), "process.exit(7)");
  const report = await f.evaluation.evaluate({ ...f.config, repeats: 1 });
  assert.equal(report.trials.length, 4); assert.equal(report.trials.filter(trial => !trial.success).length, 2);
  assert.equal(report.paired.correctness!.meanDifference, 1); assert.equal(report.paired.error!.meanDifference, -100);
  assert.match(JSON.stringify(report.limitations), /fixture/);
});

test("evaluation rejects exposed truth, a shared verifier, and unbounded failure scoring", async t => {
  const f = fixture(t);
  await assert.rejects(f.evaluation.evaluate({ ...f.config, tasks: f.config.tasks.map(task => ({ ...task, truth: join(f.project, "a.json") })) }), /outside/);
  await assert.rejects(f.evaluation.evaluate({ ...f.config, evaluator: f.config.baseline }), /independent/);
  await assert.rejects(f.evaluation.evaluate({ ...f.config, outcomes: { error: { direction: "lower", minimum: 0, maximum: 100, failureScore: 0 } } }), /worst-case/);
});
