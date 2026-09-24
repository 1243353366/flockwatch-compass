"""
WiGLE data export adapter.

Parses WiGLE CSV and KML exports into normalized FlockWatch observations.
WiGLE (wigle.net) is a crowd-sourced database of wireless networks.
"""

from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from ..schema import Band, DeviceInfo, Location, Observation, SignalData, SourceType


def parse_wigle_csv(file_path: str) -> list[Observation]:
    """
    Parse a WiGLE CSV export file.

    Expected WiGLE CSV format (standard export):
    WigleWifi-1.4,appRelease=...,model=...,release=...,device=...,display=...
    MAC,SSID,AuthMode,FirstSeen,Channel,RSSI,CurrentLatitude,CurrentLongitude,AltitudeMeters,AccuracyMeters,Type
    """
    observations: list[Observation] = []
    source_file = Path(file_path).name

    with open(file_path, newline="") as f:
        reader = csv.reader(f)

        # Skip header line (contains metadata)
        header_line = next(reader, None)

        # Find the actual column header row
        col_header = next(reader, None)
        if not col_header:
            return observations

        # Map columns
        columns = {col.strip().lower(): i for i, col in enumerate(col_header)}

        for row in reader:
            if not row or len(row) < 6:
                continue

            try:
                mac = _get(row, columns, "mac")
                ssid = _get(row, columns, "ssid")
                auth_mode = _get(row, columns, "authmode")
                first_seen = _get(row, columns, "firstseen")
                channel = _get(row, columns, "channel")
                rssi = _get(row, columns, "rssi")
                lat = _get(row, columns, "currentlatitude")
                lon = _get(row, columns, "currentlongitude")
                altitude = _get(row, columns, "altitudemeters")
                accuracy = _get(row, columns, "accuracymeters")
                net_type = _get(row, columns, "type")

                # Parse timestamp
                timestamp = _parse_wigle_timestamp(first_seen)

                # Determine band from channel
                band = Band.UNKNOWN
                ch = int(channel) if channel and channel.isdigit() else None
                if ch is not None:
                    if 1 <= ch <= 14:
                        band = Band.BAND_2_4_GHZ
                    elif 36 <= ch <= 165:
                        band = Band.BAND_5_GHZ

                # Extract OUI from MAC
                oui = None
                if mac and len(mac) >= 8:
                    oui = mac[:8]  # First 3 octets

                freq_mhz = None
                if ch is not None:
                    if band == Band.BAND_2_4_GHZ:
                        freq_mhz = 2412 + (ch - 1) * 5 if ch <= 14 else 2484
                    elif band == Band.BAND_5_GHZ:
                        freq_mhz = 5000 + ch * 5

                obs = Observation(
                    timestamp=timestamp,
                    source_type=SourceType.WIGLE,
                    source_file=source_file,
                    location=Location(
                        lat=float(lat) if lat else 0.0,
                        lon=float(lon) if lon else 0.0,
                        accuracy_m=float(accuracy) if accuracy else None,
                    ),
                    signal=SignalData(
                        rssi_dbm=float(rssi) if rssi else None,
                        frequency_mhz=freq_mhz,
                        channel=ch,
                        band=band,
                    ),
                    device=DeviceInfo(
                        mac=mac,
                        oui=oui,
                        ssid=ssid,
                        encryption_type=auth_mode,
                    ),
                    raw_data={
                        "altitude_m": float(altitude) if altitude else None,
                        "network_type": net_type,
                    },
                )
                observations.append(obs)

            except (ValueError, IndexError):
                continue

    return observations


def _get(row: list[str], columns: dict[str, int], name: str) -> Optional[str]:
    """Get a value from a CSV row by column name."""
    idx = columns.get(name)
    if idx is None or idx >= len(row):
        return None
    val = row[idx].strip()
    return val if val else None


def _parse_wigle_timestamp(ts_str: Optional[str]) -> datetime:
    """Parse a WiGLE timestamp string (format: YYYY-MM-DD HH:MM:SS)."""
    if not ts_str:
        return datetime.now(timezone.utc)
    try:
        return datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.now(timezone.utc)
