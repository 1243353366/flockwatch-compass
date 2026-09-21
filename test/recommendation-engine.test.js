import test from "node:test";
import assert from "node:assert/strict";
import { CONSENT_VERSION, methodologyCatalog, recommendProject } from "../src/recommendation-engine.js";

const base = {
  projectName: "Test project",
  budget: 250000,
  currency: "USD",
  budgetDisclosure: "approximate",
  budgetPeriod: "project",
  budgetFlexibility: "fixed",
  window: "3-6-months",
  urgency: "target",
  objectives: "Deliver a useful customer outcome while controlling project risk.",
  companyGoals: "Improve profitable customer growth.",
  departmentGoals: "Ship a sustainable service improvement.",
  teamGoals: "Reduce coordination overhead and own measurable outcomes.",
  constraints: "Existing systems must remain available.",
  hierarchy: "functional",
  approvalLoad: "medium",
  scopeCertainty: "medium",
  changeFrequency: "medium",
  deliveryCadence: "milestones",
  compliance: "medium",
  teamSize: 6,
  totalEmployees: 120,
  availablePersonnel: 5,
  hiringConstraints: "No additional hiring during the planning cycle.",
  distribution: "hybrid",
  stakeholderAccess: "medium",
  dependencyLevel: "medium",
  interruptionLevel: "medium",
  preference: "none",
  dataUseAuthorized: true,
  capabilities: ["cross-functional", "dedicated"]
};

test("catalog exposes seven distinct decision options", () => {
  const catalog = methodologyCatalog();
  assert.equal(catalog.length, 7);
  assert.equal(new Set(catalog.map((item) => item.id)).size, 7);
  assert.ok(catalog.every((item) => item.source.url.startsWith("https://")));
});

test("uncertain product work favors an adaptive approach", () => {
  const result = recommendProject({
    ...base,
    scopeCertainty: "low",
    changeFrequency: "high",
    stakeholderAccess: "high",
    deliveryCadence: "biweekly",
    compliance: "low",
    interruptionLevel: "low",
    capabilities: ["cross-functional", "dedicated", "agile-experience", "discovery"]
  });
  assert.ok(["scrum", "shape-up", "scrumban"].includes(result.recommendation.methodId));
  assert.match(result.notice, /decision-support recommendation/i);
});

test("stable regulated work favors predictive or governed hybrid delivery", () => {
  const result = recommendProject({
    ...base,
    scopeCertainty: "high",
    changeFrequency: "low",
    compliance: "high",
    approvalLoad: "high",
    hierarchy: "hierarchical",
    dependencyLevel: "high",
    deliveryCadence: "one-time",
    capabilities: ["estimation", "specialists"]
  });
  assert.ok(["predictive", "hybrid", "ccpm"].includes(result.recommendation.methodId));
});

test("interrupt-driven continuous work favors flow-based delivery", () => {
  const result = recommendProject({
    ...base,
    scopeCertainty: "medium",
    changeFrequency: "high",
    deliveryCadence: "continuous",
    interruptionLevel: "high",
    compliance: "low",
    dependencyLevel: "low",
    preference: "flow"
  });
  assert.ok(["kanban", "scrumban"].includes(result.recommendation.methodId));
});

test("every recommendation has the required evidence-to-success chain", () => {
  const result = recommendProject(base);
  const required = ["evidence", "interpretation", "recommendation", "action", "owner", "dependency", "successCriterion"];
  assert.equal(result.traceableRecommendations.length, 3);
  assert.ok(result.traceableRecommendations.every((item) => required.every((field) => typeof item[field] === "string" && item[field].length > 10)));
  assert.match(result.organizationAnalysis.question, /materially affect/i);
  assert.equal(result.executionPlan.launchSequence.length, 4);
});

test("quarterly planning is generated only with separate authorization", () => {
  assert.equal(recommendProject(base).quarterlyPlan, null);
  const authorized = recommendProject({ ...base, quarterlyPlanningAuthorized: true });
  assert.equal(authorized.quarterlyPlan.horizon, "90 days");
  assert.equal(authorized.authorization.quarterlyPlanning.granted, true);
});

test("training consent is recorded but training remains disabled", () => {
  const result = recommendProject({ ...base, trainingUseAuthorized: true });
  assert.equal(result.authorization.training.requested, true);
  assert.equal(result.authorization.training.enabled, false);
  assert.match(result.authorization.training.status, /disabled/i);
});

test("accepted high-risk information produces a versioned audit record", () => {
  const result = recommendProject({
    ...base,
    confidentialInfoIncluded: true,
    confidentialInfoAuthorized: true,
    highRiskOverrideAccepted: true,
    highRiskCategories: ["confidential", "trade-secret"]
  });
  assert.equal(result.authorization.consentVersion, CONSENT_VERSION);
  assert.deepEqual(result.authorization.confidentialInformation.categories, ["confidential", "trade-secret"]);
  assert.equal(result.authorization.confidentialInformation.informedRiskOverrideAccepted, true);
  assert.match(result.authorization.confidentialInformation.disclaimer, /does not waive liability/i);
});

test("validation rejects an incomplete decision brief", () => {
  assert.throws(
    () => recommendProject({ ...base, budget: 0, objectives: "Too short" }),
    (error) => error.code === "VALIDATION_ERROR" && Boolean(error.fields.budget) && Boolean(error.fields.objectives)
  );
});

test("no-budget disclosure is allowed without a budget value", () => {
  const result = recommendProject({ ...base, budgetDisclosure: "none", budget: 0 });
  assert.equal(result.project.budget.amount, null);
});

test("validation refuses company-data processing without explicit authorization", () => {
  assert.throws(
    () => recommendProject({ ...base, dataUseAuthorized: false }),
    (error) => error.code === "VALIDATION_ERROR" && Boolean(error.fields.dataUseAuthorized)
  );
});

test("high-risk data is refused without categories, authority, and informed override", () => {
  assert.throws(
    () => recommendProject({ ...base, confidentialInfoIncluded: true }),
    (error) => error.code === "VALIDATION_ERROR" && Boolean(error.fields.highRiskCategories) && Boolean(error.fields.confidentialInfoAuthorized) && Boolean(error.fields.highRiskOverrideAccepted)
  );
});
