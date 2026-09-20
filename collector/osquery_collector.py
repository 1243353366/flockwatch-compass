#!/usr/bin/env python3
"""Authorized-local osquery collector for Corpora AI.

This collector only runs osqueryi locally with fixed read-only queries. It never
accepts a remote host, arbitrary shell command, or network scan target.
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
from urllib.parse import urlparse
from datetime import datetime, timezone
from pathlib import Path
from ingestion_protocol import append_audit, graceful_error, send_batch

FIXED_QUERIES = {
    "processes": ("edr.process.v1", "process_observation", "SELECT pid, parent, name, path, cmdline, uid FROM processes;"),
    "listening_ports": ("edr.network.v1", "network_connection", "SELECT address, port, protocol, pid FROM listening_ports;"),
    "users": ("edr.identity.v1", "identity_observation", "SELECT username, uid, directory, shell FROM users;"),
}


def fail(message):
    raise SystemExit(f"collector refused to run: {message}")


def load_config(path):
    config = json.loads(Path(path).read_text())
    required = {
        "environment": "authorized-lab",
        "collector": "osquery",
        "target_type": "local",
        "remote_targets": False,
        "external_scanning": False,
        "production_access": False,
        "telemetry_only": True,
    }
    for key, expected in required.items():
        if config.get(key) != expected:
            fail(f"config {key!r} must equal {expected!r}")
    if not config.get("endpoint_id") or not config.get("ingest_url") or not config.get("token_env"):
        fail("endpoint_id, ingest_url, and token_env are required")
    parsed_url = urlparse(config["ingest_url"])
    if not ((parsed_url.scheme == "http" and parsed_url.hostname in {"127.0.0.1", "localhost"}) or parsed_url.scheme == "https"):
        fail("ingest_url must be localhost HTTP or HTTPS")
    if config.get("target_type") != "local":
        fail("only local targets are supported")
    return config


def run_osquery(binary, query):
    if "/" in binary and not Path(binary).is_file():
        fail(f"osquery binary does not exist: {binary}")
    try:
        result = subprocess.run([binary, "--json", query], check=True, capture_output=True, text=True, timeout=20)
    except FileNotFoundError:
        fail("osqueryi is not installed; install it on the authorized lab Linux host")
    except subprocess.TimeoutExpired:
        fail("osquery query timed out")
    except subprocess.CalledProcessError as exc:
        fail(f"osquery query failed: {exc.stderr[:300]}")
    try:
        rows = json.loads(result.stdout or "[]")
    except json.JSONDecodeError:
        fail("osquery returned malformed JSON")
    if not isinstance(rows, list):
        fail("osquery returned a non-list result")
    return rows[:1000]


def event_id(table, row, observed_at):
    raw = json.dumps({"table": table, "row": row, "observed_at": observed_at}, sort_keys=True)
    return "osquery-" + hashlib.sha256(raw.encode()).hexdigest()


def collect(config):
    binary = config.get("osquery_binary", "osqueryi")
    observed_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    heartbeat = {"table": "collector_heartbeat", "collector": "osquery", "observedAt": observed_at}
    events = [{
        "synthetic": False, "eventVersion": "edr.identity.v1", "eventId": event_id("heartbeat", heartbeat, observed_at),
        "eventType": "identity_heartbeat", "observedAt": observed_at, "hostId": config["endpoint_id"], "username": "",
        "collector": "osquery", "provenance": {"classification": "LIVE_LOCAL_OBSERVATION", "source": "osquery", "table": "collector_heartbeat", "authorization": "authorized-lab-local", "collectionTimestamp": observed_at, "visibility": "host-level"}
    }]
    for table, (version, event_type, query) in FIXED_QUERIES.items():
        for row in run_osquery(binary, query):
            row = {str(k): row[k] for k in row}
            process_name = str(row.get("name", ""))
            event = {
                "synthetic": False,
                "eventVersion": version,
                "eventId": event_id(table, row, observed_at),
                "eventType": event_type,
                "observedAt": observed_at,
                "hostId": config["endpoint_id"],
                "processName": process_name,
                "parentProcess": str(row.get("parent", "")),
                "commandLine": str(row.get("cmdline", "")),
                "filePath": str(row.get("path", "")),
                "destinationIp": str(row.get("address", "")),
                "destinationPort": int(row["port"]) if str(row.get("port", "")).isdigit() else None,
                "username": str(row.get("username", row.get("uid", ""))),
                "collector": "osquery",
                "provenance": {"classification": "OBSERVATION", "source": "osquery", "table": table, "query": query, "collectionTimestamp": observed_at, "authorization": "authorized-lab-local", "rawReference": row},
            }
            events.append(event)
    return {"lab": config, "events": events[:50]}


def main():
    parser = argparse.ArgumentParser(description="Collect fixed read-only osquery telemetry from an authorized local Linux lab")
    parser.add_argument("--config", default=str(Path(__file__).with_name("osquery-lab.json")))
    parser.add_argument("--once", action="store_true", help="collect and ingest one batch")
    args = parser.parse_args()
    config = load_config(args.config)
    interval = max(10, int(config.get("interval_seconds", 30)))
    while True:
        try:
            payload = collect(config)
            result = send_batch(config, payload)
            print(json.dumps({"state": "COLLECTED_AND_INGESTED", "events": len(payload["events"]), "result": result}), flush=True)
        except (RuntimeError, SystemExit) as exc:
            print(json.dumps(graceful_error(config, exc)), flush=True)
            if args.once:
                return
        if args.once:
            return
        time.sleep(interval)


if __name__ == "__main__":
    main()
