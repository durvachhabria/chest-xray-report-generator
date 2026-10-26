# Automated Radiology Report Generation from Chest X-Rays Using Vision-Language Models

> **NOT FOR CLINICAL USE — AI-generated draft, requires radiologist review before any clinical use**

## Coursework

- **Course:** BTECH CAP 501 — Project Life Cycle Management
- **University:** ATLAS SkillTech University, School of Technology, B.Tech in CS AI & ML
- **Team:** Gunn Mulchandani (2410731), Siddhant Amin (2404447), Vaishnavi Singh (2409233), Durva Chhabria (2404713)
- **Mentor:** Amrita Banerjee
- **Report date:** 15 September 2026
- **Scope:** Coursework prototype only. This is not a clinical product, diagnosis, or validated medical device.

## What this is

A browser demo of the report-generation pipeline described in the PLCM report:
a visual encoder feeds a text decoder, and every draft passes three checks
before it is shown as a draft:

1. **Entity consistency** — named findings checked against simulated image support.
2. **Self-consistency** — agreement across 5 independent decodings.
3. **Grad-CAM grounding** — whether attention falls inside the relevant anatomy.

Any failed check routes the case to **MANDATORY RADIOLOGIST REVIEW**, and no
finished report is ever auto-emitted. Passing cases are labelled
**DRAFT READY FOR REVIEW** — never a final report.

## Honest demo vs. trained model — read this first

- The full report proposes a trained pipeline (EfficientNet or BioViL-T encoder,
  ClinicalBERT or GPT-2 decoder) trained and evaluated on IU X-Ray.
- **This demo does NOT run that trained model.** It is a transparent
  rule/template simulation with three synthetic cases, the same three checks,
  and the same routing rule.
- **No BLEU, ROUGE, or CheXpert score is claimed for this demo.** The
  report's thresholds (for example BLEU-4, ROUGE-L, CheXpert-F1, and a
  hallucination-rate ceiling) are design targets for a trained system, not
  results achieved here.
- **No real patient chest X-ray images are used.** All images on the site are
  synthetic schematic SVGs drawn for this demo (abstract lung/heart shapes,
  labelled SYNTHETIC DEMO IMAGE). No images were copied from the course
  presentation.
- Uploaded files are processed locally in the browser only, are never
  sent anywhere, and cannot produce a medical finding in this demo —
  they run through the pipeline animation, appear in All Reports
  alongside Demo A, B and C, and route to mandatory review with no
  finding determined.

## Demo cases

- **Demo A — No acute finding (synthetic normal):** all 3 checks pass,
  status DRAFT READY FOR REVIEW.
- **Demo B — Enlarged cardiac silhouette pattern (synthetic):** draft
  mentions cardiomegaly, all 3 checks pass, status DRAFT READY FOR REVIEW.
- **Demo C — Hallucination trap (synthetic):** initial draft mentions
  pneumothorax, which is NOT supported by the entity check; self-consistency
  is low (0.40, threshold 0.60); Grad-CAM falls outside the anatomy. All
  three checks flag it, status MANDATORY RADIOLOGIST REVIEW, and no
  finished report is emitted.

## Architecture (text diagram)

```
Input (synthetic schematic / local upload)
  → Encode (simulated in this demo)
  → Decode (template draft)
  → Check 1: Entity consistency
  → Check 2: Self-consistency (5 decodings)
  → Check 3: Grad-CAM grounding (simulated region)
  → Route: DRAFT READY FOR REVIEW
             or MANDATORY RADIOLOGIST REVIEW
  → No finished report is auto-emitted
```

Model info: version **v0.1-demo**; dataset **IU X-Ray — prototype
simulation, not trained on it in this browser demo**; self-consistency
threshold **0.60**; entity rule **all entities must be supported**;
Grad-CAM rule **region must be inside relevant anatomy**.

## How to run locally

```bash
python3 -m unittest discover -s tests -v
# then open docs/index.html in a browser (no server or build step needed)
```

The site uses relative paths only (`./styles.css`, `./app.js`) and no
external CDN, so it works as a static folder and on GitHub Pages.

## How to deploy to GitHub Pages

Option 1 — classic Pages source (as the parent agent will set up after
verifying these files locally):

1. Create a public repo and push this project to the `main` branch.
2. Repo → Settings → Pages → Source: **Deploy from a branch**,
   branch `main`, folder **/docs**.
3. The live URL will be `https://<username>.github.io/<repo>/`.

Option 2 — GitHub Actions (also included):

- `.github/workflows/pages.yml` uploads `docs/` as a Pages artifact and
  deploys it. Enabling Pages with source **GitHub Actions** uses that
  workflow instead of the branch/folder source.

Live demo (verified 2026-10-26): https://durvachhabria.github.io/chest-xray-report-generator/

## Safety, dataset attribution, and cost

- **Safety:** Every page, every generated output, and this README carry the
  not-for-clinical-use label. Every draft requires radiologist review
  before any clinical use.
- **Dataset attribution:** IU X-Ray (Indiana University Chest X-Ray
  Collection, via NIH Open-i) and the Stanford CheXpert labeller are
  cited for the full project. No IU X-Ray files are redistributed in
  this demo, and no dataset download is required to run it.
- **Cost:** ₹0 — no paid services, no external CDN, pure Python tests
  with no external dependencies, and a static site.
