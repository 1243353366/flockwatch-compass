"""
FlockWatch CLI — command-line interface for the unified detection toolkit.

Commands:
    ingest       Parse source files into normalized JSONL observations
    score        Apply confidence scoring and cross-source correlation
    map          Generate interactive HTML map from observations
    rf-extract   Extract RF features from an SDR I/Q capture
    list-sigs    List loaded signature rules
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .schema import Observation
from .signatures import SignatureDatabase
from .scoring import ScoringEngine
from .adapters.wigle import parse_wigle_csv
from .adapters.esp32 import parse_esp32_log
from .adapters.flipper import parse_flipper_log
from .adapters.sdr import parse_sdr_metadata
from .rf.features import extract_features
from .rf.fingerprint import apply_template_match
from .map.export_geojson import write_geojson
from .map.render import render_map, TILE_LAYERS


ADAPTERS = {
    "wigle": parse_wigle_csv,
    "esp32": parse_esp32_log,
    "flipper": parse_flipper_log,
    "sdr": parse_sdr_metadata,
}


def cmd_ingest(args: argparse.Namespace) -> int:
    """Ingest a source file into normalized JSONL observations."""
    source_type = args.type
    adapter = ADAPTERS.get(source_type)
    if adapter is None:
        print(f"Error: Unknown source type '{source_type}'. Available: {', '.join(ADAPTERS.keys())}")
        return 1

    observations = adapter(args.file)
    print(f"Parsed {len(observations)} observations from {args.file}")

    mode = "a" if args.append else "w"
    with open(args.output, mode) as f:
        for obs in observations:
            f.write(obs.to_jsonl() + "\n")

    print(f"Wrote {len(observations)} observations to {args.output} ({mode} mode)")
    return 0


def cmd_score(args: argparse.Namespace) -> int:
    """Apply confidence scoring to observations."""
    observations: list[Observation] = []
    with open(args.input) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obs = Observation.model_validate_json(line)
            observations.append(obs)

    print(f"Loaded {len(observations)} observations")

    # Match RF fingerprints against templates
    sig_db = SignatureDatabase.load()
    for obs in observations:
        if obs.rf_fingerprint and obs.rf_fingerprint.psd_features:
            apply_template_match(obs.rf_fingerprint, sig_db)

    # Score
    engine = ScoringEngine(signatures=sig_db, threshold=args.threshold)
    scored = engine.score_all(observations)

    detections = [s for s in scored if s.is_detection]
    print(f"Scored {len(scored)} observations")
    print(f"Detections (confidence >= {args.threshold:.0%}): {len(detections)}")

    with open(args.output, "w") as f:
        for s in scored:
            f.write(s.model_dump_json() + "\n")

    print(f"Wrote scored results to {args.output}")
    return 0


def cmd_map(args: argparse.Namespace) -> int:
    """Generate an interactive HTML map."""
    # Load scored observations
    scored_data = []
    with open(args.input) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            scored_data.append(json.loads(line))

    observations: list[Observation] = []
    for item in scored_data:
        obs_data = item.get("observation", item)
        observations.append(Observation.model_validate(obs_data))

    print(f"Loaded {len(observations)} observations")

    output = render_map(
        observations,
        output_path=args.output,
        imagery=args.imagery,
        detections_only=args.detections_only,
        title=args.title,
    )

    print(f"Map written to {output}")
    return 0


def cmd_rf_extract(args: argparse.Namespace) -> int:
    """Extract RF features from an SDR I/Q capture."""
    fp = extract_features(
        args.file,
        sample_rate=int(args.sample_rate),
        center_freq_mhz=args.center_freq / 1e6,
    )

    # Match against templates
    sig_db = SignatureDatabase.load()
    apply_template_match(fp, sig_db)

    # Write output
    with open(args.output, "w") as f:
        json.dump(fp.model_dump(), f, indent=2)

    print(f"RF features extracted from {args.file}")
    print(f"  Samples: {fp.num_samples}")
    print(f"  Mean power: {fp.mean_power_db:.1f} dB" if fp.mean_power_db else "  Mean power: N/A")
    print(f"  Burst count: {fp.burst_count}")
    if fp.matched_template:
        print(f"  Matched template: {fp.matched_template} (similarity: {fp.template_similarity:.2f})")
    print(f"Output written to {args.output}")
    return 0


def cmd_list_sigs(args: argparse.Namespace) -> int:
    """List loaded signature rules."""
    sig_db = SignatureDatabase.load()
    print("Loaded Signature Database:")
    print(f"  OUI prefixes: {len(sig_db.oui_prefixes)}")
    for p in sig_db.oui_prefixes:
        print(f"    {p}")
    print(f"  Wi-Fi SSID patterns: {len(sig_db.wifi_ssid_raw)}")
    for p in sig_db.wifi_ssid_raw:
        print(f"    {p}")
    print(f"  BLE service UUIDs: {len(sig_db.ble_service_uuids)}")
    for u in sig_db.ble_service_uuids:
        print(f"    {u}")
    print(f"  BLE name patterns: {len(sig_db.ble_name_raw)}")
    for p in sig_db.ble_name_raw:
        print(f"    {p}")
    print(f"  BLE manufacturer IDs: {len(sig_db.ble_manufacturer_ids)}")
    for m in sig_db.ble_manufacturer_ids:
        print(f"    {m}")
    print(f"  RF templates: {len(sig_db.rf_templates)}")
    for t in sig_db.rf_templates:
        print(f"    {t.get('name', 'unnamed')}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="flockwatch",
        description="Unified Flock camera detection, data fusion, and RF fingerprinting toolkit",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # ingest
    ingest_parser = subparsers.add_parser("ingest", help="Parse a source file into JSONL observations")
    ingest_parser.add_argument("--type", required=True, choices=list(ADAPTERS.keys()), help="Source type")
    ingest_parser.add_argument("--file", required=True, help="Input file path")
    ingest_parser.add_argument("--output", required=True, help="Output JSONL file path")
    ingest_parser.add_argument("--append", action="store_true", help="Append to existing output file")
    ingest_parser.set_defaults(func=cmd_ingest)

    # score
    score_parser = subparsers.add_parser("score", help="Apply confidence scoring")
    score_parser.add_argument("--input", required=True, help="Input JSONL observations file")
    score_parser.add_argument("--output", required=True, help="Output scored JSONL file")
    score_parser.add_argument("--threshold", type=float, default=0.5, help="Detection confidence threshold (default: 0.5)")
    score_parser.set_defaults(func=cmd_score)

    # map
    map_parser = subparsers.add_parser("map", help="Generate interactive HTML map")
    map_parser.add_argument("--input", required=True, help="Input scored JSONL file")
    map_parser.add_argument("--output", default="flockwatch_map.html", help="Output HTML file path")
    map_parser.add_argument("--imagery", default="osm", choices=list(TILE_LAYERS.keys()), help="Base imagery layer")
    map_parser.add_argument("--detections-only", action="store_true", help="Only show detections above threshold")
    map_parser.add_argument("--title", default="FlockWatch Detection Map", help="Map title")
    map_parser.set_defaults(func=cmd_map)

    # rf-extract
    rf_parser = subparsers.add_parser("rf-extract", help="Extract RF features from I/Q capture")
    rf_parser.add_argument("--file", required=True, help="Path to I/Q capture file")
    rf_parser.add_argument("--sample-rate", default=2400000, help="Sample rate in Hz")
    rf_parser.add_argument("--center-freq", default=2412000000, help="Center frequency in Hz")
    rf_parser.add_argument("--output", required=True, help="Output JSON file path")
    rf_parser.set_defaults(func=cmd_rf_extract)

    # list-sigs
    sigs_parser = subparsers.add_parser("list-sigs", help="List loaded signature rules")
    sigs_parser.set_defaults(func=cmd_list_sigs)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
