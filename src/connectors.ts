import { createHash } from "node:crypto";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { installHome, packageVersion, privateDir, repoRoot, stateRoot } from "./paths.js";
import { atomicJson } from "./state.js";

export type Effect = "read" | "draft" | "write" | "send";
export type Connection = {
  platform: string; url?: string; bearerEnv?: string; basicEnv?: { username: string; token: string }; command?: string; args?: string[];
  passEnv?: string[]; tools: Record<string, Effect>;
};
type Receipt = { account: string; tool: string; argumentHash: string; state: "pending" | "completed" | "unknown"; at: string };

export const connectionsFile = join(installHome, ".config", "lemmaduck", "connections.json");
const platforms = (JSON.parse(readFileSync(join(repoRoot, "catalog/full.json"), "utf8")).connectors as { id: string }[]).map(p => p.id);
const help = "Use: lemmaduck connector list | add ACCOUNT github|linear|jira | discover ACCOUNT | allow ACCOUNT TOOL read|draft|write|send | tools ACCOUNT | call ACCOUNT TOOL ARGS.json [--apply REQUEST-ID] | receipt ACCOUNT REQUEST-ID";
const effects: Effect[] = ["read", "draft", "write", "send"];
export class UnknownConnectorOutcome extends Error {}
function validateAccount(account: string): void {
  if (!/^(work|personal|public)\.[a-z0-9][a-z0-9-]{0,62}$/.test(account)) throw new Error("Use an account name such as work.linear or personal.github.");
}

export function connections(): Record<string, Connection> {
  let info;
  try { info = lstatSync(connectionsFile); }
  catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") return {}; throw err; }
  if (!info.isFile() || (info.mode & 0o077) || (process.getuid && info.uid !== process.getuid())) throw new Error("Use an owner-only (chmod 600) regular connections file.");
  const value = JSON.parse(readFileSync(connectionsFile, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Connections must be an object keyed by account.");
  for (const [account, conn] of Object.entries(value) as [string, Connection][]) {
    validateAccount(account);
    if (!conn || !platforms.includes(conn.platform) || !conn.tools || typeof conn.tools !== "object" || Array.isArray(conn.tools) || Object.values(conn.tools).some(effect => !effects.includes(effect))) throw new Error("Invalid account platform or local tool effects.");
  }
  return value;
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
    const flatJira = c.platform === "jira" && url.origin === "https://mcp.atlassian.com" && url.pathname === "/v2/mcp" && url.search === "?tools=all";
    if (url.username || url.password || (url.search && !flatJira) || url.hash || !(url.protocol === "https:" || (local && url.protocol === "http:"))) throw new Error("Use an HTTPS endpoint or a local loopback HTTP endpoint without embedded credentials.");
    const headers = connectionHeaders(c);
    return new StreamableHTTPClientTransport(url, { requestInit: { headers, redirect: "error" } });
  }
  if (!isAbsolute(c.command!)) throw new Error("The stdio server command must be an absolute path.");
  return new StdioClientTransport({ command: c.command!, args: c.args || [], env: Object.fromEntries((c.passEnv || []).map(name => [name, requiredEnv(name)])) });
}

function receiptPath(account: string, id: string) {
  validateAccount(account);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(id)) throw new Error("Use a short request ID with letters, numbers, underscores or dashes.");
  return join(privateDir(join(stateRoot, "connector-receipts", account)), id + ".json");
}

export function connection(account: string): Connection {
  validateAccount(account);
  const links = connections();
  if (!Object.hasOwn(links, account)) throw new Error("Configure the account in " + connectionsFile);
  return links[account]!;
}
export function connectionEffect(account: string, tool: string): Effect {
  const conn = connection(account);
  if (!Object.hasOwn(conn.tools, tool)) throw new Error("The local tool allowlist does not include this tool.");
  return conn.tools[tool]!;
}
export function connectorCredentialNames(): string[] {
  return [...new Set(Object.values(connections()).flatMap(c => [c.bearerEnv, c.basicEnv?.username, c.basicEnv?.token, ...(c.passEnv || [])]).filter((name): name is string => !!name))];
}
export function connectionHeaders(c: Connection): Record<string, string> {
  if (c.bearerEnv && c.basicEnv) throw new Error("Choose one authentication method per account.");
  if (c.bearerEnv) return { Authorization: "Bearer " + requiredEnv(c.bearerEnv) };
  if (c.basicEnv) return { Authorization: "Basic " + Buffer.from(requiredEnv(c.basicEnv.username) + ":" + requiredEnv(c.basicEnv.token)).toString("base64") };
  return {};
}
async function withClient<T>(conn: Connection, action: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ name: "lemmaduck", version: packageVersion });
  try { await client.connect(transport(conn)); return await action(client); }
  finally { await client.close().catch(() => {}); }
}
export async function connectionTools(account: string, discover = false, signal?: AbortSignal) {
  const conn = connection(account);
  return withClient(conn, async client => {
    let cursor: string | undefined; const seen = new Set<string>();
    const tools = [];
    do {
      signal?.throwIfAborted();
      const result = await client.listTools(cursor ? { cursor } : {}, { signal });
      for (const tool of result.tools) if (discover || Object.hasOwn(conn.tools, tool.name)) tools.push({ ...tool, effect: Object.hasOwn(conn.tools, tool.name) ? conn.tools[tool.name] : "not allowed" });
      cursor = result.nextCursor;
      if (cursor && seen.has(cursor)) throw new Error("The server repeated its pagination cursor.");
      if (cursor) seen.add(cursor);
    } while (cursor);
    return tools;
  });
}
export async function callConnection(account: string, tool: string, input: Record<string, unknown>, options: { requestId?: string; signal?: AbortSignal } = {}) {
  const conn = connection(account); const effect = connectionEffect(account, tool);
  if (!input || Array.isArray(input) || typeof input !== "object") throw new Error("Tool arguments must be a JSON object.");
  if (effect !== "read" && !options.requestId) throw new Error("This " + effect + " action requires --apply REQUEST-ID.");
  if (effect === "read" && options.requestId) throw new Error("Read requests do not use --apply.");
  return withClient(conn, async client => {
    options.signal?.throwIfAborted();
    const receipt: Receipt = { account, tool, argumentHash: createHash("sha256").update(JSON.stringify(input)).digest("hex"), state: "pending", at: new Date().toISOString() };
    const path = options.requestId ? receiptPath(account, options.requestId) : undefined;
    if (path) {
      try { writeFileSync(path, JSON.stringify(receipt) + "\n", { flag: "wx", mode: 0o600 }); }
      catch (err) { if ((err as NodeJS.ErrnoException).code === "EEXIST") throw new Error("Request ID already exists. Inspect its receipt and the provider before taking further action."); throw err; }
    }
    try {
      const result = await client.callTool({ name: tool, arguments: input }, undefined, { signal: options.signal });
      if (result.isError) throw new Error("The provider returned an error: " + JSON.stringify(result.content));
      if (path) atomicJson(path, { ...receipt, state: "completed", completedAt: new Date().toISOString() });
      return result;
    } catch (err) {
      if (path) {
        atomicJson(path, { ...receipt, state: "unknown" });
        throw new UnknownConnectorOutcome(`Outcome unknown; inspect receipt ${account}/${options.requestId} and the provider before retrying. ${String(err)}`);
      }
      throw err;
    }
  });
}
export function connectionPreset(account: string, platform: string): Connection {
  validateAccount(account);
  const prefix = "LEMMADUCK_" + account.replaceAll(/[.-]/g, "_").toUpperCase();
  if (platform === "github") return { platform, url: "https://api.githubcopilot.com/mcp/", bearerEnv: prefix + "_TOKEN", tools: {} };
  if (platform === "linear") return { platform, url: "https://mcp.linear.app/mcp", bearerEnv: prefix + "_TOKEN", tools: {} };
  if (platform === "jira") return { platform, url: "https://mcp.atlassian.com/v2/mcp?tools=all", basicEnv: { username: prefix + "_EMAIL", token: prefix + "_TOKEN" }, tools: {} };
  throw new Error("Presets: github, linear, jira. Configure other MCP adapters in " + connectionsFile);
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
  if (!account) throw new Error(help);
  validateAccount(account);
  if (op === "add" && tool && argv.length === 3) {
    if (Object.hasOwn(links, account)) throw new Error("Account already configured; edit its existing entry.");
    links[account] = connectionPreset(account, tool);
    privateDir(dirname(connectionsFile)); atomicJson(connectionsFile, links);
    console.log(`Created ${account} in ${connectionsFile}. Supply its named credential variables, then discover and allow individual tools.`); return;
  }
  if (op === "allow" && tool && file && effects.includes(file as Effect) && argv.length === 4) {
    const conn = connection(account);
    conn.tools[tool] = file as Effect; links[account] = conn; atomicJson(connectionsFile, links);
    console.log(`${account}: ${tool} allowed as ${file}.`); return;
  }
  if (op === "receipt" && tool && argv.length === 3) { console.log(readFileSync(receiptPath(account, tool), "utf8")); return; }
  if (["tools", "discover"].includes(op) && argv.length === 2) { console.log(JSON.stringify(await connectionTools(account, op === "discover"), null, 2)); return; }
  if (op !== "call" || !tool || !file || ![4, 6].includes(argv.length) || (flag && flag !== "--apply")) throw new Error(help);
  console.log(JSON.stringify(await callConnection(account, tool, JSON.parse(readFileSync(file, "utf8")), { requestId: id }), null, 2));
}
