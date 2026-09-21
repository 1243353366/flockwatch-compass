# Project Compass Adversarial Threat Model

## Security posture

Project Compass assumes an active attacker will attempt credential theft, forged and replayed requests, consent bypass, data poisoning, prompt injection, privilege escalation, cross-customer access, unauthorized external actions, botnet-driven resource exhaustion, and secret exfiltration through logs or model output. Controls are implemented at the gateway and subsystem boundaries rather than delegated to the planning model.

## Current production boundary

The Render web service is the only public component. It serves static assets, performs cheap validation, issues origin-bound one-time request tokens, enforces body and rate limits, validates consent, runs the deterministic planning model, and returns a decision brief. Optional AI is disabled in production. When enabled, AI calls pass through a bounded local queue with two concurrent jobs, a queue-depth circuit breaker, an 18-second timeout, output shape validation, and a transparent-model fallback.

A free Render Key Value instance named `project-compass-queue` has been provisioned with persistence disabled and no public IP allow list. A dedicated Render Background Worker configuration is staged in `render-worker.yaml`, but it is not activated because Render has no free background-worker plan. Activating it would create paid compute and requires the user's payment configuration and explicit action.

## Request defenses

| Threat | Current control | Residual / next control |
| --- | --- | --- |
| Forged browser request | Strict origin comparison, `SameSite=Strict` binding cookie, and one-time header token | Put Render behind a CDN/WAF for reputation and managed-bot controls |
| Replay | One-time token, two-minute request timestamp, and unique idempotency key | Persist replay state in shared Key Value when running multiple web instances |
| Oversized or ambiguous payload | 64 KB limit and mandatory JSON content type | Add schema version negotiation if third-party API clients are enabled |
| Botnet burst | Per-IP minute and burst limits, token-endpoint limits, global concurrency cap, downstream queue cap | Add edge reputation, per-account/API-key quotas, and reversible quarantine after accounts exist |
| Consent bypass | Server-side required-purpose validation plus conditional high-risk gates | Store tamper-evident consent receipts if account-based audit retention is introduced |
| Sensitive-information disclosure | Explicit category declaration, purpose limitation, and informed-risk override | Add tenant-specific DLP rules before file uploads are supported |
| Prompt injection | Company fields are treated as untrusted data; model system prompt forbids following embedded instructions or taking actions | Add document segmentation and instruction classifiers before uploaded content is supported |
| Data poisoning | Objective-materiality test and evidence-to-action trace | Add Corpora evidence provenance, source reliability, and contradiction review as a separate subsystem |
| Secret theft / log exfiltration | Secrets remain server-side; errors log names only; responses expose no keys | Add centralized secret scanning and structured redaction if persistent logs are introduced |
| Unauthorized action | No deployment, purchase, account, or tool action exists in the recommendation path | Keep high-impact actions behind a separate human-approval service if ever added |
| Cross-tenant access | No accounts, tenants, or persistent customer store exist | Do not enable multi-tenant storage until row-level authorization and tenant-isolation tests exist |

## Evidence and fraud boundary

Project Compass is the business and project-management layer. A future Corpora subsystem may supply sourced claims with provenance, confidence, and contradiction metadata. Fraud-related inputs must remain verification signals. The system may state that a signal warrants additional verification; it must not label a company or person fraudulent without an appropriate evidence and adjudication process.

A normalized signal should include `signal`, `source`, `status`, `verified`, `confidence`, and `impact`. Project Compass may use the signal only when it materially affects the stated objective, and any resulting recommendation must retain the full **Evidence → Interpretation → Recommendation → Action → Owner → Dependency → Success criterion** chain.

## Multi-service target

```text
Internet
  ↓
CDN / WAF
  ↓
Public Render gateway
  ├─ request token + origin + replay controls
  ├─ consent and purpose policy gate
  ├─ size, burst, and concurrency limits
  └─ queue submission
          ↓
Private Render Key Value queue
          ↓
Bounded Background Worker(s)
  ├─ planning worker
  ├─ future evidence worker
  └─ future verification-signal worker
          ↓
Objective-linked reconciliation
          ↓
Decision brief
```

The background worker exposes no HTTP port. Queue entries must use short retention, removal on completion or failure, and encrypted private-network transport. A worker must never receive Render API credentials unless its narrowly scoped job requires them; the planning worker does not.

## Production gates

Account, tenant, upload, training, retention, external-action, and administrator features are intentionally absent. Each remains disabled until its authentication, authorization, isolation, audit, deletion, abuse-defense, and human-approval controls are implemented and tested.
