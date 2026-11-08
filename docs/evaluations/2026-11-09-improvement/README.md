# Inquiry hardening and improvement experiments

Four local improvement cycles repaired execution and provenance defects and tested
how research guidance changes behavior. All **80 paired comparison trials** completed
on 20 constructed cases, with the same `openai-codex` / `gpt-6-sol` model, tools and
ceilings within each comparison. This is engineering/component evidence authored by
the implementation agent, not independent domain validation.

## What changed

- A read-only action comparator rejects already known answers, unavailable resources,
  nondiscriminating outcomes and replication without new independent evidence.
  Learning and replication are ranked separately. Its CLI needs no model or task state.
- Both workers stop for nested unknown outcomes. The model gateway serializes actions,
  refuses unresolved work and prevents caller messages from replacing frozen policies.
- Configuration, policy, budget and case objects are copied so callers cannot alter a
  comparison after its protocol is frozen. Current live runs archive parent modules
  and dependency metadata before dispatch.
- Quota errors retain their actual cause. Quota, identity and missing-metering failures
  stop later model dispatch. Valid reported usage from failed responses remains counted.
- Numerical verification cannot be relabelled as a formal proof. Cached data, runtime
  manifests and local environments are excluded when creating medical starter projects.
- Production guidance is 158 words, compared with the previous 155. It preserves known
  local facts, qualifies broader claims, and uses records/tools when they advance work.

## Results retained without rescoring

| Comparison | Trials | Calls, old → candidate | Reported tokens, old → candidate | Automatic joint score, old → candidate |
| --- | ---: | ---: | ---: | ---: |
| Development; initial revised guidance | 32 | 27 → 20 | 38,628 → 30,736 | 0.8292 → 0.8854 |
| Transfer; same initial guidance | 16 | 18 → 10 | 27,066 → 15,271 | 0.9583 → 0.8500 |
| Proposition calibration; longer guidance | 16 | 9 → 8 | 11,597 → 11,998 | 0.7500 → 0.7500 |
| Fresh confirmation; final compact guidance | 16 | 12 → 12 | 14,593 → 14,668 | 1.0000 → 1.0000 |

The first rubric penalized some defensible scope statements and qualified concerns.
The transfer result included a correct unit equivalence labelled insufficient
information, exposing ambiguity in a single whole-answer conclusion category.
The calibration rubric also required a split plan that the task did not explicitly
request. These scores remain unchanged. The fresh confirmation instead judged scoped
propositions, numbers and evidence with an explicit output contract.

**The final confirmation does not show a cost or scientific-quality advantage.**
Both policies used the minimum calls needed to acquire the undisclosed facts and
answer all cases; reported tokens differed by 0.5%. Earlier savings apply to their
particular guidance and task sets. Do not pool quality scores across stages or
attribute all earlier savings to the final version. The improvement that survives
this audit is stronger execution/provenance control, usable action comparison and
clearer evidence handling, with correct behavior on the tested cases.

Real-model checks also executed exact owner-approved adapters: a valid result that
contradicted both hypotheses was retained, invalid verification supported no claim,
and a timeout stopped for reconciliation. All three passed with the longer and the
compact policy. The new action tool was invoked by the actual model and correctly
excluded known/unavailable actions without creating scientific records.

## Audit the evidence

[summary.json](summary.json) contains all aggregates and trial mappings.
[reports](reports/) preserves the original report bytes and hashes.
[protocols](protocols/) preserves the actual frozen execution configurations, including
original host paths. Reruns create new paths and IDs. [artifacts.json](artifacts.json)
maps SHA-256 to original UTF-8 artifact contents: inputs, visible outputs, grading
truth, adapter code and available parent-runtime snapshots. Each value hashes to its
key. Hidden model reasoning and authentication stores are excluded.

Early stages recorded critical parent digests; full parent source archives were
added before calibration and confirmation. Protocols with `runtimeFiles` map paths
to the corresponding contents in `artifacts.json`. The code and dependency metadata
can be inspected separately from the reported results. [live-controls.json](live-controls.json)
records the approved-experiment and action-tool checks. No human reviewer identity,
independent blind rating or clinical efficacy is claimed.

The [improvement log](../../IMPROVEMENT_LOG.md) records hypotheses, failures, rubric
amendments and decisions. The [case README](../../../examples/inquiry-evaluation/README.md)
explains reproduction. External scientific usefulness and discovery remain questions
for domain collaboration and independently authored research cases.
