import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { requestListener } from "../src/server.js";

process.env.AI_MODE = "off";

async function withServer(run) {
  const server = createServer(requestListener);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

async function requestGrant(baseUrl) {
  const response = await fetch(`${baseUrl}/api/request-token`, { headers: { origin: baseUrl } });
  const data = await response.json();
  const cookie = String(response.headers.get("set-cookie") || "").split(";")[0];
  return { response, data, cookie };
}

async function securePost(baseUrl, body, grant = null) {
  const activeGrant = grant || await requestGrant(baseUrl);
  return fetch(`${baseUrl}/api/recommend`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
      cookie: activeGrant.cookie,
      "x-request-token": activeGrant.data.token,
      "x-request-timestamp": String(Date.now()),
      "x-idempotency-key": randomUUID()
    },
    body: JSON.stringify(body)
  });
}

const input = {
  projectName: "Onboarding redesign",
  budget: 175000,
  currency: "USD",
  budgetDisclosure: "approximate",
  budgetPeriod: "project",
  budgetFlexibility: "fixed",
  window: "3-6-months",
  urgency: "firm",
  objectives: "Reduce customer onboarding time without increasing support demand.",
  companyGoals: "Improve time to revenue and retention.",
  departmentGoals: "Automate onboarding while maintaining service quality.",
  teamGoals: "Create a maintainable workflow with clear ownership.",
  constraints: "Integrate with the existing billing system.",
  hierarchy: "matrix",
  approvalLoad: "medium",
  scopeCertainty: "medium",
  changeFrequency: "high",
  deliveryCadence: "biweekly",
  compliance: "medium",
  teamSize: 8,
  totalEmployees: 400,
  availablePersonnel: 6,
  hiringConstraints: "No new hires this quarter.",
  distribution: "hybrid",
  stakeholderAccess: "high",
  dependencyLevel: "high",
  interruptionLevel: "medium",
  preference: "none",
  dataUseAuthorized: true,
  submitterName: "Jordan Lee",
  submitterWorkEmail: "jordan.lee@example.com",
  authorityRole: "project-owner",
  decisionOwnerName: "Morgan Chen",
  decisionOwnerRole: "VP, Operations",
  quarterlyPlanningAuthorized: true,
  capabilities: ["cross-functional", "dedicated", "agile-experience"]
};

test("health reports a self-hosted stateless runtime", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.runtime, "self-hosted-node");
    assert.equal(data.storage, "stateless");
    assert.equal(data.aiAssist.configured, false);
    assert.equal(data.authorizationPolicy.attributableRolesRequired, true);
    assert.equal(data.authorizationPolicy.trainingAndRetentionAvailable, false);
    assert.ok(response.headers.get("x-request-id"));
  });
});

test("home page serves consent and informed-risk controls", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(baseUrl);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /Decision support, not objective truth/);
    assert.match(html, /High-risk information override/);
    assert.match(html, /not a liability waiver/i);
  });
});

test("recommendation endpoint returns the complete objective-linked decision brief", async () => {
  await withServer(async (baseUrl) => {
    const response = await securePost(baseUrl, input);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.mode, "transparent-model");
    assert.ok(data.recommendation.fitScore > 0);
    assert.equal(data.alternatives.length, 3);
    assert.equal(data.authorization.requiredCompanyUse.granted, true);
    assert.equal(data.authorization.submittedBy.authorityRole, "project-owner");
    assert.equal(data.accountability.decisionOwner.name, "Morgan Chen");
    assert.equal("training" in data.authorization, false);
    assert.equal(data.authorization.quarterlyPlanning.granted, true);
    assert.equal(data.traceableRecommendations.length, 3);
    assert.equal(data.quarterlyPlan.horizon, "90 days");
  });
});

test("recommendation endpoint refuses company data without explicit authorization", async () => {
  await withServer(async (baseUrl) => {
    const response = await securePost(baseUrl, { ...input, dataUseAuthorized: false });
    const data = await response.json();
    assert.equal(response.status, 422);
    assert.ok(data.fields.dataUseAuthorized);
  });
});

test("recommendation endpoint refuses authorization when no allowed role is attached", async () => {
  await withServer(async (baseUrl) => {
    const response = await securePost(baseUrl, { ...input, authorityRole: "" });
    const data = await response.json();
    assert.equal(response.status, 422);
    assert.ok(data.fields.authorityRole);
  });
});

test("recommendation endpoint rejects attempted training authorization", async () => {
  await withServer(async (baseUrl) => {
    const response = await securePost(baseUrl, { ...input, trainingUseAuthorized: true });
    const data = await response.json();
    assert.equal(response.status, 422);
    assert.ok(data.fields.trainingUseAuthorized);
  });
});

test("high-risk data requires categories, authority, and an informed-risk override", async () => {
  await withServer(async (baseUrl) => {
    const response = await securePost(baseUrl, { ...input, confidentialInfoIncluded: true });
    const data = await response.json();
    assert.equal(response.status, 422);
    assert.ok(data.fields.highRiskCategories);
    assert.ok(data.fields.confidentialInfoAuthorized);
    assert.ok(data.fields.highRiskApproverName);
    assert.ok(data.fields.highRiskApproverRole);
    assert.ok(data.fields.highRiskOverrideAccepted);
  });
});

test("recommendation endpoint requires a one-time request token", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/recommend`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, "x-idempotency-key": randomUUID() },
      body: JSON.stringify(input)
    });
    assert.equal(response.status, 403);
  });
});

test("a request token cannot be replayed", async () => {
  await withServer(async (baseUrl) => {
    const grant = await requestGrant(baseUrl);
    const first = await securePost(baseUrl, input, grant);
    const replay = await securePost(baseUrl, input, grant);
    assert.equal(first.status, 200);
    assert.equal(replay.status, 403);
  });
});

test("cross-origin token requests are rejected", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/request-token`, { headers: { origin: "https://evil.example" } });
    assert.equal(response.status, 403);
  });
});

test("dangerous capabilities are denied outside the reasoning layer", async () => {
  await withServer(async (baseUrl) => {
    const response = await securePost(baseUrl, { ...input, requestedCapabilities: ["host.shell", "credential.read", "production.deploy"] });
    const data = await response.json();
    assert.equal(response.status, 403);
    assert.deepEqual(data.deniedCapabilities, ["host.shell", "credential.read", "production.deploy"]);
  });
});

test("recommendation endpoint returns field-level validation errors", async () => {
  await withServer(async (baseUrl) => {
    const response = await securePost(baseUrl, {});
    const data = await response.json();
    assert.equal(response.status, 422);
    assert.ok(data.fields.budget);
    assert.ok(data.fields.objectives);
  });
});
