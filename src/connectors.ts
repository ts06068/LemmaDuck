import { createHash } from "node:crypto";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { installHome, privateDir, repoRoot, stateRoot } from "./paths.js";
import { atomicJson } from "./state.js";

type Effect = "read" | "draft" | "write" | "send";
type Connection = {
  platform: string; url?: string; bearerEnv?: string; command?: string; args?: string[];
  passEnv?: string[]; tools: Record<string, Effect>;
};
type Receipt = { account: string; tool: string; argumentHash: string; state: "pending" | "completed" | "unknown"; at: string };

const config = join(installHome, ".config", "lemmaduck", "connections.json");
const platforms = (JSON.parse(readFileSync(join(repoRoot, "catalog/full.json"), "utf8")).connectors as { id: string }[]).map(p => p.id);
const help = "Use: lemmaduck connector list | tools ACCOUNT | call ACCOUNT TOOL ARGS.json [--apply REQUEST-ID] | receipt ACCOUNT REQUEST-ID";

function connections(): Record<string, Connection> {
  let info;
  try { info = lstatSync(config); }
  catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") return {}; throw err; }
  if (!info.isFile() || (info.mode & 0o077) || (process.getuid && info.uid !== process.getuid())) throw new Error("Use an owner-only (chmod 600) regular connections file.");
  return JSON.parse(readFileSync(config, "utf8"));
}

function requiredEnv(key: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || !process.env[key]) throw new Error("A configured credential or environment variable is missing.");
  return process.env[key]!;
}

function transport(c: Connection) {
  if (Boolean(c.url) === Boolean(c.command)) throw new Error("Configure exactly one transport: url or command.");
  if (c.url) {
    const url = new URL(c.url);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || !(url.protocol === "https:" || (local && url.protocol === "http:"))) throw new Error("Use an HTTPS endpoint or a local loopback HTTP endpoint without embedded credentials.");
    const headers = c.bearerEnv ? { Authorization: "Bearer " + requiredEnv(c.bearerEnv) } : undefined;
    return new StreamableHTTPClientTransport(url, { requestInit: { headers, redirect: "error" } });
  }
  if (!isAbsolute(c.command!)) throw new Error("The stdio server command must be an absolute path.");
  return new StdioClientTransport({ command: c.command!, args: c.args || [], env: Object.fromEntries((c.passEnv || []).map(name => [name, requiredEnv(name)])) });
}

function receiptPath(account: string, id: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(id)) throw new Error("Use a short request ID with letters, numbers, underscores or dashes.");
  return join(privateDir(join(stateRoot, "connector-receipts", account)), id + ".json");
}

export async function connectorCommand(argv: string[]): Promise<void> {
  const [op = "list", account, tool, file, flag, id] = argv;
  const links = connections();
  if (op === "list" && argv.length <= 1) {
    for (const platform of platforms) {
      const accounts = Object.keys(links).filter(a => links[a]?.platform === platform);
      console.log([platform, accounts.length ? accounts.join(", ") + " (configured)" : "not configured"].join("\t"));
    }
    return;
  }
  if (op === "help" || op === "--help") { console.log(help); return; }
  if (!account || !/^(work|personal|public)\.[a-z0-9][a-z0-9-]{0,62}$/.test(account)) throw new Error(help);
  if (op === "receipt" && tool && argv.length === 3) { console.log(readFileSync(receiptPath(account, tool), "utf8")); return; }
  const conn = Object.hasOwn(links, account) ? links[account] : undefined;
  if (!conn || !platforms.includes(conn.platform) || !conn.tools) throw new Error("Configure the account in " + config);
  if (!(op === "tools" && argv.length === 2) && !(op === "call" && tool && file && [4, 6].includes(argv.length))) throw new Error(help);
  const client = new Client({ name: "lemmaduck", version: "0.4.0" });
  try {
    await client.connect(transport(conn));
    if (op === "tools") {
      let cursor: string | undefined;
      const seen = new Set<string>();
      do {
        const result = await client.listTools(cursor ? { cursor } : {});
        for (const t of result.tools) if (Object.hasOwn(conn.tools, t.name)) console.log([t.name, conn.tools[t.name], t.description || ""].join("\t"));
        cursor = result.nextCursor;
        if (cursor && seen.has(cursor)) throw new Error("The server repeated its pagination cursor.");
        if (cursor) seen.add(cursor);
      } while (cursor);
      return;
    }
    if (!tool || !file || !Object.hasOwn(conn.tools, tool)) throw new Error("The local tool allowlist does not include this tool.");
    const effect = conn.tools[tool];
    if (!effect || !["read", "draft", "write", "send"].includes(effect)) throw new Error("Invalid local tool effect.");
    const input = JSON.parse(readFileSync(file, "utf8"));
    if (!input || Array.isArray(input) || typeof input !== "object") throw new Error("Tool arguments must be a JSON object.");
    let path: string | undefined;
    const receipt: Receipt = { account, tool, argumentHash: createHash("sha256").update(JSON.stringify(input)).digest("hex"), state: "pending", at: new Date().toISOString() };
    if (effect !== "read") {
      if (flag !== "--apply" || !id) throw new Error("This " + effect + " action requires --apply REQUEST-ID.");
      path = receiptPath(account, id);
      try { writeFileSync(path, JSON.stringify(receipt) + "\n", { flag: "wx", mode: 0o600 }); }
      catch (err) { if ((err as NodeJS.ErrnoException).code === "EEXIST") throw new Error("Request ID already exists. Inspect its receipt and the provider before taking further action."); throw err; }
    } else if (flag || id) throw new Error("Read requests do not use --apply.");
    try {
      const result = await client.callTool({ name: tool, arguments: input });
      if (result.isError) throw new Error("The provider returned an error: " + JSON.stringify(result.content));
      if (path) atomicJson(path, { ...receipt, state: "completed", completedAt: new Date().toISOString() });
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      if (path) atomicJson(path, { ...receipt, state: "unknown" });
      throw err;
    }
  } finally { await client.close(); }
}
