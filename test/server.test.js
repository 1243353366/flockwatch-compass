import test from "node:test";
import assert from "node:assert/strict";
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

const input = {
  projectName: "Onboarding redesign",
  budget: 175000,
  currency: "USD",
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
  distribution: "hybrid",
  stakeholderAccess: "high",
  dependencyLevel: "high",
  interruptionLevel: "medium",
  preference: "none",
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
  });
});

test("home page serves the Project Compass experience", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(baseUrl);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /Project Compass/);
    assert.match(html, /Decision support, not objective truth/);
  });
});

test("recommendation endpoint returns the complete decision brief", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/recommend`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.mode, "transparent-model");
    assert.ok(data.recommendation.fitScore > 0);
    assert.equal(data.alternatives.length, 3);
  });
});

test("recommendation endpoint returns field-level validation errors", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/recommend`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    const data = await response.json();
    assert.equal(response.status, 422);
    assert.ok(data.fields.budget);
    assert.ok(data.fields.objectives);
  });
});
