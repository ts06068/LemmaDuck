import { createHash, randomUUID } from "node:crypto";
import { accessSync, constants, closeSync, existsSync, fstatSync, openSync, readFileSync, readSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";
import { confinedPath } from "./security.js";
import { privateDir } from "./paths.js";
import { atomicJson, type TaskStore } from "./state.js";

const text = () => Type.String({ minLength: 1, maxLength: 16000 });
const texts = () => Type.Array(text(), { maxItems: 100 });
const id = () => Type.String({ pattern: "^[a-f0-9-]{36}$" });
const ids = () => Type.Array(id(), { minItems: 1, maxItems: 100, uniqueItems: true });
const number = () => Type.Number();
const rank = () => Type.Integer({ minimum: 1, maximum: 5 });
const adapter = Type.Object({ executable: text(), script: text(), files: texts() }, { additionalProperties: false });
const prediction = Type.Object({ hypothesis: id(), metric: text(), lower: number(), upper: number(), rationale: text() }, { additionalProperties: false });
export const researchSchemas = {
  observation: Type.Object({ statement: text(), files: texts(), location: text() }, { additionalProperties: false }),
  question: Type.Object({ question: text(), importance: rank(), uncertainty: text(), observations: ids() }, { additionalProperties: false }),
  hypothesis: Type.Object({ question: id(), mechanism: text(), assumptions: texts(), rejection: text() }, { additionalProperties: false }),
  study: Type.Object({ question: id(), design: Type.Literal("observational"), objective: Type.Union([Type.Literal("description"), Type.Literal("prediction"), Type.Literal("causal")]),
    population: text(), eligibility: text(), unitOfAnalysis: text(), timeZero: text(), exposure: text(), comparator: text(), exposureWindow: text(),
    outcome: text(), outcomeUnits: text(), outcomeWindow: text(), followUp: text(), censoring: text(), competingEvents: text(),
    temporalAlignment: Type.Union([Type.Literal("aligned"), Type.Literal("ambiguous")]), estimand: text(), confounders: texts(),
    exchangeability: text(), consistency: text(), positivity: text(), interference: text(), missingData: text(), sensitivityPlan: text(),
    claimPolicy: Type.Union([Type.Literal("associational"), Type.Literal("conditional-causal")]), files: Type.Array(text(), { minItems: 1, uniqueItems: true }) }, { additionalProperties: false }),
  experiment: Type.Object({ question: id(), study: Type.Optional(id()), predictions: Type.Array(prediction, { minItems: 2, maxItems: 30 }),
    inputs: Type.Array(text(), { minItems: 1, maxItems: 100, uniqueItems: true }), analysis: adapter, verifier: adapter,
    parameters: Type.Record(Type.String(), Type.Unknown()), rationale: text(), discrimination: rank(), feasibility: rank(),
    cost: Type.Integer({ minimum: 1, maximum: 1000000 }), context: text(), mode: Type.Union([Type.Literal("exploratory"), Type.Literal("confirmatory")]) }, { additionalProperties: false }),
  anomaly: Type.Object({ expected: text(), observed: text(), hypotheses: ids(), runs: Type.Array(id(), { maxItems: 100 }),
    measurement: Type.Union([Type.Literal("unchecked"), Type.Literal("valid"), Type.Literal("invalid")]), nextTest: text(),
    status: Type.Union([Type.Literal("open"), Type.Literal("resolved")]), resolution: Type.Optional(text()) }, { additionalProperties: false }),
  claim: Type.Object({ statement: text(), claimType: Type.Union([Type.Literal("descriptive"), Type.Literal("predictive"), Type.Literal("causal")]),
    scope: text(), runs: ids(), limitations: texts(), study: Type.Optional(id()), identification: Type.Optional(text()) }, { additionalProperties: false }),
  feedback: Type.Object({ source: text(), correction: text(), rationale: text(), affected: ids() }, { additionalProperties: false }),
  rule: Type.Object({ feedback: id(), description: text(), requiredParameters: texts(), allowedClaimTypes: texts(), regressionRuns: ids(), transferRuns: ids(), status: Type.Optional(Type.Union([Type.Literal("active"), Type.Literal("retired")])), retirementReason: Type.Optional(text()) }, { additionalProperties: false }),
  capability: Type.Object({ name: text(), description: text(), files: Type.Array(text(), { minItems: 1 }), developmentRuns: ids(), transferRuns: ids(), limitations: texts() }, { additionalProperties: false }),
};
export type ResearchKind = keyof typeof researchSchemas;
export type Experiment = Static<typeof researchSchemas.experiment>;
export type Hypothesis = Static<typeof researchSchemas.hypothesis>;
export type Prediction = Static<typeof prediction>;
export type Ref = { id: string; hash: string };
export type FileRef = { path: string; sha256: string };
export type FrozenAdapter = { executable: FileRef; script: string; files: FileRef[] };
export type Plan = { analysis: FrozenAdapter; verifier: FrozenAdapter; inputs: FileRef[] };
export type Measurement = { valid: boolean; metrics: Record<string, number>; reason: string };
export type Run = { experiment: Ref; scope: string; status: "running" | "verified" | "invalid" | "failed" | "unknown";
  startedAt: string; endedAt?: string; measurement?: Measurement; analysisArtifact?: string; verifierArtifact?: string; outputArtifact?: string;
  assessment?: Record<string, "compatible" | "contradicted" | "underdetermined">; error?: string; resolution?: string };
export type ResearchRecord = { version: 1; id: string; hash: string; revision: number; previous?: string; taskId: string;
  kind: ResearchKind | "run"; authority: "agent-proposal" | "owner" | "runner"; at: string; dependencies: Ref[];
  files: FileRef[]; data: Record<string, unknown>; plan?: Plan };
export type Index = { version: 1; taskId: string; heads: Record<string, string> };

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object") return "{" + Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([key, val]) => JSON.stringify(key) + ":" + canonical(val)).join(",") + "}";
  const result = JSON.stringify(value); if (result === undefined) throw new Error("Research records must be JSON values."); return result;
}
export function hash(value: unknown): string { return createHash("sha256").update(canonical(value)).digest("hex"); }
export function fileDigest(path: string): string {
  const fd = openSync(path, "r");
  try {
    if (!fstatSync(fd).isFile()) throw new Error("A regular file is required: " + path);
    const digest = createHash("sha256"); const buffer = Buffer.alloc(1024 * 1024); let count;
    while ((count = readSync(fd, buffer, 0, buffer.length, null))) digest.update(buffer.subarray(0, count));
    return digest.digest("hex");
  } finally { closeSync(fd); }
}
export function validateMeasurement(value: unknown): Measurement {
  const schema = Type.Object({ valid: Type.Boolean(), metrics: Type.Record(Type.String(), Type.Number()), reason: text() }, { additionalProperties: false });
  if (!Value.Check(schema, value)) throw new Error("Verifier must return {valid, metrics: finite numbers, reason}.");
  for (const metric of Object.values(value.metrics)) if (!Number.isFinite(metric)) throw new Error("Nonfinite verifier metric.");
  return value;
}

export class ResearchStore {
  readonly dir: string;
  readonly indexFile: string;
  constructor(readonly task: TaskStore) {
    this.dir = join(task.dir, "research", task.task.id); this.indexFile = join(this.dir, "index.json");
  }
  index(): Index {
    if (!existsSync(this.indexFile)) return { version: 1, taskId: this.task.task.id, heads: {} };
    const index = JSON.parse(readFileSync(this.indexFile, "utf8")) as Index;
    if (index.version !== 1 || index.taskId !== this.task.task.id) throw new Error("Research task changed.");
    return index;
  }
  get(id: string, revisionHash = this.index().heads[id]): ResearchRecord {
    if (!/^[a-f0-9-]{36}$/.test(id) || !/^[a-f0-9]{64}$/.test(revisionHash || "")) throw new Error("Unknown research record.");
    const record = JSON.parse(readFileSync(join(this.dir, "records", revisionHash + ".json"), "utf8")) as ResearchRecord;
    const { hash: digest, ...body } = record;
    if (digest !== revisionHash || hash(body) !== digest || body.id !== id || body.taskId !== this.task.task.id) throw new Error("Research record integrity check failed.");
    return record;
  }
  ref(id: string, kind?: ResearchRecord["kind"]): Ref {
    const record = this.get(id); if (kind && record.kind !== kind) throw new Error(`Expected ${kind}, received ${record.kind}.`);
    return { id, hash: record.hash };
  }
  list(kind?: ResearchRecord["kind"]): ResearchRecord[] {
    return Object.keys(this.index().heads).map(id => this.get(id)).filter(record => !kind || record.kind === kind);
  }
  source(path: string): FileRef { const absolute = confinedPath(this.task.project, path); return { path: relative(this.task.project, absolute), sha256: fileDigest(absolute) }; }
  freezeAdapter(spec: Experiment["analysis"]): FrozenAdapter {
    if (!isAbsolute(spec.executable)) throw new Error("Adapter executable must be an absolute path selected by the owner.");
    accessSync(spec.executable, constants.X_OK);
    const files = [...new Set([spec.script, ...spec.files])].map(path => this.source(path));
    return { executable: { path: spec.executable, sha256: fileDigest(spec.executable) }, script: this.source(spec.script).path, files };
  }
  stale(record: ResearchRecord, seen = new Set<string>(), cache = new Map<string, boolean>(), files = new Map<string, string>()): boolean {
    if (cache.has(record.hash)) return cache.get(record.hash)!;
    const digest = (path: string) => { if (!files.has(path)) files.set(path, fileDigest(path)); return files.get(path)!; };
    if (seen.has(record.hash)) throw new Error("Cyclic research dependencies.");
    const visiting = new Set(seen).add(record.hash);
    if (this.index().heads[record.id] !== record.hash) return true;
    for (const file of record.files) {
      try { if (digest(confinedPath(this.task.project, file.path)) !== file.sha256) return true; } catch { return true; }
    }
    if (record.plan) for (const adapter of [record.plan.analysis, record.plan.verifier]) {
      try { if (digest(adapter.executable.path) !== adapter.executable.sha256) return true; } catch { return true; }
    }
    const result = record.dependencies.some(ref => this.index().heads[ref.id] !== ref.hash || this.stale(this.get(ref.id, ref.hash), visiting, cache, files));
    cache.set(record.hash, result); return result;
  }
  private persist(kind: ResearchRecord["kind"], data: Record<string, unknown>, authority: ResearchRecord["authority"], dependencies: Ref[], files: FileRef[], previous?: ResearchRecord, plan?: Plan): ResearchRecord {
    const index = this.index();
    const body: Omit<ResearchRecord, "hash"> = { version: 1, id: previous?.id || randomUUID(), revision: (previous?.revision || 0) + 1,
      ...(previous ? { previous: previous.hash } : {}), taskId: index.taskId, kind, authority, at: new Date().toISOString(), dependencies, files, data, ...(plan ? { plan } : {}) };
    if (dependencies.some(ref => ref.id === body.id || this.dependsOn(ref.id, body.id))) throw new Error("Cyclic research dependencies.");
    const record: ResearchRecord = { ...body, hash: hash(body) };
    privateDir(join(this.dir, "records"));
    writeFileSync(join(this.dir, "records", record.hash + ".json"), JSON.stringify(record, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    index.heads[record.id] = record.hash; atomicJson(this.indexFile, index);
    this.task.event("research_revision", { id: record.id, kind, hash: record.hash, previous: previous?.hash, authority });
    this.refreshHandoff();
    return record;
  }
  private dependsOn(id: string, target: string, seen = new Set<string>()): boolean {
    if (seen.has(id)) return false; seen.add(id);
    return this.get(id).dependencies.some(ref => ref.id === target || this.dependsOn(ref.id, target, seen));
  }
  verifiedRuns(ids: string[]): ResearchRecord[] {
    return ids.map(id => {
      const ref = this.ref(id, "run"); const record = this.get(ref.id); const run = record.data as Run;
      if (run.status !== "verified" || !run.measurement?.valid || this.stale(record)) throw new Error("Current independently verified runs are required.");
      return record;
    });
  }
  rules(): ResearchRecord[] {
    const rules = this.list("rule").filter(record => record.data.status !== "retired");
    if (rules.some(record => this.stale(record))) throw new Error("A reviewed domain rule is stale; revalidate it before further plans or claims.");
    return rules;
  }
  record(kind: ResearchKind, value: unknown, authority: "agent-proposal" | "owner" | "runner" = "agent-proposal", replace?: string): ResearchRecord {
    if (kind === "claim" && value && typeof value === "object" && "claimType" in value && value.claimType === "formal") throw new Error("A numerical verifier cannot establish a formal proof. Formal claims require a proof-checking adapter, which is not implemented.");
    if (!Object.hasOwn(researchSchemas, kind) || !Value.Check(researchSchemas[kind], value)) throw new Error(`Invalid ${kind} record. Inspect duck research PROJECT schema ${kind}.`);
    const data = JSON.parse(JSON.stringify(value)) as Record<string, any>;
    const previous = replace ? this.get(replace) : undefined;
    if (previous && previous.kind !== kind) throw new Error("A revision must preserve the record kind.");
    if (["rule", "capability"].includes(kind) && authority !== "owner") throw new Error("Only the owner can promote reviewed rules and capabilities.");
    if (kind === "rule") {
      data.status ||= "active";
      if (data.status === "retired") {
        if (!previous || !data.retirementReason) throw new Error("Retiring a rule requires its existing ID and an observed reason.");
        return this.persist(kind, data, authority, [], [], previous);
      }
    }
    if (kind === "anomaly" && data.status === "resolved" && authority !== "owner") throw new Error("Only the owner can resolve a scientific anomaly.");
    const dependencies: Ref[] = [];
    const link = (id: string, targetKind?: ResearchRecord["kind"]) => { const ref = this.ref(id, targetKind); if (kind !== "anomaly" && this.stale(this.get(id))) throw new Error("A dependency is stale; review and revise it first."); dependencies.push(ref); };
    const files: FileRef[] = []; let plan: Plan | undefined;
    if (kind === "observation") files.push(...(data.files as string[]).map(path => this.source(path)));
    if (kind === "question") for (const id of data.observations) link(id, "observation");
    if (kind === "hypothesis") link(data.question, "question");
    if (kind === "study") {
      link(data.question, "question"); files.push(...(data.files as string[]).map(path => this.source(path)));
      if (data.claimPolicy === "conditional-causal" && (data.objective !== "causal" || data.temporalAlignment !== "aligned")) throw new Error("A conditional causal study needs an explicit causal objective and aligned time zero/exposure/outcome windows.");
    }
    if (kind === "experiment") {
      const experiment = data as Experiment; link(experiment.question, "question");
      if (experiment.study) {
        link(experiment.study, "study");
        if (this.get(experiment.study).data.question !== experiment.question) throw new Error("The experiment and study must address the same registered question.");
      }
      const signatures = new Set<string>(); const hypotheses = new Set<string>(); const predictedMetrics = new Set<string>();
      for (const prediction of experiment.predictions) {
        const key = prediction.hypothesis + ":" + prediction.metric;
        if (predictedMetrics.has(key)) throw new Error("Each hypothesis must predict each metric exactly once.");
        predictedMetrics.add(key);
        if (prediction.lower > prediction.upper || !Number.isFinite(prediction.lower) || !Number.isFinite(prediction.upper)) throw new Error("Invalid prediction interval.");
        link(prediction.hypothesis, "hypothesis"); const hypothesis = this.get(prediction.hypothesis).data as Hypothesis;
        if (hypothesis.question !== experiment.question) throw new Error("Competing hypotheses must address this question.");
        hypotheses.add(prediction.hypothesis);
      }
      for (const hypothesis of hypotheses) signatures.add(canonical(experiment.predictions.filter(p => p.hypothesis === hypothesis).map(({ hypothesis: _id, rationale: _r, ...p }) => p).sort((a, b) => a.metric.localeCompare(b.metric))));
      if (hypotheses.size < 2 || signatures.size < 2) throw new Error("A discriminating experiment requires distinct predictions from competing hypotheses.");
      const metrics = new Set(experiment.predictions.map(p => p.metric));
      for (const hypothesis of hypotheses) if ([...metrics].some(metric => !experiment.predictions.some(p => p.hypothesis === hypothesis && p.metric === metric))) throw new Error("Each hypothesis must predict the same measured metrics.");
      const frozen: Plan = { analysis: this.freezeAdapter(experiment.analysis), verifier: this.freezeAdapter(experiment.verifier), inputs: experiment.inputs.map(path => this.source(path)) };
      plan = frozen;
      if (frozen.verifier.files.some(file => frozen.analysis.files.some(other => other.sha256 === file.sha256))) throw new Error("Use a separate verifier implementation with no shared analysis code.");
      const inputPaths = new Set(plan.inputs.map(f => f.path));
      if ([...plan.analysis.files, ...plan.verifier.files].some(f => inputPaths.has(f.path))) throw new Error("Adapter code and input files must be distinct.");
      files.push(...plan.inputs, ...plan.analysis.files, ...plan.verifier.files);
      for (const rule of this.rules()) {
        const required = rule.data.requiredParameters as string[];
        if (required.some(key => !Object.hasOwn(experiment.parameters, key))) throw new Error(`Reviewed rule requires experiment parameters: ${required.join(", ")}`);
        dependencies.push(this.ref(rule.id));
      }
    }
    if (["anomaly", "claim"].includes(kind)) {
      for (const id of data.runs as string[]) link(id, "run");
      if (kind === "anomaly") {
        for (const id of data.hypotheses as string[]) link(id, "hypothesis");
        if (data.status === "resolved" && (!data.resolution || !data.runs.length)) throw new Error("Resolving an anomaly requires an observed resolution and a linked run.");
      } else {
        this.verifiedRuns(data.runs);
        if (data.claimType === "causal" && !data.identification) throw new Error("A causal claim needs an explicit identification argument; prediction alone is insufficient.");
        if (data.study) {
          link(data.study, "study");
          if ((data.runs as string[]).some(id => this.get((this.get(id).data as Run).experiment.id).data.study !== data.study)) throw new Error("Study claims must use runs linked to that exact protocol.");
        }
        if (data.claimType === "causal") {
          if (!data.study) throw new Error("A causal claim requires a registered study protocol and owner-reviewed identification assumptions.");
          const study = this.get(data.study);
          if (study.authority !== "owner" || study.data.claimPolicy !== "conditional-causal" || study.data.temporalAlignment !== "aligned") throw new Error("This protocol permits association only; causal interpretation is not approved.");
        }
        for (const rule of this.rules()) {
          const allowed = rule.data.allowedClaimTypes as string[];
          if (allowed.length && !allowed.includes(data.claimType)) throw new Error("Claim type is outside the reviewed domain rule.");
          dependencies.push(this.ref(rule.id));
        }
      }
    }
    if (kind === "feedback") {
      // A correction is a historical event, retained when its target is revised.
      data.targetRevisions = (data.affected as string[]).map(id => this.ref(id));
    }
    if (kind === "rule" || kind === "capability") {
      const development = (kind === "rule" ? data.regressionRuns : data.developmentRuns) as string[];
      const transfer = data.transferRuns as string[];
      const original = this.verifiedRuns(development), later = this.verifiedRuns(transfer);
      const originals = new Set(original.map(record => (record.data as Run).experiment.id));
      const originalInputs = new Set(original.flatMap(record => this.get((record.data as Run).experiment.id).plan!.inputs.map(f => f.sha256)));
      const originalContexts = new Set(original.map(record => this.get((record.data as Run).experiment.id).data.context));
      if (later.some(record => originals.has((record.data as Run).experiment.id) || originalContexts.has(this.get((record.data as Run).experiment.id).data.context) || !this.get((record.data as Run).experiment.id).plan!.inputs.some(f => !originalInputs.has(f.sha256)))) throw new Error("Transfer checks require distinct experiments, contexts, and input contents.");
      if (later.some(record => Date.parse((record.data as Run).startedAt) < Math.max(...original.map(item => Date.parse((item.data as Run).endedAt || (item.data as Run).startedAt))))) throw new Error("Transfer evidence must follow development runs.");
      if (kind === "rule") {
        link(data.feedback, "feedback");
        const feedback = this.get(data.feedback);
        if (feedback.authority !== "owner") throw new Error("Rule promotion requires owner-attributed domain feedback.");
        if (later.some(record => Date.parse((record.data as Run).startedAt) < Date.parse(feedback.at))) throw new Error("Rule transfer evidence must follow the recorded feedback.");
        for (const record of [...original, ...later]) {
          const experiment = this.get((record.data as Run).experiment.id).data as Experiment;
          if ((data.requiredParameters as string[]).some(key => !Object.hasOwn(experiment.parameters, key))) throw new Error("Regression and transfer plans must satisfy the proposed rule.");
        }
        if ((data.allowedClaimTypes as string[]).some(type => !["descriptive", "predictive", "causal"].includes(type))) throw new Error("Invalid rule claim type.");
      } else {
        const methods = (data.files as string[]).map(path => this.source(path));
        for (const record of [...original, ...later]) {
          const experiment = this.get((record.data as Run).experiment.id);
          if (methods.some(method => !experiment.plan!.analysis.files.some(file => file.path === method.path && file.sha256 === method.sha256))) throw new Error("The same versioned method must be present in development and transfer adapters.");
        }
        files.push(...methods);
      }
      for (const id of [...development, ...transfer]) link(id, "run");
    }
    return this.persist(kind, data, authority, [...new Map(dependencies.map(ref => [ref.id, ref])).values()], [...new Map(files.map(file => [file.path, file])).values()], previous, plan);
  }
  saveRun(run: Run, replace?: string): ResearchRecord {
    const previous = replace ? this.get(replace) : undefined;
    if (previous && previous.kind !== "run") throw new Error("Expected a research run.");
    return this.persist("run", JSON.parse(JSON.stringify(run)), "runner", [run.experiment], [], previous);
  }
  candidates(cache = new Map<string, boolean>(), files = new Map<string, string>()) {
    const used = new Set(this.list("run").map(record => (record.data as Run).experiment.hash));
    return this.list("experiment").filter(record => !this.stale(record, new Set(), cache, files) && !used.has(record.hash)).map(record => {
      const data = record.data as Experiment; const importance = this.get(data.question).data.importance as number;
      return { id: record.id, hash: record.hash, score: importance * data.discrimination * data.feasibility / data.cost,
        importance, discrimination: data.discrimination, feasibility: data.feasibility, cost: data.cost, rationale: data.rationale,
        caveat: "Ordinal researcher/model judgments; this score is not measured information gain." };
    }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  }
  summary() {
    const records = this.list(); const cache = new Map<string, boolean>(); const files = new Map<string, string>();
    const stale = (record: ResearchRecord) => this.stale(record, new Set(), cache, files);
    const runs = records.filter(record => record.kind === "run");
    const assessments: Record<string, { run: string; assessment: string }[]> = {};
    for (const record of runs) for (const [hypothesis, assessment] of Object.entries((record.data as Run).assessment || {})) (assessments[hypothesis] ||= []).push({ run: record.id, assessment: stale(record) ? "stale evidence" : assessment });
    return { taskId: this.task.task.id, records: records.map(record => ({ id: record.id, hash: record.hash, kind: record.kind, revision: record.revision, authority: record.authority, stale: stale(record), data: record.data })),
      assessments, unsupportedClaims: records.filter(record => record.kind === "claim" && record.data.claimType === "formal").map(record => record.id), candidates: this.candidates(cache, files), openAnomalies: records.filter(record => record.kind === "anomaly" && record.data.status === "open").map(record => record.id),
      caution: "Compatibility is bounded evidence, not proof of a hypothesis or causal identification. Owner approval is not independent scientific validation." };
  }
  refreshHandoff(): void {
    const summary = this.summary();
    this.task.task.research = { artifact: this.task.artifact(JSON.stringify(summary, null, 2)), count: summary.records.length,
      stale: summary.records.filter(record => record.stale).length, anomalies: summary.openAnomalies.length };
    this.task.save();
  }
}

export function assess(experiment: Experiment, measurement: Measurement): Run["assessment"] {
  const hypotheses = [...new Set(experiment.predictions.map(p => p.hypothesis))];
  const result: NonNullable<Run["assessment"]> = {};
  for (const id of hypotheses) {
    const predictions = experiment.predictions.filter(p => p.hypothesis === id);
    result[id] = !measurement.valid || predictions.some(p => measurement.metrics[p.metric] === undefined) ? "underdetermined" : predictions.every(p => measurement.metrics[p.metric]! >= p.lower && measurement.metrics[p.metric]! <= p.upper) ? "compatible" : "contradicted";
  }
  if (Object.values(result).filter(status => status === "compatible").length > 1) for (const id of hypotheses) if (result[id] === "compatible") result[id] = "underdetermined";
  return result;
}
