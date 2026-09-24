"""
SDR I/Q capture adapter.

Parses SDR metadata files and triggers RF feature extraction from
raw I/Q captures.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from ..schema import (
    Band,
    DeviceInfo,
    Location,
    Observation,
    RfFingerprint,
    SignalData,
    SourceType,
)
from ..rf.features import extract_features


def parse_sdr_metadata(file_path: str) -> list[Observation]:
    """
    Parse an SDR metadata JSON file.

    Expected format:
    {
        "timestamp": "2026-09-23T18:30:00Z",
        "capture_file": "captures/scan_001.iq",
        "sample_rate": 2400000,
        "center_freq_hz": 2412000000,
        "lat": 42.739,
        "lon": -84.408,
        "rssi": -55,
        "notes": "Bursty 2.4GHz transmission near intersection"
    }

    If the I/Q file referenced in capture_file exists, RF features will
    be extracted automatically.
    """
    observations: list[Observation] = []
    source_file = Path(file_path).name
    base_dir = Path(file_path).parent

    with open(file_path) as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            return observations

    # Handle both single capture and list of captures
    captures = data if isinstance(data, list) else [data]

    for capture in captures:
        timestamp = _parse_timestamp(capture.get("timestamp"))

        center_freq_mhz = None
        freq_hz = capture.get("center_freq_hz")
        if freq_hz:
            center_freq_mhz = freq_hz / 1e6

        band = Band.UNKNOWN
        if center_freq_mhz:
            if 2400 <= center_freq_mhz <= 2500:
                band = Band.BAND_2_4_GHZ
            elif 5000 <= center_freq_mhz <= 6000:
                band = Band.BAND_5_GHZ
            elif center_freq_mhz < 1000:
                band = Band.BAND_SUB_GHZ

        location = None
        if capture.get("lat") is not None and capture.get("lon") is not None:
            location = Location(
                lat=float(capture["lat"]),
                lon=float(capture["lon"]),
                accuracy_m=float(capture.get("accuracy_m", 20.0)),
            )

        # Extract RF features if capture file exists
        rf_fp = None
        capture_file = capture.get("capture_file")
        if capture_file:
            capture_path = Path(capture_file)
            if not capture_path.is_absolute():
                capture_path = base_dir / capture_path

            if capture_path.exists():
                sample_rate = capture.get("sample_rate", 2400000)
                rf_fp = extract_features(
                    str(capture_path),
                    sample_rate=int(sample_rate),
                    center_freq_mhz=center_freq_mhz or 2412.0,
                )

        # If no file, create metadata-only fingerprint
        if rf_fp is None and capture_file:
            rf_fp = RfFingerprint(
                capture_file=capture_file,
                sample_rate=capture.get("sample_rate"),
                center_freq_mhz=center_freq_mhz,
            )

        obs = Observation(
            timestamp=timestamp,
            source_type=SourceType.SDR,
            source_file=source_file,
            location=location,
            signal=SignalData(
                rssi_dbm=float(capture["rssi"]) if capture.get("rssi") is not None else None,
                frequency_mhz=center_freq_mhz,
                band=band,
            ),
            device=DeviceInfo(),
            rf_fingerprint=rf_fp,
            raw_data=capture,
            notes=capture.get("notes"),
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
