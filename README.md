# Corpora AI

A single-file Cloudflare Worker intelligence engine for Aadi's Digital Lab.
Paste or query a text corpus and get AI summaries, typed entities, topics,
sentiment, key-term frequency, and readability - with an algorithmic
fallback when Workers AI is unavailable.

**For ethical research use only - a research tool.** The corpus stores
third-party upstream material (e.g. MITRE ATT&CK STIX data, ahmia-crawler,
clinical-nlp-pipeline) strictly with attribution: each record keeps its
upstream project, repository URL, license, and author information.

## Launch directly from GitHub

Use these links to bypass the in-app setup flow:

- **Open in GitHub Codespaces:** [Launch Corpora AI in your browser](https://github.com/codespaces/new?hide_repo_select=true&ref=main&repo=1243353366%2Fcorpora-ai)
- **Download the repository ZIP:** [Download Corpora AI](https://github.com/1243353366/corpora-ai/archive/refs/heads/main.zip)
- **Browse the source:** [github.com/1243353366/corpora-ai](https://github.com/1243353366/corpora-ai)

Codespaces uses the checked-in `.devcontainer/devcontainer.json`: Node.js 24 is provisioned, dependencies are installed, the self-host adapter starts on port `8787`, and GitHub forwards that port to a browser tab. The first launch may require GitHub authentication and Codespaces availability. For a local download, run `npm ci && npm start`, then open `http://localhost:8787`.

### Friend-ready GitHub setup

1. Open [Launch Corpora AI in Codespaces](https://github.com/codespaces/new?hide_repo_select=true&ref=main&repo=1243353366%2Fcorpora-ai).
2. Sign in to GitHub and create the Codespace from the `main` branch.
3. Wait for the automatic setup to finish. It installs Node.js 24 and dependencies, starts the self-host adapter, and opens forwarded port `8787`.
4. Use the scoped search bar for privacy, device-defense, and cybersecurity research topics.
5. Use the 100-tool catalog to inspect each tool's authorization and data-scope policy.
6. Use the Aadi reasoning bridge only after checking explicit authorization; upstream results are untrusted and require human review.
7. Use the synthetic botnet emulator only with the displayed isolated-simulation consent. It performs no network activity, propagation, malware execution, or real-target interaction.

### Third-party browser setup

Use [Replit Import](https://replit.com/import), choose **GitHub**, and enter `https://github.com/1243353366/corpora-ai`. Replit can provide a browser-based development environment and preview, subject to its account, runtime, and hosting policies. Do not add API keys, Cloudflare tokens, database credentials, or customer data to a public Replit project. The repository's own self-host adapter is the intended no-database preview path.

### Shareable links

- [Codespaces browser launch](https://github.com/codespaces/new?hide_repo_select=true&ref=main&repo=1243353366%2Fcorpora-ai)
- [Replit Import](https://replit.com/import)
- [Direct ZIP download](https://github.com/1243353366/corpora-ai/archive/refs/heads/main.zip)

## Research-Use Policy

Corpora AI analyzes offensive cyber material strictly as research data.
Provenance is preserved (upstream project, repository URL, license, authors
on every record). It explains mechanisms, relationships, historical usage,
detection opportunities, and defensive implications - and it does not
transform retrieved material into instructions for attacking real systems.

## Endpoints

- `POST /api/analyze` - AI + algorithmic text analysis (10 req/min, 32KB cap)
- `POST /api/corpora/ingest` - Bearer-token ingestion into the shared D1 (`blog_db`, `corpora` table)
- `GET /api/corpora/search?q=` - keyword search over the corpus, JSON results
- `GET /health` - service status
- `POST /api/research/fetch` - consent-gated public HTTPS retrieval with robots checks, redirect provenance, extracted evidence, links, and prompt-injection warnings
- `POST /api/research/location` - explicit-consent country-level resolution from request metadata; never collects or stores Wi-Fi, cellular, precise coordinates, or device fingerprints
- `GET /api/tools/catalog` - complete catalog of 100 bounded cybersecurity, research, privacy, and device-defense tools with policy envelopes
- `POST /api/tools/authorize` - universal policy gate; authorizes scope only and never executes arbitrary commands or external side effects
- `POST /api/login/key/issue` - generate a temporary one-time API key
- `POST /api/login/key/verify` - exchange the one-time key for a temporary in-memory session
- `POST /api/login/provider` - report provider connector status without requesting credentials in the Worker
- `POST /api/ads/observe` - analyze a user-permitted ad observation with session-only retention
- `GET /api/search?q=` - search the privacy, device-defense, cybersecurity-research, tool, and provenance index only
- `POST /api/reasoning/run` - run the explicit hypothesis → evidence → contradiction → conclusion state loop
- `GET /api/synthetic/threatintel` - return the synthetic threat-intel dataset and attack/propagation graph
- `POST /api/synthetic/botnet-emulator` - run the defensive-only synthetic relay/fan-out emulator
- `POST /api/integrations/aadi/reasoning` - authorized bridge to Aadi's Digital Lab evidence-grounded reasoning Worker

## Deploy

```sh
npm ci
npm exec -- wrangler secret put INGEST_TOKEN   # ingestion bearer token
npm exec -- wrangler d1 execute blog_db --remote --file=schema-corpora.sql
npm exec -- wrangler deploy
```

The repository pins the supported runtime to **Node.js 24** through `engines.node` and `.nvmrc`, and pins Wrangler through `package-lock.json`; CI installs both with `npm ci` rather than a global or temporary CLI.

## Embedded research browser

The dashboard includes a bounded research-browser interface for public-web investigation. The workflow is **user authorization → research plan → browser retrieval → source validation → evidence extraction → correlation → contradiction check → investigation graph → report**. Retrieval accepts only public HTTPS URLs, rejects credentials and private hosts, checks `robots.txt`, follows at most three validated redirects, caps responses at 128KB, and records the requested URL, final URL, timestamp, status, content type, redirect chain, robots result, links, and provenance label. Authentication boundaries, CAPTCHAs, paywalls, rate limits, and anti-bot controls are not bypassed.

Webpage text is always marked as untrusted evidence. The Worker flags common prompt-injection patterns and explicitly tells the agent that webpage content is never an instruction, policy, credential, or authorization. The browser does not grant unrestricted collection authority or permission to gather arbitrary personal information.

Coarse country/region resolution is a separate, visible opt-in control. It uses request metadata only after the user checks consent, is returned with `stored: false`, and does not access Wi-Fi identifiers, cellular identifiers, precise coordinates, or device fingerprints. Location should be used only when it materially helps the declared investigation.

## Bounded 100-tool registry

The dashboard exposes all 100 requested tools across the cybersecurity/research and privacy/device-defense groups. Each catalog entry declares its purpose, read-only status, user-authorization requirement, target scope, data classes, geographic scope, external-side-effect policy, retention behavior, provenance requirement, rate limit, simulation-only status, escalation requirement, and authorization boundary. The universal gate denies missing authorization, denies simulation tools outside an explicitly authorized synthetic target, and requires human review for sensitive or simulation-scoped tools. The registry is a capability contract, not a claim that every tool has an unrestricted implementation; only the public research browser is currently execution-backed, while the remaining entries are safely catalogued for staged implementation.

## Login and ad-observation privacy lab

The dashboard includes a login portal offering iCloud, GitHub, Gmail, work email, YouTube, and a generated one-time API key. Provider buttons currently report that separately registered OAuth connectors are required; the Worker does not collect provider passwords or silently request mailbox, message, contact, or account-history access. The one-time API-key path returns a key once, stores only its hash in the Worker isolate for ten minutes, and exchanges it for a temporary session.

After login, ad analysis requires separate consent, a declared source, the restricted scope `ad-observations-only`, and `session-only` retention. The current safe implementation analyzes an ad label or description supplied by the user and returns likely targeting categories, possible signals, advertiser information if visibly supplied, unknowns, and next steps. It does not claim to inspect a user's private account feed automatically, and it does not store a personal advertising profile. Production provider connections should use narrowly scoped OAuth grants and platform-approved ad-transparency or preference APIs.

The dashboard's scoped search bar searches only those privacy and defensive-research indexes, including the 100-tool registry and provenance sources. It does not search arbitrary people, private accounts, credentials, or unrestricted web content. A specific public URL must be submitted separately through the authorized research-browser workflow.

## Aadi's Digital Lab integration

Corpora integrates the upstream [Aadi's Digital Lab repository](https://github.com/1243353366/aadi-digital-lab) through a bounded reasoning bridge to its public `/api/reasoning/ask` contract. The integration records the repository, pinned inspected commit, and **MIT license** in the response provenance. Questions require explicit user authorization, are size-limited, and receive an upstream timeout. Upstream responses are treated as untrusted research results and require human review; the Aadi Worker does not gain Corpora's tools, credentials, customer data, or authority. If the upstream Worker is unavailable, Corpora returns a local synthetic reasoning fallback rather than silently claiming an upstream result.

## Explicit reasoning and synthetic botnet emulator

The reasoning lab exposes a state machine with **hypothesis generation → evidence gathering → contradiction checking → conclusion**. Each run includes chained tool IDs from the registry, confidence with a defined interpretation, alternative explanations, conflicting evidence, missing evidence, stopping states such as `NEEDS_EVIDENCE`, and a complete audit trail. The system is designed to stop rather than manufacture certainty.

The botnet teaching view is deliberately an emulator, not a botnet. Its threat-intel records, relay/fan-out graph, scenario generator, telemetry, defensive controls, and recovery sequence are synthetic fixtures. The fail-closed preflight requires an authorized isolated synthetic target, safe simulation mode, no network, and no propagation. No sockets, commands, malware, persistence, credential theft, lateral movement, external C2, scanning, or real-target interaction are implemented.

`GET /api/edr/health` reports server-derived `telemetryTrust` (`VERIFIED`, `DEGRADED`, or `UNVERIFIED`) alongside freshness, heartbeat, duplicate, rejection, authentication-failure, and timestamp-quality metrics. `visibility` remains explicit: `container-local`, `host-level`, `synthetic`, or `unknown`.

Zero npm dependencies. Strict CSP, rate limiting, dark-mode-first UI.
Model: `@cf/openai/gpt-oss-20b` (Workers AI) with `max_tokens: 2048`.


## Observatory reasoning layer

Corpora AI now maintains a **catalogue and evaluation layer** for the Observatory reasoning stack. The catalog records LangGraph, smolagents, DSPy, PydanticAI, LlamaIndex, Haystack, Agno, AutoGen/AG2, BeeAI Framework, and OpenLLMetry as reference sources with URLs, creators, intended role, and license-review status. The catalog is not a claim that their code or model weights have been imported.

The intended reasoning chain is:

```text
raw evidence → normalized observation → retrieved corroboration → hypothesis
→ counter-hypothesis → confidence → human/verification gate → conclusion
```

The Worker does **not** silently “train itself.” When the user opts in, it stores an evaluation run’s output metadata and structured claims in additive `ai_runs` and `ai_claims` tables. Authorized reviewers can submit labels through `/api/ai/feedback`; these labels form a regression/evaluation corpus and do not update model weights or grant the Worker new permissions.

## AI memory schema

`schema-corpora.sql` now creates `ai_source_catalog`, `ai_documents`, `ai_runs`, `ai_claims`, and `ai_feedback` alongside the existing `corpora` table. Raw input is not stored by `/api/analyze`; persistence is opt-in and stores only output metadata, claims, confidence, and provenance. The Worker uses the existing `DB` binding as a safe fallback because creation of a separate Cloudflare D1 database requires account authorization that was unavailable during this release. A future `AI_DB` binding can be added without changing the API contract.

Additional endpoints are `GET /api/corpora/sources` for the reference catalog and authenticated `POST /api/ai/feedback` for labels (`accepted`, `needs-review`, `unsupported`, or `incorrect`). The health response reports the active model and whether the AI-memory binding is available.

`POST /api/observatory/proof` accepts one provenance-bearing observation and returns a bounded proof record: normalization, correlation candidate, hypothesis, Skeptic challenge, authorized-isolated simulation plan, defensive report, and audit trail. It never executes a simulation or contacts the observation source.

`GET /api/observatory/retrieve?q=incident%20response` now returns actual content-bearing, provenance-labeled passages from the D1 knowledge-document index or the embedded seed fallback. `POST /api/edr/events` accepts only synthetic, versioned fixtures such as `edr.process.v1`; it validates, hashes, deduplicates, detects, records confidence separately from severity, and returns the complete audit path. Invalid events are rejected with a reason and rejection identifier. The endpoint never collects from a real host or executes commands.

For the authorized local Linux lab, [collector/osquery_collector.py](collector/osquery_collector.py) runs fixed read-only osquery queries and sends authenticated local telemetry to `POST /api/edr/ingest`. Its [lab configuration](collector/osquery-lab.json) rejects remote targets, external scanning, production access, and non-telemetry modes. Live osquery collection is not claimed until `osqueryi` is installed on the authorized lab host.

## Contained C2 simulation

The Worker includes a fail-closed synthetic cyber-range simulator at `GET /api/range/c2/catalog`, `POST /api/range/c2/run`, and `POST /api/range/c2/contain`. It models registration, beacon-like events, jitter, predefined harmless task primitives, result correlation, detection, synthetic containment, evidence retention, and recovery status. It supports both detected and intentionally not-detected scenarios so the system does not manufacture success.

Every simulation requires the explicit preflight values `range=authorized-cyber-range`, `authorized=true`, `syntheticTarget=true`, `isolated=true`, and `safeSimulationMode=true`. Tasks are fixed simulation labels; arbitrary commands, shell execution, external agents, scanning, persistence, privilege escalation, lateral movement, tunneling, file transfer, malware, and Internet-facing listeners are not implemented. Simulated events are classified as `SIMULATED_C2` and remain distinct from `LIVE_LOCAL_OBSERVATION`, `SYNTHETIC`, and `UNKNOWN`.

The external knowledge seed is deliberately curated around [MITRE ATT&CK](https://attack.mitre.org/), [NIST SP 800-61](https://csrc.nist.gov/pubs/sp/800/61/r2/final), [NIST SP 800-115](https://csrc.nist.gov/pubs/sp/800/115/final), the [CISA KEV Catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog), and the existing malware/CTI reference sources. These are provenance-bearing references, not an undifferentiated blog dump and not executable instructions.

## Wrangler release hardening

The canonical `wrangler.toml` now declares Node 24-compatible Workers support, `nodejs_compat`, minification, disabled anonymous Wrangler metrics, and Workers observability. GitHub Actions reads Node 24 from `.nvmrc`, installs the locked dependency set with `npm ci`, uses the pinned Wrangler through `npm exec`, applies the additive D1 schema, and deploys only after the schema step succeeds. The schema is idempotent and uses `CREATE TABLE IF NOT EXISTS` / `INSERT OR IGNORE` for safe replay. See the [architecture map](ARCHITECTURE-MAP.md) for canonical file ownership and boundary status.


## Self-hosted preview

For a lightweight self-hosted preview, use Node.js 24 LTS:

```sh
PORT=8787 node selfhost.mjs
```

The adapter serves the same Worker routes on `0.0.0.0` and safely falls back to algorithmic analysis when Workers AI and D1 bindings are not supplied. For production self-hosting, provide a compatible AI/D1 adapter or use the manual Wrangler workflow; do not expose ingestion or feedback tokens in client code.

For encrypted proof persistence, generate a 32-byte base64 key and set it only as a server-side secret:

```sh
export AI_MEMORY_ENCRYPTION_KEY="$(openssl rand -base64 32)"
PORT=8787 node selfhost.mjs
```

When D1 and the key are both present, proof records and proof claims are stored as **AES-256-GCM** ciphertext. The key is never returned by `/health` or sent to the browser. Without the key, proof persistence fails closed rather than writing plaintext.

### Python fast path

For the smallest and quickest local deployment, Python 3.10+ provides a standard-library-only API fallback:

```sh
PORT=8788 python3 selfhost/python_server.py
```

It exposes `/health`, `/api/analyze`, and `/api/observatory/proof`, with the same uncertainty and no-external-execution boundary. It is intentionally stateless and does not replace the Node/Workers AI + D1 runtime. Ada and Go adapters are not included in this release because their toolchains are not part of the supported environment and an unverified duplicate runtime would increase control-plane complexity.

The repository declares `engines.node` as `>=24.0.0 <25.0.0`, includes `.nvmrc`, and pins Wrangler in `package-lock.json`. There is no Dockerfile in this repository; no Docker runtime change was necessary.

The attached evidence-governance specification is captured in the [AI Threat Observatory reasoning contract](docs/AI-THREAT-OBSERVATORY-REASONING.md) and its [machine-readable v1 policy](contracts/observatory-reasoning.v1.json). This is a defensive policy and provenance boundary; it does not enable live malware execution, external retaliation, or autonomous legal/actor attribution.

See [UPSTREAM-CREDITS.md](UPSTREAM-CREDITS.md) for the professional upstream attribution index, creator links, license-preservation requirements, and the distinction between reference material and incorporated code.

See [AUDIT-REPORT.md](AUDIT-REPORT.md) for the adversarial syntax, runtime, deployment, EDR, evidence, encryption, failure-mode, and security-boundary assessment. The report deliberately distinguishes demonstrated capabilities from partial and untested components.

See [THREAT-MODEL.md](THREAT-MODEL.md) for the security-platform threat model covering telemetry poisoning, untrusted evidence and prompt injection, collector compromise, range escape, resource exhaustion, audit evasion, and recovery trust.

See [docs/EVIDENCE-LEGAL-GOVERNANCE.md](docs/EVIDENCE-LEGAL-GOVERNANCE.md), the [evidence-governance contract](contracts/evidence-governance.v1.json), and the [versioned legal-source registry](contracts/legal-sources.v1.json) for best-evidence preservation, chain of custody, integrity verification, Michigan and federal legal limitations, authorization gates, legal holds, and the customer-configured European data-protection profile.

See [docs/CUSTOMER-DATA-PIPELINE.md](docs/CUSTOMER-DATA-PIPELINE.md) for the customer-facing explanation of why data is processed, what is in scope, how encryption works, and the distinction between server-side encryption at rest and true end-to-end encryption.

See [docs/PRIVACY-INTELLIGENCE.md](docs/PRIVACY-INTELLIGENCE.md) for the organization-level data-broker graph, browser-local exposure scan, storage disclosure, opt-out workflow, and reference-only upstream sources.

`GET /api/governance/diagnostics` checks transport, AES-256-GCM configuration, database availability, and collector authentication without returning customer content or secrets. For a local collector, use `http://127.0.0.1:<PORT>/api/edr/ingest`, set `INGEST_TOKEN` in both the adapter and collector environment, and run the collector with a config whose `collector` value matches the launcher (`local-proc` or `osquery`). A failed localhost connection is bounded to four retries and reports `DEGRADED` with a JSONL audit record rather than silently dropping telemetry.

See [docs/INVESTIGATION-WORKSTATION.md](docs/INVESTIGATION-WORKSTATION.md) and the [versioned workstation contract](contracts/investigation-workstation.v1.json) for the human-versus-AI product boundary, evidence-centered reasoning loop, hypothesis fields, controlled experiments, and approval requirements.
