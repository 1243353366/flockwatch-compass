# Corpora AI architecture map

## Canonical runtime path

```text
/proc fallback or osquery
        ↓
collector/ingestion_protocol.py
        ↓  Bearer authentication, bounded batch, retry/backoff, local audit log
POST /api/edr/ingest
        ↓
server-owned provenance and visibility
        ↓
schema validation, event hash, deduplication
        ↓
heartbeat and telemetry-trust health
        ↓
detection, correlation, audit response
        ↓
Worker API and dashboard
```

The self-host adapter remains the runtime that exposes the ingestion API. It is not a second collector protocol implementation and is intentionally retained as the deployment boundary.

## File ownership map

| Layer | Canonical files | Role | Status |
|---|---|---|---|
| Local collection | `collector/local_linux_collector.py` | Read-only `/proc` fallback; explicitly `container-local` | Critical, tested |
| SSH telemetry | `collector/ssh_local_telemetry.py`, `collector/ssh-local.json` | Read-only local process/listening-port evidence; direct authenticated relay | Critical, syntax-tested |
| SSH deception | `collector/ssh_honeypot.py`, `collector/ssh-honeypot.json` | `127.0.0.1:2222` banner-only listener; records attempts without execution | Bounded, syntax-tested |
| Cyber-range simulation | `src/index.js` `/api/range/c2/*` routes | Synthetic agents, fixed tasks, detection, range-only containment | Critical, end-to-end tested |
| Threat model | `THREAT-MODEL.md` | Security properties, attack surfaces, limitations, and residual uncertainty | Reviewed |
| Host collection | `collector/osquery_collector.py` | Fixed read-only osquery queries; intended for authorized host-level collection | Critical, syntax-tested; live osquery unverified because `osqueryi` is absent |
| Collector protocol | `collector/ingestion_protocol.py` | One source of truth for auth, 64 KiB batch bound, retry/backoff, failure state, and JSONL audit | Critical, tested |
| Collector policy | `collector/osquery-lab.json` | Local-only target, endpoint identity, ingestion URL, token environment | Critical, parsed |
| Collector documentation | `collector/README.md` | Protocol, visibility, and host/container boundary | Tested/documented |
| Ingestion API | `src/index.js` (`handleAuthorizedCollectorIngest`) | Bearer gate, lab-policy gate, server-owned collector and visibility | Critical, tested |
| Normalization/detection | `src/index.js` (`handleEdrEvents`, `detectEdrEvent`) | Version checks, required fields, event IDs, server hashes, dedupe, detection and audit stages | Critical, tested |
| Trust/health | `src/index.js` (`handleEdrHealth`, `EDR_HEALTH`) | Freshness, heartbeat, duplicate/rejection/auth/timestamp counters, `VERIFIED`/`DEGRADED`/`UNVERIFIED` | Critical, tested |
| Evidence/reasoning | `src/index.js` (`handleKnowledgeRetrieve`, `handleObservatoryProof`) | Content retrieval, provenance-labeled proof, skeptic pass, bounded simulation plan | Critical, smoke-tested |
| Browser UI | `src/index.js` embedded `PAGE`, `PAGE_CSS`, `PAGE_JS` | Dashboard, synthetic canary, retrieval, proof, and server-derived health display | Coupled to Worker shell, syntax-tested |
| Data schema | `schema-corpora.sql` | D1 tables for corpus, sources, documents, claims, EDR events/detections/rejections | Canonical schema, SQLite-parsed |
| Deployment config | `wrangler.toml` | Canonical Worker entry point and D1 binding | Canonical |
| Runtime config | `package.json`, `package-lock.json`, `.nvmrc` | Node 24 engine and locked Wrangler 4 | Canonical, Node 24 validated |
| CI/deployment | `.github/workflows/deploy.yml` | Node version from `.nvmrc`, `npm ci`, locked `npm exec -- wrangler` | Canonical, manual deploy |
| Python fast path | `selfhost/python_server.py` | Minimal algorithmic fallback; does not replace the Worker ingestion runtime | Separate, intentionally limited |
| Policy/contracts | `contracts/observatory-reasoning.v1.json`, `docs/AI-THREAT-OBSERVATORY-REASONING.md` | Reasoning and evidence-governance contract | Reference/policy |
| Attribution | `CREDITS.md`, `UPSTREAM-CREDITS.md`, `NOTICE.md` | Upstream credit and license boundary | Documentation |

## Source-of-truth rules

1. **Collector transport:** `collector/ingestion_protocol.py` is the only collector-side transport implementation. Collectors must not implement their own auth, retry, or HTTP logic.
2. **Server provenance:** `src/index.js` assigns `SYNTHETIC_FIXTURE` or `LIVE_LOCAL_OBSERVATION`; client-supplied labels are not trusted.
3. **Event identity:** collectors create deterministic event IDs for replay control, while the server independently calculates `observationId` hashes and owns deduplication.
4. **Visibility:** `container-local` is not promoted to `host-level`. Host-level visibility requires an authorized osquery deployment on the actual self-hosted host.
5. **Schema:** `schema-corpora.sql` is the D1 schema source. The Worker API is the runtime contract.
6. **Deployment:** `wrangler.toml` is the only deploy configuration. Node 24 and locked Wrangler are defined by `package.json`, `package-lock.json`, and `.nvmrc`.

## Boundary findings

| Finding | Classification | Action |
|---|---|---|
| Adapter and collector are separate concerns | Intentional coupling | Keep adapter as ingestion API/runtime boundary; collectors speak one direct protocol |
| Embedded Worker frontend and backend share `src/index.js` | Coupled but deliberate | Preserve until a larger module split is justified by tests |
| Node self-host and Python fallback both exist | Separate runtime | Python is explicitly limited and must not be treated as a second EDR implementation |
| Live osquery is unavailable in this environment | Unverified capability | Do not claim host-level EDR until `osqueryi` is installed and exercised on the authorized host |
| Local audit log is runtime-generated | Expected artifact | Ignored by Git; retained on the self-hosted runtime |

## Verification coverage

The direct protocol has passed syntax checks, successful localhost ingestion, server-owned visibility verification, heartbeat recovery, malformed-event rejection, authentication rejection, and bounded retry testing against an unreachable localhost port. The adapter remains present and was not removed. No external target or remote host was contacted.
