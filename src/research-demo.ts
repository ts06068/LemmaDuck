import { existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { ResearchStore, type Experiment } from "./research.js";
import { ResearchRunner } from "./research-runner.js";
import type { TaskStore } from "./state.js";

export async function researchDemo(task: TaskStore) {
  const research = new ResearchStore(task); const runner = new ResearchRunner(research);
  if (research.list().length) throw new Error("Use a fresh inquiry project/task for the demonstration.");
  for (const path of ["development.json", "transfer.json", "analysis.py", "verifier.py", "method.py"]) if (!existsSync(join(task.project, path))) throw new Error("Create the example with duck init PROJECT --kind inquiry first.");
  const python = execFileSync("python3", ["-c", "import sys; print(sys.executable)"], { encoding: "utf8" }).trim();
  const observation = research.record("observation", { statement: "Synthetic predictions have large absolute errors before unit conversion", files: ["development.json"], location: "rows[*].measured and rows[*].reference" }, "owner");
  const question = research.record("question", { question: "Does unit normalization explain this synthetic error?", importance: 4, uncertainty: "A scale mapping error and residual model error predict different changes", observations: [observation.id] }, "owner");
  const mapping = research.record("hypothesis", { question: question.id, mechanism: "Unit scale mismatch accounts for most of the error", assumptions: ["Reference values are correct", "The documented conversion scale applies"], rejection: "Error reduction is less than 50 synthetic units" }, "owner");
  const residual = research.record("hypothesis", { question: question.id, mechanism: "Residual model error remains after conversion", assumptions: ["Unit conversion has little explanatory value"], rejection: "Error reduction exceeds 5 synthetic units" }, "owner");
  const plan: Experiment = { question: question.id,
    predictions: [{ hypothesis: mapping.id, metric: "error_reduction", lower: 50, upper: 1000, rationale: "Conversion should remove most scale-driven error" }, { hypothesis: residual.id, metric: "error_reduction", lower: -5, upper: 5, rationale: "Unit conversion should have little effect" }],
    inputs: ["development.json"], analysis: { executable: python, script: "analysis.py", files: ["method.py"] }, verifier: { executable: python, script: "verifier.py", files: [] },
    parameters: { endpoint: "paired mean absolute error reduction", units: "synthetic reference units" }, rationale: "Change units while holding rows and references fixed", discrimination: 5, feasibility: 5, cost: 1, context: "development", mode: "confirmatory" };
  const development = research.record("experiment", plan, "owner");
  const approve = (id: string) => runner.approve({ description: "Owner-invoked local synthetic demonstration only", experiments: [id], maxRuns: 1, timeoutMs: 10000, maxTotalMs: 10000, maxCostUnits: 1, expiresAt: new Date(Date.now() + 60000).toISOString(), stopOnAnomaly: true });
  const first = await runner.run(development.id, approve(development.id).id);
  const claim = research.record("claim", { statement: "Unit normalization accounts for the error in these synthetic development rows", claimType: "descriptive", scope: "The supplied synthetic rows and reference scale", runs: [first.id], limitations: ["Does not establish transportability or clinical causality"] }, "owner");
  const feedback = research.record("feedback", { source: "Synthetic demonstration policy, not an expert review", correction: "Record endpoint and units before evaluation", rationale: "Preserve the target and scale across future tests", affected: [development.id] }, "owner");
  const transfer = research.record("experiment", { ...plan, inputs: ["transfer.json"], context: "different synthetic unit scale and values" }, "owner");
  const second = await runner.run(transfer.id, approve(transfer.id).id);
  const rule = research.record("rule", { feedback: feedback.id, description: "Require endpoint and units", requiredParameters: ["endpoint", "units"], allowedClaimTypes: ["descriptive", "predictive"], regressionRuns: [first.id], transferRuns: [second.id] }, "owner");
  const capability = research.record("capability", { name: "Unit normalization", description: "Reusable scale conversion evaluated by an independent implementation", files: ["method.py"], developmentRuns: [first.id], transferRuns: [second.id], limitations: ["Known positive scale, supplied reference values, synthetic scalar measurements"] }, "owner");
  task.checkpoint();
  return { demonstration: "synthetic, no model inference or expert validation", development: first, transfer: second, claim: claim.id, rule: rule.id, capability: capability.id, summary: research.summary() };
}

export async function evaluationDemo(task: TaskStore, signal?: AbortSignal) {
  const { ResearchEvaluation } = await import("./research-evaluation.js");
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const { randomUUID } = await import("node:crypto");
  const truth = join(task.dir, "evaluation-fixture-truth", randomUUID()); mkdirSync(truth, { recursive: true, mode: 0o700 });
  const python = execFileSync("python3", ["-c", "import sys; print(sys.executable)"], { encoding: "utf8" }).trim();
  for (const [name, answer] of [["a", 6], ["b", 15]] as const) writeFileSync(join(truth, name + ".json"), JSON.stringify({ answer }), { flag: "wx", mode: 0o600 });
  return new ResearchEvaluation(task).evaluate({ purpose: "fixture-contract", identity: { provider: "none", model: "identical deterministic arithmetic fixtures", tools: ["local arithmetic"] },
    baseline: { executable: python, script: "evaluation/baseline.py", files: [] }, candidate: { executable: python, script: "evaluation/candidate.py", files: [] }, evaluator: { executable: python, script: "evaluation/score.py", files: [] },
    tasks: ["a", "b"].map(id => ({ id, input: "evaluation/" + id + ".json", truth: join(truth, id + ".json"), context: "synthetic arithmetic " + id })),
    outcomes: { correctness: { direction: "higher", minimum: 0, maximum: 1, failureScore: 0 } }, repeats: 2, seed: 17, timeoutMs: 10000 }, signal);
}
