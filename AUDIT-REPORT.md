# Corpora AI full-system validation and EDR health audit

**Audit date:** 2026-09-19
**Scope:** `1243353366/corpora-ai`, Node 24 Worker, Node self-host adapter, Python fast path, D1 schema, CI/Wrangler configuration, evidence/provenance, encryption, and safe proof flow.
**Assessment standard:** A capability is marked **PASS** only when the complete path was demonstrated. A present file or successful dry run is not treated as proof that the capability works in production.

## Executive health summary

The repository is syntactically valid, internally consistent for the implemented algorithmic paths, and clean in Git. The Node 24 dependency installation, Worker syntax, Python compilation, JSON contract, SQLite schema, Wrangler dry run, AES-256-GCM persistence path, and both public self-host previews passed validation. Malformed requests fail with bounded 400 responses, unknown routes return 404, the Node feedback route fails closed without a token, and the proof route never executes a simulation or contacts an observation source.

The platform is **not an operational EDR or a complete external-intelligence retrieval system**. It currently provides a provenance-aware analysis and proof scaffold. It does not ingest process, file, persistence, identity, or security-control telemetry; it does not run malware analysis; and it does not demonstrate remote D1 persistence or production Cloudflare deployment in this audit. The proof endpoint receives an observation from the caller and performs deterministic normalization, a correlation candidate, a hypothesis, a Skeptic challenge, a blocked simulation plan, and an audit trail. It does not retrieve or independently corroborate evidence.

**Overall state: PARTIAL.** Safe for the demonstrated local algorithmic preview and further controlled development. Not sufficient to claim production EDR coverage, autonomous threat attribution, or validated cyber-range execution.

## Architecture map

```text
Browser UI embedded in Worker response (src/index.js: PAGE/PAGE_JS)
        |
        | POST /api/analyze, /api/observatory/proof
        v
Cloudflare Worker entry: src/index.js
        |-- optional Workers AI binding: env.AI
        |-- optional D1 binding: env.DB (blog_db)
        |-- optional AI memory alias: env.AI_DB -> env.DB
        |-- server-side encryption key: env.AI_MEMORY_ENCRYPTION_KEY
        |-- token gates: INGEST_TOKEN and AI_FEEDBACK_TOKEN
        v
D1 schema: schema-corpora.sql
        |-- corpora and ai_source_catalog
        |-- opt-in ai_runs, ai_claims, ai_feedback
        v
Provenance / reasoning output
        |-- observation hash
        |-- normalized entity
        |-- correlation candidate
        |-- hypothesis and alternative
        |-- Skeptic challenge
        |-- blocked simulation plan
        |-- audit trail

Node self-host adapter: selfhost.mjs -> imports Worker fetch handler
Python fast adapter: selfhost/python_server.py -> independent stateless fallback

Deployment: wrangler.toml -> src/index.js
CI/CD: .github/workflows/deploy.yml -> manual workflow_dispatch, Node 24, Wrangler 4, remote D1 migration, deploy
```

There is no separate frontend bundle, backend service, AI superagent process, EDR collector, malware-analysis engine, or local D1 database in this repository. The embedded browser UI and Worker are intentionally combined. The Node and Python files are adapters or fallbacks, not alternate production backends.

## Syntax and static validation

| Component | Status | Finding | Evidence |
|---|---|---|---|
| Worker JavaScript | PASS | Parses under Node 24. | `node --check src/index.js` |
| Node adapter | PASS | Parses under Node 24. | `node --check selfhost.mjs` |
| Python adapter | PASS | Compiles under Python 3.12.3. | `python3 -m py_compile selfhost/python_server.py` |
| JSON reasoning contract | PASS | Parses successfully. | `python3 -m json.tool contracts/observatory-reasoning.v1.json` |
| D1/SQLite schema | PASS | Executes in an in-memory SQLite database; seven tables and 22 seed rows created. | `sqlite3`-equivalent Python `sqlite3.executescript` validation |
| Package and lockfile | PASS | `npm ci --engine-strict` succeeds under Node v24.21.0; zero reported vulnerabilities. | Node 24 npm install output |
| Wrangler configuration | PASS | Wrangler 4.135.0 dry run recognizes `src/index.js`, `DB`, and `AI`. | `wrangler deploy --dry-run` |
| CI configuration | PASS | Manual workflow uses Node 24 and explicit Wrangler 4. | `.github/workflows/deploy.yml` |
| Automated test/build scripts | PARTIAL | No project test, lint, type-check, or application-build script is defined. | `package.json` contains only `selfhost` and `wrangler:dry-run` |

No invalid import, unsafe process-execution primitive, committed credential, or Node 20/22 runtime reference was found in the audited source/configuration paths.

## Runtime validation

| Runtime | Status | Demonstrated path | Gap |
|---|---|---|---|
| Node 24 self-host preview | PASS for algorithmic preview | Health, analysis, proof, Skeptic output, and blocked simulation plan at port 8787. | No AI or D1 bindings in the preview. |
| Python fast path | PASS for stateless fallback | Health, analysis, proof, Skeptic output, audit trail, and blocked simulation plan at port 8788. | No persistence, encryption, authentication, source catalog, or Workers AI parity. |
| Cloudflare Worker | PARTIAL | Wrangler dry run and source/binding inspection passed. | No live deployment or remote D1 write was performed during this audit. |

Live previews validated:

- [Node 24 preview](https://8787-ic1olfvm7r2j1wi9m3f6z-38df9d2c.us4.manus.computer)
- [Python preview](https://8788-ic1olfvm7r2j1wi9m3f6z-38df9d2c.us4.manus.computer)

Harmless failure-mode results were consistent. Missing analysis fields and malformed JSON returned 400. Unknown routes returned 404. The Node feedback route returned 503 when its token/database were not configured. The Python adapter returned 400 because it intentionally does not expose the feedback route.

## EDR health matrix

The requested EDR pipeline is evaluated as **AVAILABLE → INGESTED → NORMALIZED → STORED → CORRELATED → DETECTABLE → DISPLAYED**. The repository does not contain an EDR collector or telemetry schema, so the absence is recorded explicitly.

| Telemetry category | Available | Ingested | Normalized | Stored | Correlated | Detectable | Displayed | Final state |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Process creation and trees | No | No | No | No | No | No | No | UNTESTED |
| File create/modify/delete/rename | No | No | No | No | No | No | No | UNTESTED |
| Persistence mechanisms | No | No | No | No | No | No | No | UNTESTED |
| Network/DNS/beacon timing | No | No | No | No | No | No | No | UNTESTED |
| Identity/authentication/privilege | No | No | No | No | No | No | No | UNTESTED |
| Detection/quarantine/isolation/recovery | No | No | No | No | No | No | No | UNTESTED |
| Synthetic proof audit events | Yes, generated by proof route | Yes | Yes | Only with D1 and key | Entity candidate only | No rule engine | JSON response/UI | PARTIAL |

The words “telemetry,” “detection,” and “sandbox” currently describe policy, missing evidence, or a future plan. They are not evidence that an EDR data path exists.

## AI reasoning audit

| Capability | Implemented | Validated | Evidence | Gap |
|---|---:|---:|---|---|
| Explicit observation classification | Yes | Yes | Proof response labels `OBSERVATION`. | Caller supplies the observation. |
| Provenance and evidence hash | Yes | Yes | SHA-256 hash returned in proof smoke test. | No independent source retrieval. |
| Entity normalization | Yes | Yes | `example[.]invalid` normalized to `example.invalid`. | No multi-source entity store. |
| Correlation | Partial | Yes for candidate generation | Same normalized entity candidate is returned. | No corroborating graph query. |
| Hypothesis and alternative | Yes | Yes | Proof response includes both. | Heuristic, not multi-agent inference. |
| Skeptic pass | Yes | Yes | Contradiction signals, missing evidence, and alternative explanation returned. | No second independent evidence retrieval pass. |
| Uncertainty | Yes | Yes | `requires_human_review`, confidence 0.35, and unknowns returned. | Confidence is heuristic, not calibrated. |
| Safe simulation planning | Partial | Yes for blocking | `executed: false`; missing authorization/isolation blocks the plan. | No isolated cyber-range exists. |
| Defensible report | Partial | Yes for scaffold | Summary, mitigation, legal flag, unknowns, and audit trail returned. | No full incident-report workflow. |
| Reusable memory | Partial | AES path tested with a mock D1 | Encrypted `ai_runs`/`ai_claims` integration check passed. | Remote D1 persistence not demonstrated. |

## Evidence and provenance audit

The implemented proof path preserves the requested chain in reduced form:

```text
SOURCE → RAW OBSERVATION → NORMALIZED EVENT → CORRELATION CANDIDATE
→ HYPOTHESIS → SKEPTIC CHALLENGE → BLOCKED SIMULATION PLAN → REPORT → AUDIT TRAIL
```

This chain is demonstrable for caller-supplied synthetic observations. It does not yet include independent retrieval, source comparison, contradiction records from multiple sources, or a validated claim-promotion workflow. The system does not silently promote the proof hypothesis to a fact, and it marks the result for human review.

## Encryption validation

AES-256-GCM persistence was tested with a mock D1 binding under Node 24. The test verified that the stored value has the `aes-256-gcm:v1` envelope and does not contain the plaintext proof details. The implementation uses a fresh 12-byte random IV per encryption and authenticated encryption tags supplied by AES-GCM. The key is read only from `AI_MEMORY_ENCRYPTION_KEY` and is not returned by health or sent to the browser.

The following production controls remain **UNTESTED**: key rotation, key separation by environment, encrypted backups, managed secret storage, recovery from key loss, and remote D1 encryption behavior. The current design uses one environment secret for the proof-memory encryption path. That is acceptable for the minimalist prototype but is not a complete key-management program.

## Security-boundary audit

| Boundary | Status | Failure mode | Required follow-up |
|---|---|---|---|
| Production code executing samples | PASS for current code | No sample execution primitive found. | Keep sample handling reference-only. |
| External retaliation or counterattack | PASS | No outbound action or scanning primitive found. | Preserve explicit authorization gates. |
| Simulation authorization | PASS for proof path | Simulation is always marked unexecuted; unauthorized proof is blocked. | Add an isolated range before enabling any benign emulation. |
| Production secrets in simulation | PASS for current code | No simulation runner or secret export path exists. | Maintain separate environments if a range is added. |
| Ingestion authorization | PARTIAL | Node route requires a bearer token; Python route omits ingestion entirely. | Keep Python path explicitly non-production. |
| Feedback authorization | PARTIAL | Node route fails closed without a token; Python route is not implemented. | Document feature disparity and add tests if parity is required. |
| Prompt injection | PARTIAL | Policy documents treat external text as untrusted; current algorithmic path does not execute retrieved text. | Add explicit source trust labels to future retrieval code. |
| Audit trail | PARTIAL | Proof response contains an audit trail; durable storage depends on D1 and encryption configuration. | Validate remote D1 persistence in a controlled deployment. |

## Findings

### AUD-001 — EDR telemetry pipeline is absent

**Severity:** High
**Component:** EDR/telemetry integration
**Location:** Repository-wide; no collector or telemetry schema is present.
**Evidence:** All six requested EDR categories are unavailable through collection, storage, correlation, detection, and display.
**Why it matters:** The product cannot claim endpoint detection, quarantine, recovery, or reproducible alerting.
**Validation:** EDR matrix above and repository inventory.
**Recommended fix:** Add a separately scoped telemetry contract and synthetic fixtures first. Demonstrate one category end to end before adding more collectors.
**Regression test:** Submit a synthetic process event and verify `ingest → normalize → store → correlate → detect → display → audit`.
**Confidence:** High.

### AUD-002 — Proof endpoint does not retrieve external evidence

**Severity:** High
**Component:** `POST /api/observatory/proof`
**Location:** `src/index.js`, `handleObservatoryProof`.
**Evidence:** The endpoint accepts `source`, `entity`, `signal`, and `details` from the caller and performs local normalization and heuristic correlation. It does not query `corpora` or `ai_source_catalog`.
**Why it matters:** The system cannot yet prove corroboration or contradiction across independent sources.
**Validation:** Public proof smoke test and source inspection.
**Recommended fix:** Add a read-only retrieval phase against a curated corpus, with source IDs, timestamps, and separate observation records before hypothesis generation.
**Regression test:** Insert two synthetic observations with conflicting dates and require an explicit conflict record.
**Confidence:** High.

### AUD-003 — Python fast path is intentionally feature-incomplete

**Severity:** Medium
**Component:** `selfhost/python_server.py`
**Evidence:** Python exposes only health, analysis, and proof. It has no D1, AI, feedback, ingestion, source catalog, or AES persistence.
**Why it matters:** Users may mistake the fast preview for a production-equivalent runtime.
**Validation:** Endpoint inventory and live smoke tests.
**Recommended fix:** Keep it labeled as a stateless fallback, as documented. Do not present it as a production replacement for the Worker.
**Regression test:** Confirm its health response continues to report `persistentMemory: false`.
**Confidence:** High.

### AUD-004 — Production key-management lifecycle is incomplete

**Severity:** Medium
**Component:** AES-256-GCM proof persistence
**Evidence:** Encryption and unique IV generation passed locally, but rotation, backup, recovery, and environment-specific key separation were not demonstrated.
**Why it matters:** Loss or misuse of the single server-side key can make persisted proof unreadable or expose all records.
**Validation:** Mock-D1 encryption test; configuration inspection.
**Recommended fix:** Use a managed secret/KMS design, define rotation and recovery procedures, and test them without exposing keys.
**Confidence:** High.

### AUD-005 — Automated regression suite is absent

**Severity:** Medium
**Component:** `package.json` and repository CI
**Evidence:** No test, lint, type-check, or application-build script exists. CI performs schema application and deployment only.
**Why it matters:** Future changes can regress the proof contract, encryption path, or adapters without a repeatable repository test gate.
**Validation:** `package.json` inspection and CI inspection.
**Recommended fix:** Add dependency-light tests for malformed requests, proof stages, encryption envelope, schema idempotence, and Python parity.
**Confidence:** High.

### AUD-006 — Cloudflare production deployment was not exercised

**Severity:** Medium
**Component:** `wrangler.toml`, manual GitHub workflow
**Evidence:** Wrangler dry run passed and identified `DB` and `AI`, but this audit did not mutate remote D1 or deploy the Worker.
**Why it matters:** Binding permissions, remote schema state, secrets, and production routes remain unverified.
**Validation:** Dry-run output and configuration inspection.
**Recommended fix:** Run the manual workflow in the intended Cloudflare account after reviewing the exact migration and secrets.
**Confidence:** High.

## Final state by component

| Component | State |
|---|---|
| Node 24 Worker syntax and dry run | PASS |
| Node 24 algorithmic self-host preview | PASS |
| Python stateless fast path | PASS |
| D1 schema syntax and seed idempotence in SQLite | PASS |
| AES-256-GCM envelope and unique IV behavior | PASS for local mock-D1 test |
| Remote D1 persistence | UNTESTED |
| Workers AI execution | UNTESTED in local preview |
| External CTI retrieval and corroboration | PARTIAL |
| Evidence graph | PARTIAL; normalized candidate only |
| Skeptic reasoning | PASS for deterministic local pass; PARTIAL for multi-source reasoning |
| EDR process/file/persistence/network/identity telemetry | UNTESTED |
| Safe simulation execution | UNTESTED; planning and blocking only |
| Malware analysis | UNTESTED and intentionally not enabled |
| Production Cloudflare deployment | UNTESTED in this audit |
| Automated test/lint/type/build pipeline | PARTIAL; no repository suite exists |

## Recommended next validation slice

The smallest meaningful next slice is one synthetic telemetry type, preferably a process event. Define its provenance, ingest one fixture, normalize it, store it, correlate it with one second fixture, create a detection result, render the result, and persist the audit chain. Add a contradiction fixture and an encryption regression test at the same time. Do not add another agent or external framework until that complete path is demonstrated.

## References

[1]: https://attack.mitre.org/ "MITRE ATT&CK"
[2]: https://csrc.nist.gov/pubs/sp/800/61/r2/final "NIST SP 800-61 incident response guidance"
[3]: https://csrc.nist.gov/pubs/sp/800/115/final "NIST SP 800-115 technical security testing guidance"
[4]: https://www.cisa.gov/known-exploited-vulnerabilities-catalog "CISA Known Exploited Vulnerabilities Catalog"
[5]: https://developers.cloudflare.com/workers/ "Cloudflare Workers documentation"


## EDR hardening slice added after the initial audit

The repository now includes a content-bearing, synthetic-only EDR control-plane slice. It accepts explicitly versioned fixtures such as `edr.process.v1`, rejects unsupported versions and mismatched event types, validates timestamps and required fields, creates a separate observation hash, deduplicates event IDs in the local preview, and uses D1 uniqueness constraints for durable deduplication when D1 is available. Invalid fixtures return `REJECTED` with a reason and a rejection identifier; a D1-backed deployment also records the hashed rejection in `edr_rejections`.

The detection record separates rule version, severity, confidence, alert ID, correlation ID, rationale, false-positive notes, and supporting evidence. The no-match state is `no-threat-observed`, not `no-threat`. The returned health state is `DEGRADED` for the stateless preview and `PARTIALLY_OPERATIONAL` when a D1 binding is present; application uptime alone is not treated as healthy EDR.

The retrieval path now returns actual content from the embedded seed corpus when D1 is unavailable and queries `ai_knowledge_documents` when D1 is available. The dashboard exposes both retrieval results and the synthetic EDR pipeline output. The embedded content is provenance-labeled and reference-only. The endpoint-security projects listed in the supplied hardening note are credited in [UPSTREAM-CREDITS.md](UPSTREAM-CREDITS.md); no upstream code or runtime dependency was copied.

The hardening slice was smoke-tested with a suspicious synthetic process event, a benign synthetic process event, an unsupported-version rejection, content retrieval for NIST incident response, and source-catalog content. It remains **PARTIAL** as an EDR system because no osquery, OpenEDR, OpenDR, Falco, or other endpoint collector is installed or connected, and no live endpoint telemetry is collected.


## Authorized local osquery collector

A real collector implementation now exists at [collector/osquery_collector.py](collector/osquery_collector.py). It runs only fixed, read-oriented osquery queries for processes, listening ports, and users. Its configuration requires `authorized-lab`, `osquery`, `local`, `remote_targets=false`, `external_scanning=false`, `production_access=false`, and `telemetry_only=true`. The ingestion URL must be localhost HTTP or HTTPS. The collector refuses remote configurations and refuses to substitute another data source when `osqueryi` is absent.

The authenticated collector path is:

```text
local osqueryi → fixed query result → event hash/version/provenance
→ Bearer-authenticated /api/edr/ingest → validation → normalization
→ deduplication → detection → optional D1 storage → audit response
```

Collector source compilation and safety-gate tests passed. Live endpoint collection remains **UNTESTED** in this environment because `osqueryi` is not installed. This is intentionally not represented as a PASS. The installation and canary steps are documented in [collector/README.md](collector/README.md).


A localhost integration test also passed using `collector/local_linux_collector.py`: readable `/proc` process observations were collected from the running application environment, authenticated with the lab token, accepted by `/api/edr/ingest`, normalized, deduplicated, correlated, evaluated, and returned with an audit trail. These events are explicitly labeled `collector=local-proc` and `visibility=container-local`. They are not equivalent to host-level EDR. The osquery path remains the preferred real host source and remains unverified until `osqueryi` is installed on the authorized self-hosted Linux host.
