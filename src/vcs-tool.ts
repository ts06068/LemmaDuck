import { Type } from "typebox";
import { vcsRead } from "./vcs.js";

export function vcsTool(project: string) {
  return { name: "inspect_vcs", label: "Version control", description: "Inspect the current project's Git or Jujutsu status, diff or recent log. Jujutsu uses recorded state without snapshotting the working copy. No remote writes.",
    parameters: Type.Object({ view: Type.Union([Type.Literal("status"), Type.Literal("diff"), Type.Literal("log")]) }),
    async execute(_id: string, input: unknown) {
      const view = (input as { view: "status" | "diff" | "log" }).view;
      if (!["status", "diff", "log"].includes(view)) throw new Error("Choose status, diff or log.");
      return { content: [{ type: "text" as const, text: JSON.stringify(vcsRead(project, view)) }], details: {} };
    },
  };
}
