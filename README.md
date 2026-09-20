# Corpora AI

A single-file Cloudflare Worker intelligence engine for Aadi's Digital Lab.
Paste or query a text corpus and get AI summaries, typed entities, topics,
sentiment, key-term frequency, and readability - with an algorithmic
fallback when Workers AI is unavailable.

**For ethical research use only - a research tool.** The corpus stores
third-party upstream material (e.g. MITRE ATT&CK STIX data, ahmia-crawler,
clinical-nlp-pipeline) strictly with attribution: each record keeps its
upstream project, repository URL, license, and author information.

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

## Deploy

```sh
npm ci
npm exec -- wrangler secret put INGEST_TOKEN   # ingestion bearer token
npm exec -- wrangler d1 execute blog_db --remote --file=schema-corpora.sql
npm exec -- wrangler deploy
```

The repository pins the supported runtime to **Node.js 24** through `engines.node` and `.nvmrc`, and pins Wrangler through `package-lock.json`; CI installs both with `npm ci` rather than a global or temporary CLI.

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
