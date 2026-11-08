"""Independent CSV/design construction and SciPy score-equation solution; no analysis imports."""
import csv
import hashlib
import importlib.metadata
import json
from pathlib import Path
import sys

import numpy as np
from scipy.optimize import root
from scipy.special import expit


def main():
    request = json.loads(Path(sys.argv[1]).read_text())
    paths = request["inputs"]
    environment = json.loads(Path(paths["runtime.json"]).read_text())
    for package, version in environment["packages"].items():
        if importlib.metadata.version(package) != version:
            raise ValueError("Frozen runtime package mismatch")
    if hashlib.sha256(Path(paths["nhefs.csv"]).read_bytes()).hexdigest() != environment["data_sha256"]:
        raise ValueError("Source bytes differ")
    protocol = json.loads(Path(paths["protocol.json"]).read_text())
    expected_covariates = {"sex", "race", "age", "education", "smokeintensity", "smokeyrs", "exercise", "active", "wt71"}
    if set(protocol["covariates"]) != expected_covariates or protocol["claim_policy"] != "associational":
        raise ValueError("Verifier does not cover this changed protocol")
    with open(paths["nhefs.csv"], newline="") as stream:
        records = list(csv.DictReader(stream))
    if len({row["seqn"] for row in records}) != len(records):
        raise ValueError("Repeated participant ID")
    present = lambda value: value not in ("", "NA", "NaN", "nan")
    variables = sorted(expected_covariates | {"qsmk", "wt82_71"})
    included = [{name: float(row[name]) for name in variables} for row in records if all(present(row[name]) for name in variables)]
    exposed = np.array([row["qsmk"] for row in included])
    outcomes = np.array([row["wt82_71"] for row in included])
    if set(exposed) != {0, 1}:
        raise ValueError("Invalid binary exposure")
    columns = [np.ones(len(included))]
    for variable, levels in (("education", (2, 3, 4, 5)), ("exercise", (1, 2)), ("active", (1, 2))):
        for level in levels:
            columns.append(np.array([float(row[variable] == level) for row in included]))
    for variable in ("sex", "race", "age", "smokeintensity", "smokeyrs", "wt71"):
        values = np.array([row[variable] for row in included])
        columns.append(values)
        if variable not in ("sex", "race"):
            columns.append(values ** 2)
    matrix = np.column_stack(columns)
    matrix[:, 1:] = (matrix[:, 1:] - matrix[:, 1:].mean(axis=0)) / matrix[:, 1:].std(axis=0)
    if not np.isfinite(matrix).all() or not np.isfinite(outcomes).all():
        raise ValueError("Invalid covariate matrix")

    def recompute(selection):
        design, treatment, response = matrix[selection], exposed[selection], outcomes[selection]
        def score(beta):
            return design.T @ (expit(design @ beta) - treatment)
        def derivative(beta):
            probabilities = expit(design @ beta)
            return design.T @ ((probabilities * (1 - probabilities))[:, None] * design)
        solution = root(score, np.zeros(design.shape[1]), jac=derivative, method="hybr", options={"xtol": 1e-10})
        if np.max(np.abs(score(solution.x))) > 1e-6:
            raise ValueError("Independent score equations did not converge")
        probabilities = expit(design @ solution.x)
        if np.any((probabilities <= 0) | (probabilities >= 1)):
            raise ValueError("Empirical positivity failed")
        weights = np.where(treatment == 1, 1 / probabilities, 1 / (1 - probabilities))
        treated = treatment == 1
        treated_mean = np.dot(weights[treated], response[treated]) / weights[treated].sum()
        control_mean = np.dot(weights[~treated], response[~treated]) / weights[~treated].sum()
        return float(treated_mean - control_mean), weights, probabilities

    effect, weights, probabilities = recompute(np.arange(len(outcomes)))
    crude = float(outcomes[exposed == 1].mean() - outcomes[exposed == 0].mean())
    settings = protocol["uncertainty"]
    random = np.random.default_rng(settings["seed"])
    sampled = [recompute(random.integers(0, len(outcomes), size=len(outcomes)))[0] for _ in range(settings["replicates"])]
    interval = np.quantile(sampled, [.025, .975])
    group1, group0 = exposed == 1, exposed == 0
    scale = np.sqrt((matrix[group1, 1:].var(axis=0, ddof=1) + matrix[group0, 1:].var(axis=0, ddof=1)) / 2)
    balance_before = abs((matrix[group1, 1:].mean(axis=0) - matrix[group0, 1:].mean(axis=0)) / scale)
    weighted1 = np.sum(matrix[group1, 1:] * weights[group1, None], axis=0) / weights[group1].sum()
    weighted0 = np.sum(matrix[group0, 1:] * weights[group0, None], axis=0) / weights[group0].sum()
    balance_after = abs((weighted1 - weighted0) / scale)
    metrics = {"source_rows": len(records), "complete_cases": len(included), "treated": int(exposed.sum()), "control": int((1 - exposed).sum()),
               "missing_outcomes": sum(not present(row["wt82_71"]) for row in records),
               "missing_outcomes_treated": sum(row["qsmk"] == "1" and not present(row["wt82_71"]) for row in records),
               "missing_outcomes_control": sum(row["qsmk"] == "0" and not present(row["wt82_71"]) for row in records),
               "missing_covariate_records": sum(any(not present(row[name]) for name in expected_covariates) for row in records),
               "excluded_records": len(records) - len(included), "crude_difference_kg": crude,
               "ipw_difference_kg": effect, "adjustment_shift_kg": effect - crude, "ci_lower_kg": float(interval[0]), "ci_upper_kg": float(interval[1]),
               "ps_min": float(probabilities.min()), "ps_max": float(probabilities.max()),
               "ess_treated": float(weights[group1].sum() ** 2 / np.dot(weights[group1], weights[group1])),
               "ess_control": float(weights[group0].sum() ** 2 / np.dot(weights[group0], weights[group0])),
               "max_smd_before": float(balance_before.max()), "max_smd_after": float(balance_after.max()), "bootstrap_successful": len(sampled)}
    candidate = request.get("candidate", {})
    valid = candidate.get("claim_policy") == "associational" and all(
        key in candidate.get("metrics", {}) and abs(candidate["metrics"][key] - value) <= 1e-5 for key, value in metrics.items())
    if not all(np.isfinite(value) for value in metrics.values()):
        raise ValueError("Nonfinite independently calculated result")
    Path(sys.argv[2]).write_text(json.dumps({"valid": valid, "metrics": metrics,
        "reason": "Independent CSV cohort, score-equation fit, weighted means, balance and refitted bootstrap agree; this does not verify causal identification"}, indent=2))
    print("Independently checked the complete-case cohort, normalized IPW contrast, diagnostics and bootstrap")


if __name__ == "__main__":
    main()
