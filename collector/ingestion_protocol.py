#!/usr/bin/env python3
"""Direct production ingestion protocol for authorized local collectors.

The collector talks to the ingestion API directly. The server remains the
source of truth for provenance, hashes, validation, deduplication, and health.
"""
import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

RETRYABLE_STATUS = {408, 425, 429, 500, 502, 503, 504}
MAX_ATTEMPTS = 4
MAX_BATCH_BYTES = 64 * 1024


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def audit_path(config):
    return Path(config.get("audit_log", str(Path(__file__).with_name("collector-audit.jsonl"))))


def append_audit(config, record):
    record = {"auditTime": utc_now(), **record}
    path = audit_path(config)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, separators=(",", ":")) + "\n")


def send_batch(config, payload):
    token = os.environ.get(config["token_env"], "")
    if not token:
        append_audit(config, {"stage": "auth", "status": "failed", "reason": "missing_token"})
        raise RuntimeError(f"environment variable {config['token_env']} is missing")
    body = json.dumps(payload, separators=(",", ":")).encode()
    if len(body) > MAX_BATCH_BYTES:
        append_audit(config, {"stage": "backpressure", "status": "rejected", "reason": "batch_too_large", "bytes": len(body)})
        raise RuntimeError("ingestion batch exceeds bounded protocol size")
    request = urllib.request.Request(config["ingest_url"], data=body, method="POST", headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    last_error = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                raw = response.read().decode()
                result = json.loads(raw or "{}")
                if response.status >= 300:
                    raise urllib.error.HTTPError(request.full_url, response.status, "ingestion rejected", response.headers, None)
                append_audit(config, {"stage": "ingest", "status": "accepted", "attempt": attempt, "received": result.get("received"), "processed": result.get("processed"), "duplicates": result.get("duplicates"), "visibility": result.get("visibility"), "collector": result.get("collector")})
                return result
        except urllib.error.HTTPError as exc:
            last_error = f"HTTP {exc.code}"
            if exc.code not in RETRYABLE_STATUS:
                append_audit(config, {"stage": "ingest", "status": "rejected", "attempt": attempt, "error": last_error})
                raise RuntimeError(f"ingestion rejected with {last_error}") from exc
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = str(getattr(exc, "reason", exc))
        if attempt < MAX_ATTEMPTS:
            delay = min(2 ** (attempt - 1), 8)
            append_audit(config, {"stage": "retry", "status": "waiting", "attempt": attempt, "delaySeconds": delay, "error": last_error})
            time.sleep(delay)
    append_audit(config, {"stage": "ingest", "status": "failed", "attempts": MAX_ATTEMPTS, "error": last_error})
    raise RuntimeError(f"ingestion unavailable after {MAX_ATTEMPTS} attempts: {last_error}")


def graceful_error(config, error, state="DEGRADED"):
    append_audit(config, {"stage": "collector", "status": state.lower(), "error": str(error)})
    return {"state": state, "reason": str(error), "events": 0}
