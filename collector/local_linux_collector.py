#!/usr/bin/env python3
"""Minimal local Linux telemetry collector for the authorized application host.

Uses only local /proc and /etc reads when osqueryi is unavailable. It never
accepts a remote target, scans a network, or executes a command.
"""
import argparse
import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from ingestion_protocol import graceful_error, send_batch
from osquery_collector import event_id, load_config


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def process_rows():
    rows = []
    for entry in Path("/proc").iterdir():
        if not entry.name.isdigit():
            continue
        try:
            status = (entry / "status").read_text(errors="replace")
            fields = dict(line.split(":", 1) for line in status.splitlines() if ":" in line)
            cmdline = (entry / "cmdline").read_bytes().replace(b"\0", b" ").decode(errors="replace").strip()
            name = fields.get("Name", "").strip()
            parent = fields.get("PPid", "").strip()
            rows.append({"pid": entry.name, "parent": parent, "name": name, "path": "", "cmdline": cmdline, "uid": fields.get("Uid", "").split()[0] if fields.get("Uid") else ""})
        except (FileNotFoundError, PermissionError, OSError):
            continue
    return rows[:1000]


def build_payload(config):
    observed = now()
    heartbeat = {"table": "collector_heartbeat", "collector": "local-proc", "observedAt": observed}
    events = [{
        "synthetic": False, "collector": "local-proc", "eventVersion": "edr.identity.v1", "eventType": "identity_heartbeat",
        "eventId": "local-proc-heartbeat-" + event_id("heartbeat", heartbeat, observed).split("osquery-", 1)[-1], "observedAt": observed,
        "hostId": config["endpoint_id"], "username": "", "provenance": {"classification": "LIVE_LOCAL_OBSERVATION", "source": "local-proc", "table": "collector_heartbeat", "authorization": "authorized-lab-local", "collectionTimestamp": observed, "visibility": "container-local"}
    }]
    for row in process_rows():
        events.append({
            "synthetic": False, "collector": "local-proc", "eventVersion": "edr.process.v1", "eventType": "process_observation",
            "eventId": "local-proc-" + event_id("local-proc-processes", row, observed).split("osquery-", 1)[-1], "observedAt": observed,
            "hostId": config["endpoint_id"], "processName": row["name"], "parentProcess": row["parent"],
            "commandLine": row["cmdline"], "filePath": row["path"], "username": row["uid"],
            "provenance": {"classification": "LIVE_LOCAL_OBSERVATION", "source": "local-proc", "table": "processes", "authorization": "authorized-lab-local", "collectionTimestamp": observed, "visibility": "container-local"}
        })
    return {"lab": {**config, "collector": "local-proc"}, "events": events[:50]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default=str(Path(__file__).with_name("osquery-lab.json")))
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    config = load_config(args.config, "local-proc")
    while True:
        payload = build_payload(config)
        if not payload["events"]:
            print(json.dumps({"state": "DEGRADED", "reason": "no readable local process telemetry", "events": 0}), flush=True)
        else:
            try:
                result = send_batch(config, payload)
                print(json.dumps({"state": "COLLECTED_AND_INGESTED", "collector": "local-proc", "visibility": "container-local", "events": len(payload["events"]), "result": result}), flush=True)
            except RuntimeError as exc:
                print(json.dumps(graceful_error(config, exc)), flush=True)
                if args.once:
                    return
                time.sleep(min(interval, 8))
        if args.once:
            return
        time.sleep(max(10, int(config.get("interval_seconds", 30))))


if __name__ == "__main__":
    main()
