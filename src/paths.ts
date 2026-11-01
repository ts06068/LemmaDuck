import { readFileSync, mkdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const packageVersion: string = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).version;
export const installHome = resolve(process.env.LEMMADUCK_INSTALL_HOME || homedir());
export const dataRoot = process.env.LEMMADUCK_DATA_DIR || join(installHome, ".local/share/lemmaduck");
export const stateRoot = process.env.LEMMADUCK_STATE_DIR || join(installHome, ".local/state/lemmaduck");
export const editorApp = "lemmaduck-nvim";
export const binDir = join(dataRoot, "bin");
export const profileDir = join(dataRoot, "pi");
export const configDir = join(dataRoot, "config");

export function privateDir(path: string): string {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  return path;
}

export function projectPath(path: string): string {
  return realpathSync(resolve(path));
}
