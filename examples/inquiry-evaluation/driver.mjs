import fs from "node:fs";
const request=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const control=request.modelControl;
if (!control) throw Error("This adapter requires the instrumented parent model gateway.");
async function invoke(body) {
 const response=await fetch(control.url,{method:"POST",headers:{Authorization:"Bearer "+control.token,"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(125000)});
 const result=await response.json(); if(!response.ok) throw Error(result.error||"Model gateway failed"); return result;
}
const messages=[{role:"user",content:JSON.stringify(request.input.initial_prompt || request.input),timestamp:Date.now()}];
const toolReceipts=[]; let answer;
for(let call=0;call<control.maxCalls;call++) {
 const {message}=await invoke({action:"complete",messages}); messages.push(message);
 const calls=message.content.filter(part=>part.type==="toolCall");
 if(!calls.length) {
  const visible=message.content.filter(part=>part.type==="text").map(part=>part.text).join("\n").trim().replace(/^```(?:json)?\s*/,"").replace(/\s*```$/,"");
  answer=JSON.parse(visible); break;
 }
 for(const tool of calls) {
  const result=await invoke({action:"tool",name:tool.name,arguments:tool.arguments});
  toolReceipts.push({name:tool.name,isError:!!result.isError});
  messages.push({role:"toolResult",toolCallId:tool.id,toolName:tool.name,content:result.content,isError:!!result.isError,timestamp:Date.now()});
 }
}
if(!answer) throw Error("No final JSON answer within the declared call budget.");
// Publish visible answers and tool receipts only, never hidden model reasoning.
fs.writeFileSync(process.argv[3],JSON.stringify({answer,toolReceipts}));
