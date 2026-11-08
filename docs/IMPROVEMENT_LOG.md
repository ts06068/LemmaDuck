# LemmaDuck improvement cycles

Started 2026-11-09 from `7c9b1353d02c873c836af983389750accd2da104`.
The previous four-case live pilot is development evidence, not a held-out test.
It found no inquiry advantage, 67% more reported tokens, ambiguous split advice,
and weaknesses in a rubric that scores issue names rather than usable decisions.
Original results and ratings remain unchanged.

The objective is a research collaborator whose work is useful, inspectable, and
proportionate to the uncertainty. A cleaner implementation or a passing synthetic
suite alone will not establish that. The iterations below must test behavior as well
as mechanics; failed hypotheses and regressions remain in this log.

## Cycle 1: choose actions that resolve uncertainty

Hypotheses, declared before new live results:

1. Stage-aware guidance will stop redundant state inspection and case rereading on
   fully supplied reviews, while retaining provenance and approval requirements for
   actual experiments. Compared with the previous inquiry instructions, this should
   reduce model calls/tokens without losing identification or leakage checks.
2. An explicit comparison of possible test outcomes will expose actions whose answer
   is already known, unavailable resources, and outcomes that cannot distinguish the
   proposed explanations. Independent replication remains a valid objective when it
   acquires new evidence about measurement reliability.
3. Fresh cases with structured findings, evidence references, and operational action
   requirements will reveal defects that the old exact-label rubric missed. The new
   rubric must accept qualified secondary concerns and refuse unusable split plans.

Validation must include both transports' read-only permissions, malformed/misleading
plans, model identity and budget accounting, unchanged historical evidence, and a
paired live comparison of the old and revised inquiry policies on new cases. Freeze
cases, scoring, effective instructions, parent-runtime provenance and model budgets
before dispatch. Group repeats by distinct case and keep failures in the denominator.
The same author supplies implementation and cases: even a successful comparison is
component evidence, not independent domain validation or scientific discovery.

## Completion standard

Continue until the implemented behavior survives adversarial mechanical checks,
real numerical reproduction, and fresh live comparisons; material regressions must
be repaired or changes rejected. Document useful remaining boundaries rather than
claiming independent expertise, general scientific superiority, or model training.
The installed CLI and published source must agree, and appropriate full-suite/CI
checks must pass. Do not obtain better results by rescoring old trials or treating
reused development cases as untouched validation.


Cycle 1 live protocol: eight development cases × two policies × two repeats (32
trials), followed by four already frozen transfer cases under the same design (16
trials). The baseline is the previous production inquiry policy at `7c9b135`; both
policies receive the current identical tool schemas, adapter, model and ceilings.
The cases include valid counterexamples and three source-acquisition tasks across
both sets. Primary acceptance: candidate joint validity is no lower in aggregate,
no development case loses critical-problem recall, and reported tokens/model calls
fall. These are descriptive software acceptance criteria, not a statistical
noninferiority test. Any policy revision after development results must be recorded;
transfer outcomes must not be used to tune that revision and then reported as fresh.


## Cycle 2: execution controls must survive nested failures and concurrency

Code inspection found that the live evaluation gateway does not apply the worker's
unknown-operation guard and permits a tool mutation while a model request is active.
Gemini's interruption hook inspects only the enclosing tool operation, so a returned
unknown experiment can remain hidden beneath a completed wrapper. Hypothesis:
checking nested unresolved state at dispatch and after tool completion, serializing
trial actions, and rejecting client-supplied system messages will stop further model
or tool work until reconciliation without changing valid sequential workflows.
First reproduce the defects with injected local responses, then verify refusal before
any additional model call or scientific mutation. Test the real MCP wrapper as well
as the gateway. Add live approved-experiment checks for valid contradictory results
and invalid measurements; they must preserve evidence and refuse unsupported claims.


Cycle 1 development outcome: all 32 trials completed. Critical recall, supported
claim scope, next-information choice and operational-plan scores were 1.0 for both
policies. Calls fell from 27 to 20; tool calls from 12 to 4; provider-reported tokens
from 38,628 to 30,736 (20.4% lower). The remaining four tool calls were the required
source acquisitions. This supports the efficiency hypothesis on these cases.

The v2 rubric gave joint scores 0.8292 versus 0.8854. Output inspection found rubric
errors: bounded external-validation scope and qualified empirical confounding caveats
were sometimes penalized. Do not interpret that difference as a reliable scientific
quality gain. Keep the original report, rubric-v2.json and score-v2.py unchanged.
Before transfer output exists, amend the current rubric to v3 with those allowances,
and add regression tests. Transfer cases and production instructions remain unchanged;
the scoring amendment is disclosed rather than labelled untouched preregistration.

Cycle 2 reproduction: all three gateway refusal tests failed against the old gateway;
actual concurrent mutation was observed. The real MCP test also reproduced the nested
unknown bug (the experiment became unknown, but the interruption hook was not called).


A further claim-boundary audit found that a verified arithmetic run can be labelled
as a formal proof even though no formal proof-checking adapter exists. Reproduce
that case, then reject unsupported formal-proof claims explicitly. Preserve bounded
numerical evidence; do not imply that separate JSON verifiers prove arbitrary
mathematical statements. Actual theorem checking needs an implemented proof-system
contract, rather than another unchecked label.


Cycle 1 transfer outcome: all 16 trials completed. Calls fell from 18 to 10 and
reported tokens from 27,066 to 15,271 (43.6% lower). Critical recall, next-information
choice and operational plans remained 1.0. The frozen claim-scope score regressed
from 1.0 to 0.875: one answer selected insufficient_information while correctly
establishing the exact unit equivalence and rejecting the stronger conservation
violation. Original scores stay unchanged (joint validity 0.9583 vs 0.8500).
This shows an ambiguous overall conclusion label and a need to preserve known local
results separately from unproved broader claims. Do not claim an unqualified quality
win. These transfer outputs now inform cycle 3 and cannot serve as untouched evidence
for that further revision.

## Cycle 3: preserve local knowledge while qualifying broader claims

Hypothesis, before a new live run: explicitly separating supported propositions from
stronger unverified claims will retain known measurements instead of collapsing the
whole answer into uncertainty. Add one general calibration instruction. Replace the
single mutually overlapping conclusion labels with independently scored, explicitly
worded propositions in four new cases. Both policies get the same schema, sources,
tools and ceilings. Preserve all old reports and graders. Require every supplied
numerical/logical fact and justified claim boundary to survive, with no calls made
solely to reread supplied evidence. This is an additional component test rather than
a retrospective rescore or proof of broad scientific superiority.


The scaffold audit also reproduced a source-installation issue: observational
starters copied locally cached nhefs.csv, runtime.json and environment directories.
The source checkout on this host contains those cached files. Fresh projects now
copy protocol/code/lock files while excluding cached data, host-specific runtimes,
local environments and credential files. A separate fixture test checks the exact
copied inventory and confirms the source cache is preserved.


Cycle 3 outcome: all 16 trials completed. Both policies retained every scoped
proposition, numeric value, evidence reference and next action. The generic rubric
also demanded a split plan in the prediction review even though the question asked
for judgments, not a new plan. Both returned null and scored 0.75 joint validity.
The record is preserved, with no retrospective fix. Calls fell 9→8 but tokens rose
11,597→11,998 (+3.5%); the 347-word policy has overhead on simple one-call reviews.
The real-model experiment checks passed all three cases: contradictory valid result,
invalid verification, and timeout/unknown requiring reconciliation (5 calls total).

## Cycle 4: keep the useful policy concise

Hypothesis before confirmation outputs: reducing the policy to 158 words (previous
production: 155) while retaining the controls and proposition distinctions will
preserve review accuracy without the long-policy overhead. Four new confirmation
cases, two with undisclosed source material, explicitly request judgments and no
split-plan proposal. Freeze these before dispatch. Compare the compact policy to
the original production policy under identical tools/budgets, with exact proposition,
value, evidence and action checks. Keep previous results and mistakes; do not rescore
them. Acceptance: all candidate judgments/actions valid, necessary source acquisition
retained, no material quality regression, and lower total calls/reported tokens.


Cycle 4 confirmation outcome: all 16 trials completed, and both policies scored 1.0
on every scoped judgment, number, evidence reference, action and output contract.
Each used the theoretical minimum 12 calls: four supplied-case answers and four
source-acquisition tasks needing two calls each. Tokens were 14,593 versus 14,668
(+0.5%). The strict cost-reduction hypothesis was not supported on these cases; there
is no claim of a fresh-set efficiency advantage. The compact policy retains clearer
evidence distinctions with nearly the same instruction length and measured overhead,
while the reproducible control defects are repaired independently of prompt behavior.

The compact policy also passed the three actual model/adapter checks: verified
contradiction preserved, invalid measurement prevented from supporting a claim, and
unknown timeout stopped for reconciliation. The original medical study still has
current evidence and its open contradiction. Earlier cost reductions and score
regressions remain specific to their original policy snapshots and rubrics.


Final failure-path audit: successful fake responses had hidden a quota-reporting
issue. A real SDK error may report zero tokens, causing the accounting error to mask
the actual quota cause. A thrown quota exception also did not stop later planned
requests. Reproduce both and a successful response with missing accounting, then
preserve the original provider error and halt future dispatch when the comparison
cannot be metered or pinned. Do not spend more account requests to debug a route
that cannot yield valid evidence.


The final immutability test also reproduced caller aliasing: mutating repeats while
an evaluation was in flight changed the number of executed trials after the protocol
had already been saved. The evaluator now clones its validated configuration; the
gateway snapshots budgets, identities, policies and case material. The caller cannot
silently alter the frozen comparison through retained object references.

## Decisions and final audit

Keep the action comparator, execution guards, immutable protocol inputs, runtime
archives, claim-boundary fix and clean scaffolding. Each repairs a demonstrated defect
or adds a tested capability. Keep the concise guidance for proportionate inquiry and
explicit evidence distinctions. Reject a general scientific-superiority or universal
cost-saving claim: the fresh confirmation tied at the minimum calls, with +0.5% tokens.
Preserve all 80 comparisons and every failed/scoring-defective result. No learned
model weights or field-generalization claim is implied by these changes.

The actual model invoked the new action tool correctly in two calls and one tool
call, without writing a scientific record. The prior medical task retained nine
current records and its open contradiction. Original reports, protocols, visible
outputs, grading material and runtime sources are preserved with verified hashes in
[the evidence bundle](evaluations/2026-11-09-improvement/README.md).

Local validation: the full Node suite passed 87/87 before the final failure-accounting
and input-aliasing additions. The focused final model/evaluation suite covers those
additions; CI checks the complete final source. Root Python tests passed 21/21 before
the starter regression was added; the updated starter suite passed 4/4. The final CI,
installed-source checks and real worker smoke result are recorded in VALIDATION.md
when complete. Mechanical evidence is not substituted for live scientific judgment.

The final focused model/evaluation suite passed 16/16, including zero-usage and thrown
quota failures, retained usage from failed responses, overrun flags, runtime snapshots,
policy isolation, caller aliasing, and interrupted/concurrent operations. Four original
reports and all 163 published artifact digests were independently rechecked. The
source confirmation protocol is the default; legacy stages remain explicitly available
for audit/regression rather than being presented as new validation.


Completion audit: all four [implementation CI jobs](https://github.com/ts06068/LemmaDuck/actions/runs/42513664905)
passed on `becd924`: 91 main Node passes plus one medical-environment deferment covered
by the dedicated two-test medical job; 22 root Python checks; native editor checks;
three npm installs/upgrades; and real OMP protocols. The source installer, matching
build fingerprint, installed comparison CLI and doctor passed. The actual `gpt-6-sol`
worker passed work/review, checkpoint, warning/failed-output retention, cancellation,
timeout, switch/reconciliation blocking, and artifact retrieval with unrelated
connectors isolated. No required implementation check remains unverified. General
scientific benefit, independent expert validation and model training are not claimed.
