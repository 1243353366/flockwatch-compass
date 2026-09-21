# Changelog

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
