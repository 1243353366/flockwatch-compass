"""
ESP32 Wi-Fi and BLE log adapter.

Parses logs from ESP32-based detection firmware (ESP32-S3, ESP32-C5, etc.)
in JSON Lines format.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from ..schema import Band, DeviceInfo, Location, Observation, SignalData, SourceType


def parse_esp32_log(file_path: str) -> list[Observation]:
    """
    Parse an ESP32 log file in JSON Lines format.

    Expected format (one JSON object per line):
    {
        "timestamp": "2026-09-23T18:30:00Z",
        "type": "wifi" | "ble",
        "mac": "AA:BB:CC:DD:EE:FF",
        "ssid": "NetworkName",
        "rssi": -65,
        "channel": 6,
        "lat": 42.739,
        "lon": -84.408,
        "ble_name": "DeviceName",
        "ble_service_uuids": ["uuid1", "uuid2"],
        "ble_manufacturer_id": 1234
    }
    """
    observations: list[Observation] = []
    source_file = Path(file_path).name

    with open(file_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue

            log_type = data.get("type", "wifi")
            source_type = SourceType.ESP32_WIFI if log_type == "wifi" else SourceType.ESP32_BLE

            # Parse timestamp
            timestamp = _parse_timestamp(data.get("timestamp"))

            # Location
            location = None
            if data.get("lat") is not None and data.get("lon") is not None:
                location = Location(
                    lat=float(data["lat"]),
                    lon=float(data["lon"]),
                    accuracy_m=float(data.get("accuracy_m", 10.0)),
                )

            # Signal
            channel = data.get("channel")
            band = Band.UNKNOWN
            if channel is not None:
                if 1 <= int(channel) <= 14:
                    band = Band.BAND_2_4_GHZ
                elif 36 <= int(channel) <= 165:
                    band = Band.BAND_5_GHZ

            freq_mhz = None
            if channel is not None:
                if band == Band.BAND_2_4_GHZ:
                    freq_mhz = 2412 + (int(channel) - 1) * 5 if int(channel) <= 14 else 2484
                elif band == Band.BAND_5_GHZ:
                    freq_mhz = 5000 + int(channel) * 5

            signal = SignalData(
                rssi_dbm=float(data["rssi"]) if data.get("rssi") is not None else None,
                frequency_mhz=freq_mhz,
                channel=int(channel) if channel is not None else None,
                band=band,
            )

            # Device info
            mac = data.get("mac")
            oui = mac[:8] if mac and len(mac) >= 8 else None

            device = DeviceInfo(
                mac=mac,
                oui=oui,
                ssid=data.get("ssid"),
                ble_name=data.get("ble_name"),
                ble_service_uuids=data.get("ble_service_uuids", []),
                ble_manufacturer_id=data.get("ble_manufacturer_id"),
                encryption_type=data.get("encryption_type"),
            )

            obs = Observation(
                timestamp=timestamp,
                source_type=source_type,
                source_file=source_file,
                location=location,
                signal=signal,
                device=device,
                raw_data=data,
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
