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
npx wrangler secret put INGEST_TOKEN   # ingestion bearer token
npx wrangler d1 execute blog_db --remote --file=schema-corpora.sql
npx wrangler deploy
```

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

## Wrangler release hardening

The canonical `wrangler.toml` now declares Node 24-compatible Workers support, `nodejs_compat`, minification, disabled anonymous Wrangler metrics, and Workers observability. GitHub Actions uses Node 24 LTS, installs Wrangler 4 explicitly, applies the additive D1 schema, and deploys only after the schema step succeeds. The schema is idempotent and uses `CREATE TABLE IF NOT EXISTS` / `INSERT OR IGNORE` for safe replay.


## Self-hosted preview

For a lightweight self-hosted preview, use Node.js 24 LTS:

```sh
PORT=8787 node selfhost.mjs
```

The adapter serves the same Worker routes on `0.0.0.0` and safely falls back to algorithmic analysis when Workers AI and D1 bindings are not supplied. For production self-hosting, provide a compatible AI/D1 adapter or use the manual Wrangler workflow; do not expose ingestion or feedback tokens in client code.

The repository declares `engines.node` as `>=24.0.0 <25.0.0`, includes `.nvmrc`, and pins Wrangler in `package-lock.json`. There is no Dockerfile in this repository; no Docker runtime change was necessary.

The attached evidence-governance specification is captured in the [AI Threat Observatory reasoning contract](docs/AI-THREAT-OBSERVATORY-REASONING.md) and its [machine-readable v1 policy](contracts/observatory-reasoning.v1.json). This is a defensive policy and provenance boundary; it does not enable live malware execution, external retaliation, or autonomous legal/actor attribution.

See [UPSTREAM-CREDITS.md](UPSTREAM-CREDITS.md) for the professional upstream attribution index, creator links, license-preservation requirements, and the distinction between reference material and incorporated code.
