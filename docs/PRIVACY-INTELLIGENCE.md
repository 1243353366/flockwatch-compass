# Privacy intelligence and data-broker research

Corpora uses broker intelligence to help customers understand organizations that collect, aggregate, sell, expose, or license personal data. It is **not** a people-search service and must not become another data broker.

## Safe data-broker graph

The reference model is organization-centered:

```text
BROKER → collects → DATA TYPE
BROKER → sources → SOURCE
BROKER → operates → DOMAIN
BROKER → registered in → JURISDICTION
BROKER → exposes → DATA CLASS
BROKER → offers → OPT-OUT MECHANISM
BROKER → claims → PRIVACY POLICY
BROKER → subject to → REGULATION
```

The graph may contain public organization-level metadata, public privacy-policy claims, documented data categories, jurisdiction, opt-out URLs, and source provenance. It must not ingest private-person records, broker dumps, authentication data, scraped accounts, or identifiers obtained without authorization.

## Customer-controlled exposure scan

The dashboard scan is browser-local. A customer pastes public material they already obtained lawfully and enters an identifier they control. Corpora hashes the identifier in the browser, compares it only with the pasted text, and sends neither the raw identifier nor the pasted material to Corpora or a broker site. It does not crawl broker sites, confirm a match outside pasted material, or guarantee removal.

## Where data is stored

The UI discloses the current boundary: request memory is used during processing; raw input is not stored by default; persisted analysis output requires a valid AES-256-GCM key; and deployment, processing, storage, backup, and AI regions remain `UNVERIFIED` unless the operator documents them. Customer-selected jurisdiction and data-protection profiles are stored in browser local storage in the current lightweight preview; operators must use a managed authenticated profile store before treating those settings as authoritative account records.

## Opt-out workflow

When a source provides an official removal mechanism, the customer should open the source’s official page, use only the minimum verification information required, record the request date and confirmation privately, observe the stated processing period, and recheck. A dispute, identity-verification issue, legal request, or jurisdiction-specific right should be escalated to qualified counsel. Corpora may explain a public workflow but does not submit requests, impersonate a customer, bypass verification, or guarantee removal.

## Reference sources

These are reference-only sources and must be independently reviewed for current content, license, provenance, and organizational scope before ingestion:

- [OptOutRights/broker-directory](https://github.com/OptOutRights/broker-directory)
- [PersProtect/data-broker-opt-out-list](https://github.com/Persprotect/data-broker-opt-out-list)
- [Privacy Guides data-broker removals](https://github.com/privacyguides/privacyguides.org/blob/main/docs/data-broker-removals.md)
- [clening/databroker-monitor](https://github.com/clening/databroker-monitor)
- [DrCaiola/optout](https://github.com/DrCaiola/optout)

### Verified attribution notes

| Source | Creator or maintainer | License / usage boundary | Safe interpretation |
|---|---|---|---|
| OptOutRights/broker-directory | Opt Out Rights Foundation / OptOutRights GitHub organization | CC BY 4.0, per the repository’s own license and README | Organization-level broker directory; its contribution guidance prohibits private-person records. |
| PersProtect/data-broker-opt-out-list | PersProtect | CC BY 4.0, per the repository README and license | Organization and people-search-site metadata with opt-out references; links require current verification. |
| Privacy Guides data-broker removals | Privacy Guides volunteer collective | Documentation is CC BY-SA 4.0; repository code is separately MIT | Human-facing removal guidance, not a private-person dataset; adaptations must preserve attribution/share-alike requirements. |
| clening/databroker-monitor | Carey Lening | MIT | Reference for local-only opt-out tracking; do not import identity files, execute searches, or automate submissions. |
| DrCaiola/optout | DrCaiola repository owner/maintainer attribution | CC BY-NC-SA 4.0; adapted broker list has the same stated boundary | Noncommercial reference only unless permission is obtained; do not copy code/data into a commercial deployment without review. |

No upstream code or private-person data is incorporated by this release. The source list is an attribution and research index, not a claim that every source has been ingested or verified current. URLs, broker procedures, license statements, and legal requirements must be rechecked before use.
