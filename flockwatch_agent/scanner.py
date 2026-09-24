"""
RF Scanner Module

Monitors radio frequencies that wireless devices legally broadcast during normal operation:
- Wi-Fi beacon frames (2.4 GHz, 5 GHz) — access points broadcast these to announce their presence
- BLE advertisements (2.4 GHz) — BLE devices emit these to be discoverable
- ISM band emissions (902-928 MHz) — devices operating in unlicensed ISM bands

This is passive monitoring of signals devices are required to emit to function.
No transmission, no probing, no deauth, no jamming — just listening.

FCC Part 15 devices (Wi-Fi, BLE) must accept interference and operate within
power limits, but they also MUST broadcast beacons/advertisements to be useful.
We listen for those legally-mandated broadcasts.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
import json
import hashlib

from .evidence_schema import (
    EvidenceObservation,
    DetectionMethod,
    RadioType,
    ProbeIEFingerprint,
)


class ScanMode(str, Enum):
    """What the scanner is listening for."""
    WIFI_BEACON = "passive_wifi_beacon"       # Wi-Fi beacon frames (APs broadcast these)
    WIFI_PROBE_IE = "passive_wifi_probe_ie"   # Probe request IE fingerprints (passive capture)
    BLE_ADVERTISEMENT = "passive_ble_adv"     # BLE advertisements (devices emit these)
    SDR_SPECTRUM = "passive_sdr_spectrum"     # SDR energy/spectral scanning
    ISM_BAND = "passive_ism_band"            # 902-928 MHz ISM band monitoring


class Band(str, Enum):
    WIFI_2_4 = "2.4GHz"
    WIFI_5 = "5GHz"
    BLE = "BLE"
    ISM_900 = "902-928MHz"
    ISM_433 = "433MHz"


# Frequency ranges for each band (MHz)
BAND_FREQUENCIES = {
    Band.WIFI_2_4: (2412, 2484),     # Channels 1-14
    Band.WIFI_5: (5180, 5985),       # UNII bands
    Band.BLE: (2402, 2480),          # BLE channels 0-39
    Band.ISM_900: (902, 928),        # 902-928 MHz ISM
    Band.ISM_433: (433, 434),        # 433.92 MHz
}


@dataclass
class ScanConfig:
    """Configuration for an RF scan session."""
    modes: list[ScanMode] = field(default_factory=lambda: [
        ScanMode.WIFI_BEACON,
        ScanMode.BLE_ADVERTISEMENT,
        ScanMode.ISM_BAND,
    ])
    bands: list[Band] = field(default_factory=lambda: [
        Band.WIFI_2_4,
        Band.BLE,
        Band.ISM_900,
    ])
    duration_seconds: int = 60
    # ESP32-specific: which channels to scan
    wifi_channels_2_4: list[int] = field(default_factory=lambda: [1, 6, 11])
    wifi_channels_5: list[int] = field(default_factory=lambda: [36, 40, 44, 48, 149, 153, 157, 161])
    ble_scan_window_ms: int = 60     # BLE scan window
    ble_scan_interval_ms: int = 300  # BLE scan interval
    sdr_sample_rate: int = 2400000
    sdr_gain: float = 40.0  # dB
    # GPS logging interval
    gps_log_interval_s: int = 5
    # Minimum RSSI to record (filter out very weak signals)
    min_rssi_dbm: float = -100.0


def create_wifi_beacon_observation(
    mac: str,
    ssid: str,
    rssi: float,
    channel: int,
    band: Band,
    lat: float,
    lon: float,
    accuracy_m: float = 10.0,
    encryption: str = None,
    ie_types: list[int] = None,
    ie_order: list[int] = None,
    source_device: str = "esp32",
    timestamp: Optional[datetime] = None,
) -> EvidenceObservation:
    """
    Create an evidence observation from a captured Wi-Fi beacon.

    Wi-Fi access points legally broadcast beacon frames to announce their presence.
    We capture these passively — no probe requests sent, no association attempted.
    """
    timestamp = timestamp or datetime.now(timezone.utc)

    # Extract OUI from MAC
    oui = mac.replace(":", "").replace("-", "").upper()[:6] if mac and len(mac) >= 12 else None

    # Detect methods
    methods = [DetectionMethod.SSID_PATTERN]
    if oui:
        methods.append(DetectionMethod.OUI_MATCH)

    # Build probe/IE fingerprint if IE data available
    probe_ie = None
    if ie_types and ie_order:
        ie_str = ",".join(str(t) for t in ie_order)
        fingerprint_hash = hashlib.sha256(ie_str.encode()).hexdigest()
        probe_ie = ProbeIEFingerprint(
            ie_types=ie_types,
            ie_order=ie_order,
            ssid_in_probe=ssid,
            fingerprint_hash=fingerprint_hash,
        )
        methods.append(DetectionMethod.PROBE_IE_FINGERPRINT)

    freq_mhz = 2412 + (channel - 1) * 5 if channel and channel <= 14 else (5000 + channel * 5 if channel else None)

    obs = EvidenceObservation(
        timestamp=timestamp,
        source_device=source_device,
        location={"lat": lat, "lon": lon, "accuracy_m": accuracy_m},
        rssi_dbm=rssi,
        frequency_mhz=freq_mhz,
        channel=channel,
        band=band.value,
        radio_type=RadioType.WIFI,
        mac=mac,
        oui=oui,
        ssid=ssid,
        encryption_type=encryption,
        probe_ie=probe_ie,
        detection_methods=methods,
        raw_payload={
            "scan_mode": ScanMode.WIFI_BEACON.value,
            "capture_type": "passive_beacon",
            "mac": mac,
            "ssid": ssid,
            "rssi": rssi,
            "channel": channel,
            "band": band.value,
            "encryption": encryption,
            "ie_types": ie_types or [],
            "ie_order": ie_order or [],
        },
    )
    obs.compute_hash()
    return obs


def create_ble_advertisement_observation(
    mac: str,
    ble_name: str,
    rssi: float,
    service_uuids: list[str],
    manufacturer_id: int,
    lat: float,
    lon: float,
    accuracy_m: float = 10.0,
    source_device: str = "esp32",
    timestamp: Optional[datetime] = None,
) -> EvidenceObservation:
    """
    Create an evidence observation from a captured BLE advertisement.

    BLE devices legally broadcast advertisements to be discoverable.
    We capture these passively — no connection initiated.
    """
    timestamp = timestamp or datetime.now(timezone.utc)

    oui = mac.replace(":", "").replace("-", "").upper()[:6] if mac and len(mac) >= 12 else None

    methods = [DetectionMethod.BLE_UUID, DetectionMethod.BLE_NAME]
    if oui:
        methods.append(DetectionMethod.OUI_MATCH)
    if manufacturer_id is not None:
        methods.append(DetectionMethod.BLE_MFR_ID)

    obs = EvidenceObservation(
        timestamp=timestamp,
        source_device=source_device,
        location={"lat": lat, "lon": lon, "accuracy_m": accuracy_m},
        rssi_dbm=rssi,
        frequency_mhz=2402,  # BLE advertising channel 37
        channel=37,
        band=Band.BLE.value,
        radio_type=RadioType.BLE,
        mac=mac,
        oui=oui,
        ble_name=ble_name,
        ble_service_uuids=service_uuids or [],
        ble_manufacturer_id=manufacturer_id,
        detection_methods=methods,
        raw_payload={
            "scan_mode": ScanMode.BLE_ADVERTISEMENT.value,
            "capture_type": "passive_ble_adv",
            "mac": mac,
            "ble_name": ble_name,
            "rssi": rssi,
            "service_uuids": service_uuids or [],
            "manufacturer_id": manufacturer_id,
        },
    )
    obs.compute_hash()
    return obs


def create_ism_band_observation(
    frequency_mhz: float,
    rssi: float,
    burst_count: int,
    burst_intervals_ms: list[float],
    lat: float,
    lon: float,
    accuracy_m: float = 15.0,
    source_device: str = "sdr",
    psd_features: list[float] = None,
    timestamp: Optional[datetime] = None,
) -> EvidenceObservation:
    """
    Create an evidence observation from ISM band monitoring.

    Devices operating in 902-928 MHz ISM band emit RF energy during transmission.
    We passively capture this energy — no transmission on our part.
    """
    timestamp = timestamp or datetime.now(timezone.utc)

    methods = [DetectionMethod.BURST_TIMING]
    if psd_features:
        methods.append(DetectionMethod.RF_FINGERPRINT)

    band = Band.ISM_900.value
    if 433 <= frequency_mhz <= 434:
        band = Band.ISM_433.value

    obs = EvidenceObservation(
        timestamp=timestamp,
        source_device=source_device,
        location={"lat": lat, "lon": lon, "accuracy_m": accuracy_m},
        rssi_dbm=rssi,
        frequency_mhz=frequency_mhz,
        band=band,
        radio_type=RadioType.SUB_GHZ,
        detection_methods=methods,
        rf_fingerprint={
            "center_freq_mhz": frequency_mhz,
            "burst_count": burst_count,
            "burst_intervals_ms": burst_intervals_ms,
            "psd_features": psd_features or [],
        } if psd_features or burst_count > 0 else None,
        raw_payload={
            "scan_mode": ScanMode.ISM_BAND.value,
            "capture_type": "passive_ism",
            "frequency_mhz": frequency_mhz,
            "rssi": rssi,
            "burst_count": burst_count,
            "burst_intervals_ms": burst_intervals_ms,
        },
    )
    obs.compute_hash()
    return obs


def generate_scan_config(
    include_wifi: bool = True,
    include_ble: bool = True,
    include_ism: bool = True,
    include_5ghz: bool = False,
    duration_seconds: int = 60,
) -> dict:
    """
    Generate a scan configuration for the RF scanner.

    Returns a JSON config that can be deployed to ESP32, Flipper Zero,
    or SDR-based scanning hardware.
    """
    modes = []
    bands = []

    if include_wifi:
        modes.append(ScanMode.WIFI_BEACON.value)
        modes.append(ScanMode.WIFI_PROBE_IE.value)
        bands.append(Band.WIFI_2_4.value)
        if include_5ghz:
            bands.append(Band.WIFI_5.value)

    if include_ble:
        modes.append(ScanMode.BLE_ADVERTISEMENT.value)
        bands.append(Band.BLE.value)

    if include_ism:
        modes.append(ScanMode.ISM_BAND.value)
        bands.append(Band.ISM_900.value)

    return {
        "modes": modes,
        "bands": bands,
        "duration_seconds": duration_seconds,
        "wifi_channels_2_4": [1, 6, 11],
        "wifi_channels_5": [36, 40, 44, 48, 149, 153, 157, 161] if include_5ghz else [],
        "ble_scan_window_ms": 60,
        "ble_scan_interval_ms": 300,
        "sdr_sample_rate": 2400000,
        "sdr_gain_db": 40.0,
        "gps_log_interval_s": 5,
        "min_rssi_dbm": -100.0,
        "legal_notice": "Passive monitoring only. Listening for signals that wireless devices legally broadcast during normal operation. No transmission, probing, jamming, or device access.",
    }
