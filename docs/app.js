// PLCM demo simulation. No trained model runs here. No image leaves the browser.
// All outputs carry the not-for-clinical-use label. Uploads are never analysed
// and never produce a finding; they route to mandatory radiologist review.
const LABEL = "NOT FOR CLINICAL USE \u2014 AI-generated draft, requires radiologist review before any clinical use";
const THRESHOLD = 0.60;

const CASES = {
  A: {
    title: "Demo A \u2014 No acute finding (synthetic normal)",
    short: "No acute finding",
    impression: "The lungs are clear. No focal consolidation, pleural effusion, or pneumothorax is identified. The cardiac silhouette is normal in size. No acute finding.",
    entities: [
      { name: "No acute finding", supported: true },
      { name: "Clear lungs", supported: true },
      { name: "Normal cardiac silhouette", supported: true }
    ],
    decodings: ["no acute finding","no acute finding","no acute finding","no acute finding","no acute finding"],
    gradcam: { region: "lungs", target: "lungs", cx: 150, cy: 150, pass: true },
    synthetic: true
  },
  B: {
    title: "Demo B \u2014 Enlarged cardiac silhouette pattern (synthetic)",
    short: "Enlarged cardiac silhouette",
    impression: "The cardiac silhouette is enlarged, consistent with a cardiomegaly pattern in this synthetic demo. The lungs are otherwise clear, with no focal consolidation identified. Draft only \u2014 requires radiologist review.",
    entities: [
      { name: "Cardiomegaly (enlarged cardiac silhouette)", supported: true },
      { name: "Clear lungs", supported: true }
    ],
    decodings: ["cardiomegaly","cardiomegaly","cardiomegaly","cardiomegaly","normal cardiac size"],
    gradcam: { region: "heart", target: "heart", cx: 205, cy: 210, pass: true },
    synthetic: true
  },
  C: {
    title: "Demo C \u2014 Hallucination trap (synthetic)",
    short: "Flagged draft — withheld",
    impression: "FLAGGED INITIAL DRAFT \u2014 WITHHELD, NOT A FINISHED REPORT: A pneumothorax is mentioned in this initial draft. That finding is NOT supported by the simulated entity check, self-consistency is low, and the simulated Grad-CAM region falls outside the relevant anatomy. This draft must not be used.",
    entities: [
      { name: "Pneumothorax", supported: false },
      { name: "Clear lungs", supported: true }
    ],
    decodings: ["pneumothorax","pneumothorax","no acute finding","no acute finding","pleural effusion"],
    gradcam: { region: "outside_anatomy", target: "pleura", cx: 285, cy: 45, pass: false },
    synthetic: true
  }
};

let uploadCase = null;
let current = "A";
let heatOn = false;

function getCase(id) { return id === "U" ? uploadCase : CASES[id]; }

function score(decodings) {
  if (!decodings || !decodings.length) return null;
  const counts = {};
  decodings.forEach(d => counts[d] = (counts[d] || 0) + 1);
  return Math.max(...Object.values(counts)) / decodings.length;
}

function animateNumber(el, to, isPercent) {
  if (to === null) { el.textContent = "—"; return; }
  const start = performance.now(), dur = 700;
  function frame(now) {
    const p = Math.min(1, (now - start) / dur);
    const v = to * p;
    el.textContent = isPercent ? Math.round(v * 100) + "%" : v.toFixed(2);
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function caseStatus(c) {
  const sc = score(c.decodings);
  const entityPass = c.entities.length > 0 && c.entities.every(e => e.supported);
  const scPass = sc !== null && sc >= THRESHOLD;
  const gradPass = c.gradcam.pass;
  const allPass = entityPass && scPass && gradPass;
  return { sc, entityPass, scPass, gradPass, allPass, status: allPass ? "DRAFT READY FOR REVIEW" : "MANDATORY RADIOLOGIST REVIEW" };
}

function renderReports() {
  const wrap = document.getElementById("reportCards");
  const ids = ["A", "B", "C"];
  if (uploadCase) ids.push("U");
  wrap.innerHTML = ids.map(id => {
    const c = getCase(id);
    const s = caseStatus(c);
    const badge = s.allPass ? "ready" : "review";
    return `<button type="button" class="report ${current === id ? "active" : ""}" data-report="${id}">
      <span class="badge ${badge}">${s.status}</span>
      <h3>${c.title}</h3>
      <p class="small muted">${c.short}</p>
      <p class="small">${c.synthetic ? c.impression.slice(0, 140) + (c.impression.length > 140 ? "…" : "") : "No finding determined. Preview only, local to this browser."}</p>
    </button>`;
  }).join("") + (uploadCase ? "" : `<div class="report" style="cursor:default"><span class="badge review">UPLOAD TO ADD</span><h3>Your uploaded image</h3><p class="small muted">Upload an image above and its review-only card will appear here, alongside Demo A, B and C.</p></div>`);
  wrap.querySelectorAll("[data-report]").forEach(b => b.addEventListener("click", () => { render(b.dataset.report); document.getElementById("studio").scrollIntoView({ behavior: "smooth" }); }));
}

function render(caseId) {
  const c = getCase(caseId);
  if (!c) return;
  current = caseId;
  const s = caseStatus(c);

  document.querySelectorAll(".casebar button").forEach(b => b.classList.toggle("active", b.dataset.case === caseId));
  const out = document.getElementById("output");
  out.classList.remove("fade"); void out.offsetWidth; out.classList.add("fade");

  const isUpload = caseId === "U";
  document.getElementById("schematicWrap").style.display = isUpload ? "none" : "block";
  document.getElementById("uploadedWrap").style.display = isUpload ? "block" : "none";
  document.getElementById("imageCaption").textContent = isUpload
    ? "UPLOADED IMAGE — preview only, local to this browser. Not analysed, not a patient X-ray result."
    : "SYNTHETIC DEMO IMAGE — abstract schematic, not a patient X-ray. No real chest X-ray is shown or used.";

  document.getElementById("caseTitle").textContent = c.title;
  document.getElementById("impression").textContent = c.impression;
  document.getElementById("labelLine").textContent = LABEL;
  document.getElementById("entityList").innerHTML = c.entities.map(e =>
    `<div class="entity"><span>${e.name}</span><span class="${e.supported ? "pass" : "fail"}">${e.supported ? "SUPPORTED \u2713" : "NOT VERIFIED \u2717"}</span></div>`).join("");
  document.getElementById("decodings").innerHTML = c.decodings && c.decodings.length
    ? c.decodings.map((d, i) => `<span class="tag">Decoding ${i + 1}: ${d}</span>`).join(" ")
    : `<span class="tag">No decodings — uploaded images are not run through a decoder in this demo</span>`;
  document.getElementById("decodingNote").textContent = isUpload
    ? "No self-consistency score can be computed for an upload in this demo, because no decoding is performed."
    : "Agreement = most-common decoding ÷ 5. Score shown as a decimal below.";
  document.getElementById("scoreLine").style.display = isUpload ? "none" : "block";
  document.getElementById("gradcamNote").textContent = isUpload
    ? "Grad-CAM: not computed for uploads in this demo."
    : `Grad-CAM region: ${c.gradcam.region} (target: ${c.gradcam.target}) \u2014 ${s.gradPass ? "inside relevant anatomy" : "OUTSIDE relevant anatomy"}.`;

  animateNumber(document.getElementById("scoreNum"), s.sc, true);
  animateNumber(document.getElementById("scoreNum2"), s.sc, false);
  document.getElementById("entityNum").textContent = c.entities.filter(e => e.supported).length + " / " + c.entities.length;
  document.getElementById("gradNum").textContent = isUpload ? "Not computed" : (s.gradPass ? "Inside" : "Outside");

  const checks = [
    { name: "Check 1 \u2014 Entity consistency", pass: s.entityPass, detail: isUpload ? "No finding can be verified from an upload in this demo." : (s.entityPass ? "All named entities supported." : "Unsupported entity: " + c.entities.filter(e => !e.supported).map(e => e.name).join(", ")) },
    { name: "Check 2 \u2014 Self-consistency (5 decodings)", pass: s.scPass, detail: isUpload ? "Not applicable — no decodings are produced for uploads." : `Agreement ${Math.round(s.sc * 100)}% (threshold ${Math.round(THRESHOLD * 100)}%).` },
    { name: "Check 3 \u2014 Grad-CAM grounding", pass: s.gradPass, detail: isUpload ? "Not computed for uploads in this demo." : (s.gradPass ? "Attention inside relevant anatomy." : "Attention outside relevant anatomy.") }
  ];
  document.getElementById("checks").innerHTML = checks.map(ch =>
    `<div class="check"><span><b>${ch.name}</b><br><span class="muted small">${ch.detail}</span></span><span class="${ch.pass ? "pass" : "fail"}">${ch.pass ? "PASS" : "FLAG"}</span></div>`).join("");

  const statusEl = document.getElementById("status");
  statusEl.textContent = s.status;
  statusEl.className = "status " + (s.allPass ? "ready" : "review");
  document.getElementById("finished").textContent = s.allPass
    ? "Draft ready for radiologist review. This is NOT a final report, and it carries the not-for-clinical-use label above."
    : "No finished report emitted \u2014 withheld for mandatory radiologist review. " + (isUpload ? "No finding was determined from this upload." : "The flagged initial draft above must not be used as a report.");

  const stages = ["Encode","Decode","Check 1 Entity","Check 2 Self-consistency","Check 3 Grad-CAM","Route"];
  const pipe = document.getElementById("pipeline");
  const fill = document.getElementById("pipeFill");
  fill.style.width = "0%";
  pipe.innerHTML = stages.map((st, i) => `<span class="stage" id="stage-${i}">${st}</span>${i < stages.length - 1 ? '<span class="arrow">\u2192</span>' : ""}`).join("");
  stages.forEach((st, i) => {
    setTimeout(() => {
      const el = document.getElementById("stage-" + i);
      if (!el) return;
      el.classList.add("active");
      if (i === 2 && !s.entityPass) el.classList.add("fail");
      if (i === 3 && !s.scPass) el.classList.add("fail");
      if (i === 4 && !s.gradPass) el.classList.add("fail");
      if (i === 5) el.classList.add("done");
      fill.style.width = Math.round(((i + 1) / stages.length) * 100) + "%";
    }, 170 * (i + 1));
  });

  if (!isUpload) {
    const heat = document.getElementById("heatmap");
    heat.setAttribute("transform", `translate(${c.gradcam.cx - 150}, ${c.gradcam.cy - 150})`);
    heat.classList.toggle("on", heatOn);
  }
  document.getElementById("heatLabel").textContent = heatOn ? "Heatmap: ON" : "Heatmap: OFF";
  renderReports();
}

function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    document.getElementById("uploadMsg").textContent = "Please choose an image file.";
    return;
  }
  const url = URL.createObjectURL(file);
  document.getElementById("uploadedImg").src = url;
  document.getElementById("uploadThumb").src = url;
  document.getElementById("uploadPreview").classList.add("show");
  document.getElementById("clearUpload").style.display = "inline-block";
  const kb = Math.max(1, Math.round(file.size / 1024));
  document.getElementById("uploadMeta").textContent = `${file.name} • ${kb} KB • kept in this browser only`;
  document.getElementById("uploadMsg").textContent = `This file was NOT sent anywhere and was NOT analysed. No finding can be determined from it in this demo. It is routed to mandatory radiologist review. ${LABEL}`;
  uploadCase = {
    title: `Uploaded image \u2014 ${file.name} (review only)`,
    short: "No finding determined",
    impression: "No finding determined from this upload. This demo does not analyse uploaded images and does not run a trained model on them. The image is shown locally only and this case is routed to mandatory radiologist review, with no finished report emitted.",
    entities: [{ name: "Finding from uploaded image", supported: false }],
    decodings: [],
    gradcam: { region: "not_computed", target: "not_computed", cx: 150, cy: 150, pass: false },
    synthetic: false
  };
  document.getElementById("uploadCaseBtn").style.display = "inline-block";
  render("U");
}

document.querySelectorAll(".casebar button").forEach(b => b.addEventListener("click", () => render(b.dataset.case)));
document.getElementById("heatToggle").addEventListener("click", () => {
  heatOn = !heatOn;
  if (current !== "U") document.getElementById("heatmap").classList.toggle("on", heatOn);
  document.getElementById("heatLabel").textContent = heatOn ? "Heatmap: ON" : "Heatmap: OFF";
});
document.getElementById("chooseBtn").addEventListener("click", () => document.getElementById("upload").click());
document.getElementById("upload").addEventListener("change", (e) => handleFile(e.target.files && e.target.files[0]));
const dz = document.getElementById("dropzone");
["dragenter","dragover"].forEach(ev => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("drag"); }));
["dragleave","drop"].forEach(ev => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("drag"); }));
dz.addEventListener("drop", (e) => handleFile(e.dataTransfer.files && e.dataTransfer.files[0]));
document.getElementById("clearUpload").addEventListener("click", () => {
  uploadCase = null;
  document.getElementById("upload").value = "";
  document.getElementById("uploadPreview").classList.remove("show");
  document.getElementById("clearUpload").style.display = "none";
  document.getElementById("uploadCaseBtn").style.display = "none";
  render("A");
});
document.getElementById("labelLineTop").textContent = LABEL;
render("A");
