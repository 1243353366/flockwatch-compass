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
