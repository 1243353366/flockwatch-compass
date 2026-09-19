#!/usr/bin/env python3
"""Minimal Corpora AI API fallback. No third-party packages or external calls."""
import hashlib
import json
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

PORT = int(os.environ.get("PORT", "8788"))


def analyze(text):
    words = re.findall(r"[A-Za-z][A-Za-z'-]{1,}", text.lower())
    stop = {"the", "and", "for", "with", "that", "this", "from", "are", "was", "were", "not", "but", "into"}
    counts = {}
    for word in words:
        if word not in stop and len(word) > 2:
            counts[word] = counts.get(word, 0) + 1
    keywords = sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))[:12]
    markers = [marker for marker in ("however", "but", "unknown", "unconfirmed", "conflict") if marker in text.lower()]
    return {
        "ok": True,
        "mode": "algorithmic-python",
        "stats": {"characters": len(text), "words": len(words), "uniqueWords": len(set(words))},
        "keywords": [{"term": key, "count": value} for key, value in keywords],
        "skeptic": {
            "status": "conflicting_or_uncertain" if markers else "review_required",
            "alternativeHypothesis": "The observed pattern may be benign, shared, delayed, or independently caused.",
            "contradictionSignals": markers,
            "missingEvidence": ["primary telemetry", "independent corroboration", "observed timestamp"],
        },
    }


def proof(payload):
    source = payload.get("source", {})
    entity = payload.get("entity", {})
    details = str(payload.get("details", ""))[:8000]
    normalized = re.sub(r"\s+", " ", str(entity.get("value", "")).strip().lower().replace("[.]", "."))
    observation = {"classification": "OBSERVATION", "source": source, "entity": {**entity, "normalized": normalized}, "signal": payload.get("signal", ""), "details": details, "observedAt": payload.get("observedAt", "")}
    digest = hashlib.sha256(json.dumps(observation, sort_keys=True).encode()).hexdigest()
    return {"ok": True, "proof": {"version": "observatory-proof-python-v1", "observation": {**observation, "evidenceHash": digest}, "assessment": {"classification": "HYPOTHESIS", "status": "requires_human_review", "confidence": 0.35, "hypothesis": "The observation is correlated but insufficient for attribution.", "alternative": "The signal may have a benign or independent explanation."}, "simulation": {"status": "blocked_pending_authorization_and_isolation", "executed": False, "scope": "synthetic target only"}, "auditTrail": [{"stage": stage, "status": "complete"} for stage in ("ingest", "normalize", "correlate", "hypothesize", "skeptic", "report")]}}


class Handler(BaseHTTPRequestHandler):
    def send_json(self, payload, status=200):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if urlparse(self.path).path == "/health":
            self.send_json({"ok": True, "service": "corpora-ai-python", "mode": "algorithmic-python", "persistentMemory": False})
        else:
            self.send_json({"error": "Not found"}, 404)

    def do_POST(self):
        length = min(int(self.headers.get("Content-Length", "0")), 32768)
        try:
            payload = json.loads(self.rfile.read(length))
        except (ValueError, TypeError):
            self.send_json({"error": "Invalid JSON body"}, 400)
            return
        path = urlparse(self.path).path
        if path == "/api/analyze" and isinstance(payload.get("text"), str) and payload["text"].strip():
            self.send_json(analyze(payload["text"]))
        elif path == "/api/observatory/proof" and payload.get("source") and payload.get("entity") and payload.get("details"):
            self.send_json(proof(payload))
        else:
            self.send_json({"error": "Use /api/analyze with text or /api/observatory/proof with bounded observation fields."}, 400)

    def log_message(self, *_):
        return


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
