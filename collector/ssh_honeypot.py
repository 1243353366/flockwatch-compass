#!/usr/bin/env python3
"""Non-executing localhost SSH deception listener.

This is not sshd and does not authenticate, execute commands, proxy traffic,
or create a C2 channel. It binds only to 127.0.0.1 and records connection
metadata as defensive telemetry.
"""
import argparse
import json
import socketserver
import time
from datetime import datetime, timezone
from pathlib import Path
from ingestion_protocol import graceful_error, send_batch
from osquery_collector import event_id, load_config


def ssh_event_id(table, row, observed_at):
    return event_id(table, row, observed_at).replace("osquery-", "ssh-")


class HoneypotState:
    def __init__(self, config):
        self.config = config
        self.sequence = 0

    def ingest(self, client_address, bytes_received):
        observed = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        self.sequence += 1
        event = {"synthetic": False, "eventVersion": "edr.network.v1", "eventId": ssh_event_id("ssh-honeypot", {"sequence": self.sequence, "client": client_address[0], "port": client_address[1], "bytes": bytes_received}, observed), "eventType": "network_connection", "observedAt": observed, "hostId": self.config["endpoint_id"], "destinationIp": "127.0.0.1", "destinationPort": 2222, "collector": "ssh-honeypot", "provenance": {"classification": "LIVE_LOCAL_OBSERVATION", "source": "ssh-honeypot", "table": "connection_attempt", "authorization": "authorized-lab-local", "visibility": "container-local", "executed": False, "commandChannel": False}, "username": "", "commandLine": ""}
        payload = {"lab": {**self.config, "collector": "ssh-honeypot"}, "events": [event]}
        try:
            return send_batch(self.config, payload)
        except Exception as exc:
            return graceful_error(self.config, exc)


class Handler(socketserver.BaseRequestHandler):
    def handle(self):
        self.request.settimeout(2)
        try:
            self.request.sendall(b"SSH-2.0-Corpora-Local-Honeypot\r\n")
            data = self.request.recv(512)
        except (TimeoutError, OSError):
            data = b""
        result = self.server.state.ingest(self.client_address, len(data))
        print(json.dumps({"state": "CONNECTION_RECORDED", "listener": "127.0.0.1:2222", "executed": False, "result": result}), flush=True)


class LocalServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    parser = argparse.ArgumentParser(description="Non-executing localhost SSH honeypot")
    parser.add_argument("--config", default=str(Path(__file__).with_name("ssh-honeypot.json")))
    parser.add_argument("--once", action="store_true", help="start listener until one connection is recorded")
    args = parser.parse_args()
    config = load_config(args.config, "ssh-honeypot")
    server = LocalServer(("127.0.0.1", 2222), Handler)
    server.state = HoneypotState(config)
    print(json.dumps({"state": "LISTENING", "bind": "127.0.0.1", "port": 2222, "executed": False, "c2": False}), flush=True)
    try:
        if args.once:
            server.handle_request()
        else:
            server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
