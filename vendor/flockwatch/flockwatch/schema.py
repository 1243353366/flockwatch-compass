"""
Unified data schema for FlockWatch observations.

All source types (WiGLE, ESP32, Flipper Zero, SDR) are normalized into
these Pydantic models so they can be scored, correlated, and mapped together.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class SourceType(str, Enum):
    WIGLE = "wigle"
    ESP32_WIFI = "esp32_wifi"
    ESP32_BLE = "esp32_ble"
    FLIPPER = "flipper"
    SDR = "sdr"


class Band(str, Enum):
    BAND_2_4_GHZ = "2.4GHz"
    BAND_5_GHZ = "5GHz"
    BAND_SUB_GHZ = "subGHz"
    UNKNOWN = "unknown"


class Location(BaseModel):
    """Geographic location with accuracy estimate."""

    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    accuracy_m: Optional[float] = Field(None, ge=0, description="Estimated accuracy in meters")


class SignalData(BaseModel):
    """Radio signal measurements."""

    rssi_dbm: Optional[float] = Field(None, description="Received Signal Strength Indicator in dBm")
    frequency_mhz: Optional[float] = Field(None, description="Center frequency in MHz")
    channel: Optional[int] = Field(None, description="Channel number")
    band: Band = Band.UNKNOWN
    snr_db: Optional[float] = Field(None, description="Signal-to-noise ratio in dB")
    noise_floor_dbm: Optional[float] = Field(None, description="Measured noise floor in dBm")


class DeviceInfo(BaseModel):
    """Device identification fields from Wi-Fi/BLE data."""

    mac: Optional[str] = Field(None, description="Full MAC address (may be redacted)")
    oui: Optional[str] = Field(None, description="First 3 octets of MAC (OUI prefix)")
    ssid: Optional[str] = Field(None, description="Wi-Fi SSID if visible")
    ble_name: Optional[str] = Field(None, description="BLE device name if visible")
    ble_service_uuids: list[str] = Field(default_factory=list, description="BLE service UUIDs")
    ble_manufacturer_id: Optional[int] = Field(None, description="BLE manufacturer ID")
    encryption_type: Optional[str] = Field(None, description="Wi-Fi encryption type (WPA2, open, etc.)")


class RfFingerprint(BaseModel):
    """RF fingerprint extracted from SDR I/Q captures."""

    capture_file: Optional[str] = Field(None, description="Path to the I/Q capture file")
    sample_rate: Optional[int] = Field(None, description="Sample rate in Hz")
    center_freq_mhz: Optional[float] = Field(None, description="Center frequency in MHz")
    num_samples: Optional[int] = Field(None, description="Number of I/Q samples processed")
    psd_features: list[float] = Field(
        default_factory=list, description="Power spectral density feature vector (binned)"
    )
    psd_freq_bins_mhz: list[float] = Field(
        default_factory=list, description="Frequency bins for PSD features in MHz"
    )
    spectral_peaks: list[dict[str, float]] = Field(
        default_factory=list, description="Dominant spectral peaks with freq_mhz and power_db"
    )
    burst_count: int = Field(0, description="Number of detected transmission bursts")
    burst_intervals_ms: list[float] = Field(
        default_factory=list, description="Inter-burst intervals in milliseconds"
    )
    mean_power_db: Optional[float] = Field(None, description="Mean power in dB")
    peak_power_db: Optional[float] = Field(None, description="Peak power in dB")
    template_similarity: Optional[float] = Field(
        None, ge=0, le=1, description="Cosine similarity to best-matching template (0-1)"
    )
    matched_template: Optional[str] = Field(None, description="Name of matched RF template")


class ConfidenceBreakdown(BaseModel):
    """Detailed confidence score breakdown by factor."""

    oui_match: float = Field(0.0, ge=0, le=1, description="OUI prefix match confidence")
    ssid_pattern: float = Field(0.0, ge=0, le=1, description="SSID pattern match confidence")
    ble_pattern: float = Field(0.0, ge=0, le=1, description="BLE service/name match confidence")
    rf_fingerprint: float = Field(0.0, ge=0, le=1, description="RF fingerprint similarity confidence")
    cross_source: float = Field(0.0, ge=0, le=1, description="Cross-source corroboration confidence")
    timing_pattern: float = Field(0.0, ge=0, le=1, description="Transmission timing pattern match")

    @property
    def total(self) -> float:
        """Weighted sum of all factors."""
        weights = {
            "oui_match": 0.25,
            "ssid_pattern": 0.20,
            "ble_pattern": 0.15,
            "rf_fingerprint": 0.20,
            "cross_source": 0.15,
            "timing_pattern": 0.05,
        }
        return min(
            1.0,
            sum(
                getattr(self, factor) * weight
                for factor, weight in weights.items()
            ),
        )


class Observation(BaseModel):
    """Unified observation record — the core data entity."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source_type: SourceType
    source_file: Optional[str] = None

    # Location
    location: Optional[Location] = None

    # Signal data
    signal: SignalData = Field(default_factory=SignalData)

    # Device identification
    device: DeviceInfo = Field(default_factory=DeviceInfo)

    # RF fingerprint (only for SDR captures)
    rf_fingerprint: Optional[RfFingerprint] = None

    # Confidence (populated by scoring engine)
    confidence: Optional[ConfidenceBreakdown] = None
    confidence_overall: Optional[float] = Field(None, ge=0, le=1)
    confidence_explanation: Optional[str] = None

    # Raw source data for reference
    raw_data: dict[str, Any] = Field(default_factory=dict)

    # Metadata
    notes: Optional[str] = None

    def to_jsonl(self) -> str:
        """Serialize to a single JSON line."""
        return self.model_dump_json(exclude_none=False)


class ScoredObservation(BaseModel):
    """Observation with confidence scoring applied."""

    observation: Observation
    is_detection: bool = Field(..., description="Whether this observation is classified as a Flock device")
    confidence_threshold: float = Field(0.5, description="Threshold used for classification")
    correlated_observations: list[str] = Field(
        default_factory=list, description="IDs of observations that corroborate this one"
    )
