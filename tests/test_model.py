"""Unit tests for the PLCM demo pipeline. No external dependencies.

These tests check routing logic and labelling only. They do NOT claim
clinical accuracy, and they do NOT claim a trained model was evaluated.
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from model import (
    DEMO_CASES,
    NOT_FOR_CLINICAL_USE,
    generate_report,
    generate_upload_report,
    gradcam_region_check,
    model_info,
    self_consistency_score,
)


class TestDemoCases(unittest.TestCase):
    def test_demo_a_passes(self):
        report = generate_report("A")
        self.assertEqual(report["status"], "DRAFT READY FOR REVIEW")
        self.assertTrue(report["entity_check"]["passed"])
        self.assertGreaterEqual(
            report["self_consistency_score"],
            report["self_consistency_threshold"],
        )
        self.assertTrue(report["gradcam_check"]["passed"])

    def test_demo_b_passes(self):
        report = generate_report("B")
        self.assertEqual(report["status"], "DRAFT READY FOR REVIEW")
        self.assertTrue(report["entity_check"]["passed"])
        self.assertTrue(report["gradcam_check"]["passed"])
        # 4 of 5 decodings agree on cardiomegaly.
        self.assertEqual(report["self_consistency_score"], 0.8)

    def test_demo_c_routed_to_mandatory_review_and_not_emitted(self):
        report = generate_report("C")
        self.assertEqual(report["status"], "MANDATORY RADIOLOGIST REVIEW")
        self.assertTrue(report["routed_to_mandatory_review"])
        self.assertFalse(report["auto_emitted"])
        self.assertFalse(report["auto_emitted_as_finished_report"])
        self.assertIsNone(report["final_report"])
        # All three checks must flag Demo C.
        self.assertFalse(report["entity_check"]["passed"])
        self.assertIn("Pneumothorax", report["entity_check"]["unsupported"])
        self.assertLess(
            report["self_consistency_score"],
            report["self_consistency_threshold"],
        )
        self.assertFalse(report["gradcam_check"]["passed"])

    def test_every_output_carries_not_for_clinical_use_label(self):
        for case_id in DEMO_CASES:
            report = generate_report(case_id)
            self.assertIn("NOT FOR CLINICAL USE", report["label"])
            self.assertEqual(report["label"], NOT_FOR_CLINICAL_USE)
            self.assertIn("requires radiologist review", report["label"])
            # No output is ever a final report.
            self.assertIsNone(report["final_report"])

    def test_model_info_returns_version_data_thresholds(self):
        info = model_info()
        self.assertEqual(info["model_version"], "v0.1-demo")
        self.assertIn("IU X-Ray", info["dataset"])
        self.assertIn("simulation", info["dataset"])
        self.assertEqual(info["self_consistency_threshold"], 0.6)
        self.assertEqual(info["self_consistency_decodings"], 5)
        self.assertIn("NOT FOR CLINICAL USE", info["label"])

    def test_self_consistency_and_gradcam_helpers(self):
        self.assertEqual(self_consistency_score(DEMO_CASES["A"]), 1.0)
        self.assertEqual(self_consistency_score(DEMO_CASES["C"]), 0.4)
        self.assertTrue(gradcam_region_check(DEMO_CASES["B"])["passed"])
        self.assertFalse(gradcam_region_check(DEMO_CASES["C"])["passed"])

    def test_upload_routes_to_mandatory_review_with_no_finding(self):
        report = generate_upload_report("test.png")
        self.assertEqual(report["status"], "MANDATORY RADIOLOGIST REVIEW")
        self.assertTrue(report["routed_to_mandatory_review"])
        self.assertIsNone(report["final_report"])
        self.assertFalse(report["auto_emitted"])
        self.assertIn("No finding determined", report["draft_impression"])
        self.assertIsNone(report["self_consistency_score"])
        self.assertFalse(report["entity_check"]["passed"])
        self.assertFalse(report["gradcam_check"]["passed"])

    def test_unknown_case_raises(self):
        with self.assertRaises(ValueError):
            generate_report("Z")


if __name__ == "__main__":
    unittest.main()
