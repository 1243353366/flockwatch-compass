# Project Compass

**Project Compass** is a self-hosted decision-support tool that helps project managers decide **how a project should run**. It compares the project’s budget, deadline, organizational structure, goals, uncertainty, constraints, dependencies, and team capabilities against seven distinct delivery approaches.

The product returns a primary recommendation, credible alternatives, material tradeoffs, expected leverage, and a lightweight operating blueprint. It does not present the recommendation as objective truth or promise savings. The project manager remains accountable for the decision.

## What changed in version 2

The repository has been fully repurposed from its previous corpus-analysis and Cloudflare Worker implementation. The Cloudflare runtime, bindings, database schema, cybersecurity tooling, and deployment workflow have been removed. Version 2 runs as a dependency-free Node.js service and can also be packaged with Docker.

## Product capabilities

Project Compass collects a structured decision brief across five steps:

1. **Project basics:** budget, budget flexibility, deadline or completion window, urgency, and project objective.
2. **Goals and structure:** company goals, department goals, team goals, organizational hierarchy, approval load, and non-negotiable outcomes.
3. **Delivery realities:** scope certainty, expected change, desired cadence, compliance burden, and known constraints.
4. **Team and capabilities:** team size, distribution, stakeholder access, dependency load, interruptions, skills, and optional preferences.
5. **Review:** a human-readable summary before the recommendation is generated.

The engine evaluates **Scrum, Kanban, Predictive delivery, Predictive–Agile Hybrid, Critical Chain, Shape Up, and Scrumban**. These methods are intentionally different enough to expose meaningful tradeoffs rather than presenting several near-identical agile frameworks.

## Operating modes

Both modes are included in the same application. The default is fully local and deterministic.

| Approach | Tradeoffs | Cost | Setup Complexity |
| --- | --- | --- | --- |
| **Transparent self-hosted model** | Fast, inspectable, and private. The scoring logic is visible in the repository, but the explanation is template-based. | No model usage cost | Low |
| **Self-hosted model with optional AI narrative** | Keeps the transparent ranking and adds a contextual executive summary, tradeoff narrative, and validation questions. Project inputs are sent to the configured provider. | Depends on the selected provider and model | Medium |

The AI narrative does **not** silently replace the primary recommendation. If the provider is unavailable, times out, or returns unusable data, the service falls back to the transparent model.

## Quick start

Project Compass requires **Node.js 20 or newer**. Node 22 is pinned for development.

```bash
git clone https://github.com/1243353366/corpora-ai.git
cd corpora-ai
npm ci
npm start
```

Open [http://localhost:8787](http://localhost:8787). The server binds to `0.0.0.0` by default, so it can be placed behind a reverse proxy on a private network or public host.

### Development mode

```bash
npm run dev
```

The development script uses Node’s native watch mode. No bundler or frontend build step is required.

## Docker

```bash
docker compose up --build -d
```

The service will be available on port `8787`. The container runs as the non-root `node` user and exposes a health check at `GET /health`.

## Optional AI-assisted explanation

The transparent recommendation engine is always available. To enable the optional OpenAI-compatible narrative layer, provide a server-side key and explicitly set `AI_MODE=on`:

```bash
cp .env.example .env
# Edit .env, then:
set -a && . ./.env && set +a
npm start
```

Relevant variables are:

```dotenv
AI_MODE=on
AI_API_KEY=your-server-side-key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

`OPENAI_API_KEY` and `OPENAI_API_BASE` are accepted as aliases. Never put provider keys in `public/app.js`, commit them to Git, or expose them in browser configuration.

## API

### `POST /api/recommend`

Accepts the assessment payload and returns the complete decision brief. Successful responses include:

- the primary method, fit score, and directional confidence;
- rationale and decision factors;
- strengths, watchouts, and context-specific tailoring;
- directional leverage across time, money, human effort, and operational friction;
- an operating blueprint;
- three alternatives with selection tradeoffs;
- optional AI-generated interpretation when configured.

The endpoint is rate-limited in memory, accepts at most 64 KB of JSON, and returns field-level validation errors with HTTP `422`.

### `GET /api/methodologies`

Returns the seven methodology profiles and their public references.

### `GET /health`

Reports the Node runtime, recommendation-engine version, optional AI configuration state, and stateless storage mode. It never returns API keys.

## Privacy and data handling

The service has **no database and no account system**. Assessment drafts are saved in the user’s browser with `localStorage` so a page refresh does not destroy in-progress work. The user can clear that draft from the interface.

A completed assessment is posted to the self-hosted Node service only when the user selects **Generate recommendation**. The baseline engine processes it in memory and does not persist it. When optional AI mode is enabled, the assessment and baseline recommendation are sent to the configured OpenAI-compatible provider; that provider’s data terms then apply.

The application includes a strict Content Security Policy, denies framing, disables browser access to camera, microphone, geolocation, and payments, and avoids third-party frontend scripts.

## Recommendation logic

The scoring engine is located in `src/recommendation-engine.js`. It derives ten project signals:

- adaptability need;
- upfront planning need;
- governance intensity;
- continuous-flow need;
- feedback cadence;
- team autonomy;
- deadline pressure;
- resource pressure;
- discovery need;
- dependency intensity.

Each methodology defines a public operating profile across the same dimensions. The engine compares project signals with those profiles, applies a small set of explicit context rules, and ranks all seven approaches. Confidence combines input completeness with the separation between the leading methods.

These scores are **comparative heuristics**, not empirical success probabilities. They should be used to formulate and challenge a decision. They should not be used to certify compliance, forecast return on investment, or replace delivery leadership.

## Verification

```bash
npm run verify
```

The verification command checks JavaScript syntax and runs Node’s native test suite. Tests cover adaptive product work, regulated plan-driven work, interrupt-driven flow, response completeness, validation, static delivery, and the health endpoint.

## Repository structure

```text
public/
  index.html                 Multi-step assessment and decision brief
  styles.css                 Responsive visual system
  app.js                     Browser state, validation, rendering, and export
src/
  recommendation-engine.js   Transparent scoring, tradeoffs, and blueprint logic
  server.js                  Self-hosted Node HTTP server and optional AI adapter
test/
  recommendation-engine.test.js
  server.test.js
Dockerfile
compose.yaml
.env.example
```

## Method references

The method profiles are grounded in primary or authoritative guidance, while the final choice remains context-dependent. Scrum is framed as an empirical framework for complex work.[1] Kanban is framed as a flow-management method that relies on explicit workflow policies and work-in-progress limits.[2] Predictive and hybrid approaches are treated as different life-cycle strategies rather than maturity levels.[3] [4] Critical Chain emphasizes resource-aware sequencing and buffer management.[5] Shape Up uses shaped bets, fixed appetite, variable scope, and protected cycles.[6] Scrumban combines selected Scrum cadences with Kanban flow controls.[7]

## License and use

No license file was present in the source repository at the time of this repurpose. Add an explicit license before distributing modified versions outside your organization.

## References

[1]: https://scrumguides.org/scrum-guide.html "The 2020 Scrum Guide"
[2]: https://kanban.university/kanban-guide/ "The Official Guide to the Kanban Method"
[3]: https://www.pmi.org/about/what-is-project-management "Project Management Approaches"
[4]: https://www.pmi.org/disciplined-agile/serial/hybridlifecycles "Hybrid Life Cycles"
[5]: https://www.pmi.org/learning/library/critical-chain-project-management-investigation-6380 "Critical Chain Project Management: Under Investigation or Case Closed?"
[6]: https://basecamp.com/shapeup "Shape Up: Stop Running in Circles and Ship Work that Matters"
[7]: https://www.scrum.org/resources/kanban-guide-scrum-teams "The Kanban Guide for Scrum Teams"
