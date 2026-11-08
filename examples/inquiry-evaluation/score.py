"""Frozen evidence/action rubric; independent of the policies and model adapter.

It checks a structured decision contract, not the truth of clinical effects or the
quality of arbitrary prose. Clinical usefulness still needs a separate review.
"""
import json
import sys


def score(answer, truth):
    if not isinstance(answer, dict) or not isinstance(answer.get("findings"), list):
        raise ValueError("Missing structured findings")
    findings = answer["findings"]
    if len(findings) > 20 or len({f.get("issue") for f in findings}) != len(findings):
        raise ValueError("Findings must be bounded and unique")
    appropriate = []
    established = set()
    for finding in findings:
        issue, status, evidence = finding.get("issue"), finding.get("status"), finding.get("evidence")
        if issue not in truth["allowed_issues"] or status not in {"established", "possible", "not_supported"}:
            raise ValueError("Invalid finding or evidence status")
        if not isinstance(evidence, list) or not evidence or any(f not in truth["facts"] for f in evidence):
            raise ValueError("Evidence must cite supplied fact IDs")
        if status == "not_supported":
            appropriate.append(issue not in truth["established"])
            continue
        allowed = truth["established"] if status == "established" else {**truth["established"], **truth["possible"]}
        supported = issue in allowed and bool(set(evidence) & set(allowed[issue]))
        appropriate.append(supported)
        if supported and status == "established":
            established.add(issue)
    required = set(truth["required"])
    recall = len(required & established) / len(required) if required else 1.0
    precision = sum(appropriate) / len(appropriate) if appropriate else 1.0
    action = answer.get("next_action", {})
    if not isinstance(action, dict) or not isinstance(action.get("reason"), str) or len(action["reason"].strip()) < 20:
        raise ValueError("Supply an evidence-based next-action reason")
    next_score = float(action.get("id") in truth["next_actions"] and type(action.get("new_information")) is bool and action["new_information"] == truth["next_actions"].get(action["id"]))
    expected_plan = truth["split_plan"]
    plan = answer.get("split_plan")
    usable = float(isinstance(plan, dict) and all(plan.get(key) == value for key, value in expected_plan.items())) if expected_plan else float(plan is None)
    result = {"critical_recall": recall, "evidence_precision": precision,
              "claim_scope": float(answer.get("conclusion") in truth["conclusions"]),
              "next_information": next_score, "operational_plan": usable}
    result["joint_validity"] = min(result.values())
    return result


def main():
    request = json.load(open(sys.argv[1]))
    try:
        metrics = score(request["candidate"]["answer"], request["truth"])
        result = {"valid": True, "metrics": metrics,
                  "reason": "Frozen evidence-status/action/operational-plan contract; not expert prose judgment or causal ground truth"}
    except (KeyError, TypeError, ValueError) as error:
        result = {"valid": False, "metrics": {}, "reason": str(error)}
    json.dump(result, open(sys.argv[2], "w"))


if __name__ == "__main__":
    main()
