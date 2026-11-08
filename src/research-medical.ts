import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ResearchStore, fileDigest, type Experiment, type Run } from "./research.js";
import { ResearchRunner } from "./research-runner.js";
import type { TaskStore } from "./state.js";

const NHEFS_SHA = "6726827bfcebf7324d786211a517d0515532c2405cc71c5a1fab68d7116ea16c";
export async function medicalStudy(task: TaskStore, signal?: AbortSignal) {
  const research = new ResearchStore(task);
  if (research.list().length) throw new Error("Use a fresh observational study task for this public-data reproduction.");
  const runtime = JSON.parse(readFileSync(join(task.project, "runtime.json"), "utf8"));
  const protocol = JSON.parse(readFileSync(join(task.project, "protocol.json"), "utf8"));
  if (runtime.data_sha256 !== NHEFS_SHA || fileDigest(join(task.project, "nhefs.csv")) !== NHEFS_SHA) throw new Error("Prepare the pinned public NHEFS teaching data first.");
  const files = ["nhefs.csv", "protocol.json", "requirements.lock", "runtime.json"];
  const observation = research.record("observation", { statement: "Public NHEFS cessation groups may differ in measured baseline covariates; some follow-up weights are missing", files, location: "qsmk, baseline covariates and wt82_71 in the pinned public teaching release" }, "owner");
  const question = research.record("question", { question: protocol.question, importance: 4, uncertainty: "Magnitude and direction of the change from crude to prespecified adjusted sample contrast", observations: [observation.id] }, "owner");
  const study = research.record("study", { question: question.id, design: "observational", objective: "description", population: protocol.population,
    eligibility: "Keep records with qsmk, wt82_71 and all nine prespecified baseline covariates; report every exclusion", unitOfAnalysis: protocol.unit_of_analysis,
    timeZero: protocol.time_zero, exposure: protocol.exposure, comparator: protocol.comparator, exposureWindow: "Between baseline and the 1982 survey; exact cessation time unavailable",
    outcome: "wt82_71", outcomeUnits: "kg", outcomeWindow: "Baseline to 1982", followUp: "Survey follow-up to 1982; no fabricated person-time",
    censoring: "Missing weight outcomes excluded in this illustration; group-specific counts reported", competingEvents: "Death and loss to follow-up can affect observation; not treated as confirmed event-free follow-up",
    temporalAlignment: "ambiguous", estimand: protocol.estimand, confounders: protocol.covariates,
    exchangeability: "Unverified; measured adjustment does not eliminate unmeasured confounding", consistency: "Cessation versions and timing are insufficiently specified for a baseline intervention",
    positivity: "Inspect fitted propensity range, weights, effective sample sizes and balance", interference: "Not assessed; no-interference is not established",
    missingData: protocol.missing_data, sensitivityPlan: protocol.sensitivity_plan, claimPolicy: "associational", files }, "owner");
  const shifted = research.record("hypothesis", { question: question.id, mechanism: "Measured baseline adjustment materially attenuates the observed contrast", assumptions: ["Registered propensity model is numerically estimable"], rejection: "Adjusted minus crude contrast is greater than -0.25 kg" }, "owner");
  const unchanged = research.record("hypothesis", { question: question.id, mechanism: "The registered adjustment changes the observed contrast by at most 0.25 kg", assumptions: ["Same complete-case population in both calculations"], rejection: "Absolute adjustment shift exceeds 0.25 kg" }, "owner");
  const experiment: Experiment = { question: question.id, study: study.id,
    predictions: [{ hypothesis: shifted.id, metric: "adjustment_shift_kg", lower: -10, upper: -.25, rationale: "A materially smaller adjusted contrast would support measured-confounding sensitivity, without establishing causality" },
      { hypothesis: unchanged.id, metric: "adjustment_shift_kg", lower: -.25, upper: .25, rationale: "A small change would support stability to this particular measured adjustment" }],
    inputs: files, analysis: { executable: runtime.python, script: "analysis.py", files: [] }, verifier: { executable: runtime.python, script: "verifier.py", files: [] },
    parameters: { endpoint: "normalized IPW observed mean weight-change contrast", units: "kg", estimand: protocol.estimand, timeZero: protocol.time_zero, claimPolicy: "associational", bootstrap: protocol.uncertainty },
    rationale: "Hold the complete-case cohort fixed, compare crude and prespecified weighted contrasts, and independently recompute every bootstrap/diagnostic", discrimination: 4, feasibility: 4, cost: 1, context: "public NHEFS observational teaching cohort", mode: "exploratory" };
  const plan = research.record("experiment", experiment, "owner");
  const runner = new ResearchRunner(research);
  const scope = runner.approve({ description: "Owner-invoked public NHEFS reproduction; frozen protocol and independent numerical verification; no model calls or private data", experiments: [plan.id], maxRuns: 1,
    timeoutMs: 240000, maxTotalMs: 300000, maxCostUnits: 1, expiresAt: new Date(Date.now() + 600000).toISOString(), stopOnAnomaly: true });
  const record = await runner.run(plan.id, scope.id, signal); const run = record.data as Run;
  let claim: string | undefined;
  if (run.status === "verified") {
    const m = run.measurement!.metrics;
    claim = research.record("claim", { statement: `In the registered complete-case teaching sample (n=${m.complete_cases}), the observed crude contrast is ${m.crude_difference_kg} kg and the normalized IPW contrast is ${m.ipw_difference_kg} kg; the refitted-bootstrap interval is [${m.ci_lower_kg}, ${m.ci_upper_kg}] kg.`,
      claimType: "descriptive", study: study.id, scope: "The pinned public NHEFS teaching release and this prespecified complete-case/model definition", runs: [record.id],
      limitations: protocol.identification_limits }, "owner").id;
  }
  task.checkpoint();
  return { purpose: "Public observational-data reproduction, not an AI-performance or causal-effect validation", sourceSha256: NHEFS_SHA, study: study.id,
    experiment: plan.id, run: record, claim, identification: "association only; no causal ground truth or domain-expert endorsement", summary: research.summary() };
}
