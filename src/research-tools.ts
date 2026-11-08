import { Type } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { TaskStore } from "./state.js";
import type { ResearchKind } from "./research.js";

const readParams = Type.Object({ id: Type.Optional(Type.String()), kind: Type.Optional(Type.String()) }, { additionalProperties: false });
const writeParams = Type.Object({ kind: Type.String(), data: Type.Record(Type.String(), Type.Unknown()), revise: Type.Optional(Type.String()) }, { additionalProperties: false });
const runParams = Type.Object({ scope: Type.String(), experiment: Type.Optional(Type.String()) }, { additionalProperties: false });
export const researchToolNames = ["inspect_research", "record_research", "run_research_experiment"];
export const RESEARCH_INSTRUCTIONS = `Use inspect_research to recover scientific state and schemas. Record sourced observations, an important question, competing hypotheses, then experiment plans with distinct predicted measurement ranges before executing. Include measurement/selection artifacts where plausible. Compare candidate tests by importance, discrimination, feasibility, and cost; scores are ordinal judgments, not measured information gain. Only the owner can approve an exact bounded scope in the CLI. run_research_experiment executes approved frozen adapters and their independent verifier; it cannot approve or expand scope. Preserve negative and inconclusive results and open anomalies. Distinguish a completed process, a verified measurement, compatibility with a hypothesis, and causal identification. Claims must link current verified runs. Observational studies register population, time zero, exposure/comparator, outcome window, confounders, missingness, estimand, and identification assumptions; ambiguous temporal alignment permits association only. Domain feedback is a proposal until the owner records it; rule/capability promotion requires reviewed regression and distinct transfer evidence. Cite artifact IDs and do not replace contradictions with a confident summary.`;
type ResearchTool = Pick<ToolDefinition, "name" | "label" | "description" | "parameters"> & { execute(id: string, input: unknown, signal?: AbortSignal): Promise<{ content: { type: "text"; text: string }[]; details: {} }> };
export function researchToolDefinitions(store: TaskStore, review: () => boolean): ResearchTool[] {
  const state = async () => { const { ResearchStore } = await import("./research.js"); return new ResearchStore(store); };
  return [
    { name: "inspect_research", label: "Scientific state", description: "Read scientific records, candidate rankings, anomalies, and exact JSON schemas. Optional id reads a record; kind reads a schema. No approval or execution.", parameters: readParams,
      async execute(_id: string, input: unknown) {
        const args = input as { id?: string; kind?: string };
        const research = await state();
        const { researchSchemas } = await import("./research.js");
        const { ResearchRunner } = await import("./research-runner.js");
        const runner = new ResearchRunner(research);
        let value: unknown;
        if (args.id) value = research.get(args.id);
        else if (args.kind) { if (!Object.hasOwn(researchSchemas, args.kind)) throw new Error("Unknown research kind."); value = researchSchemas[args.kind as ResearchKind]; }
        else value = { ...research.summary(), scopes: runner.scopes().map(scope => ({ ...scope, usage: runner.usage(scope.id) })) };
        return { content: [{ type: "text" as const, text: JSON.stringify(value) }], details: {} };
      } },
    { name: "record_research", label: "Scientific record", description: "Propose a typed observation, question, hypothesis, observational study, experiment, anomaly, claim, or feedback record. Inspect its schema first. Optional revise creates an immutable revision and makes dependent evidence stale. Cannot approve scopes, record owner feedback, or promote rules/capabilities.", parameters: writeParams,
      async execute(_id: string, input: unknown) {
        const args = input as { kind: string; data: Record<string, unknown>; revise?: string };
        if (review()) throw new Error("Read-only review blocks research changes.");
        if (["rule", "capability"].includes(args.kind)) throw new Error("Only the owner can promote rules and capabilities.");
        const research = await state();
        const record = research.record(args.kind as ResearchKind, args.data, "agent-proposal", args.revise);
        store.checkpoint(); return { content: [{ type: "text" as const, text: JSON.stringify(record) }], details: {} };
      } },
    { name: "run_research_experiment", label: "Approved experiment", description: "Execute an exact owner-approved experiment revision, or the remaining approved batch when experiment is omitted. Frozen code/data/verifier and trial, time, cost-unit, expiry, and stop limits are enforced. No arbitrary shell or scope expansion. Unknown outcomes require owner reconciliation.", parameters: runParams,
      async execute(id: string, input: unknown, signal?: AbortSignal) {
        const args = input as { scope: string; experiment?: string };
        if (review()) throw new Error("Read-only review blocks experiment execution.");
        const { ResearchRunner } = await import("./research-runner.js");
        const runner = new ResearchRunner(await state());
        const result = args.experiment ? await runner.run(args.experiment, args.scope, signal, id) : await runner.cycle(args.scope, signal, id);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }], details: {} };
      } },
  ];
}
