#!/usr/bin/env python3
"""Authorized-local SSH telemetry collector.

Reads only local process/socket/authentication evidence. It never enables sshd,
scans remote hosts, accepts commands, or creates a control channel.
"""
import argparse
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from ingestion_protocol import graceful_error, send_batch
from osquery_collector import event_id, load_config


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def ssh_event_id(table, row, observed_at):
    return event_id(table, row, observed_at).replace("osquery-", "ssh-")


def local_sshd_processes():
    rows = []
    for entry in Path("/proc").iterdir():
        if not entry.name.isdigit():
            continue
        try:
            name = (entry / "comm").read_text(errors="replace").strip()
            if "ssh" not in name.lower():
                continue
            status = (entry / "status").read_text(errors="replace")
            fields = dict(line.split(":", 1) for line in status.splitlines() if ":" in line)
            rows.append({"pid": entry.name, "parent": fields.get("PPid", "").strip(), "name": name, "uid": fields.get("Uid", "").split()[0] if fields.get("Uid") else ""})
        except (FileNotFoundError, PermissionError, OSError):
            continue
    return rows


def local_listening_ports():
    results = []
    path = Path("/proc/net/tcp")
    if not path.exists():
        return results
    for line in path.read_text(errors="replace").splitlines()[1:]:
        parts = line.split()
        if len(parts) < 4 or parts[3] != "0A":
            continue
        try:
            port = int(parts[1].split(":", 1)[1], 16)
        except (IndexError, ValueError):
            continue
        if port in {22, 2222}:
            results.append({"address": "127.0.0.1", "port": port, "protocol": "tcp"})
    return results


def build_payload(config):
    observed = now()
    events = [{"synthetic": False, "eventVersion": "edr.identity.v1", "eventId": ssh_event_id("ssh-heartbeat", {"collector": "ssh-local"}, observed), "eventType": "identity_heartbeat", "observedAt": observed, "hostId": config["endpoint_id"], "username": "", "collector": "ssh-local", "provenance": {"classification": "LIVE_LOCAL_OBSERVATION", "source": "ssh-local", "table": "collector_heartbeat", "authorization": "authorized-lab-local", "visibility": "container-local"}}]
    for row in local_sshd_processes():
        events.append({"synthetic": False, "eventVersion": "edr.process.v1", "eventId": ssh_event_id("ssh-processes", row, observed), "eventType": "process_observation", "observedAt": observed, "hostId": config["endpoint_id"], "processName": row["name"], "parentProcess": row["parent"], "username": row["uid"], "collector": "ssh-local", "provenance": {"classification": "LIVE_LOCAL_OBSERVATION", "source": "ssh-local", "table": "local_processes", "authorization": "authorized-lab-local", "visibility": "container-local"}})
    for row in local_listening_ports():
        events.append({"synthetic": False, "eventVersion": "edr.network.v1", "eventId": ssh_event_id("ssh-listening", row, observed), "eventType": "network_connection", "observedAt": observed, "hostId": config["endpoint_id"], "destinationIp": row["address"], "destinationPort": row["port"], "collector": "ssh-local", "provenance": {"classification": "LIVE_LOCAL_OBSERVATION", "source": "ssh-local", "table": "local_listening_ports", "authorization": "authorized-lab-local", "visibility": "container-local"}})
    return {"lab": {**config, "collector": "ssh-local"}, "events": events[:50]}


def main():
    parser = argparse.ArgumentParser(description="Collect local SSH telemetry only")
    parser.add_argument("--config", default=str(Path(__file__).with_name("ssh-local.json")))
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    config = load_config(args.config, "ssh-local")
    interval = max(10, int(config.get("interval_seconds", 30)))
    while True:
        try:
            result = send_batch(config, build_payload(config))
            print(json.dumps({"state": "COLLECTED_AND_INGESTED", "collector": "ssh-local", "visibility": "container-local", "result": result}), flush=True)
        except Exception as exc:
            print(json.dumps(graceful_error(config, exc)), flush=True)
            if args.once:
                return
            time.sleep(min(interval, 8))
        if args.once:
            return
        time.sleep(interval)


if __name__ == "__main__":
    main()
