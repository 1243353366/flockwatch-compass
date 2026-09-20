# Corpora AI threat model

## Scope

Corpora AI is treated as a security platform with a defensive evidence, telemetry, retrieval, reasoning, and controlled cyber-range surface. The model covers the Worker/API, local collectors, direct ingestion protocol, D1/SQLite schema, self-host adapters, dashboard, reasoning layer, and contained C2 simulator. It does not authorize testing against external systems.

## Security property

> No single untrusted observation is sufficient to establish attribution, compromise, or a high-impact conclusion.

Corpora AI should require corroboration, preserve uncertainty, distinguish observation from inference, and retain the evidence needed to explain why a conclusion was reached.

## Attack-surface matrix

| Surface | Representative attack | Required defensive property | Current control |
|---|---|---|---|
| Web/API abuse | Malformed requests, enumeration, resource exhaustion | Validation, rate limits, bounded work | Request validation, rate limiting, bounded event batches |
| Telemetry poisoning | Forged observations, provenance claims, duplicates, contradictory timestamps | Server-owned provenance, authentication, deduplication, trust degradation | Bearer ingestion auth, server-assigned classification/visibility, event hashes, duplicate tracking, timestamp metrics |
| Credential compromise | Reused ingestion or feedback token | Authentication failure visibility and server-only secrets | Authorization headers, authentication-failure counters, tokens are environment secrets |
| Prompt injection | Instructions embedded in documents, metadata, URLs, or evidence | Treat external content as data, not policy | Retrieval/proof contracts preserve provenance and uncertainty; no external content is promoted to system instruction |
| Evidence manipulation | Modify, delete, or rewrite observations and audit records | Append-oriented storage and integrity verification | Event observation hashes, audit stages, rejection quarantine, JSONL collector audit records |
| AI manipulation | Misleading evidence engineered to force a false conclusion | Evidence weighting, contradictions, alternatives, uncertainty | Skeptic review, alternative hypotheses, missing-evidence fields, negative-evidence guard |
| Dependency/supply chain | Compromised package, action, or build dependency | Lockfiles and reproducible runtime | `package-lock.json`, Node 24 pin, locked Wrangler, manual CI deployment |
| Worker/API compromise | Authorization or input-validation flaw | Least privilege, fail-closed policy, audit trails | Route validation, collector policy gate, bounded inputs, explicit simulation preflight |
| Collector compromise | False health or telemetry claims | Server-derived provenance and independent heartbeat | Server overwrites collector claims; heartbeat and freshness determine trust |
| DoS/retry amplification | Floods, huge batches, retry storms | Limits, backoff, bounded retries | 64 KiB batch limit, max 50 events, four-attempt capped backoff, graceful degraded state |
| SSRF-style abuse | Server-side fetch to unintended destination | Strict outbound allowlist | Retrieval is D1/embedded-seed based; collectors permit localhost HTTP or configured HTTPS ingestion only |
| Cross-tenant boundary | Access to another investigation’s evidence | Object-level authorization | Must remain a deployment requirement before multi-tenant exposure; no claim of complete multi-tenant isolation |
| Cyber-range escape | Simulation reaching production systems | Hard preflight, synthetic IDs, isolated binding | Required range/authorization/synthetic/isolated/safe-mode flags; no external agents or commands |
| Log/audit evasion | Actions without reliable evidence | Independent audit and integrity checks | Server audit stages, collector JSONL audit, event hashes, evidence-retention fields |

## Telemetry-poisoning test model

The controlled test sequence is:

```text
fake or malformed observation
        ↓
server authentication and schema gate
        ↓
server provenance assignment
        ↓
hash and deduplicate
        ↓
correlate without overclaiming
        ↓
reason with alternative hypotheses
        ↓
contain only inside the synthetic range
        ↓
retain evidence and recovery state
```

A collector-provided value such as `LIVE_LOCAL_OBSERVATION`, `container-local`, or `synthetic=false` is a claim, not authority. The server establishes the final classification from the authenticated route and validated lab configuration.

## Untrusted evidence and prompt injection

Imported text, malware metadata, URLs, and investigation evidence are untrusted content. Instruction-like strings inside them must remain content and must not override system policy, delete evidence, mark an incident resolved, or authorize an action. A reasoning result should explicitly identify instruction-like content, preserve the source and hash, and explain what independent evidence is still required.

## Controlled attack record

Every future defensive test should record:

| Field | Meaning |
|---|---|
| Attack simulated | Bounded scenario and preflight decision |
| Evidence generated | Event IDs, hashes, provenance, and timestamps |
| Detection expected/observed | Whether the rule should and did trigger |
| Containment | Authorized range-only action and result |
| Evidence preserved | Whether the audit trail survived the test |
| Recovery | Whether trust returned to verified state |
| Residual uncertainty | Missing evidence and alternative explanations |

## Current limitations

The local `/proc` path is demonstrated only as `container-local` telemetry. Host-level osquery remains unverified until it is installed and exercised on the authorized self-hosted host. Cross-tenant isolation, append-only remote audit storage, and production-grade key rotation require deployment-specific controls and are not claimed by the local preview.
