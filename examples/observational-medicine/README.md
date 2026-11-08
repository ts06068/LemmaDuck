# Observational medicine: NHEFS reproduction

This project compares crude and measured-covariate-adjusted weight-change contrasts
between smoking-cessation groups in the public NHEFS teaching release used by Hernán
and Robins. The source CSV is downloaded from the author's site and checked against
a pinned SHA-256. The dataset is not redistributed in this repository.

This is a methodological reproduction. It is not a new clinical finding, a known
causal-effect benchmark, or evidence that LemmaDuck improves scientific productivity.
Exact cessation timing is unavailable and the exposure/outcome windows overlap.
The registered protocol therefore permits **associational claims only**.

## Run

From a built source checkout:

```sh
./duck init /absolute/path/to/new-observational-study --kind observational
cd /absolute/path/to/new-observational-study
uv venv --python 3.12 .venv
uv pip sync --python .venv/bin/python --require-hashes requirements.lock
.venv/bin/python prepare.py
duck research /absolute/path/to/new-observational-study medical-demo
```

For an already downloaded public CSV, `prepare.py --from-file /path/to/nhefs.csv`
performs the same checksum check. It refuses a changed source. The runtime manifest
records the exact interpreter, package versions, dependency-lock hash and data hash.
The analysis and verifier check those dependencies before use. Neither contacts a
model service. The owner-invoked `medical-demo` authorizes this fixed public-data
reproduction and its independent numerical verification only.

## What runs

- Freeze the source, protocol, environment manifest, predictions and code.
- Register population, eligibility, time zero, exposure/comparator, outcome window,
  estimand, confounding, missingness, positivity, censoring and claim limits.
- Count unique participants, exclusions and exposure-group denominators.
- Fit the prespecified logistic propensity model and normalized IPW mean contrast.
- Refit the model in every participant-bootstrap replicate; preserve all failures.
- Recompute the cohort, design matrix, propensity score equations, weighting,
  uncertainty and diagnostics with a separate SciPy implementation.
- Preserve rejected/inconclusive hypotheses, anomalies and an explicitly bounded claim.

The original exploratory expectations allow attenuation or a small adjustment shift.
The observed public-data result may reject both. The framework preserves that outcome;
it does not change the original predictions to fit a result. A revised explanation
or a new study needs its own recorded rationale and approved plan.

The verifier checks numerical reproduction, not the truth of causal assumptions.
Complete-case selection, residual confounding, treatment versions and coarse timing
remain limitations. Bootstrap intervals reflect this analysis's sampling/model
procedure and do not account for all sources of bias. Within-cohort resampling is
not independent external validation.

## Sources and reuse

- [Author's teaching data](https://miguelhernan.org/s/nhefs.csv)
- [Hernán and Robins, Causal Inference: What If](https://miguelhernan.org/s/hernanrobins_WhatIf_2jan25.pdf), Part II
- [LemmaDuck research guide](https://github.com/ts06068/LemmaDuck/blob/main/docs/RESEARCH.md)

Use different cases and a separately frozen domain rubric for a baseline/candidate
AI comparison. Do not treat an observed association in this public cohort as known
causal ground truth or a hidden evaluation task.
