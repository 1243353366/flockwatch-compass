"""
Flipper Zero log adapter.

Parses logs from Flipper Zero captures (sub-1 GHz and 2.4 GHz).
Supports both raw text and JSON formats.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from ..schema import Band, DeviceInfo, Location, Observation, SignalData, SourceType


def parse_flipper_log(file_path: str) -> list[Observation]:
    """
    Parse a Flipper Zero log file.

    Supports two formats:
    1. JSON Lines — one JSON object per line
    2. Plain text — Flipper Zero's default log format

    Expected JSON format:
    {
        "timestamp": "2026-09-23T18:30:00Z",
        "frequency": 915000000,
        "protocol": "raw",
        "rssi": -45,
        "lat": 42.739,
        "lon": -84.408,
        "data_hex": "AABBCCDD",
        "burst_count": 3,
        "burst_intervals_ms": [100.0, 150.0]
    }

    Expected text format:
    [2026-09-23 18:30:00] Freq: 915000000 RSSI: -45 Protocol: raw Data: AABBCCDD
    """
    observations: list[Observation] = []
    source_file = Path(file_path).name

    with open(file_path) as f:
        first_line = f.readline().strip()

        # Detect format
        if first_line.startswith("{"):
            # JSON Lines format
            observations = _parse_json_lines(f, first_line, source_file)
        else:
            # Plain text format
            observations = _parse_text_log(f, first_line, source_file)

    return observations


def _parse_json_lines(f, first_line: str, source_file: str) -> list[Observation]:
    """Parse JSON Lines format Flipper Zero logs."""
    observations: list[Observation] = []
    lines = [first_line] + f.readlines()

    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue

        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            continue

        freq_hz = data.get("frequency")
        freq_mhz = freq_hz / 1e6 if freq_hz else None

        band = Band.BAND_SUB_GHZ
        if freq_mhz and freq_mhz > 2400:
            band = Band.BAND_2_4_GHZ
        elif freq_mhz and freq_mhz > 5000:
            band = Band.BAND_5_GHZ

        timestamp = _parse_timestamp(data.get("timestamp"))

        location = None
        if data.get("lat") is not None and data.get("lon") is not None:
            location = Location(
                lat=float(data["lat"]),
                lon=float(data["lon"]),
                accuracy_m=float(data.get("accuracy_m", 15.0)),
            )

        obs = Observation(
            timestamp=timestamp,
            source_type=SourceType.FLIPPER,
            source_file=source_file,
            location=location,
            signal=SignalData(
                rssi_dbm=float(data["rssi"]) if data.get("rssi") is not None else None,
                frequency_mhz=freq_mhz,
                band=band,
            ),
            device=DeviceInfo(),
            raw_data={
                "protocol": data.get("protocol"),
                "data_hex": data.get("data_hex"),
                "burst_count": data.get("burst_count", 0),
                "burst_intervals_ms": data.get("burst_intervals_ms", []),
            },
            rf_fingerprint=None,
        )
        observations.append(obs)

    return observations


def _parse_text_log(f, first_line: str, source_file: str) -> list[Observation]:
    """Parse plain text Flipper Zero logs."""
    import re

    observations: list[Observation] = []
    lines = [first_line] + f.readlines()

    # Pattern: [2026-09-23 18:30:00] Freq: 915000000 RSSI: -45 Protocol: raw Data: AABBCCDD
    pattern = re.compile(
        r"\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]"
        r".*?Freq:\s*(\d+)\s*"
        r"RSSI:\s*(-?\d+)\s*"
        r"Protocol:\s*(\S+)\s*"
        r"(?:Data:\s*(\S+))?"
    )

    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue

        match = pattern.search(line)
        if not match:
            continue

        ts_str, freq_str, rssi_str, protocol, data_hex = match.groups()

        freq_hz = int(freq_str)
        freq_mhz = freq_hz / 1e6
        band = Band.BAND_SUB_GHZ
        if freq_mhz > 2400:
            band = Band.BAND_2_4_GHZ

        timestamp = datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)

        obs = Observation(
            timestamp=timestamp,
            source_type=SourceType.FLIPPER,
            source_file=source_file,
            location=None,
            signal=SignalData(
                rssi_dbm=float(rssi_str),
                frequency_mhz=freq_mhz,
                band=band,
            ),
            device=DeviceInfo(),
            raw_data={
                "protocol": protocol,
                "data_hex": data_hex,
            },
        )
        observations.append(obs)

    return observations


def _parse_timestamp(ts_str: Optional[str]) -> datetime:
    """Parse an ISO 8601 timestamp string."""
    if not ts_str:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return datetime.now(timezone.utc)
