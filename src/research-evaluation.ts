import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";
import { confinedPath, withinRoot } from "./security.js";
import { privateDir } from "./paths.js";
import type { TaskStore } from "./state.js";
import { atomicJson } from "./state.js";
import { ResearchStore, fileDigest, hash, validateMeasurement, type FrozenAdapter } from "./research.js";
import { ModelGateway, liveModel, modelBudgetSchema, modelPoliciesSchema, liveResearchToolNames, type ModelUsage } from "./research-model.js";
import { TaskStore as TrialTaskStore } from "./state.js";
import { executeAdapter, readAdapterResult } from "./research-runner.js";

const adapter = Type.Object({ executable: Type.String(), script: Type.String(), files: Type.Array(Type.String()) }, { additionalProperties: false });
const schema = Type.Object({
  purpose: Type.Union([Type.Literal("fixture-contract"), Type.Literal("research-evaluation")]),
  identity: Type.Object({ provider: Type.String(), model: Type.String(), tools: Type.Array(Type.String()) }, { additionalProperties: false }),
  baseline: adapter, candidate: adapter, evaluator: adapter,
  tasks: Type.Array(Type.Object({ id: Type.String({ minLength: 1 }), input: Type.String(), truth: Type.String(), context: Type.String({ minLength: 1 }) }, { additionalProperties: false }), { minItems: 2, maxItems: 100 }),
  live: Type.Optional(modelBudgetSchema), policies: Type.Optional(modelPoliciesSchema),
  outcomes: Type.Record(Type.String(), Type.Object({ direction: Type.Union([Type.Literal("higher"), Type.Literal("lower")]), minimum: Type.Number(), maximum: Type.Number(), failureScore: Type.Number() }, { additionalProperties: false })),
  repeats: Type.Integer({ minimum: 1, maximum: 20 }), seed: Type.Integer({ minimum: 1, maximum: 2147483647 }),
  timeoutMs: Type.Integer({ minimum: 10, maximum: 300000 }),
}, { additionalProperties: false });
export type EvaluationConfig = Static<typeof schema>;
type Trial = { blindId: string; task: string; context: string; repeat: number; order: number; inputHash: string; outputArtifact?: string;
  logArtifact?: string; inputArtifact?: string; elapsedMs: number; success: boolean; metrics: Record<string, number>; error?: string; tokenUsage: "unknown" | "reported"; modelUsage?: ModelUsage };
type Report = { version: 1; id: string; hash?: string; at: string; taskId: string; purpose: EvaluationConfig["purpose"]; configHash: string;
  identity: EvaluationConfig["identity"]; conditions?: { baseline: string; candidate: string }; liveRuntime?: ReturnType<ModelGateway["provenance"]>; runtimeFiles?: Record<string, string>; budget: { timeoutMs: number; attemptsPerMethodTask: 1; tokenUsage: "unknown" | "reported"; live?: EvaluationConfig["live"] }; trials: Trial[];
  paired: Record<string, { direction: string; distinctTasks: number; meanDifference: number; perTask: Record<string, number> }>; limitations: string[] };
const ratingsSchema = Type.Object({ reviewer: Type.String({ minLength: 1 }), qualification: Type.String({ minLength: 1 }),
  reportHash: Type.String({ pattern: "^[a-f0-9]{64}$" }), ratings: Type.Array(Type.Object({ blindId: Type.String(), validity: Type.Integer({ minimum: 1, maximum: 5 }),
    importance: Type.Integer({ minimum: 1, maximum: 5 }), utility: Type.Integer({ minimum: 1, maximum: 5 }), notes: Type.String({ minLength: 1 }) }, { additionalProperties: false }), { minItems: 1 }) }, { additionalProperties: false });

function random(seed: number): () => number { let state = seed; return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; }; }
function copyCode(research: ResearchStore, adapter: FrozenAdapter, destination: string): void {
  for (const file of adapter.files) {
    const source = confinedPath(research.task.project, file.path);
    if (fileDigest(source) !== file.sha256) throw new Error("Frozen evaluation adapter changed.");
    const target = confinedPath(destination, file.path); mkdirSync(join(target, ".."), { recursive: true }); writeFileSync(target, readFileSync(source), { flag: "wx", mode: 0o600 });
  }
}
export class ResearchEvaluation {
  readonly dir: string;
  constructor(readonly task: TaskStore) { this.dir = join(task.dir, "research-evaluations", task.task.id); }
  path(id: string): string { if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid evaluation ID."); return join(this.dir, id); }
  report(id: string): Report {
    const report = JSON.parse(readFileSync(join(this.path(id), "report.json"), "utf8")) as Report;
    const { hash: digest, ...body } = report;
    if (digest !== hash(body) || report.taskId !== this.task.task.id || report.id !== id) throw new Error("Evaluation report integrity check failed.");
    return report;
  }
  async evaluate(value: unknown, signal?: AbortSignal): Promise<Report> {
    if (!Value.Check(schema, value)) throw new Error("Invalid paired evaluation configuration.");
    const config = JSON.parse(JSON.stringify(value)) as EvaluationConfig;
    if (this.task.unresolved().length) throw new Error("Resolve interrupted operations before evaluation.");
    if (!Object.keys(config.outcomes).length || Object.values(config.outcomes).some(metric => metric.minimum > metric.maximum || metric.failureScore !== (metric.direction === "higher" ? metric.minimum : metric.maximum))) throw new Error("Declare bounded outcomes and a worst-case failure score before evaluation.");
    if (new Set(config.tasks.map(task => task.id)).size !== config.tasks.length) throw new Error("Evaluation task IDs must be unique.");
    const research = new ResearchStore(this.task);
    const methods = { baseline: research.freezeAdapter(config.baseline), candidate: research.freezeAdapter(config.candidate) };
    const evaluator = research.freezeAdapter(config.evaluator);
    if (Object.values(methods).some(method => method.files.some(file => evaluator.files.some(other => other.sha256 === file.sha256)))) throw new Error("Evaluator implementation must be independent of both methods.");
    // Truth is owner-selected, outside the agent project. Only the evaluator receives it.
    const tasks = config.tasks.map(task => {
      if (!isAbsolute(task.truth) || task.truth === confinedPath(this.task.project, task.input)) throw new Error("Truth must use an owner-selected absolute path outside the project.");
      const truth = realpathSync(task.truth); const input = research.source(task.input); const truthHash = fileDigest(truth);
      if (withinRoot(this.task.project, truth)) throw new Error("Keep evaluator truth outside the agent project.");
      return { ...task, truth, inputHash: input.sha256, truthHash, input: confinedPath(this.task.project, task.input) };
    });
    if (config.live && JSON.stringify([...config.identity.tools].sort()) !== JSON.stringify([...liveResearchToolNames].sort())) throw new Error("Live tool identity must match the shared gateway toolset.");
    if (config.policies && !config.live) throw new Error("Policy comparisons require the instrumented live gateway.");
    const gateway = config.live ? new ModelGateway(config.identity, config.live, await liveModel(config.identity.provider, config.identity.model), config.policies) : undefined;
    const liveRuntime = gateway?.provenance();
    const id = randomUUID(), directory = privateDir(this.path(id)); const rng = random(config.seed);
    const runtimeFiles = gateway ? gateway.snapshot(join(directory, "runtime"), liveRuntime) : undefined;
    const report: Report = { version: 1, id, at: new Date().toISOString(), taskId: this.task.task.id, purpose: config.purpose, configHash: hash({ config, methods, evaluator, tasks, ...(liveRuntime ? { liveRuntime, runtimeFiles } : {}) }),
      identity: config.identity, ...(config.policies ? { conditions: { baseline: config.policies.baseline.name, candidate: config.policies.candidate.name } } : {}), ...(liveRuntime ? { liveRuntime, runtimeFiles } : {}), budget: { timeoutMs: config.timeoutMs, attemptsPerMethodTask: 1, tokenUsage: config.live ? "reported" : "unknown", ...(config.live ? { live: config.live } : {}) }, trials: [], paired: {},
      limitations: ["Synthetic fixture results establish harness mechanics only when purpose is fixture-contract.", config.live ? "Pinned model identity, call counts, tool calls, and provider-reported token usage are recorded by the parent gateway." : "Model identity and toolset are owner-declared; adapters must independently attest actual usage for a live comparison.",
        config.live ? "Identical call/tool/token ceilings apply to both conditions. Monetary charges and remaining subscription quota are unknown; token accounting is provider-reported." : "Wall time, process attempts, source hashes, and bounded output are enforced; internal model calls, tokens, and charges are unknown.", "Truth is withheld from method payloads; same-user processes are not isolated by an OS sandbox.",
        "Repeated runs are grouped by task; these descriptive differences do not establish statistical significance, novelty, or scientific benefit."] };
    const mapping: Record<string, "baseline" | "candidate"> = {};
    atomicJson(join(directory, "protocol.json"), { config, methods, evaluator, tasks, ...(liveRuntime ? { liveRuntime, runtimeFiles } : {}) });
    const op = "research-evaluation:" + id; this.task.beginOperation(op, "research_evaluation", report.configHash);
    let interrupted = false;
    try {
      for (let repeat = 0; repeat < config.repeats; repeat++) for (const task of tasks) {
        const order = rng() < .5 ? ["baseline", "candidate"] as const : ["candidate", "baseline"] as const;
        for (const [position, methodName] of order.entries()) {
          signal?.throwIfAborted(); const blindId = randomUUID(); mapping[blindId] = methodName;
          const runRoot = privateDir(join(directory, blindId)); const methodDir = privateDir(join(runRoot, "method")); const evaluatorDir = privateDir(join(runRoot, "evaluator"));
          const trial: Trial = { blindId, task: task.id, context: task.context, repeat, order: position, inputHash: task.inputHash, elapsedMs: 0, success: false, metrics: {}, tokenUsage: "unknown" };
          report.trials.push(trial); const started = Date.now();
          let modelControl: Awaited<ReturnType<ModelGateway["trial"]>> | undefined;
          try {
            copyCode(research, methods[methodName], methodDir); copyCode(research, evaluator, evaluatorDir);
            if (fileDigest(task.input) !== task.inputHash || fileDigest(task.truth) !== task.truthHash) throw new Error("Evaluation source changed after protocol freeze.");
            // Freeze before either method executes; do not expose truth or the evaluator path.
            const taskInput = readFileSync(task.input); const truth = JSON.parse(readFileSync(task.truth, "utf8"));
            const trialInput = JSON.parse(taskInput.toString());
            if (gateway) modelControl = await gateway.trial(new TrialTaskStore(methodDir, join(directory, "trial-state")), methodName, trialInput);
            const request = { ...(modelControl ? { modelControl: modelControl.control } : {}), version: 1, task: task.id, context: task.context, input: JSON.parse(taskInput.toString()), identity: config.identity, budget: report.budget, repeat, seed: config.seed + repeat };
            const execution = await executeAdapter(methods[methodName], methodDir, request, config.timeoutMs, signal);
            trial.inputArtifact = this.task.artifact(taskInput.toString());
            trial.logArtifact = this.task.artifact(readFileSync(join(methodDir, ".execution.log"), "utf8"));
            if (execution.interrupted) { interrupted = true; throw new Error("Method interrupted: " + execution.reason); }
            if (execution.exitCode !== 0) throw new Error("Method failed with exit code " + execution.exitCode);
            const candidate = readAdapterResult(join(methodDir, ".result.json")); trial.outputArtifact = this.task.artifact(JSON.stringify(candidate));
            for (const file of evaluator.files) if (fileDigest(confinedPath(evaluatorDir, file.path)) !== file.sha256) throw new Error("Evaluator modified during method execution.");
            const verified = await executeAdapter(evaluator, evaluatorDir, { version: 1, task: task.id, candidate, truth }, config.timeoutMs, signal);
            if (verified.interrupted) { interrupted = true; throw new Error("Evaluator interrupted: " + verified.reason); }
            if (verified.exitCode !== 0) throw new Error("Evaluator failed with exit code " + verified.exitCode);
            const measurement = validateMeasurement(readAdapterResult(join(evaluatorDir, ".result.json")));
            if (!measurement.valid) throw new Error("Independent evaluation invalid: " + measurement.reason);
            if (Object.entries(config.outcomes).some(([metric, rule]) => measurement.metrics[metric] === undefined || measurement.metrics[metric]! < rule.minimum || measurement.metrics[metric]! > rule.maximum)) throw new Error("Evaluator omitted an outcome or returned an out-of-range score.");
            for (const file of evaluator.files) if (fileDigest(confinedPath(evaluatorDir, file.path)) !== file.sha256) throw new Error("Evaluator modified itself during scoring.");
            trial.metrics = measurement.metrics; trial.success = true;
          } catch (error) { trial.error = String(error); if (signal?.aborted) interrupted = true; }
          if (modelControl) {
            await modelControl.close(); trial.modelUsage = modelControl.usage; trial.tokenUsage = "reported";
            if (modelControl.usage.limitExceeded || modelControl.usage.errors.length) { trial.success = false; trial.error = (trial.error || "") + "; " + modelControl.usage.errors.join("; "); }
          }
          trial.elapsedMs = Date.now() - started;
          atomicJson(join(directory, "partial.json"), { trials: report.trials });
          if (interrupted) throw new Error("Interrupted paired evaluation; partial records retained. Reconcile before retrying.");
        }
      }
      const metrics = Object.keys(config.outcomes);
      for (const metric of metrics) {
        const perTask: Record<string, number> = {};
        for (const task of tasks) {
          const average = (method: string) => report.trials.filter(trial => trial.task === task.id && mapping[trial.blindId] === method).reduce((sum, trial) => sum + (trial.success ? trial.metrics[metric]! : config.outcomes[metric]!.failureScore), 0) / config.repeats;
          perTask[task.id] = average("candidate") - average("baseline");
        }
        report.paired[metric] = { direction: config.outcomes[metric]!.direction, distinctTasks: tasks.length, meanDifference: Object.values(perTask).reduce((a, b) => a + b, 0) / tasks.length, perTask };
      }
      this.task.endOperation(op, { status: "completed", terminationReason: "exit", exitCode: 0 }, JSON.stringify({ trials: report.trials.length, successful: report.trials.filter(trial => trial.success).length }));
    } catch (error) {
      this.task.endOperation(op, { status: "unknown", terminationReason: "interrupted", error: String(error) }, JSON.stringify(report.trials)); throw error;
    } finally { atomicJson(join(directory, "private-mapping.json"), mapping); this.task.checkpoint(); }
    report.hash = hash(report); atomicJson(join(directory, "report.json"), report); return report;
  }
  review(id: string) {
    const report = this.report(id);
    return { id, reportHash: report.hash, rubric: "Rate validity, scientific importance, and practical utility from 1 (poor) to 5 (strong). Cite concrete evidence and uncertainty. Identities and automated scores are withheld.",
      cases: report.trials.map(trial => ({ blindId: trial.blindId, task: trial.task, context: trial.context, inputHash: trial.inputHash, inputArtifact: trial.inputArtifact, outputArtifact: trial.outputArtifact, failure: trial.success ? undefined : trial.error })) };
  }
  rate(id: string, value: unknown) {
    const report = this.report(id);
    if (!Value.Check(ratingsSchema, value) || value.reportHash !== report.hash) throw new Error("Ratings must identify the frozen report and reviewer qualifications.");
    const expected = new Set(report.trials.map(trial => trial.blindId));
    if (value.ratings.length !== expected.size || new Set(value.ratings.map(rating => rating.blindId)).size !== expected.size || value.ratings.some(rating => !expected.has(rating.blindId))) throw new Error("Rate every blinded trial exactly once before revealing identities.");
    const receipt = { ...value, at: new Date().toISOString(), authority: "owner-recorded; reviewer identity is declared, not independently authenticated" };
    writeFileSync(join(this.path(id), "ratings.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", mode: 0o600 }); return receipt;
  }
  reveal(id: string) {
    this.report(id); if (!existsSync(join(this.path(id), "ratings.json"))) throw new Error("Record blinded ratings before revealing identities.");
    return { mapping: JSON.parse(readFileSync(join(this.path(id), "private-mapping.json"), "utf8")), ratings: JSON.parse(readFileSync(join(this.path(id), "ratings.json"), "utf8")) };
  }
}
