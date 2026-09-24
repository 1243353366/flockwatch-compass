const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mean = (...values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const round = (value) => Math.round(value);

const LEVEL = Object.freeze({ low: 0.12, medium: 0.52, high: 0.92 });
const URGENCY = Object.freeze({ exploratory: 0.18, target: 0.48, firm: 0.76, critical: 1 });
const HIERARCHY = Object.freeze({ flat: 0.18, functional: 0.52, matrix: 0.78, hierarchical: 0.94 });
const CADENCE = Object.freeze({ "one-time": 0.12, milestones: 0.5, biweekly: 0.78, continuous: 1 });
const BUDGET_PRESSURE = Object.freeze({ flexible: 0.2, fixed: 0.62, tight: 0.95 });
const PREFERENCE = Object.freeze({ none: null, agile: "scrum", structured: "predictive", flow: "kanban", hybrid: "hybrid" });
export const CONSENT_VERSION = "company-data-authorization-2026-09-21-v2";
const HIGH_RISK_CATEGORIES = Object.freeze(["confidential", "proprietary", "trade-secret", "personal", "regulated", "other-sensitive"]);
const AUTHORITY_ROLES = Object.freeze(["executive-sponsor", "data-owner", "project-owner", "security-privacy", "delegated-written-authority"]);
const HIGH_RISK_APPROVER_ROLES = Object.freeze(["executive-sponsor", "data-owner", "security-privacy"]);
const AUTHORIZATION_POLICY_OWNER = process.env.AUTHORIZATION_POLICY_OWNER || "Application owner (1243353366)";

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
    budgetDisclosure: choice(raw.budgetDisclosure, ["none", "approximate", "exact"], "approximate"),
    budgetPeriod: choice(raw.budgetPeriod, ["monthly", "quarterly", "annual", "project"], "project"),
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
    totalEmployees: number(raw.totalEmployees, 0, 10_000_000, 0),
    availablePersonnel: number(raw.availablePersonnel, 0, 500, 0),
    hiringConstraints: text(raw.hiringConstraints, 2000),
    distribution: choice(raw.distribution, ["colocated", "hybrid", "distributed"], "hybrid"),
    stakeholderAccess: choice(raw.stakeholderAccess, ["low", "medium", "high"], "medium"),
    dependencyLevel: choice(raw.dependencyLevel, ["low", "medium", "high"], "medium"),
    interruptionLevel: choice(raw.interruptionLevel, ["low", "medium", "high"], "medium"),
    preference: choice(raw.preference, ["none", "agile", "structured", "flow", "hybrid"], "none"),
    dataUseAuthorized: raw.dataUseAuthorized === true,
    submitterName: text(raw.submitterName, 120),
    submitterWorkEmail: text(raw.submitterWorkEmail, 254).toLowerCase(),
    authorityRole: choice(raw.authorityRole, AUTHORITY_ROLES, ""),
    decisionOwnerName: text(raw.decisionOwnerName, 120),
    decisionOwnerRole: text(raw.decisionOwnerRole, 160),
    quarterlyPlanningAuthorized: raw.quarterlyPlanningAuthorized === true,
    trainingUseRequested: raw.trainingUseAuthorized === true || raw.trainingUseRequested === true,
    confidentialInfoIncluded: raw.confidentialInfoIncluded === true,
    confidentialInfoAuthorized: raw.confidentialInfoAuthorized === true,
    highRiskApproverName: text(raw.highRiskApproverName, 120),
    highRiskApproverRole: choice(raw.highRiskApproverRole, HIGH_RISK_APPROVER_ROLES, ""),
    highRiskOverrideAccepted: raw.highRiskOverrideAccepted === true,
    highRiskCategories: Array.isArray(raw.highRiskCategories)
      ? [...new Set(raw.highRiskCategories.filter((item) => HIGH_RISK_CATEGORIES.includes(item)))].slice(0, HIGH_RISK_CATEGORIES.length)
      : [],
    capabilities: Array.isArray(raw.capabilities)
      ? [...new Set(raw.capabilities.filter((item) => ["cross-functional", "dedicated", "agile-experience", "discovery", "estimation", "specialists"].includes(item)))].slice(0, 6)
      : []
  };
}

export function validateInput(input) {
  const errors = {};
  if (input.budgetDisclosure !== "none" && !(input.budget > 0)) errors.budget = "Enter the approximate or exact budget, or select no budget information.";
  if (!input.deadline && !input.window) errors.deadline = "Choose a desired completion window or enter a deadline.";
  if (input.objectives.length < 20) errors.objectives = "Describe the project objective in at least 20 characters.";
  if (!input.companyGoals) errors.companyGoals = "Add at least one company-level goal.";
  if (!input.departmentGoals) errors.departmentGoals = "Add at least one department or team goal.";
  if (!input.teamGoals) errors.teamGoals = "Add at least one team-member or team goal.";
  if (input.teamSize < 1) errors.teamSize = "Team size must be at least one.";
  if (!input.dataUseAuthorized) errors.dataUseAuthorized = "Explicit company-data authorization is required before Project Compass can generate a recommendation or framework.";
  if (input.submitterName.length < 2) errors.submitterName = "Enter the name of the person submitting and authorizing this information.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.submitterWorkEmail)) errors.submitterWorkEmail = "Enter the submitter's valid work email address.";
  if (!input.authorityRole) errors.authorityRole = "Attach an allowed authority role to this request.";
  if (input.decisionOwnerName.length < 2) errors.decisionOwnerName = "Name the human accountable for acting on this decision brief.";
  if (input.decisionOwnerRole.length < 2) errors.decisionOwnerRole = "Enter the accountable decision owner's role.";
  if (input.trainingUseRequested) errors.trainingUseAuthorized = "Training and retention are not available capabilities in this release and cannot be authorized through this request.";
  if (input.confidentialInfoIncluded && !input.confidentialInfoAuthorized) errors.confidentialInfoAuthorized = "Confirm that you are authorized to disclose and process the identified confidential or trade-secret information.";
  if (input.confidentialInfoIncluded && input.highRiskApproverName.length < 2) errors.highRiskApproverName = "Name the human who approved the high-risk information override.";
  if (input.confidentialInfoIncluded && !input.highRiskApproverRole) errors.highRiskApproverRole = "Attach an allowed high-risk approver role.";
  if (input.confidentialInfoIncluded && input.highRiskCategories.length === 0) errors.highRiskCategories = "Select every high-risk information category included in the submission.";
  if (input.confidentialInfoIncluded && !input.highRiskOverrideAccepted) errors.highRiskOverrideAccepted = "Review and accept the informed-risk override, or remove the high-risk information before submitting.";
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
  const effectivePersonnel = input.availablePersonnel || input.teamSize;
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
    resource: clamp(mean(budget, dependencies, effectivePersonnel <= 8 ? 0.72 : 0.48)),
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

function buildOrganizationAnalysis(input, factors) {
  const opportunities = [];
  const problems = [];

  if (factors.iteration >= 0.62) opportunities.push({
    signal: "Fast learning loop",
    evidence: `Stakeholder access is ${input.stakeholderAccess}, expected change is ${input.changeFrequency}, and the desired cadence is ${input.deliveryCadence}.`,
    objectiveImpact: "Frequent evidence can correct assumptions before they consume a material share of the budget or delay the stated objective."
  });
  if (factors.autonomy >= 0.58) opportunities.push({
    signal: "Decision-making closer to the work",
    evidence: `The ${input.teamSize}-person team reports ${input.capabilities.length || 0} relevant capabilities and operates in a ${input.hierarchy} structure.`,
    objectiveImpact: "Clear delegated authority can shorten decision time and protect delivery capacity for the stated objective."
  });
  if (factors.flow >= 0.55) opportunities.push({
    signal: "Lower coordination waste",
    evidence: `The project expects ${input.interruptionLevel} unplanned work and a ${input.deliveryCadence} delivery cadence.`,
    objectiveImpact: "Explicit work-in-progress limits can reduce context switching and move more effort toward the stated objective."
  });
  if (opportunities.length < 2) opportunities.push({
    signal: "Explicit objective alignment",
    evidence: `Company, department, and team goals were supplied alongside the project objective: ${input.objectives.slice(0, 180)}.`,
    objectiveImpact: "A shared objective hierarchy makes it possible to reject work that does not materially advance the intended outcome."
  });

  if (factors.dependencies >= 0.62) problems.push({
    signal: "Dependency-driven delay risk",
    evidence: `Dependency load is ${input.dependencyLevel}; the operating structure is ${input.hierarchy}.`,
    objectiveImpact: "Unowned cross-team or vendor dependencies can delay the stated objective even when the core team completes its own work."
  });
  if (factors.governance >= 0.62) problems.push({
    signal: "Approval latency",
    evidence: `Approval load is ${input.approvalLoad}, compliance is ${input.compliance}, and hierarchy is ${input.hierarchy}.`,
    objectiveImpact: "Slow or ambiguous decision rights can turn routine changes into schedule and budget risk against the stated objective."
  });
  if (factors.discovery >= 0.62) problems.push({
    signal: "Unresolved solution assumptions",
    evidence: `Scope certainty is ${input.scopeCertainty} and expected change is ${input.changeFrequency}.`,
    objectiveImpact: "Committing too early to an untested solution can produce rework or an output that fails to achieve the stated objective."
  });
  if (factors.deadline >= 0.72) problems.push({
    signal: "Schedule compression",
    evidence: `Deadline posture is ${input.urgency}; the completion target is ${input.deadline || input.window}.`,
    objectiveImpact: "The available decision and delivery time may be smaller than the coordination and dependency load requires."
  });
  if (problems.length < 2) problems.push({
    signal: "Execution assumptions need validation",
    evidence: `The project combines a ${input.budgetFlexibility} budget, ${input.scopeCertainty} scope certainty, and ${input.dependencyLevel} dependencies.`,
    objectiveImpact: "Unverified capacity and sequencing assumptions can weaken the link between the project plan and the stated objective."
  });

  return {
    question: "Does this information materially affect the organization's stated objective?",
    answer: "Yes. The conditions below change the probability, cost, speed, or effort required to achieve the stated objective.",
    objective: input.objectives,
    opportunities: opportunities.slice(0, 3),
    problems: problems.slice(0, 3)
  };
}

function recommendationForSignal(signal, primary, input) {
  const definitions = {
    adaptability: {
      evidence: `Scope certainty is ${input.scopeCertainty} and expected change is ${input.changeFrequency}.`,
      interpretation: "A fully detailed early plan would harden assumptions before the organization has enough evidence.",
      recommendation: `Use ${primary.name} to hold the outcome boundary steady while adapting solution scope through evidence.`,
      action: "Create an assumption backlog, rank the three assumptions most likely to prevent the objective, and test them before expanding delivery.",
      owner: "Product owner",
      dependency: "Access to representative stakeholders and decision-makers",
      successCriterion: "The top three assumptions are tested and resulting scope decisions are recorded before more than 20% of the budget is committed."
    },
    planning: {
      evidence: `Deadline posture is ${input.urgency}, dependencies are ${input.dependencyLevel}, and scope certainty is ${input.scopeCertainty}.`,
      interpretation: "The objective depends on credible sequencing and forecasting, not only team-level task execution.",
      recommendation: `Use the planning controls in ${primary.name} to maintain one integrated milestone and dependency forecast.`,
      action: "Build a rolling six-week plan that names each milestone, dependency, owner, decision date, and forecast risk.",
      owner: "Project manager",
      dependency: "Workstream estimates and external commitment dates",
      successCriterion: "Every critical milestone has an owner and dependency date, and forecast variance is reviewed weekly."
    },
    governance: {
      evidence: `Approval load is ${input.approvalLoad}, compliance is ${input.compliance}, and the organization is ${input.hierarchy}.`,
      interpretation: "The stated objective can be delayed by unclear decision rights even when delivery work is progressing.",
      recommendation: `Pair ${primary.name} with explicit decision thresholds and lightweight evidence gates.`,
      action: "Publish a decision-rights matrix that defines team authority, sponsor authority, approval evidence, and maximum response time.",
      owner: "Executive sponsor",
      dependency: "Agreement from compliance, finance, and functional leaders",
      successCriterion: "At least 90% of project decisions are resolved within the agreed response time and no item waits more than five business days for approval."
    },
    flow: {
      evidence: `Unplanned work is ${input.interruptionLevel} and the requested cadence is ${input.deliveryCadence}.`,
      interpretation: "Starting too much work would divert human effort from the objective and lengthen delivery time.",
      recommendation: `Apply ${primary.name} with visible work-in-progress limits and an explicit expedite policy.`,
      action: "Map the delivery workflow, set a capacity limit for each active stage, and define which urgent requests may bypass the normal queue.",
      owner: "Delivery lead",
      dependency: "Team agreement on workflow states and capacity",
      successCriterion: "Work-in-progress limits are respected for four consecutive weeks and median cycle time improves from the first-cycle baseline."
    },
    iteration: {
      evidence: `Expected change is ${input.changeFrequency}, stakeholder access is ${input.stakeholderAccess}, and cadence is ${input.deliveryCadence}.`,
      interpretation: "The organization can use frequent stakeholder evidence to keep delivery tied to the objective.",
      recommendation: `Use ${primary.name} to produce and review a usable outcome in each delivery cycle.`,
      action: "Define the first reviewable outcome, schedule the stakeholder review now, and record every resulting continue, change, or stop decision.",
      owner: "Product owner",
      dependency: "Named stakeholders with protected review time",
      successCriterion: "A usable outcome is reviewed in every cycle and resulting decisions are recorded within two business days."
    },
    autonomy: {
      evidence: `The team has ${input.capabilities.length || 0} selected capabilities and works in a ${input.hierarchy} organization.`,
      interpretation: "The team can move faster if solution decisions are delegated within explicit boundaries.",
      recommendation: `Implement ${primary.name} with an empowered cross-functional team and named escalation boundaries.`,
      action: "Document which scope, design, and sequencing decisions the team can make without escalation, then staff any missing capability.",
      owner: "Functional leaders",
      dependency: "Stable team allocation and sponsor delegation",
      successCriterion: "At least 90% of day-to-day delivery decisions are resolved within the team boundary during the first two cycles."
    },
    deadline: {
      evidence: `Deadline posture is ${input.urgency} and the target is ${input.deadline || input.window}.`,
      interpretation: "The objective requires early visibility into the few milestones and decisions that can move the finish date.",
      recommendation: `Use ${primary.name} with explicit milestone buffers and early escalation of critical-path changes.`,
      action: "Identify the critical milestones, assign a forecast buffer, and review blocker age and buffer consumption each week.",
      owner: "Project manager",
      dependency: "Credible milestone estimates and dependency commitments",
      successCriterion: "No unresolved critical blocker is older than five business days and every milestone forecast includes current buffer status."
    },
    resource: {
      evidence: `Budget disclosure is ${input.budgetDisclosure}, budget flexibility is ${input.budgetFlexibility}, and ${input.availablePersonnel || input.teamSize} people are identified as available.`,
      interpretation: "Parallel work and context switching can consume scarce budget and specialist capacity without advancing the objective.",
      recommendation: `Use ${primary.name} to cap concurrent work and protect the people whose capacity constrains delivery.`,
      action: "Set a portfolio-level concurrency limit, reserve specialist capacity, and stop or defer work that does not materially advance the objective.",
      owner: "Project manager and resource managers",
      dependency: "Visible allocation data and authority to defer competing work",
      successCriterion: "Concurrent work stays within the agreed capacity limit and no critical role is allocated above its committed availability."
    },
    discovery: {
      evidence: `Scope certainty is ${input.scopeCertainty}; discovery capability is ${input.capabilities.includes("discovery") ? "available" : "not selected"}.`,
      interpretation: "The objective depends on learning which solution is valuable and feasible before scaling execution.",
      recommendation: `Begin ${primary.name} with a bounded discovery cycle tied directly to the stated objective.`,
      action: "Define the highest-risk user, process, and technical assumptions and run the smallest tests that can change the delivery decision.",
      owner: "Product owner and discovery lead",
      dependency: "User access, representative data, and technical prototyping support",
      successCriterion: "Each high-risk assumption has evidence and a continue, change, or stop decision before full implementation begins."
    },
    dependencies: {
      evidence: `Dependency load is ${input.dependencyLevel} in a ${input.hierarchy} organization.`,
      interpretation: "The objective can be missed through cross-team waiting even if each workstream reports local progress.",
      recommendation: `Operate ${primary.name} with one cross-team dependency map and joint integration checkpoints.`,
      action: "List every critical dependency, name both sides of the handoff, set a needed-by date, and review unresolved dependencies weekly.",
      owner: "Project manager and workstream leads",
      dependency: "Participation from external teams and vendors",
      successCriterion: "Every critical dependency has an owner and needed-by date, with zero newly discovered critical dependencies at milestone review."
    }
  };
  const detail = definitions[signal.key] || definitions.dependencies;
  return {
    objectiveImpact: `Material: ${signal.label} directly affects the probability, cost, speed, or effort required to achieve the stated objective.`,
    ...detail
  };
}

function buildTraceableRecommendations(primary, input, factors) {
  return topSignals(factors).slice(0, 3).map((signal, index) => ({
    id: `recommendation-${index + 1}`,
    ...recommendationForSignal(signal, primary, input)
  }));
}

function buildExecutionPlan(primary, input) {
  return {
    objective: input.objectives,
    framework: primary.name,
    cadence: primary.blueprint.cadence,
    launchSequence: [
      { window: "Days 1–5", outcome: "Confirm the objective, success measures, decision rights, and non-negotiable boundaries.", owner: "Executive sponsor and project manager" },
      { window: "Days 6–10", outcome: "Map workstreams, dependencies, risks, available capacity, and the first reviewable outcome.", owner: "Project manager and workstream leads" },
      { window: "Days 11–20", outcome: `Launch the first ${primary.name} delivery cycle and collect evidence against the stated objective.`, owner: "Delivery team" },
      { window: "Days 21–30", outcome: "Review evidence, resolve contradictions, adapt the plan, and approve the next bounded commitment.", owner: "Product owner and sponsor" }
    ]
  };
}

function buildQuarterlyPlan(primary, input) {
  if (!input.quarterlyPlanningAuthorized) return null;
  return {
    authorized: true,
    horizon: "90 days",
    purpose: "Quarterly planning and planning-cycle recommendations",
    cycles: [
      { window: "Days 1–30", focus: "Validate the objective, establish the operating model, resolve the highest-risk assumptions, and baseline delivery evidence.", decision: "Continue, reshape, or stop the initial approach." },
      { window: "Days 31–60", focus: `Scale the strongest evidence-backed work through ${primary.name} while controlling dependencies and work in progress.`, decision: "Reallocate capacity toward the work with the clearest objective impact." },
      { window: "Days 61–90", focus: "Complete the quarter's bounded outcome, measure objective movement, and prepare the next planning-cycle recommendation.", decision: "Fund, adapt, defer, or end the next-quarter work based on evidence." }
    ]
  };
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
    input.budgetDisclosure === "none" || input.budget > 0, Boolean(input.deadline || input.window), input.objectives.length >= 20,
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
  const generatedAt = new Date().toISOString();
  const organizationAnalysis = buildOrganizationAnalysis(input, factors);
  const traceableRecommendations = buildTraceableRecommendations(primary, input, factors);
  const executionPlan = buildExecutionPlan(primary, input);
  const quarterlyPlan = buildQuarterlyPlan(primary, input);

  return {
    version: "project-compass-v2",
    generatedAt,
    notice: "This is a decision-support recommendation based on the information supplied. It is not an objective truth, guarantee, or substitute for project leadership judgment.",
    authorization: {
      consentVersion: CONSENT_VERSION,
      grantedAt: generatedAt,
      policyOwner: AUTHORIZATION_POLICY_OWNER,
      submittedBy: { name: input.submitterName, workEmail: input.submitterWorkEmail, authorityRole: input.authorityRole },
      selectedPurposes: [
        "recommendations-plans-delivery-frameworks",
        ...(input.quarterlyPlanningAuthorized ? ["quarterly-planning"] : [])
      ],
      requiredCompanyUse: {
        granted: true,
        scope: "Use the supplied company and project information only to develop recommendations, plans, and delivery frameworks for the company."
      },
      quarterlyPlanning: {
        granted: input.quarterlyPlanningAuthorized,
        scope: "Quarterly planning and planning-cycle recommendations."
      },
      confidentialInformation: {
        declared: input.confidentialInfoIncluded,
        authorized: input.confidentialInfoIncluded ? input.confidentialInfoAuthorized : false,
        approvedBy: input.confidentialInfoIncluded ? { name: input.highRiskApproverName, authorityRole: input.highRiskApproverRole } : null,
        categories: input.confidentialInfoIncluded ? input.highRiskCategories : [],
        informedRiskOverrideAccepted: input.confidentialInfoIncluded ? input.highRiskOverrideAccepted : false,
        disclaimer: "The override records informed choice and does not waive liability, change legal classification, or displace applicable law or organizational obligations."
      },
      purposeLimitation: "These grants do not permit unrelated uses, disclosure, or secondary processing beyond the selected purposes and apply only to information the submitter is permitted to provide."
    },
    accountability: {
      decisionOwner: { name: input.decisionOwnerName, role: input.decisionOwnerRole },
      responsibility: "This named human owns validation, interpretation, and the decision to act on the brief, including any optional AI-authored narrative.",
      aiBoundary: "AI output is advisory and cannot approve, authorize, or execute an action."
    },
    project: {
      name: projectLabel,
      budget: { disclosure: input.budgetDisclosure, amount: input.budgetDisclosure === "none" ? null : input.budget, currency: input.currency, period: input.budgetPeriod, flexibility: input.budgetFlexibility },
      deadline: input.deadline || null,
      completionWindow: input.window,
      teamSize: input.teamSize,
      workforce: { totalEmployees: input.totalEmployees || null, availablePersonnel: input.availablePersonnel || null, hiringConstraints: input.hiringConstraints || null }
    },
    organizationAnalysis,
    traceableRecommendations,
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
    executionPlan,
    quarterlyPlan,
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
