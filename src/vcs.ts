import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";

export type Vcs = { backend: "git" | "jj" | "none"; root: string };
export function detectVcs(project: string): Vcs {
  let root = realpathSync(project);
  while (true) {
    if (existsSync(join(root, ".jj"))) return { backend: "jj", root };
    if (existsSync(join(root, ".git"))) return { backend: "git", root };
    if (dirname(root) === root) return { backend: "none", root: project };
    root = dirname(root);
  }
}
export function vcsArgs(backend: "git" | "jj", view: "status" | "diff" | "log" | "head" | "stat"): string[] {
  if (backend === "jj") return ["--ignore-working-copy", "--at-op=@", "--no-pager", "--color", "never", ...({
    status: ["status"], diff: ["diff"], log: ["log", "--limit", "10"],
    head: ["log", "-r", "@", "--no-graph", "-T", "commit_id"], stat: ["diff", "--stat"],
  })[view]];
  return ["--no-pager", "-c", "core.fsmonitor=false", "-c", "core.pager=cat", "-c", "color.ui=false", ...({
    status: ["status", "--short"], diff: ["diff", "--no-ext-diff", "--no-textconv", "HEAD"],
    log: ["log", "-10", "--oneline", "--no-decorate"], head: ["rev-parse", "HEAD"], stat: ["diff", "--no-ext-diff", "--no-textconv", "--stat", "HEAD"],
  })[view]];
}
function invoke(vcs: Vcs, args: string[]): string {
  return execFileSync(vcs.backend, args, { cwd: vcs.root, encoding: "utf8", timeout: 5000, maxBuffer: 2 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_PAGER: "cat", JJ_PAGER: "cat" }, stdio: ["ignore", "pipe", "pipe"] }).trim();
}
export function vcsRead(project: string, view: "status" | "diff" | "log" | "head" | "stat") {
  const vcs = detectVcs(project);
  if (vcs.backend === "none") return { ...vcs, output: "No Git or Jujutsu repository detected." };
  const args = vcsArgs(vcs.backend, view);
  let output: string;
  try { output = invoke(vcs, args); }
  catch (error) {
    // Unborn Git repositories have no HEAD. Their staged and untracked files
    // remain visible in status; use a working-tree diff where possible.
    if (vcs.backend === "git" && ["diff", "stat"].includes(view)) {
      try { output = invoke(vcs, args.filter(arg => arg !== "HEAD")); }
      catch { throw new Error("Git inspection failed; check the executable and repository."); }
    } else throw new Error(`${vcs.backend} inspection failed; check the executable and repository. ${error instanceof Error && "code" in error ? String(error.code) : ""}`);
  }
  return { ...vcs, ...(vcs.backend === "jj" ? { note: "Recorded Jujutsu state at @. --ignore-working-copy does not snapshot unsaved working-copy changes; run jj status yourself to refresh." } : {}), output };
}
