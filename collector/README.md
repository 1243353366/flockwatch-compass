# Authorized local osquery collector

This directory contains the first real endpoint collector for Corpora AI. It is deliberately limited to an **authorized local Linux lab**. The collector runs fixed, read-only osquery queries for processes, listening ports, and users. It does not scan networks, accept remote targets, execute arbitrary commands, establish persistence, or disable controls.

## Configuration boundary

`osquery-lab.json` is machine-readable authorization. The collector refuses to start unless all of the following remain true:

- `environment` is `authorized-lab`;
- `collector` is `osquery`;
- `target_type` is `local`;
- `remote_targets`, `external_scanning`, and `production_access` are false;
- `telemetry_only` is true; and
- the ingestion URL is localhost HTTP or HTTPS.

The ingestion token is read from the environment variable named by `token_env`; it is never stored in the configuration file or repository.

## Run one collection

Install `osqueryi` on the authorized Linux lab machine using the official osquery documentation and package-signing process. Then start the local Node adapter with an ingestion token:

```sh
export INGEST_TOKEN="generate-a-long-random-lab-token"
PORT=8787 node ../selfhost.mjs
python3 osquery_collector.py --config osquery-lab.json --once
```

The collector sends authenticated batches to `/api/edr/ingest`. The server validates the lab policy and event schema, assigns observation hashes, deduplicates event IDs, stores events and detections when D1 is configured, and returns an audit path. Run without `--once` for the configured interval.

## Current verification state

The osquery collector source compiles and rejects remote or otherwise unsafe configurations. Live osquery collection is **UNTESTED in this repository environment because `osqueryi` is not installed**. The collector fails closed with an explicit error rather than pretending a substitute is osquery.

For containerized or minimal Linux environments where osquery is unavailable, `local_linux_collector.py` provides a deliberately narrower, read-only fallback from local `/proc` process state. It is labeled `local-proc`, authenticated through the same ingestion path, and reports `visibility=container-local`; it must not be interpreted as host-level EDR visibility.

## Direct production protocol

Both collectors now use `ingestion_protocol.py` directly:

```text
/proc or osquery → collector protocol client → Bearer-authenticated ingestion API
→ server-assigned provenance → schema validation → server hash/event identity
→ deduplication → heartbeat/health → detection → audit response
```

The protocol applies a 64 KiB bounded batch, retries only transient HTTP/network failures with capped exponential backoff, records accepted/rejected/retry/failure stages to a local JSONL audit log, and returns a degraded state instead of silently dropping collection failures. The existing adapter remains available as the ingestion API and is not removed.

## Upstream boundary

[osquery](https://github.com/osquery/osquery) is an architectural and endpoint-observation reference. This repository does not copy osquery code or redistribute its packages. Review the upstream license and package-signing requirements before installing it in the authorized lab.
