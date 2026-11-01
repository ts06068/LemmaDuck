import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";
const respond = value => process.stdout.write(JSON.stringify({jsonrpc: "2.0", ...value}) + "\n");
for await (const line of createInterface({input: process.stdin})) {
  const {id, method, params} = JSON.parse(line);
  if (id === undefined) continue;
  if (method === "initialize") respond({id, result: {protocolVersion: params.protocolVersion, capabilities: {tools:{}}, serverInfo:{name:"fixture",version:"1"}}});
  else if (method === "tools/list") respond({id, result: {tools: ["read_demo", "write_demo", "hidden_demo"].map(name => ({name, inputSchema:{type:"object"}}))}});
  else if (method === "tools/call") {
    if (params.name === "write_demo") appendFileSync(process.argv[2], "effect\n");
    respond({id, result: {content:[{type:"text",text:"fixture acknowledged"}], isError: params.arguments.fail === true}});
  } else respond({id, error:{code:-32601,message:"Unknown method"}});
}
