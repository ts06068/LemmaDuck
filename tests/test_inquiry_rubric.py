"""Audit the new rubric against the weaknesses observed in the first live pilot."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1] / "examples/inquiry-evaluation"
spec = importlib.util.spec_from_file_location("inquiry_score", ROOT / "score.py")
score_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(score_module)
RUBRIC = json.loads((ROOT / "rubric.json").read_text())["rubric"]


def answer(case):
    truth = RUBRIC[case]
    return {"conclusion": truth["conclusions"][0],
            "findings": [{"issue": issue, "status": "established", "evidence": truth["established"][issue]} for issue in truth["required"]],
            "next_action": {"id": next(iter(truth["next_actions"])), "new_information": next(iter(truth["next_actions"].values())), "reason": "Use the supplied evidence to resolve the consequential uncertainty."},
            "split_plan": copy.deepcopy(truth["split_plan"])}


class InquiryRubricTests(unittest.TestCase):
    def test_qualified_confounding_concern_is_not_penalized_as_a_false_fact(self):
        a = answer("late-exposure")
        a["findings"].append({"issue": "unmeasured_confounding", "status": "possible", "evidence": ["F3"]})
        self.assertEqual(score_module.score(a, RUBRIC["late-exposure"])["joint_validity"], 1)
        a["findings"][-1]["status"] = "established"
        self.assertLess(score_module.score(a, RUBRIC["late-exposure"])["evidence_precision"], 1)

    def test_correct_issue_names_do_not_excuse_a_leaking_operational_plan(self):
        a = answer("preprocessing-before-split")
        self.assertEqual(score_module.score(a, RUBRIC["preprocessing-before-split"])["joint_validity"], 1)
        a["split_plan"]["assignment"] = "episode_random"
        metrics = score_module.score(a, RUBRIC["preprocessing-before-split"])
        self.assertEqual(metrics["critical_recall"], 1)
        self.assertEqual(metrics["operational_plan"], 0)
        self.assertEqual(metrics["joint_validity"], 0)

    def test_repeating_known_information_cannot_replace_a_discriminating_next_action(self):
        a = answer("unknown-overlap")
        a["next_action"] = {"id": "repeat_protocol", "new_information": True, "reason": "Reconfirm the hospital protocol that was already supplied."}
        self.assertEqual(score_module.score(a, RUBRIC["unknown-overlap"])["next_information"], 0)

    def test_negative_controls_do_not_impose_impossible_causal_or_prediction_requirements(self):
        for case in ["clean-prediction", "aligned-comparator", "landmark-prediction"]:
            self.assertEqual(score_module.score(answer(case), RUBRIC[case])["joint_validity"], 1)
        a = answer("clean-prediction")
        a["findings"].append({"issue": "temporal_leakage", "status": "established", "evidence": ["F2"]})
        self.assertLess(score_module.score(a, RUBRIC["clean-prediction"])["evidence_precision"], 1)

    def test_bounded_verification_and_empirical_assumption_caveats_are_valid(self):
        a = answer("clean-prediction")
        a["findings"].append({"issue": "verification_scope", "status": "established", "evidence": ["F4"]})
        self.assertEqual(score_module.score(a, RUBRIC["clean-prediction"])["joint_validity"], 1)
        a = answer("aligned-comparator")
        a["findings"].append({"issue": "unmeasured_confounding", "status": "possible", "evidence": ["F3"]})
        self.assertEqual(score_module.score(a, RUBRIC["aligned-comparator"])["joint_validity"], 1)

    def test_invented_evidence_and_issue_codes_are_rejected(self):
        a = answer("late-exposure")
        a["findings"][0]["evidence"] = ["F999"]
        with self.assertRaises(ValueError): score_module.score(a, RUBRIC["late-exposure"])
        a = answer("late-exposure"); a["findings"][0]["issue"] = "invented"
        with self.assertRaises(ValueError): score_module.score(a, RUBRIC["late-exposure"])


if __name__ == "__main__": unittest.main()
