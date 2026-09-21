# Project Compass Architecture

## Overview

Project Compass is a dependency-free, self-hosted Node.js application. The browser presents a five-step project assessment. The server validates the submission, runs a transparent methodology comparison, and returns a decision brief. An optional OpenAI-compatible adapter can add narrative context without changing the baseline ranking.

```text
Browser
  ├─ browser-local draft storage
  ├─ multi-step validation
  └─ POST /api/recommend
          │
          ▼
Node HTTP server
  ├─ request limits and security headers
  ├─ field validation
  ├─ transparent scoring engine
  │     ├─ project signal derivation
  │     ├─ seven-method comparison
  │     └─ tradeoffs and operating blueprint
  └─ optional AI narrative adapter
        └─ configured OpenAI-compatible provider
```

## Trust boundaries

The browser stores the in-progress draft in `localStorage`. The Node service is stateless and does not include a database. A recommendation request is processed in memory. Optional AI mode is disabled unless the server operator explicitly sets `AI_MODE=on` and provides a key.

The deterministic engine owns the ranking. The AI adapter can only add an executive summary, a tradeoff narrative, and validation questions. A provider failure returns the baseline output instead of failing the product decision flow.

## Canonical files

| File | Responsibility |
| --- | --- |
| `src/server.js` | HTTP runtime, security headers, request limits, static assets, APIs, and optional AI adapter |
| `src/recommendation-engine.js` | Input normalization, validation, methodology profiles, ranking, confidence, tradeoffs, and blueprint |
| `public/index.html` | Assessment and decision-brief semantics |
| `public/styles.css` | Responsive visual system and print layout |
| `public/app.js` | Browser state, draft persistence, step navigation, validation, result rendering, print, and JSON export |
| `test/*.test.js` | Unit and integration verification |
| `Dockerfile` and `compose.yaml` | Portable self-host packaging |

## Deployment boundary

The repository has no Cloudflare Worker, D1, Wrangler, or platform-specific binding. It runs on any Node 20+ host or container runtime. Production deployments should place the service behind an HTTPS reverse proxy and inject optional AI credentials as server-side environment variables.
