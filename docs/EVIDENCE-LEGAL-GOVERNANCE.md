# Evidence, legal, and jurisdiction governance

## Limitation

Corpora AI preserves evidence-management metadata and provides legal information references. It does **not** determine admissibility, provide legal advice, guarantee compliance, or replace qualified counsel. Hashing and chain-of-custody metadata support authentication and review but do not automatically establish admissibility.

## Best-evidence handling

The application treats the best-evidence concept as an evidence-preservation requirement, not as a simplistic requirement that every digital artifact remain on its original physical device. Where technically and legally possible, preserve the original artifact, calculate a SHA-256 hash, record the algorithm/version, acquisition and observation timestamps, ingestion timestamp, collector identity/version, acquisition method, source system and identifier, size, MIME type, transformations, exports, and derivative relationships.

Originals are never overwritten. A normalized, parsed, redacted, decrypted, summarized, or enriched artifact is a new derived artifact linked to the original. Analyst annotations remain separate. Evidence status is explicit: `ORIGINAL`, `FORENSIC_COPY`, `DUPLICATE`, `DERIVED`, `SUMMARY`, `ANALYST_NOTE`, `SYNTHETIC`, or `UNKNOWN`.

## Chain of custody

Custody history is append-oriented and records the evidence ID, event ID, handler, authenticated identity, role, timestamp, action, reason, source, destination, hash before and after when applicable, verification result, authorization context, case/investigation ID, related ticket/report, and whether the event was system- or human-generated. Supported transitions include `COLLECTED`, `HASHED`, `STORED`, `VERIFIED`, `ACCESSED`, `EXPORTED`, `COPIED`, `REVIEWED`, `SEALED`, and `DELETED_UNDER_POLICY`.

Deletion never disappears silently. An authorized deletion records who acted, when, why, under which policy or authority, what was deleted, and the artifact hash or identifier. A legal hold overrides ordinary cleanup until properly released.

## Integrity verification

Periodic and on-demand verification must compare the expected hash with the actual hash and record the verification time and method. A mismatch produces `EVIDENCE_INTEGRITY_FAILED`, preserves the failed-verification evidence, and creates an integrity incident. The system must not silently repair, replace, or overwrite the artifact.

## Claim separation

The product distinguishes `OBSERVED_FACT`, `AUTHENTICATED_EVIDENCE`, `DERIVED_DATA`, `INFERENCE`, `HYPOTHESIS`, and `ATTRIBUTION`. The AI must not promote an inference to an observed fact. Important conclusions should show provenance, supporting evidence IDs, confidence, alternatives, missing evidence, and the limitation that network evidence does not by itself establish operator identity.

## United States and Michigan profiles

The application exposes United States and Michigan profiles as legal-information references. They point to concepts including authentication, originals and duplicates, electronic records, preservation, access authorization, privacy/data handling, incident response, disclosure, retention, and legal process. The versioned reference registry includes Federal Rules of Evidence concepts such as FRE 901, FRE 1001–1004, and FRE 803(6) where applicable, and Michigan Rules of Evidence concepts such as MRE 901 and MRE 1001–1004. The application does not encode a conclusion that evidence is admissible. Where facts, proceeding, authorization, contract, or jurisdiction matter, it displays `LEGAL REVIEW REQUIRED` or `COUNSEL REVIEW RECOMMENDED`.

When the proceeding is unknown, the status is `FEDERAL JURISDICTION UNKNOWN`, `LEGAL ANALYSIS LIMITED`, and `COUNSEL REVIEW RECOMMENDED`.

## European data-protection mode

On first use, the dashboard asks where customer data will be processed or stored and whether EU/EEA personal data will be processed. It does not infer jurisdiction from IP geolocation. If the customer selects EU/EEA or answers yes to EU/EEA personal data, the interface enables **EUROPEAN DATA-PROTECTION MODE**. This label is not “GDPR compliant.”

The mode is a configuration profile for purpose limitation, data minimization, storage limitation, accuracy, integrity/confidentiality, accountability, privacy by design/default, access control, encryption, pseudonymization where appropriate, retention and deletion workflows, access/export workflows, auditability, breach response, controller/processor role documentation, legal-basis recording, and cross-border transfer configuration. Encryption and pseudonymization do not automatically remove data from legal scope when re-identification remains possible.

Data region, storage region, processing region, backup region, AI-processing region, third-party processor, and cross-border transfer state should be explicitly recorded. If the deployment cannot establish these values, the dashboard must display `DATA RESIDENCY = UNVERIFIED`.

## Authorization gate

Before active collection, testing, simulation, or response, the system requires target ownership, authorization, defined scope, rules of engagement, time window, third-party-system status, data-processing authority, and legal-review status. Ambiguous authorization blocks active action. Passive observation and isolated synthetic simulation may remain available where appropriate.

The AI may identify preservation risks, missing custody fields, jurisdictional questions, and relevant legal references. It must not declare admissibility or inadmissibility, fabricate legal authority or chain of custody, alter evidence to improve admissibility, or claim that the product guarantees compliance.

The machine-readable contract is [`contracts/evidence-governance.v1.json`](../contracts/evidence-governance.v1.json).
