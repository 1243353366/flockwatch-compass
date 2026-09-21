# Project Compass Architecture

## Overview

Project Compass is the **business intelligence and project-management layer**. It accepts purpose-authorized company context, tests whether the information materially affects the stated objective, identifies opportunities and problems, recommends a delivery approach, and turns the recommendation into an executable plan and framework. It does not treat the recommendation as objective truth and does not execute external actions.

```text
Browser
  ├─ browser-local draft (consent is never persisted)
  ├─ explicit purpose and high-risk information gates
  └─ one-time request token + timestamp + idempotency key
          │
          ▼
Public Render gateway
  ├─ origin, replay, size, burst, and concurrency controls
  ├─ consent and purpose policy
  ├─ deny-by-default capability policy
  ├─ input validation
  └─ transparent planning engine
          │
          ├─ current: bounded local AI queue (AI disabled in production)
          │
          └─ staged target: private Render Key Value queue
                              │
                              ▼
                     Background Worker
                     ├─ no HTTP listener
                     ├─ bounded concurrency
                     ├─ same capability policy
                     └─ planning task only
```

## Capability boundary

The capability policy in `src/capability-policy.js` is enforced by the server and worker, outside the reasoning layer. **Default is deny.** Grants are request-scoped and non-transitive.

| Capability | PM policy |
| --- | --- |
| Read authorized project data | Allow |
| Analyze evidence | Allow |
| Generate recommendations | Allow |
| Generate plans and delivery frameworks | Allow |
| Inspect permitted task state | Allow |
| Recommend a deployment plan | Allow |
| Execute a shell or spawn processes | Deny |
| Read credentials | Deny |
| Perform production deployment | Deny |
| Access arbitrary networks | Deny |
| Access another tenant | Deny |
| Delegate capabilities or escalate privileges | Deny |
| Perform external actions | Deny |

The PM may state that an action would be useful. That does not grant the capability to perform it. A claim that an administrator approved an action is not an authorization record.

## Consent boundary

The required grant covers only recommendations, plans, and delivery frameworks for the company. The server requires an attributable submitter name, work email, and allowed authority role, plus a named human decision owner. Quarterly planning is a separate optional scope. Training and retention are not implemented and cannot be authorized in this release. Confidential or high-risk information requires category selection, a named approver with an allowed role, authority confirmation, and acceptance of a versioned informed-risk override. The override is not a liability waiver and does not change applicable law or the information's classification.

## Evidence boundary

A future **Corpora evidence subsystem** may retrieve external claims, provenance, confidence, contradiction, and source-reliability data. It remains separate from Project Compass. Fraud-related data is modeled as a verification signal, never an unsupported verdict. Project Compass may use a signal only when it materially affects the stated objective.

Every generated recommendation carries the complete chain:

> **Evidence → Interpretation → Recommendation → Action → Owner → Dependency → Success criterion**

## Abuse-defense boundary

The current gateway uses a 64 KB body limit, mandatory JSON, strict origin checks, a `SameSite=Strict` binding cookie, a one-time token, a two-minute request timestamp, a unique idempotency key, per-IP minute and burst limits, a global recommendation concurrency cap, and a downstream AI queue circuit breaker. These controls are progressive and reversible. No account or permanent-ban system exists.

A production multi-tenant version must add an upstream CDN/WAF, per-account and per-API-key quotas, shared replay state, reversible anomaly quarantine, row-level tenant authorization, and audit retention before accounts or customer storage are enabled.

## Render deployment

The public application runs on Render at `https://project-compass-advisor.onrender.com`. A free, private Render Key Value instance named `project-compass-queue` has been provisioned with persistence disabled. The paid Background Worker definition is staged in `render-worker.yaml` but is not activated because Render does not offer a free worker plan and task compute would create a charge. The current release therefore retains a bounded local queue as its safe fallback.

## Canonical files

| File | Responsibility |
| --- | --- |
| `src/server.js` | Public gateway, token and replay controls, rate limits, static assets, APIs, bounded AI queue |
| `src/capability-policy.js` | Deny-by-default, non-transitive PM capability policy |
| `src/recommendation-engine.js` | Authorization validation, objective-impact analysis, method comparison, traceable recommendations, execution and quarterly plans |
| `worker/index.js` | Private queue worker with no HTTP listener |
| `public/index.html` | Intake, consent, warnings, analysis, and plan semantics |
| `public/app.js` | Browser-local state, secure submission, validation, rendering, export |
| `THREAT-MODEL.md` | Adversarial assumptions, controls, residual risks, and production gates |
| `render-worker.yaml` | Staged paid worker definition; not connected automatically |
| `test/*.test.js` | Decision, consent, replay, origin, and capability-policy verification |
