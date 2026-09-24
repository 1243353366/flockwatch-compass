# Project Compass

**Project Compass** is a Render-hosted decision-support tool that helps project managers decide **how a project should run**. It analyzes purpose-authorized company context, identifies opportunities and problems that materially affect the stated objective, compares seven delivery approaches, and turns recommendations into executable plans and delivery frameworks.

Every recommendation preserves an auditable **Evidence → Interpretation → Recommendation → Action → Owner → Dependency → Success criterion** chain. The product does not present recommendations as objective truth, promise savings, or perform external actions. The project manager remains accountable for the decision.

## What changed in version 2

The repository has been fully repurposed from its previous corpus-analysis and Cloudflare Worker implementation. The Cloudflare runtime, bindings, database schema, and deployment workflow have been removed. Version 2 runs as a portable Node.js service on Render and can also be packaged with Docker. Queue dependencies are isolated to the staged private worker path.

## Product capabilities

Project Compass collects a structured decision brief across five steps:

1. **Project basics:** optional, approximate, or exact budget; budget period and flexibility; deadline or completion window; urgency; and project objective.
2. **Goals and structure:** company goals, department goals, team goals, organizational hierarchy, approval load, and non-negotiable outcomes.
3. **Delivery realities:** scope certainty, expected change, desired cadence, compliance burden, and known constraints.
4. **Team and capabilities:** total employees, relevant team size, available personnel, hiring constraints, distribution, stakeholder access, dependency load, interruptions, skills, and optional preferences.
5. **Review and authorization:** a human-readable summary, named submitter with an allowed authority role, named accountable decision owner, separate quarterly scope, and a conditional high-risk information override with a named approver.

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

Accepts the assessment payload after the browser obtains a one-time grant from `GET /api/request-token`. Requests require the origin-bound binding cookie, `X-Request-Token`, a fresh `X-Request-Timestamp`, and a unique `X-Idempotency-Key`. Successful responses include:

- the primary method, fit score, and directional confidence;
- rationale and decision factors;
- strengths, watchouts, and context-specific tailoring;
- directional leverage across time, money, human effort, and operational friction;
- objective-impact opportunities and problems;
- three traceable recommendations with evidence, interpretation, action, owner, dependency, and success criterion;
- a first-30-days execution plan and delivery framework;
- a 90-day plan only when quarterly planning is separately authorized;
- three alternatives with selection tradeoffs;
- optional AI-generated interpretation when configured.

The payload must include `dataUseAuthorized: true`, the authorized submitter's name and work email, an allowed authority role, and a named human decision owner. Quarterly planning is a separate scope. **Training and retention are not features in this release:** there is no training consent, training pipeline, or later-use retention path. Confidential or high-risk information also requires selected categories, a named approver with an allowed role, authority confirmation, and an accepted versioned informed-risk override. The endpoint refuses requests that omit those server-validated records, exceed the granted purpose, or request denied capabilities.

### `GET /api/methodologies`

Returns the seven methodology profiles and their public references.

### `GET /health`

Reports the Node runtime, recommendation-engine version, optional AI configuration state, and stateless storage mode. It never returns API keys.

## Privacy and data handling

The production service is hosted on Render and has **no application database and no account system**. Assessment drafts are saved in the user’s browser with `localStorage` so a page refresh does not destroy in-progress work. The authorization checkbox is not saved in the browser draft and must be reconfirmed after a refresh or new session. The user can clear the rest of the draft from the interface.

A completed assessment is posted to the Render-hosted Node service only after the submitter confirms they are authorized to share the company information and permits Project Compass to use it only for recommendations, plans, and delivery frameworks for that company. The authorization does not permit unrelated use, disclosure, or secondary processing. The baseline engine processes the brief in memory and does not persist it. When optional AI mode is enabled, the authorized assessment and baseline recommendation are sent to the configured OpenAI-compatible provider for the same stated purposes; that provider’s data terms then apply.

The application includes a strict Content Security Policy, denies framing, disables browser access to camera, microphone, geolocation, and payments, and avoids third-party frontend scripts.

## Security and worker architecture

The application uses a deny-by-default capability policy outside the reasoning layer. The PM can read authorized project data, analyze evidence, generate recommendations, plans, and frameworks, inspect permitted task state, and recommend deployment work. It cannot execute a shell, read credentials, deploy production, access arbitrary networks, cross tenants, delegate capabilities, escalate privileges, or perform external actions.

The public gateway enforces one-time request tokens, strict origins, replay timestamps, idempotency keys, body limits, burst and minute rate limits, and global concurrency controls. Optional AI work is isolated behind a bounded local queue and is disabled in production. A free private Render Key Value queue has been provisioned; a dedicated paid Background Worker is staged in `render-worker.yaml` but is not activated because it would create a charge. See `THREAT-MODEL.md` and `ARCHITECTURE-MAP.md` for the full boundary and production gates.

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

The verification command checks JavaScript syntax and runs Node’s native test suite. Tests cover method fit, objective-impact traceability, separate consent scopes, high-risk overrides, origin checks, one-time-token replay, denied capabilities, and static delivery.

## Repository structure

```text
public/
  index.html                 Multi-step assessment and decision brief
  styles.css                 Responsive visual system
  app.js                     Browser state, validation, rendering, and export
src/
  recommendation-engine.js   Objective analysis, scoring, traceability, and plans
  capability-policy.js       Deny-by-default non-transitive capability grants
  server.js                  Secure public gateway and bounded AI queue
worker/
  index.js                   Private Render planning worker entry point
test/
  capability-policy.test.js
  recommendation-engine.test.js
  server.test.js
THREAT-MODEL.md
ARCHITECTURE-MAP.md
render-worker.yaml           Staged paid worker definition
Dockerfile
compose.yaml
.env.example
```

## Method references

The method profiles are grounded in primary or authoritative guidance, while the final choice remains context-dependent. Scrum is framed as an empirical framework for complex work.[1] Kanban is framed as a flow-management method that relies on explicit workflow policies and work-in-progress limits.[2] Predictive and hybrid approaches are treated as different life-cycle strategies rather than maturity levels.[3] [4] Critical Chain emphasizes resource-aware sequencing and buffer management.[5] Shape Up uses shaped bets, fixed appetite, variable scope, and protected cycles.[6] Scrumban combines selected Scrum cadences with Kanban flow controls.[7]

## License and use

Project Compass is proprietary software under the **Project Compass Proprietary Internal-Use License** in `LICENSE`. Authorized internal employees and contractors may use it only for the designated organization's approved internal operations, security review, and maintenance. Distribution, personal forks, third-party hosting, commercialization, and model-training use require separate written authorization from the copyright owner.

## References

[1]: https://scrumguides.org/scrum-guide.html "The 2020 Scrum Guide"
[2]: https://kanban.university/kanban-guide/ "The Official Guide to the Kanban Method"
[3]: https://www.pmi.org/about/what-is-project-management "Project Management Approaches"
[4]: https://www.pmi.org/disciplined-agile/serial/hybridlifecycles "Hybrid Life Cycles"
[5]: https://www.pmi.org/learning/library/critical-chain-project-management-investigation-6380 "Critical Chain Project Management: Under Investigation or Case Closed?"
[6]: https://basecamp.com/shapeup "Shape Up: Stop Running in Circles and Ship Work that Matters"
[7]: https://www.scrum.org/resources/kanban-guide-scrum-teams "The Kanban Guide for Scrum Teams"
