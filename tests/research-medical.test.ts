import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const python = process.env.LEMMADUCK_TEST_MEDICAL_PYTHON;
const skip = !python;
test("medical adapters independently reproduce the cohort, weighting, bootstrap and uncertainty without causal claims", { skip, timeout: 120000 }, t => {
  const root = mkdtempSync(join(tmpdir(), "lemmaduck-medical-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = resolve("examples/observational-medicine");
  for (const name of ["analysis.py", "verifier.py", "requirements.lock"]) copyFileSync(join(source, name), join(root, name));
  const protocol = JSON.parse(readFileSync(join(source, "protocol.json"), "utf8")); protocol.uncertainty.replicates = 12;
  writeFileSync(join(root, "protocol.json"), JSON.stringify(protocol));
  const generated = spawnSync(python!, ["-c", `import csv,json,random,math,importlib.metadata,hashlib,sys
from pathlib import Path
r=Path(sys.argv[1]); random.seed(319)
with (r/'nhefs.csv').open('w',newline='') as f:
 w=csv.writer(f);w.writerow(['seqn','sex','race','age','education','smokeintensity','smokeyrs','exercise','active','wt71','qsmk','wt82_71'])
 for i in range(600):
  age=random.uniform(25,70);sex=random.randrange(2);race=random.randrange(2);education=random.randint(1,5)
  smoke=random.uniform(3,35);years=random.uniform(2,40);exercise=random.randrange(3);active=random.randrange(3);weight=random.uniform(45,105)
  a=int(random.random()<1/(1+math.exp(-(-2.2+.045*age+.2*sex))))
  y=2*a+.08*age+.03*weight+random.gauss(0,1)
  w.writerow([i,sex,race,age,education,smoke,years,exercise,active,weight,a,'' if i%10==0 else y])
packages={name:importlib.metadata.version(name) for name in ['numpy','pandas','scipy','statsmodels','patsy']}
(r/'runtime.json').write_text(json.dumps({'packages':packages,'data_sha256':hashlib.sha256((r/'nhefs.csv').read_bytes()).hexdigest(),'requirements_sha256':hashlib.sha256((r/'requirements.lock').read_bytes()).hexdigest()}))`, root], { encoding: "utf8" });
  assert.equal(generated.status, 0, generated.stderr);
  const inputs = Object.fromEntries(["nhefs.csv", "protocol.json", "requirements.lock", "runtime.json"].map(name => [name, join(root, name)]));
  const request = join(root, "request.json"); const output = join(root, "output.json"); writeFileSync(request, JSON.stringify({ inputs }));
  const env = { ...process.env, OPENBLAS_NUM_THREADS: "1", OMP_NUM_THREADS: "1" };
  const analyzed = spawnSync(python!, [join(root, "analysis.py"), request, output], { encoding: "utf8", env });
  assert.equal(analyzed.status, 0, analyzed.stderr);
  const candidate = JSON.parse(readFileSync(output, "utf8"));
  assert.equal(candidate.metrics.source_rows, 600); assert.equal(candidate.metrics.complete_cases, 540); assert.equal(candidate.metrics.missing_outcomes, 60);
  assert.equal(candidate.metrics.missing_outcomes_treated + candidate.metrics.missing_outcomes_control, 60);
  assert.equal(candidate.metrics.excluded_records, 60);
  assert.equal(candidate.metrics.bootstrap_successful, 12); assert.equal(candidate.claim_policy, "associational");
  assert.ok(candidate.metrics.ci_lower_kg < candidate.metrics.ci_upper_kg);
  writeFileSync(request, JSON.stringify({ inputs, candidate }));
  const verified = spawnSync(python!, [join(root, "verifier.py"), request, join(root, "verified.json")], { encoding: "utf8", env });
  assert.equal(verified.status, 0, verified.stderr); assert.equal(JSON.parse(readFileSync(join(root, "verified.json"), "utf8")).valid, true);
  candidate.metrics.ipw_difference_kg += 1; writeFileSync(request, JSON.stringify({ inputs, candidate }));
  const tampered = spawnSync(python!, [join(root, "verifier.py"), request, join(root, "rejected.json")], { encoding: "utf8", env });
  assert.equal(tampered.status, 0, tampered.stderr); assert.equal(JSON.parse(readFileSync(join(root, "rejected.json"), "utf8")).valid, false);
});

test("the medical prepare step refuses an altered source without downloading or overwriting it", t => {
  const root = mkdtempSync(join(tmpdir(), "lemmaduck-medical-source-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = resolve("examples/observational-medicine");
  copyFileSync(join(source, "prepare.py"), join(root, "prepare.py"));
  // An empty lock lets this standard-library provenance check run in ordinary CI.
  writeFileSync(join(root, "requirements.lock"), "# fixture-only empty dependency manifest\n");
  const altered = join(root, "altered.csv"); writeFileSync(altered, "seqn,qsmk,wt82_71\n1,1,100\n");
  const result = spawnSync(python || "python3", [join(root, "prepare.py"), "--from-file", altered], { encoding: "utf8" });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /checksum changed/);
  assert.equal(createHash("sha256").update(readFileSync(altered)).digest("hex"), createHash("sha256").update("seqn,qsmk,wt82_71\n1,1,100\n").digest("hex"));
});
