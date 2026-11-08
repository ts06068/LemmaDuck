import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TaskStore } from "../../src/state.js";
import { ResearchStore, type Experiment } from "../../src/research.js";

export function seedExperiment(task: TaskStore, mode: "valid" | "contradiction" | "invalid" | "timeout" = "valid") {
  const project = task.project;
  writeFileSync(join(project, "sample.json"), "[10,20,30]\n");
  writeFileSync(join(project, "calculate.mjs"), mode === "timeout"
    ? "import fs from 'node:fs';fs.writeFileSync('dispatch-started.txt','started');setInterval(()=>{},1000);"
    : "import fs from 'node:fs';const r=JSON.parse(fs.readFileSync(process.argv[2]));const x=JSON.parse(fs.readFileSync(r.inputs['sample.json']));fs.writeFileSync(process.argv[3],JSON.stringify({mean:x.reduce((a,b)=>a+b,0)/x.length}));");
  writeFileSync(join(project, "independent.mjs"), `import fs from 'node:fs';const r=JSON.parse(fs.readFileSync(process.argv[2]));const x=JSON.parse(fs.readFileSync(r.inputs['sample.json']));let sum=0;for(const v of x)sum+=v;const mean=sum/x.length;fs.writeFileSync(process.argv[3],JSON.stringify({valid:${mode === "invalid" ? "false" : "Math.abs(mean-r.candidate.mean)<1e-10"},metrics:{mean},reason:'${mode === "invalid" ? "Injected invalid measurement: deliberately reject this candidate" : "Independent sum and count"}'}));`);
  const research = new ResearchStore(task);
  const observation = research.record("observation", { statement: "Frozen synthetic observations; no clinical claim", files: ["sample.json"], location: "All three observations" }, "owner");
  const question = research.record("question", { question: "Which proposed mean is supported by independent measurement?", importance: 3, uncertainty: "A frozen test may contradict both original proposals", observations: [observation.id] }, "owner");
  const bounds = mode === "contradiction" ? [[30,31],[40,41]] : [[19,21],[24,26]];
  const hypotheses = bounds.map(([lower,upper]) => research.record("hypothesis", {question:question.id,mechanism:`Mean in ${lower}..${upper}`,assumptions:["Complete synthetic observations"],rejection:"Independent mean outside the frozen interval"}, "owner"));
  const experiment: Experiment = {question:question.id,predictions:hypotheses.map((hypothesis,i)=>({hypothesis:hypothesis.id,metric:"mean",lower:bounds[i]![0]!,upper:bounds[i]![1]!,rationale:"Frozen independent measurement distinguishes the original proposals"})),inputs:["sample.json"],analysis:{executable:process.execPath,script:"calculate.mjs",files:[]},verifier:{executable:process.execPath,script:"independent.mjs",files:[]},parameters:{endpoint:"arithmetic mean",units:"synthetic units"},rationale:"Execute only this frozen controlled check",discrimination:4,feasibility:5,cost:1,context:"controlled-"+mode,mode:"confirmatory"};
  const plan = research.record("experiment", experiment, "owner");
  return { research, plan };
}
