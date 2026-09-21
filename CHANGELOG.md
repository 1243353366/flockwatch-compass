# Changelog

## 2.1.0 — Objective-linked planning and adversarial security

Project Compass now analyzes whether authorized information materially affects the organization's stated objective, identifies opportunities and problems, and returns three recommendations with a complete **Evidence → Interpretation → Recommendation → Action → Owner → Dependency → Success criterion** chain. It adds an executable first-30-days plan and separately authorized 90-day planning cycle.

Authorization is divided into required company use, optional quarterly planning, optional training request, and conditional confidential-information gates. Training remains disabled. High-risk submissions require category selection, authority confirmation, and a versioned informed-risk override that explicitly is not a liability waiver.

The public gateway now enforces origin-bound one-time tokens, request timestamps, idempotency keys, burst and minute limits, concurrency caps, strict JSON and body limits, and hardened response headers. A deny-by-default, non-transitive capability policy prevents shell, credential, deployment, arbitrary-network, cross-tenant, delegation, and privilege-escalation access outside the reasoning layer. Optional AI is isolated behind a bounded local queue and treats company input as untrusted data.

A free private Render Key Value queue is provisioned. A no-HTTP background planning worker and its paid Render Blueprint are staged but intentionally not activated because worker compute would create a charge.

## 2.0.1 — Explicit company-data authorization

Project Compass now requires the submitter to confirm they are authorized to share the company and project information and explicitly permit its use only for recommendations, plans, and delivery frameworks for that company. The authorization does not permit unrelated use, disclosure, or secondary processing and applies only to information the submitter is permitted to provide. The browser does not store this authorization in the saved draft, and the API rejects any recommendation request that does not contain the explicit grant. The production disclosure identifies Render as the host and preserves the stateless, no-application-database boundary.

## 2.0.0 — Project Compass

The repository was repurposed into a self-hosted project delivery methodology decision-support product.

### Added

- A five-step assessment covering budget, timeline, goals, organizational structure, delivery constraints, team size, and team capabilities.
- A transparent comparison engine for Scrum, Kanban, Predictive delivery, Predictive–Agile Hybrid, Critical Chain, Shape Up, and Scrumban.
- Rationale, tradeoffs, alternatives, directional impact, confidence, decision factors, and a practical operating blueprint.
- Optional OpenAI-compatible narrative assistance that cannot silently replace the baseline ranking.
- Browser-local draft saving, JSON export, print layout, responsive design, and dark mode.
- A dependency-free Node.js server, Dockerfile, Compose configuration, health endpoint, and automated tests.

### Removed

- Cloudflare Worker, Wrangler, Workers AI, D1, and Cloudflare deployment configuration.
- The previous corpus-analysis, cybersecurity, research-browser, collector, EDR, simulation, and privacy-lab surfaces.

### Changed

- Product identity from Corpora AI to Project Compass.
- Default runtime from Node 24 plus Cloudflare bindings to portable Node 20+ self-hosting.
- Continuous integration now verifies the portable Node application instead of deploying to Cloudflare.
