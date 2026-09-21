import test from "node:test";
import assert from "node:assert/strict";
import { methodologyCatalog, recommendProject } from "../src/recommendation-engine.js";

const base = {
  projectName: "Test project",
  budget: 250000,
  currency: "USD",
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
  distribution: "hybrid",
  stakeholderAccess: "medium",
  dependencyLevel: "medium",
  interruptionLevel: "medium",
  preference: "none",
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

test("recommendation returns alternatives, tradeoffs, and a startup blueprint", () => {
  const result = recommendProject(base);
  assert.equal(result.alternatives.length, 3);
  assert.ok(result.recommendation.tradeoffs.strengths.length >= 2);
  assert.ok(result.recommendation.tradeoffs.watchouts.length >= 2);
  assert.ok(result.recommendation.blueprint.practices.length >= 3);
  assert.ok(result.recommendation.impact.every((item) => item.score >= 1 && item.score <= 5));
});

test("validation rejects an incomplete decision brief", () => {
  assert.throws(
    () => recommendProject({ ...base, budget: 0, objectives: "Too short" }),
    (error) => error.code === "VALIDATION_ERROR" && Boolean(error.fields.budget) && Boolean(error.fields.objectives)
  );
});
