# Customer data pipeline

## Why data is processed

Corpora AI processes customer-submitted text, authorized telemetry, configuration choices, and optional evaluation output to analyze material, retrieve related reference content, correlate observations, test authorized synthetic scenarios, produce reports, and maintain an auditable security workflow.

## Scope

The in-scope data categories are customer-submitted content, requested telemetry, security metadata, provenance and integrity metadata, jurisdiction selections, optional evaluation output, and operational records needed to rate-limit and secure the service. Raw analysis input is not stored by default. The service does not silently collect customer data based on IP geolocation.

## Storage and encryption

Data is transmitted over HTTPS in the published deployment. Persisted analysis output and claims are written only when a valid 32-byte `AI_MEMORY_ENCRYPTION_KEY` is configured; they are encrypted with AES-256-GCM and otherwise fail closed. Observatory proof records use the same server-side encryption boundary. The encryption key is never returned to the browser or health endpoint.

This is **server-side encryption at rest**, not end-to-end encryption. The service must receive plaintext during authorized processing so its analysis and retrieval functions can operate. A deployment must not claim end-to-end encryption unless a separate customer-held-key architecture is implemented and verified. The product does not store raw analysis text by default, but submitted content is necessarily present in request memory while processing.

## Customer acknowledgment

The first-run prompt explains why data is needed, what is in scope, and that retention, residency, legal basis, access, deletion, and transfer decisions remain customer-policy and counsel-controlled. The customer must acknowledge the notice before saving the jurisdiction profile. The profile is customer-declared and is not inferred from IP location.

## European data-protection mode

Selecting EU/EEA processing or indicating EU/EEA personal data enables **EUROPEAN DATA-PROTECTION MODE**. This is a safeguards profile, not a claim of GDPR compliance. It calls for purpose limitation, minimization, retention and deletion controls, access controls, encryption, pseudonymization where appropriate, accountability, processor/controller documentation, legal-basis records, data-residency verification, and transfer review.

## Product limitations

The service does not determine legal admissibility, provide legal advice, guarantee compliance, invent a retention period, or silently delete evidence. Qualified counsel and the customer’s documented policies remain responsible for legal conclusions and operational decisions.
