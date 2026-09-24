const form = document.querySelector("#assessment-form");
const steps = [...document.querySelectorAll(".form-step")];
const stepItems = [...document.querySelectorAll("#step-list li")];
const nextButton = document.querySelector("#next-button");
const backButton = document.querySelector("#back-button");
const generateButton = document.querySelector("#generate-button");
const advisor = document.querySelector("#advisor");
const results = document.querySelector("#results");
const DRAFT_KEY = "project-compass-draft-v1";
const THEME_KEY = "project-compass-theme";
let activeStep = 1;
let highestStep = 1;
let latestResult = null;
let toastTimer;

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const byId = (id) => document.getElementById(id);
const labelize = (value) => String(value || "").replaceAll("-", " ").replace(/\b\w/g, (character) => character.toUpperCase());

const iconPaths = {
  time: '<circle cx="12" cy="12" r="8"></circle><path d="M12 7v5l3 2"></path>',
  money: '<path d="M4 7h16v11H4z"></path><path d="M7 10h.01M17 15h.01"></path><circle cx="12" cy="12.5" r="2.2"></circle>',
  effort: '<circle cx="9" cy="8" r="3"></circle><path d="M3.5 19c.6-3.5 2.5-5 5.5-5s4.9 1.5 5.5 5M16 8h5M18.5 5.5v5"></path>',
  friction: '<path d="M8 4h8v4H8zM6 16h12v4H6zM4 10h16v4H4z"></path>'
};

function showToast(message) {
  const toast = byId("toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  byId("theme-toggle").setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  localStorage.setItem(THEME_KEY, theme);
}
setTheme(localStorage.getItem(THEME_KEY) || "light");
byId("theme-toggle").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

function collectInput() {
  const data = new FormData(form);
  return {
    projectName: data.get("projectName") || "",
    budget: Number(data.get("budget") || 0),
    currency: data.get("currency") || "USD",
    budgetDisclosure: data.get("budgetDisclosure") || "approximate",
    budgetPeriod: data.get("budgetPeriod") || "project",
    budgetFlexibility: data.get("budgetFlexibility") || "fixed",
    deadline: data.get("deadline") || "",
    window: data.get("window") || "3-6-months",
    urgency: data.get("urgency") || "target",
    objectives: data.get("objectives") || "",
    hierarchy: data.get("hierarchy") || "functional",
    companyGoals: data.get("companyGoals") || "",
    departmentGoals: data.get("departmentGoals") || "",
    teamGoals: data.get("teamGoals") || "",
    nonNegotiables: data.get("nonNegotiables") || "",
    approvalLoad: data.get("approvalLoad") || "medium",
    scopeCertainty: data.get("scopeCertainty") || "medium",
    changeFrequency: data.get("changeFrequency") || "medium",
    compliance: data.get("compliance") || "medium",
    deliveryCadence: data.get("deliveryCadence") || "milestones",
    constraints: data.get("constraints") || "",
    teamSize: Number(data.get("teamSize") || 6),
    totalEmployees: Number(data.get("totalEmployees") || 0),
    availablePersonnel: Number(data.get("availablePersonnel") || 0),
    hiringConstraints: data.get("hiringConstraints") || "",
    distribution: data.get("distribution") || "hybrid",
    stakeholderAccess: data.get("stakeholderAccess") || "medium",
    dependencyLevel: data.get("dependencyLevel") || "medium",
    interruptionLevel: data.get("interruptionLevel") || "medium",
    preference: data.get("preference") || "none",
    dataUseAuthorized: data.get("dataUseAuthorized") === "yes",
    submitterName: data.get("submitterName") || "",
    submitterWorkEmail: data.get("submitterWorkEmail") || "",
    authorityRole: data.get("authorityRole") || "",
    decisionOwnerName: data.get("decisionOwnerName") || "",
    decisionOwnerRole: data.get("decisionOwnerRole") || "",
    quarterlyPlanningAuthorized: data.get("quarterlyPlanningAuthorized") === "yes",
    confidentialInfoIncluded: data.get("confidentialInfoIncluded") === "yes",
    confidentialInfoAuthorized: data.get("confidentialInfoAuthorized") === "yes",
    highRiskApproverName: data.get("highRiskApproverName") || "",
    highRiskApproverRole: data.get("highRiskApproverRole") || "",
    highRiskOverrideAccepted: data.get("highRiskOverrideAccepted") === "yes",
    highRiskCategories: data.getAll("highRiskCategories"),
    capabilities: data.getAll("capabilities")
  };
}

function saveDraft() {
  try {
    const input = collectInput();
    input.dataUseAuthorized = false;
    input.submitterName = "";
    input.submitterWorkEmail = "";
    input.authorityRole = "";
    input.quarterlyPlanningAuthorized = false;
    input.confidentialInfoIncluded = false;
    input.confidentialInfoAuthorized = false;
    input.highRiskApproverName = "";
    input.highRiskApproverRole = "";
    input.highRiskOverrideAccepted = false;
    input.highRiskCategories = [];
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ input, highestStep }));
  } catch { /* Browser storage can be disabled. */ }
}

function applyDraft(input) {
  Object.entries(input || {}).forEach(([name, value]) => {
    if (["capabilities", "highRiskCategories"].includes(name) && Array.isArray(value)) {
      document.querySelectorAll(`[name="${name}"]`).forEach((element) => { element.checked = value.includes(element.value); });
      return;
    }
    const candidates = [...form.querySelectorAll(`[name="${CSS.escape(name)}"]`)];
    if (!candidates.length) return;
    if (candidates[0].type === "radio") {
      const target = candidates.find((candidate) => candidate.value === String(value));
      if (target) target.checked = true;
    } else if (candidates[0].type === "checkbox") {
      candidates[0].checked = value === true;
    } else {
      candidates[0].value = value ?? "";
    }
  });
}

function loadDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    if (saved?.input) applyDraft(saved.input);
    highestStep = Math.max(1, Math.min(5, Number(saved?.highestStep) || 1));
  } catch { /* Ignore malformed browser-local state. */ }
}

function updateCharacterCounts() {
  document.querySelectorAll("[data-count-for]").forEach((counter) => {
    const field = byId(counter.dataset.countFor);
    counter.textContent = `${field.value.length.toLocaleString()} / ${Number(field.maxLength).toLocaleString()}`;
  });
}

function clearErrors() {
  document.querySelectorAll("[aria-invalid='true']").forEach((field) => field.removeAttribute("aria-invalid"));
  document.querySelectorAll(".field-error").forEach((element) => { element.textContent = ""; });
}

function showErrors(errors) {
  clearErrors();
  Object.entries(errors).forEach(([name, message]) => {
    const field = form.querySelector(`[name="${CSS.escape(name)}"]`);
    if (field) field.setAttribute("aria-invalid", "true");
    const slot = document.querySelector(`[data-error-for="${CSS.escape(name)}"]`);
    if (slot) slot.textContent = message;
  });
}

function validateStep(step) {
  const input = collectInput();
  const errors = {};
  if (step === 1) {
    if (input.budgetDisclosure !== "none" && !(input.budget > 0)) errors.budget = "Enter the approximate or exact budget, or select no budget information.";
    if (input.objectives.trim().length < 20) errors.objectives = "Describe the objective in at least 20 characters.";
  }
  if (step === 2) {
    if (!input.companyGoals.trim()) errors.companyGoals = "Add at least one company-level goal.";
    if (!input.departmentGoals.trim()) errors.departmentGoals = "Add at least one department or team goal.";
    if (!input.teamGoals.trim()) errors.teamGoals = "Add at least one team or team-member goal.";
  }
  if (step === 4 && input.teamSize < 1) errors.teamSize = "Team size must be at least one.";
  if (step === 5) {
    if (!input.dataUseAuthorized) errors.dataUseAuthorized = "Confirm that you are authorized to share the information and permit its use only for the stated company-planning purposes.";
    if (input.submitterName.trim().length < 2) errors.submitterName = "Enter the authorized submitter's name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.submitterWorkEmail)) errors.submitterWorkEmail = "Enter the submitter's valid work email.";
    if (!input.authorityRole) errors.authorityRole = "Attach an allowed authority role to this request.";
    if (input.decisionOwnerName.trim().length < 2) errors.decisionOwnerName = "Name the human accountable for this decision brief.";
    if (input.decisionOwnerRole.trim().length < 2) errors.decisionOwnerRole = "Enter the accountable decision owner's role.";
    if (input.confidentialInfoIncluded && input.highRiskCategories.length === 0) errors.highRiskCategories = "Select every high-risk information category included in the submission.";
    if (input.confidentialInfoIncluded && !input.confidentialInfoAuthorized) errors.confidentialInfoAuthorized = "Confirm that you are authorized to disclose and process the selected high-risk categories.";
    if (input.confidentialInfoIncluded && input.highRiskApproverName.trim().length < 2) errors.highRiskApproverName = "Name the human who approved this high-risk override.";
    if (input.confidentialInfoIncluded && !input.highRiskApproverRole) errors.highRiskApproverRole = "Attach an allowed high-risk approver role.";
    if (input.confidentialInfoIncluded && !input.highRiskOverrideAccepted) errors.highRiskOverrideAccepted = "Review and accept the informed-risk override, or remove the high-risk information.";
  }
  showErrors(errors);
  const firstField = Object.keys(errors)[0] ? form.querySelector(`[name="${CSS.escape(Object.keys(errors)[0])}"]`) : null;
  if (firstField) firstField.focus();
  return Object.keys(errors).length === 0;
}

function stepForError(name) {
  if (["budget", "deadline", "objectives"].includes(name)) return 1;
  if (["companyGoals", "departmentGoals", "teamGoals"].includes(name)) return 2;
  if (["constraints", "scopeCertainty", "changeFrequency", "compliance"].includes(name)) return 3;
  if (["dataUseAuthorized", "submitterName", "submitterWorkEmail", "authorityRole", "decisionOwnerName", "decisionOwnerRole", "highRiskCategories", "confidentialInfoAuthorized", "highRiskApproverName", "highRiskApproverRole", "highRiskOverrideAccepted"].includes(name)) return 5;
  return 4;
}

function updateStep(step, options = {}) {
  activeStep = Math.max(1, Math.min(5, step));
  highestStep = Math.max(highestStep, activeStep);
  steps.forEach((section) => {
    const isActive = Number(section.dataset.step) === activeStep;
    section.hidden = !isActive;
    section.classList.toggle("is-active", isActive);
  });
  stepItems.forEach((item) => {
    const itemStep = Number(item.dataset.step);
    item.classList.toggle("is-active", itemStep === activeStep);
    item.classList.toggle("is-complete", itemStep < activeStep);
    item.querySelector("button").disabled = itemStep > highestStep;
  });
  byId("progress-bar").style.width = `${activeStep * 20}%`;
  byId("rail-progress-label").textContent = `Step ${activeStep} of 5`;
  byId("rail-progress-detail").textContent = stepItems[activeStep - 1].querySelector("strong").textContent;
  backButton.hidden = activeStep === 1;
  nextButton.hidden = activeStep === 5;
  generateButton.hidden = activeStep !== 5;
  if (activeStep === 5) renderReview();
  saveDraft();
  if (options.scroll !== false) advisor.scrollIntoView({ behavior: "smooth", block: "start" });
}

function syncBudgetDisclosure() {
  const noBudget = byId("budget-disclosure").value === "none";
  byId("budget").disabled = noBudget;
  byId("currency").disabled = noBudget;
  byId("budget-period").disabled = noBudget;
  byId("budget-amount-field").classList.toggle("is-disabled", noBudget);
}

function resetHighRiskOverride() {
  byId("high-risk-override-accepted").value = "no";
  byId("override-status").textContent = "Not accepted";
  byId("override-status").classList.remove("is-accepted");
}

function syncHighRiskPanel() {
  const included = byId("confidential-info-included").checked;
  byId("high-risk-panel").hidden = !included;
  if (!included) {
    document.querySelectorAll('[name="highRiskCategories"]').forEach((field) => { field.checked = false; });
    byId("confidential-info-authorized").checked = false;
    byId("high-risk-approver-name").value = "";
    byId("high-risk-approver-role").value = "";
    resetHighRiskOverride();
  }
}

byId("budget-disclosure").addEventListener("change", syncBudgetDisclosure);
byId("confidential-info-included").addEventListener("change", syncHighRiskPanel);
["quarterly-planning-authorized", "confidential-info-authorized", "high-risk-approver-name", "high-risk-approver-role"].forEach((id) => byId(id).addEventListener("change", () => {
  if (byId("confidential-info-included").checked) resetHighRiskOverride();
}));
document.querySelectorAll('[name="highRiskCategories"]').forEach((field) => field.addEventListener("change", resetHighRiskOverride));
byId("review-high-risk-override").addEventListener("click", () => byId("high-risk-dialog").showModal());
byId("accept-high-risk-override").addEventListener("click", () => {
  byId("high-risk-override-accepted").value = "yes";
  byId("override-status").textContent = "Accepted · company-data-authorization-2026-09-21-v2";
  byId("override-status").classList.add("is-accepted");
  document.querySelector('[data-error-for="highRiskOverrideAccepted"]').textContent = "";
});

stepItems.forEach((item) => item.querySelector("button").addEventListener("click", () => {
  const target = Number(item.dataset.step);
  if (target <= highestStep) updateStep(target);
}));

nextButton.addEventListener("click", () => {
  if (!validateStep(activeStep)) return;
  updateStep(activeStep + 1);
});
backButton.addEventListener("click", () => updateStep(activeStep - 1));

const formatMoney = (amount, currency) => {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount); }
  catch { return `${currency} ${Number(amount || 0).toLocaleString()}`; }
};
const summarize = (value, fallback = "Not provided") => {
  const normalized = String(value || "").trim();
  return normalized ? (normalized.length > 150 ? `${normalized.slice(0, 147)}…` : normalized) : fallback;
};

function reviewCard(index, title, rows) {
  return `<article class="review-card"><span>${String(index).padStart(2, "0")}</span><h3>${esc(title)}</h3><dl>${rows.map(([key, value]) => `<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl></article>`;
}

function renderReview() {
  const input = collectInput();
  const budgetSummary = input.budgetDisclosure === "none" ? "Not provided" : `${input.budgetDisclosure === "exact" ? "Exact" : "Approx."} ${formatMoney(input.budget, input.currency)} / ${input.budgetPeriod}`;
  byId("review-grid").innerHTML = [
    reviewCard(1, "Project basics", [["Project", input.projectName || "Unnamed project"], ["Budget", budgetSummary], ["Timeline", input.deadline || labelize(input.window)], ["Objective", summarize(input.objectives)]]),
    reviewCard(2, "Goals & structure", [["Hierarchy", labelize(input.hierarchy)], ["Company", summarize(input.companyGoals)], ["Department", summarize(input.departmentGoals)], ["Team", summarize(input.teamGoals)]]),
    reviewCard(3, "Delivery realities", [["Scope certainty", labelize(input.scopeCertainty)], ["Expected change", labelize(input.changeFrequency)], ["Compliance", labelize(input.compliance)], ["Cadence", labelize(input.deliveryCadence)]]),
    reviewCard(4, "Team & capability", [["Employees", input.totalEmployees || "Not provided"], ["Relevant team", `${input.teamSize} people`], ["Available", input.availablePersonnel || "Not provided"], ["Hiring", summarize(input.hiringConstraints)], ["Working model", labelize(input.distribution)], ["Capabilities", input.capabilities.length ? input.capabilities.map(labelize).join(", ") : "None selected"]])
  ].join("");
}

function appendList(id, items) {
  const list = byId(id);
  list.replaceChildren(...(items || []).map((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    return li;
  }));
}

function validSourceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "#";
  } catch { return "#"; }
}

function renderResults(data) {
  latestResult = data;
  const recommendation = data.recommendation;
  const organizationAnalysis = data.organizationAnalysis;
  byId("results-project-name").textContent = data.project.name;
  byId("result-notice").textContent = data.notice;
  byId("accountable-owner").textContent = data.accountability.decisionOwner.name;
  byId("accountable-owner-role").textContent = data.accountability.decisionOwner.role;
  byId("authorized-submitter").textContent = data.authorization.submittedBy.name;
  byId("authorized-submitter-role").textContent = `${labelize(data.authorization.submittedBy.authorityRole)} · ${data.authorization.submittedBy.workEmail}`;
  byId("authorization-policy-owner").textContent = data.authorization.policyOwner;
  byId("authorization-timestamp").textContent = `Authorized ${new Date(data.authorization.grantedAt).toLocaleString()}`;
  byId("materiality-question").textContent = organizationAnalysis.question;
  byId("materiality-answer").textContent = organizationAnalysis.answer;
  byId("analysis-objective").textContent = organizationAnalysis.objective;
  const insightCards = (items) => items.map((item) => `<article><strong>${esc(item.signal)}</strong><dl><div><dt>Evidence</dt><dd>${esc(item.evidence)}</dd></div><div><dt>Objective impact</dt><dd>${esc(item.objectiveImpact)}</dd></div></dl></article>`).join("");
  byId("opportunity-list").innerHTML = insightCards(organizationAnalysis.opportunities);
  byId("problem-list").innerHTML = insightCards(organizationAnalysis.problems);
  byId("analysis-mode").textContent = data.mode === "ai-assisted" ? "AI-assisted explanation" : "Transparent model";
  byId("recommendation-label").textContent = recommendation.label;
  byId("recommendation-name").textContent = recommendation.name;
  byId("recommendation-description").textContent = recommendation.description;
  byId("fit-score").textContent = recommendation.fitScore;
  byId("fit-score-ring").style.borderColor = recommendation.fitScore >= 80 ? "#64cbb0" : recommendation.fitScore >= 68 ? "#e0b45a" : "#db7a68";
  byId("confidence-label").textContent = recommendation.confidence.label;
  byId("confidence-basis").textContent = recommendation.confidence.basis;
  byId("method-mix").innerHTML = recommendation.methodMix.map((part) => `<div class="mix-segment"><div><span style="width:${Number(part.percent)}%"></span></div><small>${esc(part.name)} · ${Number(part.percent)}%</small></div>`).join("");
  const traceFields = [
    ["Evidence", "evidence"], ["Interpretation", "interpretation"], ["Recommendation", "recommendation"],
    ["Action", "action"], ["Owner", "owner"], ["Dependency", "dependency"], ["Success criterion", "successCriterion"]
  ];
  byId("recommendation-traces").innerHTML = data.traceableRecommendations.map((item, index) => `<article class="trace-card"><header><span>${String(index + 1).padStart(2, "0")}</span><p>${esc(item.objectiveImpact)}</p></header><dl>${traceFields.map(([label, key]) => `<div><dt>${label}</dt><dd>${esc(item[key])}</dd></div>`).join("")}</dl></article>`).join("");

  const perspective = data.perspective;
  byId("ai-perspective").hidden = !perspective;
  if (perspective) {
    byId("ai-model").textContent = data.ai?.model || "Configured model";
    byId("ai-summary").textContent = perspective.executiveSummary;
    byId("ai-tradeoffs").textContent = perspective.tradeoffNarrative;
    appendList("ai-questions", perspective.validationQuestions);
  }

  byId("impact-grid").innerHTML = recommendation.impact.map((item) => `<article class="impact-card"><div class="impact-head"><span class="impact-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${iconPaths[item.id] || iconPaths.time}</svg></span><span class="impact-score">${Number(item.score).toFixed(1)}<small> / 5</small></span></div><h4>${esc(item.label)}</h4><p>${esc(item.note)}</p><div class="meter"><span style="width:${Math.round((Number(item.score) / 5) * 100)}%"></span></div></article>`).join("");
  appendList("rationale-list", recommendation.rationale);
  byId("factor-bars").innerHTML = data.decisionFactors.map((factor) => `<div class="factor-row"><div><strong>${esc(factor.label)}</strong><span>${Number(factor.strength)}%</span></div><div class="meter"><span style="width:${Number(factor.strength)}%"></span></div></div>`).join("");
  appendList("strength-list", recommendation.tradeoffs.strengths);
  appendList("watchout-list", recommendation.tradeoffs.watchouts);
  byId("blueprint-cadence").textContent = recommendation.blueprint.cadence;
  byId("launch-sequence").innerHTML = data.executionPlan.launchSequence.map((phase) => `<article><span>${esc(phase.window)}</span><p>${esc(phase.outcome)}</p><small>${esc(phase.owner)}</small></article>`).join("");
  appendList("blueprint-roles", recommendation.blueprint.roles);
  appendList("blueprint-practices", recommendation.blueprint.practices);
  appendList("blueprint-controls", recommendation.blueprint.controls);
  appendList("tailoring-list", recommendation.tailoring);
  byId("tailoring-row").hidden = recommendation.tailoring.length === 0;
  byId("quarterly-section").hidden = !data.quarterlyPlan;
  if (data.quarterlyPlan) byId("quarterly-grid").innerHTML = data.quarterlyPlan.cycles.map((cycle) => `<article><span>${esc(cycle.window)}</span><h4>${esc(cycle.focus)}</h4><p><strong>Decision:</strong> ${esc(cycle.decision)}</p></article>`).join("");
  byId("alternative-grid").innerHTML = data.alternatives.map((alternative) => `<article class="alternative-card"><div class="alternative-card-head"><div><h4>${esc(alternative.name)}</h4><span class="alt-label">${esc(alternative.label)}</span></div><span class="alt-score">${Number(alternative.score)}</span></div><p>${esc(alternative.description)}</p><div class="alt-detail"><strong>Choose instead when</strong>${esc(alternative.whenToChooseInstead)}<strong>Tradeoff</strong>${esc(alternative.tradeoff)}</div><a href="${esc(validSourceUrl(alternative.source.url))}" target="_blank" rel="noreferrer">Read ${esc(alternative.source.publisher)} guidance ↗</a></article>`).join("");
  appendList("assumptions-list", data.assumptions);

  advisor.hidden = true;
  results.hidden = false;
  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateStep(1) || !validateStep(2) || !validateStep(4) || !validateStep(5)) {
    const errorField = form.querySelector("[aria-invalid='true']");
    const errorStep = Number(errorField?.closest(".form-step")?.dataset.step || 1);
    updateStep(errorStep);
    return;
  }

  generateButton.disabled = true;
  generateButton.classList.add("is-loading");
  try {
    const tokenResponse = await fetch("/api/request-token", { headers: { accept: "application/json" } });
    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenPayload.token) throw new Error(tokenPayload.error || "A secure request token could not be created.");
    const response = await fetch("/api/recommend", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-token": tokenPayload.token,
        "x-request-timestamp": String(Date.now()),
        "x-idempotency-key": crypto.randomUUID()
      },
      body: JSON.stringify(collectInput())
    });
    const data = await response.json();
    if (!response.ok) {
      if (data.fields) {
        showErrors(data.fields);
        updateStep(stepForError(Object.keys(data.fields)[0]));
      }
      throw new Error(data.error || "The recommendation could not be completed.");
    }
    renderResults(data);
  } catch (error) {
    showToast(error.message || "The recommendation could not be completed.");
  } finally {
    generateButton.disabled = false;
    generateButton.classList.remove("is-loading");
  }
});

form.addEventListener("input", (event) => {
  const errorSlot = document.querySelector(`[data-error-for="${CSS.escape(event.target.name || "")}"]`);
  if (errorSlot) errorSlot.textContent = "";
  event.target.removeAttribute?.("aria-invalid");
  updateCharacterCounts();
  saveDraft();
});
form.addEventListener("change", saveDraft);

byId("edit-button").addEventListener("click", () => {
  results.hidden = true;
  advisor.hidden = false;
  updateStep(5);
});
byId("print-button").addEventListener("click", () => window.print());
byId("export-button").addEventListener("click", () => {
  if (!latestResult) return;
  const blob = new Blob([JSON.stringify(latestResult, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const slug = String(latestResult.project.name || "project").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  link.href = url;
  link.download = `${slug}-methodology-recommendation.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Recommendation exported as JSON.");
});
byId("clear-button").addEventListener("click", () => {
  if (!window.confirm("Clear the browser-local assessment draft?")) return;
  localStorage.removeItem(DRAFT_KEY);
  form.reset();
  byId("team-size").value = 6;
  syncBudgetDisclosure();
  syncHighRiskPanel();
  highestStep = 1;
  updateCharacterCounts();
  updateStep(1);
  showToast("Draft cleared.");
});

const today = new Date();
const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
byId("deadline").min = localToday;
loadDraft();
syncBudgetDisclosure();
syncHighRiskPanel();
updateCharacterCounts();
updateStep(1, { scroll: false });
