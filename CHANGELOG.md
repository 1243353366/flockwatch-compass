# Changelog

All notable changes to Corpora AI are documented here. Entries describe defensive, authorized-local functionality and preserve the distinction between verified behavior and capability that remains unverified.

## [Unreleased]

### Planned

- Validate the osquery collector on the authorized self-hosted Linux host after `osqueryi` is installed.
- Extend evidence-graph presentation for live local observations without promoting container-local visibility to host-level EDR.
- Add automated regression coverage for contaminated evidence, stale events, contradictions, duplicate records, and AI-unavailable operation.

## [2026-09-19] — Direct ingestion protocol and architecture map

### Added

- Added `collector/ingestion_protocol.py` as the single collector-side transport implementation.
- Routed both the `/proc` collector and osquery collector through the same direct authenticated ingestion protocol.
- Added bounded 64 KiB request batches.
- Added capped exponential retry and backoff for transient network and HTTP failures.
- Added graceful degraded-state responses when ingestion is unavailable.
- Added local JSONL collector audit records for authentication, retry, acceptance, rejection, and failure stages.
- Added heartbeat events to local collectors for freshness and telemetry-trust verification.
- Added `ARCHITECTURE-MAP.md` documenting canonical file ownership, dependency boundaries, source-of-truth rules, and verification status.

### Changed

- Preserved the existing adapter as the ingestion API/runtime boundary instead of removing it.
- Server-side ingestion now assigns provenance and visibility rather than trusting collector-supplied labels.
- The dashboard and health API continue to distinguish `container-local`, `host-level`, `synthetic`, and `unknown` visibility.
- Updated collector documentation to describe the direct production protocol and its safety boundaries.

### Verification

- Direct localhost ingestion passed with real container-local process observations.
- Authentication rejection passed.
- Malformed-event rejection passed.
- Bounded retry and degraded failure behavior passed against an unreachable localhost port.
- Heartbeat recovery passed after adapter and collector restart.
- JavaScript, Python, JSON, SQL, and Wrangler validation passed.

## [2026-09-19] — Telemetry trust hardening

### Added

- Added server-side freshness and heartbeat tracking.
- Added measurable counters for received, processed, rejected, duplicate, dropped, timestamp-error, and authentication-failure events.
- Added `GET /api/edr/health` with explicit state and telemetry-trust reporting.
- Added `VERIFIED`, `DEGRADED`, and `UNVERIFIED` telemetry-trust states.
- Added `DATA_GAP` and `FAILED` health states when telemetry becomes stale or disappears.
- Added a dashboard health panel showing trust reasons and visibility.

### Security

- Synthetic fixtures are server-labeled as `SYNTHETIC_FIXTURE`.
- Authorized local observations are server-labeled as `LIVE_LOCAL_OBSERVATION`.
- Client-supplied provenance, collector labels, and synthetic flags are not authoritative.
- Container-local telemetry is never silently promoted to host-level EDR.

## [2026-09-19] — Node 24 and locked Wrangler runtime

### Changed

- Declared Node.js `>=24.0.0 <25.0.0` as the supported runtime.
- Added `.nvmrc` with the Node 24 line.
- Pinned Wrangler through `package.json` and `package-lock.json`.
- Updated CI to read the Node version from `.nvmrc`, run `npm ci`, and invoke the locked Wrangler with `npm exec`.
- Updated deployment documentation to remove global and temporary Wrangler installation instructions.

### Verification

- Node 24.21.0 validation passed.
- Locked Wrangler 4.135.0 validation passed.
- Wrangler dry-run passed under Node 24.

## [2026-09-19] — Authorized local telemetry foundation

### Added

- Added the fixed-query osquery collector for authorized local Linux environments.
- Added the read-only `/proc` fallback for minimal or containerized environments where osquery is unavailable.
- Added explicit endpoint identity, local-only policy, telemetry-only policy, and remote-target rejection.
- Added provenance and visibility documentation for the distinction between container-local and host-level collection.

### Current limitation

`osqueryi` is not installed in the development sandbox. The osquery implementation is syntax-tested and fail-closed; host-level osquery collection remains unverified until it is run on the authorized self-hosted Linux host.

## [2026-09-19] — Observatory and evidence foundation

### Added

- Added content-bearing retrieval from curated defensive knowledge sources.
- Added provenance-aware observatory proof records.
- Added bounded skeptic review and uncertainty-aware reporting.
- Added synthetic-only EDR fixtures and audit-stage reporting.
- Added D1 schema for corpus sources, documents, claims, evaluation records, EDR events, detections, and rejection quarantine.
- Added upstream attribution, licensing, and evidence-governance documentation.

### Safety boundary

The Observatory remains analysis-only for external evidence. It does not execute malware, scan external systems, perform retaliation, or make unsupported actor attribution claims.

## [2026-09-18] — Initial public Sentinel Atlas and Corpora AI foundation

### Added

- Published the Corpora AI Worker and self-hosted Node/Python preview paths.
- Added algorithmic analysis with optional AI enrichment.
- Added opt-in evaluation memory with raw-input minimization.
- Added AES-256-GCM protection for persisted proof records when configured.
- Added MIT licensing, notices, upstream credits, and deployment documentation.

[Unreleased]: https://github.com/1243353366/corpora-ai/compare/main...HEAD


## Complete repository manifest — 2026-09-19

This section records every file tracked on the `main` branch at the time of publication. The manifest is intentionally complete so the changelog also serves as a compact repository inventory.

### Deployment and automation

| File | Purpose |
|---|---|
| `.github/workflows/deploy.yml` | Manual Node 24 CI and locked Wrangler deployment workflow |
| `.gitignore` | Excludes dependencies, Wrangler output, Python caches, and local collector audit logs |
| `.nvmrc` | Node 24 runtime pin |
| `package.json` | Runtime engine, scripts, and Wrangler dependency declaration |
| `package-lock.json` | Locked npm dependency graph, including Wrangler 4 |
| `wrangler.toml` | Canonical Cloudflare Worker configuration |

### Application runtime and interface

| File | Purpose |
|---|---|
| `src/index.js` | Cloudflare Worker, API routes, ingestion, normalization, detection, trust health, retrieval, reasoning, and embedded dashboard |
| `selfhost.mjs` | Node self-host adapter for the Worker runtime |
| `selfhost/python_server.py` | Minimal Python algorithmic fallback service; not a replacement for the Worker ingestion runtime |

### Authorized collectors and direct ingestion

| File | Purpose |
|---|---|
| `collector/README.md` | Collector setup, protocol, visibility, and authorization boundaries |
| `collector/ingestion_protocol.py` | Single direct transport implementation for authentication, batch limits, retry/backoff, graceful failure, and audit logging |
| `collector/local_linux_collector.py` | Read-only local `/proc` fallback collector, explicitly labeled `container-local` |
| `collector/osquery_collector.py` | Fixed-query osquery collector for an authorized Linux host |
| `collector/osquery-lab.json` | Local-only collector configuration, endpoint identity, ingestion URL, and token environment |

### Data, contracts, and evidence governance

| File | Purpose |
|---|---|
| `schema-corpora.sql` | SQLite/D1 schema for corpus, knowledge, evaluation, EDR, detection, rejection, and feedback data |
| `contracts/observatory-reasoning.v1.json` | Machine-readable evidence and reasoning contract |
| `docs/AI-THREAT-OBSERVATORY-REASONING.md` | Human-readable Observatory reasoning and knowledge-layer specification |

### Documentation, audit, licensing, and attribution

| File | Purpose |
|---|---|
| `README.md` | Public product, deployment, safety, runtime, and integration documentation |
| `ARCHITECTURE-MAP.md` | Canonical file ownership, source-of-truth rules, boundaries, and verification map |
| `AUDIT-REPORT.md` | Full-system validation, EDR health, and known limitation report |
| `CREDITS.md` | Existing project and upstream attribution record |
| `UPSTREAM-CREDITS.md` | Consolidated creators, projects, licenses, and reference-only attribution |
| `INGEST-LOG.md` | Ingestion history and provenance notes |
| `CHANGELOG.md` | This release history and complete repository manifest |

### Release-level system summary

Corpora AI is organized as a defensive evidence and telemetry system rather than a single script. The supported path is local `/proc` or authorized osquery collection, one shared direct ingestion protocol, an ingestion API that owns provenance and validation, event hashing and deduplication, telemetry-trust health, detection and correlation, evidence retrieval and reasoning, and a dashboard that exposes uncertainty and visibility boundaries. The Node adapter remains intentionally present as the self-hosted runtime/API boundary. The Python service remains a limited algorithmic fallback. No file in this manifest authorizes external scanning, arbitrary command execution, malware execution, retaliation, or unsupported actor attribution.

At this release, the local `/proc` path has been exercised successfully in the container-local environment. The osquery collector is syntax-tested and fail-closed, but host-level osquery collection remains unverified until `osqueryi` is installed and run on the authorized self-hosted Linux host.


## [2026-09-19] — SSH defensive telemetry trio

### Added

- Added `collector/ssh_local_telemetry.py` for read-only local process and listening-port observations.
- Added `collector/ssh-local.json` with authorized-lab, local-only, telemetry-only policy.
- Added `collector/ssh_honeypot.py` as a non-executing localhost deception listener on `127.0.0.1:2222`.
- Added `collector/ssh-honeypot.json` with the same fail-closed local policy.
- Extended the server ingestion allowlist for `ssh-local` and `ssh-honeypot` while preserving server-assigned provenance and visibility.

### Safety boundaries

The honeypot does not authenticate, execute commands, invoke a shell, proxy traffic, tunnel traffic, accept remote targets, or create a command-and-control channel. The SSH telemetry collector reads local evidence only. The shared protocol supports an authorized HTTPS telemetry relay but does not provide C2 semantics; an external relay must be a specifically configured ingestion API, never a control endpoint.

### Verification

Python syntax, JSON configuration, Worker syntax, forbidden-primitive scanning, and diff checks passed. Both SSH collectors use the shared authentication, bounded batching, retry/backoff, graceful failure, audit logging, event identity, heartbeat, and server-validation path.


## [2026-09-19] — Contained C2 simulation and platform threat model

### Added

- Added a fail-closed synthetic cyber-range C2 simulator in `src/index.js`.
- Added catalog, run, and containment routes under `/api/range/c2/*`.
- Added predefined harmless simulation tasks, synthetic agent IDs, jitter metadata, task/result correlation, detection latency, expected-versus-actual detection, evidence retention, recovery status, and synthetic containment records.
- Added `THREAT-MODEL.md` covering telemetry poisoning, untrusted evidence and prompt injection, collector compromise, API abuse, resource exhaustion, SSRF boundaries, cyber-range escape, and recovery trust.

### Verification

- Detected-beacon and intentionally not-detected scenarios both passed.
- Synthetic events were classified as `SIMULATED_C2`, distinct from live local telemetry.
- Synthetic containment isolated only synthetic agent IDs and reported no external effect.
- Invalid range, authorization, target, isolation, or safe-mode preflight was rejected with HTTP 403.
- No arbitrary commands, shell execution, external-agent enrollment, scanning, persistence, privilege escalation, lateral movement, tunneling, file transfer, malware deployment, or Internet-facing C2 listener was added.


## [2026-09-19] — Investigation workstation contract

Added `docs/INVESTIGATION-WORKSTATION.md` and `contracts/investigation-workstation.v1.json`. The contract separates human responsibilities from AI reasoning, defines the retrieve/verify/correlate/challenge/hypothesize/test/explain/recommend/preserve-provenance loop, requires observed-versus-inferred claim levels and competing hypotheses, treats telemetry gaps as uncertainty rather than absence of threats, and requires human authorization for high-impact defensive actions. It also formalizes the controlled experiment and simulation-learning loop without granting the AI operational authority.


## [2026-09-19] — Evidence and legal governance layer

Added versioned evidence-governance and legal-source contracts, plus documentation for original-versus-derived artifacts, SHA-256 integrity verification, append-oriented chain of custody, legal holds, claim-level separation, authorization gates, Michigan and federal legal-information limitations, and customer-policy-dependent retention. The dashboard now asks customers where data will be processed or stored and whether EU/EEA personal data is involved. It enables **EUROPEAN DATA-PROTECTION MODE** from customer-declared configuration without inferring location from IP addresses and without claiming GDPR compliance. The UI explicitly states that hashing and custody metadata do not guarantee admissibility and that legal conclusions require qualified counsel.


## [2026-09-19] — Customer data pipeline and encrypted persistence

Added a customer-facing first-run data-use notice covering purpose, scope, and why data is needed. The prompt requires acknowledgment before saving a jurisdiction profile and enables European data-protection mode from customer-declared answers. Persisted analysis output and claims now fail closed unless a valid server-side AES-256-GCM key is configured, matching the existing encrypted observatory-proof boundary. Documentation explicitly distinguishes encrypted storage at rest from true end-to-end encryption because the analysis service must receive plaintext during authorized processing.


## [2026-09-19] — Data-flow diagnostics and privacy intelligence

Added `/api/governance/diagnostics` and a dashboard repair panel covering customer input, AI processing, redacted operational logs, error state, telemetry, bounded collector audit, encrypted database persistence, encrypted audit records, and authorized exports. The endpoint reports missing encryption, database, transport, or localhost collector configuration without returning customer content, tokens, keys, or raw exception bodies, and provides concrete repair steps.

Added a browser-local privacy exposure scan and organization-level data-broker intelligence documentation. The scan hashes a customer-controlled identifier locally, compares it only with customer-pasted public material, sends no identifier or pasted material to Corpora or broker sites, discloses storage boundaries, and provides a cautious opt-out workflow. The five supplied upstream sources remain reference-only until independently reviewed; no private-person records or upstream code are incorporated.


## [2026-09-19] — Localhost failure recovery

Fixed a verified defect in the local-proc collector launcher: it was invoking the shared configuration validator with the default `osquery` collector type, causing valid local-proc configurations to be rejected. The launcher now passes `local-proc` explicitly. A wrong localhost port was tested end to end: the collector capped retries at four, recorded retry/failure audit stages, and returned `DEGRADED`; after correcting the port and supplying the lab ingestion token, real container-local process telemetry was authenticated, server-labeled, normalized, deduplicated, correlated, audited, and displayed successfully.
