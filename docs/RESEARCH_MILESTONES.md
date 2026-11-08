# Research implementation milestones

The target is an inspectable inquiry loop: observations lead to competing explanations,
preregistered tests, independent measurements, explicit revisions, and reusable methods.
Execution success, human approval, and scientific evidence remain distinct.

| Milestone | Acceptance evidence required |
| --- | --- |
| 1. Structured scientific records | Typed, revisioned observations, questions, hypotheses, plans, results, claims, and provenance; malformed links rejected; ordinary tasks remain compatible. |
| 2. Executable inquiry loop | Candidate tests compared for importance, discrimination, feasibility, and cost; predictions frozen before dispatch; real adapter execution changes hypothesis assessments; inconclusive outcomes remain explicit. |
| 3. Independent verification | Separate frozen verifier; input/code digests; structured measurements; failed verification cannot support a claim; evaluator changes invalidate approval. |
| 4. Contradictions and negative results | Persistent anomalies and rejected/inconclusive explanations in handoffs; transitive dependency invalidation; no silent deletion by a later summary. |
| 5. Bounded autonomy | Owner-approved exact experiment scope, runtime/trial limits, stop conditions, and replay prevention; cancellation/unknown effects require reconciliation; Pi and Gemini share controls. |
| 6. Domain feedback and improvement | Attributed correction records; reviewed, executable regression checks; versioned rule promotion gated by passing checks and later independent cases. |
| 7. Scientific progress and reuse evaluation | Repeated paired baseline/candidate harness with equal declared budgets, hidden evaluator material, independent outcomes and attributed reviewer ratings; reusable methods must pass distinct transfer cases. |

Implementation and test results are recorded below as work completes. Synthetic tests
validate mechanics and controlled examples. They do not demonstrate scientific novelty,
live model performance, clinical validity, or benefit to working scientists. Those require
prospective domain collaborations and a separately reviewed evaluation protocol.

## Implementation map

| Milestone | Implemented source | Controlled verification |
| --- | --- | --- |
| 1 | `src/research.ts`: schema-checked immutable revisions, pinned dependency/file refs and separate authority labels | Structure/link rejection, historical reads, integrity, stale descendants and task-switch isolation |
| 2 | Candidate ranking, `ResearchRunner.cycle`, preregistered predictions, real adapters and bounded hypothesis assessments | Unit-normalization development/transfer example; incompatible and overlapping predictions; batch stop |
| 3 | Frozen, separately staged verifier with no shared analysis-code hashes; strict measurement contract | Changed verifier refusal, independent recomputation, invalid/missing measurements and claim refusal |
| 4 | Anomaly records, preserved per-run negative/inconclusive assessments, transitive invalidation, handoff artifact | Stale claims, inconclusive batch and owner-only anomaly resolution |
| 5 | Owner CLI/UI scope approval; exact plan revisions; attempts, wall time, cost units, expiry, stop rules and receipts | Real cancellation/timeout, consumed attempts, replay refusal, review and shared Gemini MCP permissions |
| 6 | Attributed feedback; executable parameter/claim-type rules; later transfer evidence; fail-closed stale rules and explicit retirement | Proposed feedback cannot promote rules; changed transfer data makes rules stale; distinct method hashes/contexts checked |
| 7 | Paired repeated evaluator with frozen external truth, independent scoring, worst-case failure scores, task-grouped differences and blind ratings | Two tasks × two methods × two repeats; identical deterministic controls score equally; failure denominator and rating gates tested |

The local inquiry demonstration measured error reductions of **340** and **144** on
the supplied development and transfer data. The paired evaluator control completed
**eight trials** with a mean correctness difference of **zero**, as expected for
identical deterministic adapters. These observations validate execution, provenance,
and evaluation mechanics. They do not estimate improvement from the inquiry engine.

## Observational-medicine execution and evaluation

The source includes a typed observational-study protocol and a hash-pinned public
NHEFS reproduction. The independent analysis and verifier agreed on 1,566 complete
cases, a 3.4405 kg normalized IPW sample contrast, and its refitted bootstrap interval.
The +0.9000 kg shift from the crude contrast contradicted both initial exploratory
hypotheses; the anomaly and original predictions remain. Timing and confounding
limitations restrict the claim to association.

An authenticated ChatGPT `gpt-6-sol` comparison completed all 24 planned review trials:
four constructed cases, two conditions, three repeats. Shared model, tools, facts,
adapter and declared budgets were held constant. The inquiry condition showed no
advantage: issue F1 was 0.933 versus 0.950, the other three automatic outcomes tied,
and reported tokens were 25,980 versus 15,514. User-requested skeptical clinical
epidemiology persona ratings were also lower for the candidate. These are post hoc
ratings by the same implementation agent, with partial condition-label exposure;
they are not independent blinded expert review.

[The evidence and all ratings](evaluations/2026-11-09-observational-pilot/README.md)
include provenance, failed/negative findings and limits. The exact-label rubric itself
needs independent validation: it penalizes some qualified extra warnings and misses
an ambiguous split instruction. Its original scores were preserved. Parent-module
provenance was captured during this first pilot; future live protocols freeze module
hashes and instructions before dispatch. The subscription transport does not forward
an output-token cap, so token ceilings are checked after responses and overruns fail
the trial; an already dispatched response may exceed a declared ceiling.

## Scientific claim boundary

All seven milestones now have software support and controlled acceptance evidence.
The live pilot does not establish improved scientific performance. The synthetic
promotion/transfer example demonstrates the gate mechanics, not field generalization.
The persona review demonstrates the ratings workflow, not independent domain
validation. Real study usefulness, discovery/invention, and transferable capability
still require independently authored cases and prospective collaboration with domain
scientists. These remain evaluation needs, not implemented model training or proven
scientific achievements.

The subsequent [improvement cycles](IMPROVEMENT_LOG.md) added informative-action
comparison, immutable live protocols and runtime archives, nested-interruption and
quota controls, refusal of unsupported formal proofs, and clean medical scaffolding.
The [80-trial evidence bundle](evaluations/2026-11-09-improvement/README.md) retains
both apparent improvements and regressions. The final fresh confirmation tied the
previous policy at the minimum calls; it does not demonstrate scientific superiority.
