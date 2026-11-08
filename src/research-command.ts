import { readFileSync } from "node:fs";
import { compareResearchActions } from "./research-actions.js";
import { confinedPath } from "./security.js";
import { ResearchStore, researchSchemas, type ResearchKind } from "./research.js";
import { ResearchRunner } from "./research-runner.js";
import { acquireProjectLock, TaskStore } from "./state.js";
import { projectPath } from "./paths.js";

export async function researchCommand(argv: string[]): Promise<void> {
  const [path, action = "status", ...args] = argv;
  if (!path) throw new Error("Use: duck research PROJECT status|schema KIND|record KIND FILE|revise ID FILE|approve FILE|run EXPERIMENT SCOPE|cycle SCOPE|reconcile RUN NOTE|promote KIND FILE");
  const project = projectPath(path);
  if (action === "compare") {
    if (!args[0]) throw new Error("Use: duck research PROJECT compare ACTIONS.json");
    console.log(JSON.stringify(compareResearchActions(JSON.parse(readFileSync(confinedPath(project, args[0]), "utf8"))), null, 2));
    return;
  }
  const release = ["status", "schema", "show", "next"].includes(action) ? () => {} : acquireProjectLock(project);
  try {
    const store = new TaskStore(project); const research = new ResearchStore(store); const runner = new ResearchRunner(research);
    const input = (file?: string): unknown => { if (!file) throw new Error("A project-relative JSON file is required."); return JSON.parse(readFileSync(confinedPath(project, file), "utf8")); };
    let output: unknown;
    if (action === "status") { output = { ...research.summary(), scopes: runner.scopes().map(scope => ({ ...scope, usage: runner.usage(scope.id) })) }; }
    else if (action === "schema") { if (!args[0] || !Object.hasOwn(researchSchemas, args[0])) throw new Error("Unknown record kind."); output = researchSchemas[args[0] as ResearchKind]; }
    else if (action === "show") output = research.get(args[0]!);
    else if (action === "next") output = research.candidates();
    else if (action === "record") output = research.record(args[0] as ResearchKind, input(args[1]), "owner");
    else if (action === "revise") output = research.record(research.get(args[0]!).kind as ResearchKind, input(args[1]), "owner", args[0]);
    else if (action === "promote") { if (!["rule", "capability"].includes(args[0]!)) throw new Error("Promote rule or capability."); output = research.record(args[0] as ResearchKind, input(args[1]), "owner"); }
    else if (["evaluate", "evaluation-review", "evaluation-rate", "evaluation-reveal"].includes(action)) {
      const { ResearchEvaluation } = await import("./research-evaluation.js"); const evaluation = new ResearchEvaluation(store);
      if (action === "evaluate") {
        store.recoverInterrupted();
        const stop = new AbortController(); const cancel = () => stop.abort();
        process.once("SIGTERM", cancel); process.once("SIGINT", cancel);
        try { output = await evaluation.evaluate(input(args[0]), stop.signal); }
        finally { process.removeListener("SIGTERM", cancel); process.removeListener("SIGINT", cancel); }
      } else output = action === "evaluation-review" ? evaluation.review(args[0]!) : action === "evaluation-rate" ? evaluation.rate(args[0]!, input(args[1])) : evaluation.reveal(args[0]!);
    }
    else if (action === "medical-demo") {
      store.recoverInterrupted();
      const stop = new AbortController(); const cancel = () => stop.abort();
      process.once("SIGTERM", cancel); process.once("SIGINT", cancel);
      try { output = await (await import("./research-medical.js")).medicalStudy(store, stop.signal); }
      finally { process.removeListener("SIGTERM", cancel); process.removeListener("SIGINT", cancel); }
    }
    else if (action === "evaluation-demo") output = await (await import("./research-demo.js")).evaluationDemo(store);
    else if (action === "demo") output = await (await import("./research-demo.js")).researchDemo(store);
    else if (action === "approve") output = runner.approve(input(args[0]));
    else if (action === "reconcile") { runner.reconcile(args[0]!, args.slice(1).join(" ")); output = research.summary(); }
    else if (action === "run" || action === "cycle") {
      store.recoverInterrupted(); runner.recoverInterrupted();
      const stop = new AbortController(); const cancel = () => stop.abort();
      process.once("SIGTERM", cancel); process.once("SIGINT", cancel);
      try { output = action === "run" ? await runner.run(args[0]!, args[1]!, stop.signal) : await runner.cycle(args[0]!, stop.signal); }
      finally { process.removeListener("SIGTERM", cancel); process.removeListener("SIGINT", cancel); }
    } else throw new Error("Unknown research action.");
    if (!["status", "schema", "show", "next"].includes(action)) store.checkpoint();
    console.log(JSON.stringify(output, null, 2));
  } finally { release(); }
}
