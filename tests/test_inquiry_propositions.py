"""Check that local facts, contradictions and stronger claims stay distinct."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1] / "examples/inquiry-evaluation"
spec = importlib.util.spec_from_file_location("proposition_score", ROOT / "score-propositions.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
TRUTH = json.loads((ROOT / "rubric.json").read_text())["rubric"]["observed-versus-causal"]
ANSWER = {"judgments": [
    {"id": "C1", "status": "supported", "evidence": ["F1"], "value": .05},
    {"id": "C2", "status": "not_established", "evidence": ["F2"], "value": None},
    {"id": "C3", "status": "contradicted", "evidence": ["F2"], "value": None}],
    "next_action": {"id": "audit_design", "new_information": True, "reason": "Align the available dates and assess the recorded confounders first."}, "split_plan": None}


class PropositionTests(unittest.TestCase):
    def test_retains_sample_fact_without_promoting_causality(self):
        self.assertEqual(module.score(ANSWER, TRUTH)["joint_validity"], 1)
        for index, status in [(0, "not_established"), (1, "supported"), (2, "not_established")]:
            changed = copy.deepcopy(ANSWER)
            changed["judgments"][index]["status"] = status
            self.assertEqual(module.score(changed, TRUTH)["claim_scope"], 0)

    def test_wrong_numeric_fact_and_unknown_evidence_cannot_pass(self):
        changed = copy.deepcopy(ANSWER)
        changed["judgments"][0]["value"] = -.05
        self.assertEqual(module.score(changed, TRUTH)["joint_validity"], 0)
        changed = copy.deepcopy(ANSWER)
        changed["judgments"][0]["evidence"] = ["F999"]
        self.assertLess(module.score(changed, TRUTH)["evidence_precision"], 1)

    def test_duplicate_or_missing_propositions_are_rejected(self):
        changed = copy.deepcopy(ANSWER)
        changed["judgments"][0] = changed["judgments"][1]
        with self.assertRaises(ValueError): module.score(changed, TRUTH)


if __name__ == "__main__": unittest.main()
