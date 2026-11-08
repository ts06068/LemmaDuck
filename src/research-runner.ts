import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, writeFileSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";
import { atomicJson } from "./state.js";
import { confinedPath } from "./security.js";
import { privateDir } from "./paths.js";
import { assess, fileDigest, hash, ResearchStore, validateMeasurement, type Experiment, type FileRef, type FrozenAdapter, type Ref, type ResearchRecord, type Run } from "./research.js";

const scopeSchema = Type.Object({
  description: Type.String({ minLength: 1, maxLength: 16000 }),
  experiments: Type.Array(Type.String({ pattern: "^[a-f0-9-]{36}$" }), { minItems: 1, maxItems: 100, uniqueItems: true }),
  maxRuns: Type.Integer({ minimum: 1, maximum: 100 }),
  timeoutMs: Type.Integer({ minimum: 10, maximum: 300000 }),
  maxTotalMs: Type.Integer({ minimum: 10, maximum: 86400000 }),
  maxCostUnits: Type.Integer({ minimum: 1, maximum: 100000000 }),
  expiresAt: Type.String(), stopOnAnomaly: Type.Boolean(),
}, { additionalProperties: false });
export type ScopeRequest = Static<typeof scopeSchema>;
export type Scope = ScopeRequest & { id: string; hash: string; taskId: string; approvedAt: string; authority: "owner-cli"; plans: Ref[] };
type Usage = { attempts: { run: string; experiment: string; cost: number; startedAt: string; elapsedMs?: number; status: Run["status"] }[]; stopped?: string };
const RESULT_LIMIT = 1024 * 1024;

export function readAdapterResult(path: string): unknown {
  const entry = lstatSync(path);
  if (!entry.isFile() || entry.isSymbolicLink() || entry.size > RESULT_LIMIT) throw new Error("Adapter result must be a regular JSON file no larger than 1 MiB.");
  return JSON.parse(readFileSync(path, "utf8"));
}
function checkedCopy(root: string, file: FileRef, destination: string): void {
  const source = confinedPath(root, file.path); const bytes = readFileSync(source);
  if (createHash("sha256").update(bytes).digest("hex") !== file.sha256) throw new Error("Frozen source changed: " + file.path);
  const target = confinedPath(destination, file.path); mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  writeFileSync(target, bytes, { flag: "wx", mode: 0o600 });
}
function checkAdapter(adapter: FrozenAdapter): void {
  if (fileDigest(adapter.executable.path) !== adapter.executable.sha256) throw new Error("Approved adapter executable changed.");
}
type Execution = { exitCode: number | null; elapsedMs: number; interrupted: boolean; reason?: string };
export async function executeAdapter(adapter: FrozenAdapter, cwd: string, manifest: unknown, timeoutMs: number, signal?: AbortSignal, deadline?: number): Promise<Execution> {
  signal?.throwIfAborted(); checkAdapter(adapter);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Invalid adapter timeout.");
  if (deadline !== undefined && Date.now() >= deadline) throw new Error("Approved execution window expired before dispatch.");
  const request = join(cwd, ".request.json"), output = join(cwd, ".result.json"), log = join(cwd, ".execution.log");
  writeFileSync(request, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  if (existsSync(output)) throw new Error("Adapter output already exists.");
  const fd = openSync(log, "wx", 0o600); const started = Date.now();
  const launchTimeout = deadline === undefined ? timeoutMs : Math.min(timeoutMs, deadline - started);
  if (launchTimeout <= 0) { closeSync(fd); throw new Error("Approved execution window expired before dispatch."); }
  return new Promise((resolve, reject) => {
    let bytes = 0; let reason: string | undefined; let killTimer: ReturnType<typeof setTimeout> | undefined; let finished = false;
    const child = spawn(adapter.executable.path, [adapter.script, request, output], { cwd, detached: true, stdio: ["ignore", "pipe", "pipe"],
      env: { PATH: dirname(adapter.executable.path) + ":/usr/bin:/bin", TMPDIR: cwd, PYTHONNOUSERSITE: "1", PYTHONDONTWRITEBYTECODE: "1", NO_COLOR: "1", OPENBLAS_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MKL_NUM_THREADS: "1" } });
    const kill = (cause: string) => {
      if (finished) return; reason ||= cause;
      try { process.kill(-child.pid!, "SIGTERM"); } catch { child.kill("SIGTERM"); }
      killTimer ||= setTimeout(() => { try { process.kill(-child.pid!, "SIGKILL"); } catch { /* exited */ } }, 500);
    };
    const onAbort = () => kill("cancelled"); signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) kill("cancelled");
    const timer = setTimeout(() => kill("timeout"), launchTimeout);
    const cleanup = () => { finished = true; clearTimeout(timer); if (killTimer) clearTimeout(killTimer); signal?.removeEventListener("abort", onAbort); closeSync(fd); };
    const data = (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 8 * RESULT_LIMIT) { kill("output limit"); return; }
      try { let offset = 0; while (offset < chunk.length) offset += writeSync(fd, chunk, offset, chunk.length - offset); }
      catch { kill("log capture failed"); }
    };
    child.stdout.on("data", data); child.stderr.on("data", data);
    child.once("error", error => { cleanup(); reject(error); });
    child.once("close", (exitCode, exitSignal) => {
      if (finished) return;
      // A spawned descendant may still be running after its entry point exits.
      try { process.kill(-child.pid!, "SIGKILL"); } catch { /* no descendants */ }
      cleanup(); resolve({ exitCode, elapsedMs: Date.now() - started, interrupted: !!reason || !!exitSignal, ...(reason || exitSignal ? { reason: reason || exitSignal! } : {}) });
    });
  });
}

export class ResearchRunner {
  constructor(readonly research: ResearchStore) {}
  private scopePath(id: string): string {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid scope ID.");
    return join(this.research.dir, "scopes", id + ".json");
  }
  private usagePath(id: string): string { this.scopePath(id); return join(privateDir(join(this.research.dir, "scope-usage")), id + ".json"); }
  scopes(): Scope[] {
    const dir = join(this.research.dir, "scopes");
    // No directory creation for read-only status.
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter(name => name.endsWith(".json")).map(name => this.scope(name.slice(0, -5)));
  }
  scope(id: string): Scope {
    const scope = JSON.parse(readFileSync(this.scopePath(id), "utf8")) as Scope; const { hash: digest, ...body } = scope;
    if (digest !== hash(body) || scope.taskId !== this.research.task.task.id || scope.id !== id) throw new Error("Scope integrity check failed.");
    return scope;
  }
  usage(id: string): Usage { const path = this.usagePath(id); return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { attempts: [] }; }
  approve(value: unknown): Scope {
    if (!Value.Check(scopeSchema, value) || !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= Date.now()) throw new Error("Invalid or expired scope. Provide exact experiments, limits, expiry, and stopOnAnomaly.");
    if (value.maxRuns > value.experiments.length) throw new Error("Each approved experiment may run once; maxRuns exceeds the plan count.");
    const plans = value.experiments.map(id => { const ref = this.research.ref(id, "experiment"); if (this.research.stale(this.research.get(id))) throw new Error("Cannot approve a stale experiment."); return ref; });
    const body = { ...value, id: randomUUID(), taskId: this.research.task.task.id, approvedAt: new Date().toISOString(), authority: "owner-cli" as const, plans };
    const scope = { ...body, hash: hash(body) }; privateDir(dirname(this.scopePath(scope.id)));
    writeFileSync(this.scopePath(scope.id), JSON.stringify(scope, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    this.research.task.event("research_scope_approved", scope); return scope;
  }
  recoverInterrupted(): void {
    for (const record of this.research.list("run")) {
      const run = record.data as Run; if (run.status !== "running") continue;
      this.research.saveRun({ ...run, status: "unknown", error: "Interrupted owner process; inspect partial effects before reconciliation." }, record.id);
      const usage = this.usage(run.scope); usage.stopped = "Interrupted run requires observed reconciliation.";
      const attempt = usage.attempts.find(item => item.run === record.id); if (attempt) attempt.status = "unknown";
      atomicJson(this.usagePath(run.scope), usage);
    }
  }
  reconcile(id: string, note: string): void {
    const record = this.research.get(id); const run = record.data as Run;
    if (record.kind !== "run" || run.status !== "unknown" || !note.trim()) throw new Error("Reconcile an unknown research run with an observed resolution.");
    this.research.saveRun({ ...run, status: "failed", resolution: note, endedAt: new Date().toISOString() }, id);
    const operation = this.research.task.task.operations.find(op => op.id === "research-run:" + id);
    if (operation) this.research.task.reconcile(operation.id, true, note);
    // The old scope remains stopped; resuming needs a newly reviewed scope.
  }
  async run(experimentId: string, scopeId: string, signal?: AbortSignal, ownerOperation?: string): Promise<ResearchRecord> {
    const store = this.research.task; signal?.throwIfAborted();
    if (store.unresolved().some(op => op.id !== ownerOperation) || this.research.list("run").some(record => ["running", "unknown"].includes((record.data as Run).status))) throw new Error("Resolve active or unknown operations before running an experiment.");
    const scope = this.scope(scopeId); const usage = this.usage(scopeId);
    if (usage.stopped || Date.parse(scope.expiresAt) <= Date.now()) throw new Error("Scope is stopped or expired; owner review is required.");
    const experiment = this.research.get(experimentId); const spec = experiment.data as Experiment;
    if (experiment.kind !== "experiment" || !scope.plans.some(ref => ref.id === experiment.id && ref.hash === experiment.hash) || this.research.stale(experiment)) throw new Error("Experiment differs from the approved scope or has stale dependencies.");
    if (usage.attempts.length >= scope.maxRuns || usage.attempts.reduce((sum, attempt) => sum + attempt.cost, 0) + spec.cost > scope.maxCostUnits) throw new Error("Approved trial or cost-unit budget exhausted.");
    if (this.research.list("run").some(record => (record.data as Run).experiment.hash === experiment.hash)) throw new Error("Experiment revision already attempted. Review and preregister a new revision before another trial.");
    const consumedMs = usage.attempts.reduce((sum, attempt) => sum + (attempt.elapsedMs ?? scope.timeoutMs), 0);
    const available = Math.min(scope.timeoutMs, scope.maxTotalMs - consumedMs, Date.parse(scope.expiresAt) - Date.now());
    if (available < 1) throw new Error("Approved wall-time budget exhausted.");
    const started = Date.now();
    const deadline = Math.min(started + scope.maxTotalMs - consumedMs, Date.parse(scope.expiresAt));
    let record = this.research.saveRun({ experiment: this.research.ref(experiment.id), scope: scope.id, status: "running", startedAt: new Date(started).toISOString() });
    const run = record.data as Run; const operationId = "research-run:" + record.id;
    usage.attempts.push({ run: record.id, experiment: experiment.id, cost: spec.cost, startedAt: run.startedAt, status: "running" });
    atomicJson(this.usagePath(scope.id), usage); store.beginOperation(operationId, "research_experiment", experiment.hash);
    const root = privateDir(join(this.research.dir, "runs", record.id));
    const analysisDir = privateDir(join(root, "analysis")); const verifierDir = privateDir(join(root, "verifier"));
    let final: Run = { ...run, status: "failed" };
    const log = (directory: string) => existsSync(join(directory, ".execution.log")) ? store.artifact(readFileSync(join(directory, ".execution.log"), "utf8")) : undefined;
    try {
      const plan = experiment.plan!;
      for (const [directory, adapter] of [[analysisDir, plan.analysis], [verifierDir, plan.verifier]] as const) {
        for (const file of [...plan.inputs, ...adapter.files]) checkedCopy(store.project, file, directory);
      }
      const request = (directory: string) => ({ version: 1, experiment: { id: experiment.id, hash: experiment.hash, parameters: spec.parameters, mode: spec.mode, context: spec.context },
        inputs: Object.fromEntries(plan.inputs.map(file => [file.path, join(directory, file.path)])) });
      if (Date.now() >= deadline) throw new Error("Approved execution window expired during preparation; no adapter dispatched.");
      const analysis = await executeAdapter(plan.analysis, analysisDir, request(analysisDir), scope.timeoutMs, signal, deadline);
      final.analysisArtifact = log(analysisDir);
      if (analysis.interrupted) { final.status = "unknown"; throw new Error("Analysis " + analysis.reason); }
      if (analysis.exitCode !== 0) throw new Error("Analysis failed with exit code " + analysis.exitCode);
      const candidate = readAdapterResult(join(analysisDir, ".result.json")); final.outputArtifact = store.artifact(JSON.stringify(candidate));
      for (const file of [...plan.verifier.files, ...plan.inputs]) if (fileDigest(confinedPath(verifierDir, file.path)) !== file.sha256) throw new Error("Verifier staging was modified during analysis.");
      const remaining = Math.min(scope.timeoutMs - analysis.elapsedMs, deadline - Date.now()); if (remaining < 1) { final.status = "unknown"; throw new Error("Experiment budget expired before verification."); }
      const verification = await executeAdapter(plan.verifier, verifierDir, { ...request(verifierDir), candidate }, remaining, signal, deadline);
      final.verifierArtifact = log(verifierDir);
      if (verification.interrupted) { final.status = "unknown"; throw new Error("Verifier " + verification.reason); }
      if (verification.exitCode !== 0) throw new Error("Verifier failed with exit code " + verification.exitCode);
      final.measurement = validateMeasurement(readAdapterResult(join(verifierDir, ".result.json")));
      if (this.research.stale(experiment)) throw new Error("Approved sources changed during execution; evidence is stale.");
      for (const file of plan.verifier.files) if (fileDigest(confinedPath(verifierDir, file.path)) !== file.sha256) throw new Error("Verifier implementation changed during execution.");
      const missing = spec.predictions.some(prediction => final.measurement!.metrics[prediction.metric] === undefined);
      if (missing) final.measurement = { ...final.measurement, valid: false, reason: final.measurement.reason + "; required prediction metrics are missing" };
      final.status = final.measurement.valid ? "verified" : "invalid"; final.assessment = assess(spec, final.measurement);
    } catch (error) { final.error = String(error); }
    final.analysisArtifact ||= log(analysisDir); final.verifierArtifact ||= log(verifierDir); final.endedAt = new Date().toISOString();
    record = this.research.saveRun(final, record.id);
    const attempt = usage.attempts.find(item => item.run === record.id)!; attempt.elapsedMs = Date.now() - started; attempt.status = final.status;
    const anomaly = final.status !== "verified" || !Object.values(final.assessment || {}).includes("compatible");
    if (final.status === "unknown" || (scope.stopOnAnomaly && anomaly)) usage.stopped = "Unexpected, inconclusive, invalid, or unknown outcome requires owner review.";
    atomicJson(this.usagePath(scope.id), usage);
    store.endOperation(operationId, { status: final.status === "unknown" ? "unknown" : final.status === "verified" ? "completed" : "failed", error: final.error }, JSON.stringify(record));
    if (anomaly) this.research.record("anomaly", { expected: spec.predictions.map(p => `${p.hypothesis}: ${p.metric} in [${p.lower}, ${p.upper}]`).join("; "),
      observed: final.measurement ? JSON.stringify(final.measurement) : final.error || final.status,
      hypotheses: [...new Set(spec.predictions.map(p => p.hypothesis))], runs: [record.id], measurement: final.measurement?.valid ? "valid" : final.measurement ? "invalid" : "unchecked", nextTest: "Review measurement validity and competing explanations before preregistering another test.", status: "open" }, "runner");
    store.checkpoint(); return record;
  }
  async cycle(scopeId: string, signal?: AbortSignal, ownerOperation?: string): Promise<ResearchRecord[]> {
    const results: ResearchRecord[] = []; const scope = this.scope(scopeId);
    for (let i = 0; i < scope.maxRuns; i++) {
      const usage = this.usage(scopeId); if (usage.stopped || usage.attempts.length >= scope.maxRuns) break;
      const next = this.research.candidates().find(candidate => scope.plans.some(ref => ref.id === candidate.id && ref.hash === candidate.hash));
      if (!next) break;
      results.push(await this.run(next.id, scopeId, signal, ownerOperation));
    }
    return results;
  }
}
