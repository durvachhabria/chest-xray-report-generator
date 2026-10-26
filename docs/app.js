// PLCM demo simulation. No trained model runs here. No image leaves the browser.
// All outputs carry the not-for-clinical-use label. Uploads are never analysed.
const LABEL = "NOT FOR CLINICAL USE \u2014 AI-generated draft, requires radiologist review before any clinical use";
const THRESHOLD = 0.60;

const CASES = {
  A: {
    title: "Demo A \u2014 No acute finding (synthetic normal)",
    impression: "The lungs are clear. No focal consolidation, pleural effusion, or pneumothorax is identified. The cardiac silhouette is normal in size. No acute finding.",
    entities: [
      { name: "No acute finding", supported: true },
      { name: "Clear lungs", supported: true },
      { name: "Normal cardiac silhouette", supported: true }
    ],
    decodings: ["no acute finding","no acute finding","no acute finding","no acute finding","no acute finding"],
    gradcam: { region: "lungs", target: "lungs", cx: 150, cy: 150, pass: true }
  },
  B: {
    title: "Demo B \u2014 Enlarged cardiac silhouette pattern (synthetic)",
    impression: "The cardiac silhouette is enlarged, consistent with a cardiomegaly pattern in this synthetic demo. The lungs are otherwise clear, with no focal consolidation identified. Draft only \u2014 requires radiologist review.",
    entities: [
      { name: "Cardiomegaly (enlarged cardiac silhouette)", supported: true },
      { name: "Clear lungs", supported: true }
    ],
    decodings: ["cardiomegaly","cardiomegaly","cardiomegaly","cardiomegaly","normal cardiac size"],
    gradcam: { region: "heart", target: "heart", cx: 205, cy: 210, pass: true }
  },
  C: {
    title: "Demo C \u2014 Hallucination trap (synthetic)",
    impression: "FLAGGED INITIAL DRAFT \u2014 WITHHELD, NOT A FINISHED REPORT: A pneumothorax is mentioned in this initial draft. That finding is NOT supported by the simulated entity check, self-consistency is low, and the simulated Grad-CAM region falls outside the relevant anatomy. This draft must not be used.",
    entities: [
      { name: "Pneumothorax", supported: false },
      { name: "Clear lungs", supported: true }
    ],
    decodings: ["pneumothorax","pneumothorax","no acute finding","no acute finding","pleural effusion"],
    gradcam: { region: "outside_anatomy", target: "pleura", cx: 285, cy: 45, pass: false }
  }
};

function score(decodings) {
  const counts = {};
  decodings.forEach(d => counts[d] = (counts[d] || 0) + 1);
  return Math.max(...Object.values(counts)) / decodings.length;
}

function animateNumber(el, to, isPercent) {
  const start = performance.now(), dur = 700;
  function frame(now) {
    const p = Math.min(1, (now - start) / dur);
    const v = to * p;
    el.textContent = isPercent ? Math.round(v * 100) + "%" : v.toFixed(2);
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

let current = "A";
let heatOn = false;

function render(caseId) {
  current = caseId;
  const c = CASES[caseId];
  const sc = score(c.decodings);
  const entityPass = c.entities.every(e => e.supported);
  const scPass = sc >= THRESHOLD;
  const gradPass = c.gradcam.pass;
  const allPass = entityPass && scPass && gradPass;
  const status = allPass ? "DRAFT READY FOR REVIEW" : "MANDATORY RADIOLOGIST REVIEW";

  document.querySelectorAll(".casebar button").forEach(b => b.classList.toggle("active", b.dataset.case === caseId));
  const out = document.getElementById("output");
  out.classList.remove("fade"); void out.offsetWidth; out.classList.add("fade");

  document.getElementById("caseTitle").textContent = c.title;
  document.getElementById("impression").textContent = c.impression;
  document.getElementById("labelLine").textContent = LABEL;
  document.getElementById("entityList").innerHTML = c.entities.map(e =>
    `<div class="entity"><span>${e.name}</span><span class="${e.supported ? "pass" : "fail"}">${e.supported ? "SUPPORTED \u2713" : "NOT SUPPORTED \u2717"}</span></div>`).join("");
  document.getElementById("decodings").innerHTML = c.decodings.map((d, i) =>
    `<span class="tag">Decoding ${i + 1}: ${d}</span>`).join(" ");
  document.getElementById("gradcamNote").textContent =
    `Grad-CAM region: ${c.gradcam.region} (target: ${c.gradcam.target}) \u2014 ${gradPass ? "inside relevant anatomy" : "OUTSIDE relevant anatomy"}.`;

  animateNumber(document.getElementById("scoreNum"), sc, true);
  animateNumber(document.getElementById("scoreNum2"), sc, false);
  document.getElementById("entityNum").textContent = c.entities.filter(e => e.supported).length + " / " + c.entities.length;
  document.getElementById("gradNum").textContent = gradPass ? "Inside" : "Outside";

  const checks = [
    { name: "Check 1 \u2014 Entity consistency", pass: entityPass, detail: entityPass ? "All named entities supported." : "Unsupported entity: " + c.entities.filter(e => !e.supported).map(e => e.name).join(", ") },
    { name: "Check 2 \u2014 Self-consistency (5 decodings)", pass: scPass, detail: `Agreement ${Math.round(sc * 100)}% (threshold ${Math.round(THRESHOLD * 100)}%).` },
    { name: "Check 3 \u2014 Grad-CAM grounding", pass: gradPass, detail: gradPass ? "Attention inside relevant anatomy." : "Attention outside relevant anatomy." }
  ];
  document.getElementById("checks").innerHTML = checks.map(ch =>
    `<div class="check"><span><b>${ch.name}</b><br><span class="muted small">${ch.detail}</span></span><span class="${ch.pass ? "pass" : "fail"}">${ch.pass ? "PASS" : "FLAG"}</span></div>`).join("");

  const statusEl = document.getElementById("status");
  statusEl.textContent = status;
  statusEl.className = "status " + (allPass ? "ready" : "review");
  document.getElementById("finished").textContent = allPass
    ? "Draft ready for radiologist review. This is NOT a final report, and it carries the not-for-clinical-use label above."
    : "No finished report emitted \u2014 withheld for mandatory radiologist review. The flagged initial draft above must not be used as a report.";

  // Animated pipeline stages
  const stages = ["Encode","Decode","Check 1 Entity","Check 2 Self-consistency","Check 3 Grad-CAM","Route"];
  const pipe = document.getElementById("pipeline");
  pipe.innerHTML = stages.map((s, i) => `<span class="stage" id="stage-${i}">${s}</span>${i < stages.length - 1 ? '<span class="arrow">\u2192</span>' : ""}`).join("");
  stages.forEach((s, i) => {
    setTimeout(() => {
      const el = document.getElementById("stage-" + i);
      if (!el) return;
      el.classList.add("active");
      if (i === 2 && !entityPass) el.classList.add("fail");
      if (i === 3 && !scPass) el.classList.add("fail");
      if (i === 4 && !gradPass) el.classList.add("fail");
      if (i === 5) el.classList.add("done");
    }, 180 * (i + 1));
  });

  // Heatmap position: move the radial gradient group to the case region.
  const heat = document.getElementById("heatmap");
  heat.setAttribute("transform", `translate(${c.gradcam.cx - 150}, ${c.gradcam.cy - 150})`);
  heat.classList.toggle("on", heatOn);
  document.getElementById("heatLabel").textContent = heatOn ? "Heatmap: ON" : "Heatmap: OFF";
}

document.querySelectorAll(".casebar button").forEach(b => b.addEventListener("click", () => render(b.dataset.case)));
document.getElementById("heatToggle").addEventListener("click", () => {
  heatOn = !heatOn;
  document.getElementById("heatmap").classList.toggle("on", heatOn);
  document.getElementById("heatLabel").textContent = heatOn ? "Heatmap: ON" : "Heatmap: OFF";
});
document.getElementById("upload").addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  const msg = document.getElementById("uploadMsg");
  if (!f) return;
  msg.textContent = `File "${f.name}" was NOT sent anywhere and was NOT analysed. In this demo, no finding can be determined from this demo. This upload is routed to mandatory radiologist review. ${LABEL}`;
});
document.getElementById("labelLineTop").textContent = LABEL;
render("A");
