"""Prespecified normalized IPW contrast with a participant bootstrap; association only."""
import hashlib
import importlib.metadata
import json
from pathlib import Path
import sys

import numpy as np
import pandas as pd
import patsy
import statsmodels.api as sm


def main():
    request = json.loads(Path(sys.argv[1]).read_text())
    inputs = request["inputs"]
    runtime = json.loads(Path(inputs["runtime.json"]).read_text())
    for name, expected in runtime["packages"].items():
        if importlib.metadata.version(name) != expected:
            raise ValueError("Runtime dependency changed: " + name)
    if hashlib.sha256(Path(inputs["nhefs.csv"]).read_bytes()).hexdigest() != runtime["data_sha256"]:
        raise ValueError("Dataset differs from registered source")
    if hashlib.sha256(Path(inputs["requirements.lock"]).read_bytes()).hexdigest() != runtime["requirements_sha256"]:
        raise ValueError("Environment manifest changed")
    protocol = json.loads(Path(inputs["protocol.json"]).read_text())
    if protocol["claim_policy"] != "associational":
        raise ValueError("This adapter does not establish a causal estimand")
    frame = pd.read_csv(inputs["nhefs.csv"])
    if frame.seqn.duplicated().any() or not frame.qsmk.isin([0, 1]).all():
        raise ValueError("Duplicate IDs or invalid exposure coding")
    required = protocol["covariates"] + ["qsmk", "wt82_71"]
    complete = frame.dropna(subset=required).copy()
    a, design = patsy.dmatrices(protocol["propensity_formula"], complete, return_type="dataframe")
    a = np.asarray(a).ravel()
    x = np.asarray(design)
    y = complete.wt82_71.to_numpy(float)
    if not np.isfinite(x).all() or not np.isfinite(y).all() or len(np.unique(a)) != 2:
        raise ValueError("Invalid analysis matrix")
    # Scaling improves numeric conditioning without changing an unpenalized logit.
    x[:, 1:] = (x[:, 1:] - x[:, 1:].mean(axis=0)) / x[:, 1:].std(axis=0)

    def estimate(indices):
        sampled_x, sampled_a, sampled_y = x[indices], a[indices], y[indices]
        fit = sm.GLM(sampled_a, sampled_x, family=sm.families.Binomial()).fit(maxiter=100, tol=1e-10)
        p = np.asarray(fit.predict(sampled_x))
        if not fit.converged or np.any((p <= 0) | (p >= 1)):
            raise ValueError("Unconverged or degenerate propensity fit")
        weights = np.where(sampled_a == 1, 1 / p, 1 / (1 - p))
        means = [np.average(sampled_y[sampled_a == group], weights=weights[sampled_a == group]) for group in (0, 1)]
        return float(means[1] - means[0]), weights, p

    contrast, weights, p = estimate(np.arange(len(y)))
    crude = float(y[a == 1].mean() - y[a == 0].mean())
    uncertainty = protocol["uncertainty"]
    rng = np.random.default_rng(uncertainty["seed"])
    bootstrap = [estimate(rng.integers(0, len(y), size=len(y)))[0] for _ in range(uncertainty["replicates"])]
    lower, upper = np.quantile(bootstrap, [.025, .975])
    pooled = np.sqrt((x[a == 1, 1:].var(axis=0, ddof=1) + x[a == 0, 1:].var(axis=0, ddof=1)) / 2)
    before = np.abs((x[a == 1, 1:].mean(axis=0) - x[a == 0, 1:].mean(axis=0)) / pooled)
    after = np.abs((np.average(x[a == 1, 1:], axis=0, weights=weights[a == 1]) - np.average(x[a == 0, 1:], axis=0, weights=weights[a == 0])) / pooled)
    ess = lambda group: float(weights[a == group].sum() ** 2 / np.square(weights[a == group]).sum())
    metrics = {"source_rows": len(frame), "complete_cases": len(complete), "treated": int(a.sum()), "control": int((1 - a).sum()),
               "missing_outcomes": int(frame.wt82_71.isna().sum()),
               "missing_outcomes_treated": int(frame.loc[frame.qsmk == 1, "wt82_71"].isna().sum()),
               "missing_outcomes_control": int(frame.loc[frame.qsmk == 0, "wt82_71"].isna().sum()),
               "missing_covariate_records": int(frame[protocol["covariates"]].isna().any(axis=1).sum()),
               "excluded_records": len(frame) - len(complete), "crude_difference_kg": crude,
               "ipw_difference_kg": contrast, "adjustment_shift_kg": contrast - crude, "ci_lower_kg": float(lower), "ci_upper_kg": float(upper),
               "ps_min": float(p.min()), "ps_max": float(p.max()), "ess_treated": ess(1), "ess_control": ess(0),
               "max_smd_before": float(before.max()), "max_smd_after": float(after.max()), "bootstrap_successful": len(bootstrap)}
    if not all(np.isfinite(value) for value in metrics.values()):
        raise ValueError("Nonfinite result")
    Path(sys.argv[2]).write_text(json.dumps({"metrics": metrics, "claim_policy": "associational", "bootstrap": uncertainty,
        "limitations": protocol["identification_limits"], "design_columns": list(design.columns)}, indent=2))
    print("Completed prespecified complete-case IPW association and refitted participant bootstrap")


if __name__ == "__main__":
    main()
