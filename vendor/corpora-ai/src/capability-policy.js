export const CAPABILITY_POLICY_VERSION = "project-compass-capabilities-2026-09-21-v1";

const BASE_CAPABILITIES = Object.freeze([
  "project.read",
  "evidence.analyze",
  "project.recommend",
  "plan.generate",
  "framework.generate",
  "task.read",
  "deployment.recommend",
  "result.write"
]);

const NEVER_GRANTED = Object.freeze([
  "host.shell",
  "credential.read",
  "arbitrary.network",
  "process.spawn",
  "filesystem.root",
  "production.deploy",
  "model.train",
  "data.retain",
  "capability.delegate",
  "privilege.escalate",
  "authorization.admin_claim",
  "account.admin",
  "tenant.cross_access",
  "external.action"
]);

function cleanRequested(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 32);
}

export function authorizePlanningCapabilities(input = {}) {
  const granted = [...BASE_CAPABILITIES];
  if (input.quarterlyPlanningAuthorized === true) granted.push("quarterly.plan");
  if (process.env.QUEUE_URL) granted.push("worker.submit");

  const requested = cleanRequested(input.requestedCapabilities);
  const denied = requested.filter((capability) => !granted.includes(capability));
  if (denied.length) {
    const error = new Error("One or more requested capabilities are outside this service's policy boundary.");
    error.code = "CAPABILITY_DENIED";
    error.denied = denied;
    throw error;
  }

  return {
    policyVersion: CAPABILITY_POLICY_VERSION,
    scope: "single-authorized-recommendation-request",
    granted,
    explicitlyUnavailable: NEVER_GRANTED,
    enforcement: "server-and-worker-policy-boundary"
  };
}
