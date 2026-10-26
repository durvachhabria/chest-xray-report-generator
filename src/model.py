"""Prototype pipeline for the PLCM coursework demo.

This is a transparent, rule/template simulation of the pipeline described
in the BTECH CAP 501 report. It is NOT a trained EfficientNet / BioViL-T /
ClinicalBERT / GPT-2 model, it was NOT trained on IU X-Ray in this demo,
and it produces NO clinical finding. Every output carries the
not-for-clinical-use label.

No external dependencies. No real patient images are used.
"""

from collections import Counter

NOT_FOR_CLINICAL_USE = (
    "NOT FOR CLINICAL USE \u2014 AI-generated draft, "
    "requires radiologist review before any clinical use"
)

MODEL_VERSION = "v0.1-demo"
DATASET = "IU X-Ray \u2014 prototype simulation, not trained on it in this browser demo"
SELF_CONSISTENCY_THRESHOLD = 0.60
ANATOMY_REGIONS = {"lungs", "heart", "pleura", "cardiac silhouette"}

DEMO_CASES = {
    "A": {
        "id": "A",
        "title": "Demo A \u2014 No acute finding (synthetic normal)",
        "image_label": "SYNTHETIC DEMO IMAGE \u2014 abstract schematic, not a patient X-ray",
        "draft_impression": (
            "The lungs are clear. No focal consolidation, pleural effusion, "
            "or pneumothorax is identified. The cardiac silhouette is normal "
            "in size. No acute finding."
        ),
        "entities": [
            {"name": "No acute finding", "supported": True},
            {"name": "Clear lungs", "supported": True},
            {"name": "Normal cardiac silhouette", "supported": True},
        ],
        # Five independent decodings, canonicalised to a short label each.
        "decodings": [
            "no acute finding",
            "no acute finding",
            "no acute finding",
            "no acute finding",
            "no acute finding",
        ],
        "gradcam_region": "lungs",
        "gradcam_target": "lungs",
    },
    "B": {
        "id": "B",
        "title": "Demo B \u2014 Enlarged cardiac silhouette pattern (synthetic)",
        "image_label": "SYNTHETIC DEMO IMAGE \u2014 abstract schematic, not a patient X-ray",
        "draft_impression": (
            "The cardiac silhouette is enlarged, consistent with a "
            "cardiomegaly pattern in this synthetic demo. The lungs are "
            "otherwise clear, with no focal consolidation identified. "
            "Draft only \u2014 requires radiologist review."
        ),
        "entities": [
            {"name": "Cardiomegaly (enlarged cardiac silhouette)", "supported": True},
            {"name": "Clear lungs", "supported": True},
        ],
        "decodings": [
            "cardiomegaly",
            "cardiomegaly",
            "cardiomegaly",
            "cardiomegaly",
            "normal cardiac size",
        ],
        "gradcam_region": "heart",
        "gradcam_target": "heart",
    },
    "C": {
        "id": "C",
        "title": "Demo C \u2014 Hallucination trap (synthetic)",
        "image_label": "SYNTHETIC DEMO IMAGE \u2014 abstract schematic, not a patient X-ray",
        "draft_impression": (
            "FLAGGED INITIAL DRAFT \u2014 WITHHELD, NOT A FINISHED REPORT: "
            "A pneumothorax is mentioned in this initial draft. That finding "
            "is NOT supported by the simulated entity check, self-consistency "
            "is low, and the simulated Grad-CAM region falls outside the "
            "relevant anatomy. This draft must not be used."
        ),
        "entities": [
            {"name": "Pneumothorax", "supported": False},
            {"name": "Clear lungs", "supported": True},
        ],
        "decodings": [
            "pneumothorax",
            "pneumothorax",
            "no acute finding",
            "no acute finding",
            "pleural effusion",
        ],
        "gradcam_region": "outside_anatomy",
        "gradcam_target": "pleura",
    },
}


def entity_consistency_check(case):
    """Return pass/fail plus supported / unsupported entity names."""
    entities = case.get("entities", [])
    supported = [e["name"] for e in entities if e["supported"]]
    unsupported = [e["name"] for e in entities if not e["supported"]]
    return {
        "passed": len(unsupported) == 0 and len(entities) > 0,
        "supported": supported,
        "unsupported": unsupported,
    }


def self_consistency_score(case):
    """Agreement across five decodings: most-common label count / total."""
    decodings = case.get("decodings", [])
    if not decodings:
        return 0.0
    most_common, count = Counter(decodings).most_common(1)[0]
    return round(count / len(decodings), 2)


def gradcam_region_check(case):
    """Pass only if the attended region is inside the relevant anatomy."""
    region = case.get("gradcam_region", "")
    return {
        "passed": region in ANATOMY_REGIONS,
        "region": region,
        "target": case.get("gradcam_target", ""),
    }


def route_decision(checks):
    """Routing rule from the report: any failed check -> mandatory review.

    checks is a dict with keys entity_passed, self_consistency_passed,
    gradcam_passed. A passing case is a DRAFT READY FOR REVIEW, never a
    final report. A failing case is MANDATORY RADIOLOGIST REVIEW and its
    finished report is never auto-emitted.
    """
    all_pass = (
        checks["entity_passed"]
        and checks["self_consistency_passed"]
        and checks["gradcam_passed"]
    )
    if all_pass:
        return "DRAFT READY FOR REVIEW"
    return "MANDATORY RADIOLOGIST REVIEW"


def generate_report(case_id):
    """Generate the demo report dict for case A, B or C."""
    if case_id not in DEMO_CASES:
        raise ValueError(f"Unknown demo case: {case_id!r}. Use A, B or C.")
    case = DEMO_CASES[case_id]
    entity = entity_consistency_check(case)
    score = self_consistency_score(case)
    gradcam = gradcam_region_check(case)
    checks = {
        "entity_passed": entity["passed"],
        "self_consistency_passed": score >= SELF_CONSISTENCY_THRESHOLD,
        "gradcam_passed": gradcam["passed"],
    }
    status = route_decision(checks)
    is_mandatory = status == "MANDATORY RADIOLOGIST REVIEW"
    return {
        "case_id": case_id,
        "title": case["title"],
        "label": NOT_FOR_CLINICAL_USE,
        "image_label": case["image_label"],
        "draft_impression": case["draft_impression"],
        # A finished report is never emitted by this demo. Passing cases
        # return a draft for review; failing cases return no finished report.
        "final_report": None,
        "auto_emitted": False,
        "auto_emitted_as_finished_report": False,
        "status": status,
        "routed_to_mandatory_review": is_mandatory,
        "entity_check": entity,
        "self_consistency_score": score,
        "self_consistency_threshold": SELF_CONSISTENCY_THRESHOLD,
        "self_consistency_decodings": list(case["decodings"]),
        "gradcam_check": gradcam,
        "model_version": MODEL_VERSION,
    }


def model_info():
    """Model-info panel data (FR5). Honest demo distinction included."""
    return {
        "model_version": MODEL_VERSION,
        "model": "Transparent rule/template demo simulation \u2014 NOT a trained "
        "EfficientNet / BioViL-T / ClinicalBERT / GPT-2 model running here",
        "dataset": DATASET,
        "dataset_attribution": "IU X-Ray (Indiana University / NIH Open-i); "
        "CheXpert labeller (Stanford) cited, not redistributed",
        "self_consistency_threshold": SELF_CONSISTENCY_THRESHOLD,
        "self_consistency_decodings": 5,
        "entity_check": "All named entities must be supported; any unsupported "
        "entity fails the check",
        "gradcam_check": "Attended region must fall inside the relevant anatomy",
        "routing_rule": "Any failed check -> MANDATORY RADIOLOGIST REVIEW; "
        "no finished report is auto-emitted",
        "label": NOT_FOR_CLINICAL_USE,
        "cost": "\u20b90",
    }
