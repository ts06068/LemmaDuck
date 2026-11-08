# Scientific inquiry

The research engine adds an explicit inquiry lifecycle to the existing Pi task.
It preserves predictions, execution, evidence, interpretations, and corrections as
separate records. It supports domain-specific adapters; it does not claim scientific
novelty, clinical validity, or a measured improvement in research productivity.

## Run the complete local example

The inquiry commands below are available in the source checkout. They are not part
of the already published Base 0.5.3 package.

```sh
npm ci --include=dev --ignore-scripts --no-audit --no-fund
npm run build
./duck init /absolute/path/to/new-study --kind inquiry
./duck research /absolute/path/to/new-study demo
./duck research /absolute/path/to/new-study status
```

`demo` explicitly authorizes the bundled synthetic exercise: it preregisters two
competing explanations, executes a unit-normalization calculation, independently
checks it using Decimal arithmetic, records a bounded claim, then tests the same
method on a different dataset and scale. It records synthetic feedback, a reviewed
rule, and a reusable capability. It makes no model calls. The feedback source is
labelled synthetic; it is not represented as a domain scientist's endorsement.

The expected error reductions are 340 and 144 synthetic reference units. These are
paired calculations on the supplied rows, not model discrimination scores or
clinical treatment effects. Run the example in a fresh project/task.

## Scientific records

```sh
duck research PROJECT schema observation
duck research PROJECT schema experiment
duck research PROJECT record observation observation.json
duck research PROJECT show RECORD_ID
duck research PROJECT revise RECORD_ID replacement.json
duck research PROJECT next
```

`record` and `revise` files are relative to the selected project. CLI writes are
owner actions. Agent tools create proposals. A revision creates an immutable record
with a previous-version pointer; it does not overwrite the earlier evidence.

| Kind | Required content |
| --- | --- |
| Observation | Statement, source files and source location |
| Question | Scientific question, importance, uncertainty and linked observations |
| Hypothesis | Question, mechanism, assumptions and rejection criterion |
| Experiment | Competing interval predictions, inputs, analysis/verifier, parameters, rationale, discrimination, feasibility, cost units, context and exploratory/confirmatory mode |
| Run | Runner-owned plan reference, execution outcome, logs, measurement and hypothesis assessments |
| Anomaly | Expected/observed discrepancy, linked hypotheses/runs, measurement validity and next test |
| Claim | Statement, claim type, scope, current verified runs and limitations |
| Feedback | Attributed correction, rationale and exact affected revisions |
| Rule | Reviewed feedback, executable parameter/claim-type constraints, regression and subsequent transfer runs |
| Capability | Versioned method files, development and distinct transfer runs, limitations |

The current prediction contract uses finite numeric intervals. Domain adapters can
produce multiple named measurements. Each hypothesis must predict the same metrics;
identical predictions are rejected. Richer qualitative or probabilistic predictions
require a future schema extension. Compatibility with a registered interval is
bounded evidence. It is not a probability of truth or proof of a mechanism.

Candidate priority is `importance × discrimination × feasibility / cost`. These
ordinal inputs are declared judgments, not measured information gain. The full
rationale and all components remain visible. Use `next` to inspect this comparison.

## Freeze and authorize an experiment

An experiment names separate analysis and verifier scripts. Both use this interface:

```text
ABSOLUTE_INTERPRETER SCRIPT REQUEST_JSON OUTPUT_JSON
```

The request contains frozen input paths and experiment parameters. The verifier
additionally receives the candidate output. The analysis returns a JSON object. The
verifier must independently calculate or check the measurement and return:

```json
{"valid": true, "metrics": {"error_reduction": 340}, "reason": "Independent calculation over the frozen rows"}
```

The engine snapshots source and executable hashes, stages separate analysis and
verifier inputs, captures full logs, rejects modified verifiers and missing metrics,
and keeps execution status distinct from measurement validity. All dependent records
become stale if a source, interpreter, plan, or upstream record changes. Installed
libraries, drivers, hardware, and external systems are not fully captured by an
executable digest. Record their versions in an environment manifest among the frozen
inputs and use a controlled execution environment for substantive work.

Write an owner scope file using the exact experiment IDs:

```json
{
  "description": "Evaluate the registered unit-conversion tests on synthetic inputs",
  "experiments": ["REPLACE_WITH_EXPERIMENT_UUID"],
  "maxRuns": 1,
  "timeoutMs": 10000,
  "maxTotalMs": 10000,
  "maxCostUnits": 1,
  "expiresAt": "REPLACE_WITH_FUTURE_ISO_8601_TIME",
  "stopOnAnomaly": true
}
```

```sh
duck research PROJECT approve scope.json
duck research PROJECT run EXPERIMENT_ID SCOPE_ID
duck research PROJECT cycle SCOPE_ID
```

Review the scripts and input scope before approval. Cost units are a declared
planning budget, not monetary billing. A plan revision can run once. Interrupted or
failed trials consume their attempt. Changing predictions, files, or a dependency
requires a new reviewed plan/scope. The cycle selects the highest-priority remaining
approved test, assesses it, and continues only within its limits. Open-ended generation
of new experiments happens through the researcher/agent; new plans need authorization.

A separate verifier is structurally independent code selected by the owner. This
mechanism alone cannot establish that its scientific method or measurements are sound.

## Pi and Gemini

Both workers expose `inspect_research`, `record_research`, and
`run_research_experiment`. `/research` shows scientific state. In the interactive Pi
session, `/research approve scope.json` previews the exact scope and frozen plans and
requests owner approval. Alternatively quit the worker, approve through the CLI, and
reopen the same project. External CLI writers respect the existing project lease.

Review mode exposes inspection only. Agents cannot approve scopes, attribute their
own feedback to the owner, promote rules/capabilities, or resolve scientific anomalies.
Handoffs include an artifact for the complete scientific state, stale counts, and open
anomalies. Rejected and inconclusive assessments remain linked to their original runs.

## Recover and correct

```sh
duck research PROJECT reconcile UNKNOWN_RUN_ID 'Observed process termination and inspected partial effects'
```

This records a failed/abandoned run with an observed resolution, rather than inventing
a successful measurement. The old scope stays stopped. Review a new plan/scope to
continue. General task-operation reconciliation remains available for other tools.

Source changes invalidate claims transitively. Re-register/revise the affected
scientific records and repeat approved validation before using the claims. Historical
versions remain accessible. Only the owner can resolve an anomaly with a linked run
and a recorded explanation.

## Accumulate domain experience and methods

```sh
duck research PROJECT record feedback correction.json
duck research PROJECT promote rule rule.json
duck research PROJECT promote capability capability.json
```

Agent feedback proposals retain their authority label. Rule promotion requires
owner-attributed feedback, current verified regression runs, and subsequent transfer
runs on different inputs/contexts. Promoted rules enforce required experiment
parameters and permitted claim types. Stale rules fail closed. To retire a rule,
revise it through the owner CLI with `status: "retired"` and `retirementReason`;
the old rule and its evidence stay in history.

Capability promotion requires that the same method-file hashes occur in development
and distinct transfer adapters. This checks reuse provenance and execution. A domain
review must still establish substantive generalization and usefulness. Capturing a
workflow or rule does not train the underlying language model.

## Evaluate progress

The copied inquiry example also includes a runnable evaluator contract exercise:

```sh
duck research PROJECT evaluation-demo
```

It compares two identical deterministic arithmetic adapters on two tasks with two
repeats (eight trials). Both should score 1 and the paired difference should be 0.
Truth is written to owner-side state outside the project. This is a positive control
for the evaluator, not a claim that the candidate outperforms an AI baseline.

For a substantive comparison, supply your own frozen methods, domain cases, and rubric:

```sh
duck research PROJECT evaluate evaluation.json
duck research PROJECT evaluation-review EVALUATION_ID
duck research PROJECT evaluation-rate EVALUATION_ID ratings.json
duck research PROJECT evaluation-reveal EVALUATION_ID
```

An evaluation configuration names baseline, candidate, and independent evaluator
adapters with the same script interface as experiments. It supplies at least two
tasks, repeat count, randomization seed, per-process timeout, and the shared declared
provider/model/tool identity. Each task supplies an input file in the project, an
absolute truth-file path outside the project, and its domain context.

```json
{
  "purpose": "research-evaluation",
  "identity": {"provider": "YOUR_PROVIDER", "model": "EXACT_MODEL_ID", "tools": ["YOUR_ALLOWED_TOOLS"]},
  "baseline": {"executable": "/absolute/interpreter", "script": "baseline.py", "files": []},
  "candidate": {"executable": "/absolute/interpreter", "script": "candidate.py", "files": []},
  "evaluator": {"executable": "/absolute/interpreter", "script": "score.py", "files": []},
  "tasks": [
    {"id": "case-a", "input": "a.json", "truth": "/outside-project/a-truth.json", "context": "DOMAIN_A"},
    {"id": "case-b", "input": "b.json", "truth": "/outside-project/b-truth.json", "context": "DOMAIN_B"}
  ],
  "outcomes": {"validity": {"direction": "higher", "minimum": 0, "maximum": 1, "failureScore": 0}},
  "repeats": 5,
  "seed": 17,
  "timeoutMs": 30000
}
```

Method requests contain `input`, `identity`, `budget`, `repeat`, `seed`, and task/context
identifiers. The evaluator receives `candidate` and `truth`, and returns the verifier
measurement contract. Truth and evaluator paths are withheld from method payloads.
Freeze the domain rubric and expected outcomes before running a comparison.

All attempted trials stay in the denominator; failures receive the declared worst-case
score, including for lower-is-better metrics. Results report paired differences averaged
within task before aggregating across tasks. Repeats are not counted as independent
scientific problems. Human review exports hide method identities and automated scores.
Ratings require reviewer identity/qualifications, the report hash, and all trial IDs
before the reveal action is available. Reviewer identity is declared, not authenticated.

Per-process wall time, attempts, frozen sources, and output limits are enforced. Actual
provider identity, internal tool/model calls, token budgets, and charges require
instrumented adapters; the generic harness reports those as unknown. The statistical
report is descriptive and does not establish superiority. The fixture tests use
`purpose: "fixture-contract"` and test the harness, not an AI scientist's ability.

## Execution boundary

Adapters execute as the host user with a minimal environment and separate staging
directories. This is not OS-level containment. An approved program can still access
host resources through explicit paths or start its own network calls. Restricted
research needs an institution-approved container, sandbox, or execution host. The
software's truth separation and permission checks do not replace that boundary.

## Observational medicine pilot

Create a fresh study with `duck init PROJECT --kind observational`, install its
hash-locked Python dependencies, and run `prepare.py` inside it. Then run
`duck research PROJECT medical-demo`. The [study README](../examples/observational-medicine/README.md)
contains the full commands, frozen analysis definition, provenance and limitations.

The engine's `study` record adds an explicit population, eligibility, unit of analysis,
time zero, exposure/comparator, exposure/outcome windows, follow-up, censoring,
competing events, estimand, confounders, identification assumptions, missingness,
sensitivity plan, source files and claim policy. Study-linked experiments must address
the same question. Claims must use runs linked to that protocol. A causal claim needs
an owner-reviewed causal protocol, aligned temporal windows and an explicit
identification argument. Those are recorded assumptions and permissions, not proof
that causal identification holds.

The NHEFS pilot is association-only because exposure timing is coarse. It reproduces
a complete-case IPW contrast and refitted participant-bootstrap interval with a
separate numerical solver. Its unexpected direction of adjustment is retained as an
anomaly against the original exploratory predictions. The public observational result
is not used as causal ground truth or as a hidden scientific-benefit benchmark.


## Instrumented live review comparison

`node scripts/evaluate-medical.mjs --live /absolute/new-pilot-root EXACT_MODEL`
runs the [observational-method review pilot](../examples/observational-evaluation/README.md)
with the signed-in, billing-confirmed ChatGPT profile. It makes live subscription
requests. The runner refuses an existing output directory. Four constructed cases,
three repeats, two conditions, and a frozen owner-authored rubric give 24 planned
trials. They test a review component separately from the NHEFS reproduction.

Both conditions use the exact same adapter, model, case facts and four shared tools.
The baseline receives ordinary research-assistant instructions; the candidate receives
LemmaDuck's inquiry instructions. The parent controls credentials and records each
model response's identity, call count, tool calls and provider-reported token usage.
Child adapters receive an ephemeral loopback capability, never model credentials.
There is no automatic model fallback or SDK retry. Visible final answers and tool
receipts are saved; hidden reasoning is omitted from answer artifacts.

The optional `live` evaluation configuration declares `maxCalls`, `maxToolCalls`,
`maxOutputTokens`, `maxReportedTokens`, and `reasoning`. A new request is refused
after the call/tool/token budget is consumed. The installed Codex transport does not
forward an output-token cap: output and aggregate token ceilings are checked after
each response, and overruns fail that trial. An already dispatched response may
exceed a declared ceiling. Monetary charges and remaining account quota are unknown.
The randomized seed determines trial order; it does not promise deterministic sampling.

These public cases and their rubric were authored with the implementation. They are
not an externally validated domain benchmark or causal-effect ground truth. Repeats
remain grouped by the four cases. A result does not establish end-to-end discovery,
clinical usefulness, or transfer to real research. The separate blind human-review
export remains available; a qualified reviewer must supply their own ratings before
method identities are revealed through the review CLI.


For a readable review packet, run:

```sh
node scripts/export-research-review.mjs PROJECT EVALUATION_ID /absolute/new-review-directory
```

It verifies artifact hashes and exports anonymous visible answers, an empty ratings
JSON template, and a local HTML rating form. The form uses no network requests and
requires an identifier, qualifications, three ratings per answer, and notes. Keep
personal reviewer information in owner-controlled storage. A reviewer persona or
another model is an automated review perspective; record that identity and any
exposure to conditions/results rather than labelling it independent human review.

## Choose the next research action

For a supplied explanation or review, use its evidence directly. Research records
and tools are useful when they advance a question, resolve missing information, or
verify a consequential result. A verified local result can remain known while a
broader scientific claim remains uncertain.

`compare_research_actions` is available in Pi and Gemini, including read-only review.
It compares declared possible outcomes for competing explanations, rejects unavailable
resources and already known answers, and distinguishes independent replication from
rerunning the same result. It leaves scientific records unchanged. Learning and
replication have separate rankings because their scores have different meanings.
These are declared outcome distinctions per cost, not measured information gain.

Owners can use it without a model profile or task-state initialization:

```sh
duck research PROJECT compare actions.json
```

The inquiry starter includes an example `actions.json`. Describe the question,
alternative hypotheses, and each action's availability, known-answer status,
independence, cost and possible outcomes. Each outcome names compatible alternatives.
The engine exposes missing alternatives and nondiscriminating proposals; domain
judgment must still assess whether those predictions and independence assumptions
are credible.

Formal-proof claims are refused: the current verifier contract checks bounded
measurements and does not implement a proof-system adapter. Historical records are
preserved, and historical formal claims appear in `unsupportedClaims`. An arithmetic
check cannot be relabelled as a universal proof. A causal claim still requires the
owner-reviewed identification protocol as well as verified measurements.

Unknown nested experiment outcomes now interrupt both workers. The live gateway also
refuses new calls while reconciliation is required, serializes model/tool actions,
and prevents method transcripts from replacing the owner-frozen system policy.
Live comparisons may name owner-supplied `policies.baseline` and `policies.candidate`
(each with `name` and `text`); exact instructions and parent sources are frozen before
dispatch and withheld from method payloads. Provenance digests and archived executable
modules support review of the actual implementation, not just a version label.
