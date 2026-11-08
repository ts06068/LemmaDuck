# Inquiry policy improvement experiments

These constructed cases compare the production inquiry instructions at `7c9b135`
with the current instructions. Both conditions receive the same authenticated model,
tools, adapter, facts, per-trial ceilings and randomized order. Repeats are grouped
by case. Failures remain in the denominator. The baseline is the previous inquiry
policy, not an ordinary assistant or an earlier complete installation.

The [improvement log](https://github.com/ts06068/LemmaDuck/blob/main/docs/IMPROVEMENT_LOG.md)
records hypotheses before dispatch, results, rubric errors and subsequent changes.
Original reports are retained. The evidence does not support treating every automatic
score as scientific truth or claiming general scientific superiority.

## Run

From a built source checkout with an authenticated, billing-confirmed ChatGPT profile:

```sh
node scripts/evaluate-inquiry.mjs --live /absolute/new-run-root gpt-6-sol confirmation
```

This makes live subscription requests and refuses an existing output directory.
The default stage is `confirmation`; other stages are `development`, `transfer` and `calibration`. Rerunning a
stage produces a development/regression measurement; it does not make previously
inspected cases untouched validation. The provider/model is pinned with no automatic
fallback. Extra charges and remaining account quota are not inferred from usage.

The owner protocol records exact policies, code/input/truth hashes, budgets and
parent-runtime provenance before model dispatch. Current runs also archive the
executed parent modules and dependency metadata. Child adapters receive an ephemeral
loopback capability, not model credentials or both condition policies. Visible answer
artifacts omit hidden reasoning. Two confirmation cases require acquiring undisclosed
case facts; avoiding every tool cannot pass.

## Grading and limits

`score.py` checks issue status, evidence references, next-action choice and an explicit
operational split plan. Its original v2/v3 trials exposed ambiguity in issue labels
and conclusion categories. Those outcomes are preserved. The earlier rubric versions
and `score-v2.py` remain available for audit; they are not silently replaced in old
reports.

`score-propositions.py` separately grades explicitly scoped propositions, numeric
values, evidence references and actions. Confirmation tasks explicitly request no
new split plan. Regression tests check that known local results are not erased by
uncertainty, numerical association is not promoted to causality, observed contradictions
are retained, and leaking operational plans cannot pass merely by naming the right
issues. These are bounded contracts, not an evaluation of arbitrary scientific prose.

The same implementation agent authored these cases, policies and rubrics. Inputs
are public and trusted; same-user processes are not confined by an OS sandbox.
The cases contain no real patient records. Independent review, real study utility,
discovery and external generalization remain separate questions.

The design draws on [target-trial alignment](https://pmc.ncbi.nlm.nih.gov/articles/PMC5124536/),
[leakage in ML-based science](https://pmc.ncbi.nlm.nih.gov/articles/PMC10499856/), and
[risks with competing events](https://www.bmj.com/content/bmj/349/bmj.g5060.full.pdf).
Those references motivate the methodological checks; they do not supply clinical
causal-effect ground truth for these constructed cases.
