"""Independent proposition/value/action contract. No whole-answer scope aliases."""
import json
import math
import sys


def score(answer, truth):
    judgments = answer.get("judgments")
    if not isinstance(judgments, list) or len(judgments) != len(truth["propositions"]):
        raise ValueError("Judge every scoped proposition exactly once")
    if {row.get("id") for row in judgments} != set(truth["propositions"]):
        raise ValueError("Missing or repeated proposition IDs")
    correct, grounded = [], []
    for row in judgments:
        expected = truth["propositions"][row["id"]]
        correct_value = row.get("value") is None if expected["value"] is None else type(row.get("value")) in (int, float) and math.isfinite(row["value"]) and abs(row["value"] - expected["value"]) <= 1e-9
        correct.append(row.get("status") == expected["status"] and correct_value)
        evidence = row.get("evidence", [])
        grounded.append(isinstance(evidence, list) and bool(evidence) and all(e in truth["facts"] for e in evidence) and bool(set(evidence) & set(expected["evidence"])))
    action = answer.get("next_action", {})
    valid_action = type(action.get("new_information")) is bool and action.get("id") in truth["next_actions"] and action["new_information"] == truth["next_actions"].get(action["id"]) and isinstance(action.get("reason"), str) and len(action["reason"].strip()) >= 20
    expected_plan = truth["split_plan"]
    plan = answer.get("split_plan")
    usable = isinstance(plan, dict) and all(plan.get(k) == v for k, v in expected_plan.items()) if expected_plan else plan is None
    metrics = {"critical_recall": sum(correct) / len(correct), "evidence_precision": sum(grounded) / len(grounded),
               "claim_scope": float(all(correct)), "next_information": float(valid_action), "operational_plan": float(usable)}
    metrics["joint_validity"] = min(metrics.values())
    return metrics


def main():
    request = json.load(open(sys.argv[1]))
    try:
        metrics = score(request["candidate"]["answer"], request["truth"])
        result = {"valid": True, "metrics": metrics, "reason": "Frozen scoped-proposition, numeric-value, evidence and action contract; no expert or clinical efficacy claim"}
    except (KeyError, TypeError, ValueError) as error:
        result = {"valid": False, "metrics": {}, "reason": str(error)}
    json.dump(result, open(sys.argv[2], "w"))


if __name__ == "__main__":
    main()
