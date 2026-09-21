const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mean = (...values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const round = (value) => Math.round(value);

const LEVEL = Object.freeze({ low: 0.12, medium: 0.52, high: 0.92 });
const URGENCY = Object.freeze({ exploratory: 0.18, target: 0.48, firm: 0.76, critical: 1 });
const HIERARCHY = Object.freeze({ flat: 0.18, functional: 0.52, matrix: 0.78, hierarchical: 0.94 });
const CADENCE = Object.freeze({ "one-time": 0.12, milestones: 0.5, biweekly: 0.78, continuous: 1 });
const BUDGET_PRESSURE = Object.freeze({ flexible: 0.2, fixed: 0.62, tight: 0.95 });
const PREFERENCE = Object.freeze({ none: null, agile: "scrum", structured: "predictive", flow: "kanban", hybrid: "hybrid" });

export const METHODOLOGIES = Object.freeze([
  {
    id: "scrum",
    name: "Scrum",
    label: "Sprint-based delivery",
    description: "A focused, iterative approach built around a small cross-functional team, short sprints, and frequent stakeholder feedback.",
    profile: { adaptability: 0.92, planning: 0.42, governance: 0.44, flow: 0.48, iteration: 1, autonomy: 0.9, deadline: 0.68, resource: 0.54, discovery: 0.82, dependencies: 0.42 },
    advantages: ["Creates a regular inspect-and-adapt rhythm", "Surfaces usable outcomes and stakeholder feedback early"],
    cautions: ["Ceremonies can become overhead when the team is interrupted frequently", "Needs an empowered team and an available product decision-maker"],
    blueprint: {
      cadence: "Two-week sprints with a protected sprint goal",
      roles: ["One accountable product owner", "One delivery facilitator", "A stable cross-functional delivery team"],
      practices: ["Maintain one ordered outcome backlog", "Plan only the next sprint in detail", "Review usable work with stakeholders", "Retrospect and change one operating habit each sprint"],
      controls: ["Track sprint goal success, not task completion alone", "Escalate blocked dependencies within one business day"]
    },
    source: { title: "The Scrum Guide", url: "https://scrumguides.org/scrum-guide.html", publisher: "Scrum Guides" }
  },
  {
    id: "kanban",
    name: "Kanban",
    label: "Continuous-flow delivery",
    description: "A flow-oriented system that visualizes work, limits work in progress, and improves throughput without requiring fixed iterations.",
    profile: { adaptability: 0.76, planning: 0.5, governance: 0.36, flow: 1, iteration: 0.58, autonomy: 0.66, deadline: 0.73, resource: 0.88, discovery: 0.42, dependencies: 0.56 },
    advantages: ["Handles variable arrival rates and unplanned work well", "Reduces multitasking through explicit work-in-progress limits"],
    cautions: ["Can drift without explicit service policies and review cadences", "Long-range commitments need separate forecasting and governance"],
    blueprint: {
      cadence: "Continuous pull with weekly replenishment and delivery review",
      roles: ["A service owner", "Work-item owners", "The people needed to resolve flow blockers"],
      practices: ["Visualize the end-to-end workflow", "Set work-in-progress limits by stage", "Define classes of service", "Review cycle time and blocked work weekly"],
      controls: ["Do not start work when a work-in-progress limit is reached", "Use aging alerts before due dates become emergencies"]
    },
    source: { title: "The Official Guide to the Kanban Method", url: "https://kanban.university/kanban-guide/", publisher: "Kanban University" }
  },
  {
    id: "predictive",
    name: "Predictive",
    label: "Plan-driven delivery",
    description: "A staged approach that establishes scope, sequence, approvals, and controls before execution begins.",
    profile: { adaptability: 0.16, planning: 1, governance: 0.94, flow: 0.18, iteration: 0.24, autonomy: 0.3, deadline: 0.62, resource: 0.54, discovery: 0.16, dependencies: 0.88 },
    advantages: ["Makes commitments, approvals, and handoffs explicit", "Fits stable scope and regulated stage-gate environments"],
    cautions: ["Late learning can make change expensive", "Detailed plans may create false confidence when requirements are uncertain"],
    blueprint: {
      cadence: "Phase gates tied to approved deliverables and milestones",
      roles: ["A project manager with integrated-plan ownership", "Named workstream leads", "A decision board for material changes"],
      practices: ["Baseline scope, schedule, and cost", "Map dependencies before execution", "Use formal change control", "Validate acceptance criteria at each gate"],
      controls: ["Hold contingency for identified risks", "Reforecast when a critical-path assumption changes"]
    },
    source: { title: "Process Groups: A Practice Guide", url: "https://www.pmi.org/standards/process-groups", publisher: "Project Management Institute" }
  },
  {
    id: "hybrid",
    name: "Hybrid",
    label: "Governed iterative delivery",
    description: "A tailored operating model that keeps milestone and governance controls while using iterative delivery inside each workstream.",
    profile: { adaptability: 0.66, planning: 0.8, governance: 0.84, flow: 0.62, iteration: 0.76, autonomy: 0.6, deadline: 0.76, resource: 0.65, discovery: 0.62, dependencies: 0.82 },
    advantages: ["Balances organizational controls with short learning cycles", "Lets different workstreams use the cadence that fits their uncertainty"],
    cautions: ["Can become two full processes layered together", "Requires clear rules for which decisions are fixed and which can adapt"],
    blueprint: {
      cadence: "Monthly governance milestones with two-week delivery cycles",
      roles: ["A project lead who owns the integrated outcome", "Empowered workstream owners", "A lightweight steering group for boundary decisions"],
      practices: ["Lock budget and outcome boundaries, not every feature", "Deliver uncertain work iteratively", "Manage cross-team dependencies on one milestone map", "Review assumptions before each governance checkpoint"],
      controls: ["Keep one risk and decision log", "Require change approval only when a boundary or milestone is affected"]
    },
    source: { title: "Hybrid Life Cycles", url: "https://www.pmi.org/disciplined-agile/serial/hybridlifecycles", publisher: "Project Management Institute" }
  },
  {
    id: "ccpm",
    name: "Critical Chain",
    label: "Constraint-led delivery",
    description: "A schedule-focused approach that protects the project constraint with resource-aware sequencing and shared buffers.",
    profile: { adaptability: 0.34, planning: 0.86, governance: 0.7, flow: 0.38, iteration: 0.36, autonomy: 0.48, deadline: 1, resource: 1, discovery: 0.24, dependencies: 1 },
    advantages: ["Concentrates attention on the resources and dependencies that set the finish date", "Uses visible buffers instead of hidden safety inside every task"],
    cautions: ["Needs credible dependency and resource data", "Fits discovery-heavy or rapidly changing work poorly on its own"],
    blueprint: {
      cadence: "Buffer-based schedule reviews at least weekly",
      roles: ["A project manager who owns the critical chain", "Resource managers", "Owners for feeding-chain commitments"],
      practices: ["Sequence work around real resource constraints", "Remove hidden task-level padding", "Protect the finish date with a project buffer", "Prioritize work using buffer health"],
      controls: ["Avoid multitasking on constrained resources", "Escalate buffer consumption before milestone slippage"]
    },
    source: { title: "Critical Chain Project Management", url: "https://www.pmi.org/learning/library/critical-chain-project-management-7983", publisher: "Project Management Institute" }
  },
  {
    id: "shape-up",
    name: "Shape Up",
    label: "Appetite-led product cycles",
    description: "A product-development approach that shapes problems before committing a small autonomous team to a fixed time appetite.",
    profile: { adaptability: 0.75, planning: 0.42, governance: 0.32, flow: 0.3, iteration: 0.86, autonomy: 1, deadline: 0.82, resource: 0.72, discovery: 1, dependencies: 0.28 },
    advantages: ["Constrains investment with a fixed appetite rather than an expanding estimate", "Gives capable teams room to determine the solution"],
    cautions: ["Requires strong shaping judgment before work is selected", "Cross-team dependencies and regulated approvals weaken team autonomy"],
    blueprint: {
      cadence: "Six-week build cycles followed by a cool-down period",
      roles: ["A shaping group", "A betting or portfolio group", "A small autonomous build team"],
      practices: ["Define the problem, appetite, boundaries, and rabbit holes", "Bet on shaped pitches rather than maintaining a large backlog", "Let the team scope-hammer inside the appetite", "Use hill charts to expose unknowns"],
      controls: ["Do not extend a cycle by default", "Re-shape or stop work that cannot fit the appetite"]
    },
    source: { title: "Shape Up", url: "https://basecamp.com/shapeup", publisher: "Basecamp" }
  },
  {
    id: "scrumban",
    name: "Scrumban",
    label: "Cadenced flow",
    description: "A pragmatic hybrid that keeps a regular review rhythm while using pull, work-in-progress limits, and flow metrics for execution.",
    profile: { adaptability: 0.86, planning: 0.58, governance: 0.48, flow: 0.92, iteration: 0.9, autonomy: 0.8, deadline: 0.8, resource: 0.84, discovery: 0.62, dependencies: 0.58 },
    advantages: ["Retains a predictable review cadence without forcing all work into a sprint commitment", "Fits teams balancing planned delivery with operational demand"],
    cautions: ["Working agreements must be explicit because there is no single canonical implementation", "It can inherit too many ceremonies if the team does not remove redundant controls"],
    blueprint: {
      cadence: "Continuous pull with a two-week outcome review",
      roles: ["A single priority owner", "A flow facilitator", "A cross-functional delivery team"],
      practices: ["Use a replenished outcome queue", "Set work-in-progress limits", "Reserve capacity for urgent work", "Review outcomes and flow every two weeks"],
      controls: ["Define an expedite policy", "Use cycle-time trends to adjust capacity and commitments"]
    },
    source: { title: "The Kanban Guide for Scrum Teams", url: "https://www.scrum.org/resources/kanban-guide-scrum-teams", publisher: "Scrum.org" }
  }
]);

const METHOD_BY_ID = Object.fromEntries(METHODOLOGIES.map((method) => [method.id, method]));

function text(value, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function choice(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function number(value, min, max, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function normalizeInput(raw = {}) {
  const deadline = text(raw.deadline, 20);
  return {
    projectName: text(raw.projectName, 120),
    budget: number(raw.budget, 0, 1_000_000_000_000, 0),
    currency: choice(raw.currency, ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "OTHER"], "USD"),
    budgetFlexibility: choice(raw.budgetFlexibility, ["tight", "fixed", "flexible"], "fixed"),
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? deadline : "",
    window: choice(raw.window, ["under-6-weeks", "6-12-weeks", "3-6-months", "6-12-months", "over-year"], "3-6-months"),
    urgency: choice(raw.urgency, ["exploratory", "target", "firm", "critical"], "target"),
    objectives: text(raw.objectives, 6000),
    companyGoals: text(raw.companyGoals, 3000),
    departmentGoals: text(raw.departmentGoals, 3000),
    teamGoals: text(raw.teamGoals, 3000),
    constraints: text(raw.constraints, 4000),
    nonNegotiables: text(raw.nonNegotiables, 3000),
    hierarchy: choice(raw.hierarchy, ["flat", "functional", "matrix", "hierarchical"], "functional"),
    approvalLoad: choice(raw.approvalLoad, ["low", "medium", "high"], "medium"),
    scopeCertainty: choice(raw.scopeCertainty, ["low", "medium", "high"], "medium"),
    changeFrequency: choice(raw.changeFrequency, ["low", "medium", "high"], "medium"),
    deliveryCadence: choice(raw.deliveryCadence, ["one-time", "milestones", "biweekly", "continuous"], "milestones"),
    compliance: choice(raw.compliance, ["low", "medium", "high"], "medium"),
    teamSize: number(raw.teamSize, 1, 500, 6),
    distribution: choice(raw.distribution, ["colocated", "hybrid", "distributed"], "hybrid"),
    stakeholderAccess: choice(raw.stakeholderAccess, ["low", "medium", "high"], "medium"),
    dependencyLevel: choice(raw.dependencyLevel, ["low", "medium", "high"], "medium"),
    interruptionLevel: choice(raw.interruptionLevel, ["low", "medium", "high"], "medium"),
    preference: choice(raw.preference, ["none", "agile", "structured", "flow", "hybrid"], "none"),
    capabilities: Array.isArray(raw.capabilities)
      ? [...new Set(raw.capabilities.filter((item) => ["cross-functional", "dedicated", "agile-experience", "discovery", "estimation", "specialists"].includes(item)))].slice(0, 6)
      : []
  };
}

export function validateInput(input) {
  const errors = {};
  if (!(input.budget > 0)) errors.budget = "Enter a project budget greater than zero.";
  if (!input.deadline && !input.window) errors.deadline = "Choose a desired completion window or enter a deadline.";
  if (input.objectives.length < 20) errors.objectives = "Describe the project objective in at least 20 characters.";
  if (!input.companyGoals) errors.companyGoals = "Add at least one company-level goal.";
  if (!input.departmentGoals) errors.departmentGoals = "Add at least one department or team goal.";
  if (!input.teamGoals) errors.teamGoals = "Add at least one team-member or team goal.";
  if (input.teamSize < 1) errors.teamSize = "Team size must be at least one.";
  return errors;
}

function daysUntil(dateString) {
  if (!dateString) return null;
  const timestamp = Date.parse(`${dateString}T23:59:59Z`);
  if (!Number.isFinite(timestamp)) return null;
  return Math.ceil((timestamp - Date.now()) / 86_400_000);
}

function deriveFactors(input) {
  const scopeUncertainty = 1 - LEVEL[input.scopeCertainty];
  const change = LEVEL[input.changeFrequency];
  const compliance = LEVEL[input.compliance];
  const hierarchy = HIERARCHY[input.hierarchy];
  const approvals = LEVEL[input.approvalLoad];
  const stakeholder = LEVEL[input.stakeholderAccess];
  const dependencies = LEVEL[input.dependencyLevel];
  const interruptions = LEVEL[input.interruptionLevel];
  const cadence = CADENCE[input.deliveryCadence];
  const budget = BUDGET_PRESSURE[input.budgetFlexibility];
  const urgent = URGENCY[input.urgency];
  const days = daysUntil(input.deadline);
  const deadlineFromDate = days === null ? urgent : days <= 42 ? 1 : days <= 90 ? 0.82 : days <= 180 ? 0.62 : 0.38;
  const deadline = Math.max(urgent, deadlineFromDate);
  const teamCapabilities = input.capabilities;
  const autonomy = clamp(mean(
    teamCapabilities.includes("cross-functional") ? 0.92 : 0.35,
    teamCapabilities.includes("dedicated") ? 0.92 : 0.42,
    1 - hierarchy * 0.65,
    teamCapabilities.includes("agile-experience") ? 0.82 : 0.42
  ));
  const discovery = clamp(mean(scopeUncertainty, change, teamCapabilities.includes("discovery") ? 0.9 : 0.42));
  return {
    adaptability: clamp(mean(change, scopeUncertainty, discovery)),
    planning: clamp(mean(1 - scopeUncertainty, compliance, dependencies, deadline)),
    governance: clamp(mean(compliance, hierarchy, approvals)),
    flow: clamp(mean(cadence, interruptions)),
    iteration: clamp(mean(cadence, change, stakeholder)),
    autonomy,
    deadline,
    resource: clamp(mean(budget, dependencies, input.teamSize <= 8 ? 0.72 : 0.48)),
    discovery,
    dependencies
  };
}

const WEIGHTS = Object.freeze({ adaptability: 1.18, planning: 1.04, governance: 0.94, flow: 0.9, iteration: 1.04, autonomy: 0.7, deadline: 0.82, resource: 0.74, discovery: 0.82, dependencies: 0.82 });

function scoreMethod(method, input, factors) {
  let weightedDistance = 0;
  let totalWeight = 0;
  const dimensionFit = {};
  for (const [dimension, weight] of Object.entries(WEIGHTS)) {
    const distance = Math.abs(method.profile[dimension] - factors[dimension]);
    weightedDistance += distance * weight;
    totalWeight += weight;
    dimensionFit[dimension] = round((1 - distance) * 100);
  }
  let score = 96 - (weightedDistance / totalWeight) * 64;

  if (method.id === "scrum") {
    if (input.teamSize >= 4 && input.teamSize <= 10) score += 4;
    if (input.capabilities.includes("agile-experience")) score += 4;
    if (input.interruptionLevel === "high") score -= 9;
    if (input.stakeholderAccess === "low") score -= 7;
  }
  if (method.id === "kanban") {
    if (input.interruptionLevel === "high") score += 8;
    if (input.deliveryCadence === "continuous") score += 5;
  }
  if (method.id === "predictive") {
    if (input.scopeCertainty === "high") score += 7;
    if (input.compliance === "high") score += 5;
    if (input.changeFrequency === "high") score -= 10;
  }
  if (method.id === "hybrid") {
    if (input.compliance === "high" && input.changeFrequency !== "low") score += 8;
    if (input.hierarchy === "matrix") score += 5;
    if (input.teamSize > 12) score += 3;
  }
  if (method.id === "ccpm") {
    if (input.urgency === "critical") score += 6;
    if (input.dependencyLevel === "high") score += 7;
    if (input.scopeCertainty === "low") score -= 7;
  }
  if (method.id === "shape-up") {
    if (input.capabilities.includes("cross-functional") && input.capabilities.includes("dedicated")) score += 6;
    if (input.capabilities.includes("discovery")) score += 4;
    if (input.compliance === "high") score -= 10;
    if (input.teamSize > 20) score -= 6;
  }
  if (method.id === "scrumban") {
    if (input.interruptionLevel === "high" && input.changeFrequency !== "low") score += 8;
    if (input.deliveryCadence === "continuous") score += 4;
  }

  const preferred = PREFERENCE[input.preference];
  if (preferred === method.id) score += 4;
  if (input.preference === "agile" && ["scrum", "scrumban", "shape-up"].includes(method.id)) score += 2;
  if (input.preference === "flow" && ["kanban", "scrumban"].includes(method.id)) score += 2;
  if (input.preference === "structured" && ["predictive", "ccpm", "hybrid"].includes(method.id)) score += 2;

  return { id: method.id, score: round(clamp(score, 35, 96)), dimensionFit };
}

function topSignals(factors) {
  const labels = {
    adaptability: "ability to absorb change",
    planning: "upfront planning and predictability",
    governance: "governance and approval control",
    flow: "continuous flow and interruption handling",
    iteration: "short feedback cycles",
    autonomy: "team autonomy",
    deadline: "deadline protection",
    resource: "resource efficiency",
    discovery: "problem and solution discovery",
    dependencies: "cross-team dependency control"
  };
  return Object.entries(factors)
    .map(([key, value]) => ({ key, value, label: labels[key] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);
}

function buildRationale(primary, input, factors) {
  const signals = topSignals(factors);
  const rationale = signals.slice(0, 3).map((signal) => {
    if (signal.key === "adaptability") return `Your inputs indicate meaningful uncertainty or change, so ${primary.name} was favored for its ability to adjust without replanning the entire project.`;
    if (signal.key === "planning") return `${primary.name} aligns with the amount of upfront planning needed to coordinate the deadline, scope, and dependencies you described.`;
    if (signal.key === "governance") return `The organizational and compliance inputs call for visible decision rights; this approach can provide them without treating every decision as a formal gate.`;
    if (signal.key === "flow") return `The expected interruption and delivery pattern makes work-in-progress control more valuable than a task board alone.`;
    if (signal.key === "iteration") return `Frequent feedback is useful here because it can expose assumption gaps before budget and schedule are fully committed.`;
    if (signal.key === "autonomy") return `The stated team capabilities support delegating solution decisions closer to the work.`;
    if (signal.key === "deadline") return `The completion pressure makes cadence, dependency visibility, and early risk escalation central to the operating model.`;
    if (signal.key === "resource") return `Budget and capacity pressure increase the value of limiting parallel work and protecting scarce skills.`;
    if (signal.key === "discovery") return `The project still contains discovery risk, so the recommendation preserves room to test assumptions before scaling execution.`;
    return `Cross-team dependencies are material, so the recommendation includes explicit integration points and escalation rules.`;
  });
  if (input.preference !== "none") rationale.push(`Your stated preference for a ${input.preference} style was treated as a secondary signal, not as a deciding constraint.`);
  return rationale;
}

function buildTradeoffs(primary, input) {
  const strengths = [...primary.advantages];
  const watchouts = [...primary.cautions];
  if (input.approvalLoad === "high") watchouts.push("Approval latency could erase the benefit of the proposed delivery cadence unless decision rights are delegated.");
  if (input.stakeholderAccess === "low") watchouts.push("Low stakeholder availability reduces feedback quality; schedule explicit decision windows before work begins.");
  if (input.distribution === "distributed") watchouts.push("A distributed team needs written working agreements and asynchronous decision records to avoid coordination drag.");
  if (!input.capabilities.includes("dedicated")) watchouts.push("Shared team members create context-switching risk; reserve capacity explicitly rather than assuming full availability.");
  return { strengths: strengths.slice(0, 3), watchouts: watchouts.slice(0, 4) };
}

function impactEstimate(primary, factors) {
  const p = primary.profile;
  const fit = (key) => 1 - Math.abs(p[key] - factors[key]);
  const toImpact = (value) => round(clamp(1.5 + value * 3.4, 1, 5) * 10) / 10;
  return [
    { id: "time", label: "Time", score: toImpact(mean(fit("deadline"), fit("flow"), fit("iteration"))), note: "Potential to protect delivery time through cadence and earlier risk visibility" },
    { id: "money", label: "Money", score: toImpact(mean(fit("resource"), fit("planning"))), note: "Potential to reduce rework, idle time, and over-commitment" },
    { id: "effort", label: "Human effort", score: toImpact(mean(fit("autonomy"), fit("resource"), fit("flow"))), note: "Potential to focus capacity and reduce avoidable coordination" },
    { id: "friction", label: "Operational friction", score: toImpact(mean(fit("governance"), fit("dependencies"), fit("adaptability"))), note: "Potential to simplify decisions, handoffs, and change handling" }
  ];
}

function buildTailoring(primary, input) {
  const additions = [];
  if (primary.id === "predictive" && input.changeFrequency !== "low") additions.push("Run a short discovery sprint before baselining the plan.");
  if (["scrum", "shape-up"].includes(primary.id) && input.compliance === "high") additions.push("Add milestone evidence packs and a lightweight compliance gate outside the team cadence.");
  if (["kanban", "scrumban"].includes(primary.id) && input.deadline) additions.push("Add a milestone forecast and explicit finish-date buffer; flow metrics alone do not guarantee the deadline.");
  if (input.dependencyLevel === "high") additions.push("Maintain one cross-team dependency map with named owners and decision dates.");
  if (input.approvalLoad === "high") additions.push("Pre-authorize decision thresholds so routine changes do not wait for the full approval chain.");
  if (!input.capabilities.includes("agile-experience") && ["scrum", "scrumban", "shape-up"].includes(primary.id)) additions.push("Start with a four-week pilot and review whether the team can sustain the operating rhythm before wider rollout.");
  return additions.slice(0, 4);
}

function confidenceFor(input, ranking) {
  const completenessChecks = [
    input.budget > 0, Boolean(input.deadline || input.window), input.objectives.length >= 20,
    Boolean(input.companyGoals), Boolean(input.departmentGoals), Boolean(input.teamGoals),
    Boolean(input.constraints), input.capabilities.length >= 2, Boolean(input.nonNegotiables)
  ];
  const completeness = completenessChecks.filter(Boolean).length / completenessChecks.length;
  const margin = (ranking[0]?.score || 0) - (ranking[1]?.score || 0);
  const value = round(clamp(0.48 + completeness * 0.3 + margin / 100, 0.48, 0.91) * 100);
  return {
    value,
    label: value >= 82 ? "High directional confidence" : value >= 68 ? "Moderate directional confidence" : "Low directional confidence",
    basis: margin < 5 ? "Several approaches fit similarly; use the tradeoffs and pilot plan to decide." : "The leading approach separates from the alternatives on the supplied constraints."
  };
}

function makeMethodMix(primary, second, input) {
  if (primary.id === "hybrid") {
    const agilePartner = ["scrum", "scrumban", "kanban", "shape-up"].includes(second.id) ? second : METHOD_BY_ID.scrumban;
    return [{ name: "Milestone governance", percent: 35 }, { name: agilePartner.name, percent: 65 }];
  }
  if (primary.id === "predictive" && input.changeFrequency !== "low") return [{ name: "Predictive governance", percent: 70 }, { name: "Discovery sprints", percent: 30 }];
  if (["scrum", "scrumban", "kanban", "shape-up"].includes(primary.id) && input.compliance === "high") return [{ name: primary.name, percent: 75 }, { name: "Stage-gate controls", percent: 25 }];
  return [{ name: primary.name, percent: 100 }];
}

export function recommendProject(rawInput) {
  const input = normalizeInput(rawInput);
  const errors = validateInput(input);
  if (Object.keys(errors).length) {
    const error = new Error("Some required project inputs are missing or invalid.");
    error.code = "VALIDATION_ERROR";
    error.fields = errors;
    throw error;
  }

  const factors = deriveFactors(input);
  const scored = METHODOLOGIES
    .map((method) => ({ ...scoreMethod(method, input, factors), method }))
    .sort((a, b) => b.score - a.score);
  const primary = scored[0].method;
  const runnerUp = scored[1].method;
  const confidence = confidenceFor(input, scored);
  const projectLabel = input.projectName || "this project";

  return {
    version: "project-compass-v1",
    generatedAt: new Date().toISOString(),
    notice: "This is a decision-support recommendation based on the information supplied. It is not an objective truth, guarantee, or substitute for project leadership judgment.",
    project: {
      name: projectLabel,
      budget: { amount: input.budget, currency: input.currency, flexibility: input.budgetFlexibility },
      deadline: input.deadline || null,
      completionWindow: input.window,
      teamSize: input.teamSize
    },
    recommendation: {
      methodId: primary.id,
      name: primary.name,
      label: primary.label,
      description: primary.description,
      fitScore: scored[0].score,
      confidence,
      methodMix: makeMethodMix(primary, runnerUp, input),
      rationale: buildRationale(primary, input, factors),
      tradeoffs: buildTradeoffs(primary, input),
      tailoring: buildTailoring(primary, input),
      impact: impactEstimate(primary, factors),
      blueprint: primary.blueprint,
      source: primary.source
    },
    alternatives: scored.slice(1, 4).map(({ method, score }) => ({
      id: method.id,
      name: method.name,
      label: method.label,
      score,
      description: method.description,
      whenToChooseInstead: method.advantages[0],
      tradeoff: method.cautions[0],
      source: method.source
    })),
    decisionFactors: topSignals(factors).map(({ key, value, label }) => ({ key, label, strength: round(value * 100) })),
    assumptions: [
      "Scores compare the operating characteristics described in this brief; they do not predict project success.",
      "Budget impact is directional because labor rates, vendor commitments, and sunk costs were not provided.",
      "The recommendation should be revisited when scope certainty, staffing, deadline, or governance changes materially."
    ]
  };
}

export function methodologyCatalog() {
  return METHODOLOGIES.map(({ id, name, label, description, advantages, cautions, source }) => ({ id, name, label, description, advantages, cautions, source }));
}
