"""
RF OSINT Evidence Schema

The evidence model for FlockWatch Compass's RF OSINT correlation system.
Separate from FlockWatch's detection schema — this layer sits above detection
and adds public data correlation, FCC lookups, and deterministic confidence.

Key principle: the LLM never decides a camera exists.
The detector produces evidence, the evidence engine correlates and explains.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from uuid import uuid4
import hashlib
import json

from pydantic import BaseModel, Field


class ConfidenceTier(str, Enum):
    """4-tier confidence system — deterministic, never set by LLM.
    No manual verification required — machine_supported is the highest
    automated tier, achievable through repeated observations + public corroboration."""
    UNCONFIRMED = "unconfirmed"
    PROBABLE = "probable"
    SUPPORTED = "supported"
    MACHINE_SUPPORTED = "machine_supported"

    @property
    def display_name(self) -> str:
        return {
            "unconfirmed": "Unconfirmed — one weak indicator, may be false positive",
            "probable": "Probable — multiple independent passive indicators",
            "supported": "Supported — passive detection + independent public evidence",
            "machine_supported": "Machine-supported — repeated automated observations + public corroboration",
        }[self.value]

    @property
    def numeric(self) -> int:
        return {"unconfirmed": 1, "probable": 2, "supported": 3, "machine_supported": 4}[self.value]


class RadioType(str, Enum):
    WIFI = "wifi"
    BLE = "ble"
    SUB_GHZ = "sub_ghz"
    SDR = "sdr"


class DetectionMethod(str, Enum):
    OUI_MATCH = "oui_match"
    SSID_PATTERN = "ssid_pattern"
    BLE_UUID = "ble_uuid"
    BLE_NAME = "ble_name"
    BLE_MFR_ID = "ble_manufacturer_id"
    PROBE_IE_FINGERPRINT = "probe_ie_fingerprint"
    RF_FINGERPRINT = "rf_fingerprint"
    BURST_TIMING = "burst_timing"
    CROSS_SOURCE = "cross_source"


class PublicSourceType(str, Enum):
    FCC_EQUIPMENT = "fcc_equipment"
    FCC_ULS = "fcc_uls"
    WIGLE = "wigle"
    MUNICIPAL = "municipal"
    OSM = "osm"
    NEWS = "news"
    COMMUNITY = "community"
    PROCUREMENT = "procurement"


class EvidenceLocation(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    accuracy_m: Optional[float] = None
    address: Optional[str] = None
    description: Optional[str] = None


class ProbeIEFingerprint(BaseModel):
    """Wi-Fi probe request / information element fingerprint."""
    ie_types: list[int] = Field(default_factory=list, description="IE type numbers observed")
    ie_order: list[int] = Field(default_factory=list, description="IE types in order of appearance")
    ssid_in_probe: Optional[str] = None
    supported_rates: list[str] = Field(default_factory=list)
    capability_info: Optional[str] = None
    fingerprint_hash: Optional[str] = Field(None, description="SHA256 of normalized IE sequence")


class RfFingerprint(BaseModel):
    capture_file: Optional[str] = None
    sample_rate: Optional[int] = None
    center_freq_mhz: Optional[float] = None
    psd_features: list[float] = Field(default_factory=list)
    spectral_peaks: list[dict[str, float]] = Field(default_factory=list)
    burst_count: int = 0
    burst_intervals_ms: list[float] = Field(default_factory=list)
    mean_power_db: Optional[float] = None
    peak_power_db: Optional[float] = None
    template_similarity: Optional[float] = Field(None, ge=0, le=1)
    matched_template: Optional[str] = None


class EvidenceObservation(BaseModel):
    """
    Normalized evidence observation from any detection source.
    Produced by the detector — the AI never creates these.
    """

    id: str = Field(default_factory=lambda: str(uuid4()))
    raw_hash: Optional[str] = Field(None, description="SHA256 of raw payload for integrity")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Source
    source_device: str = Field(..., description="esp32, flipper, sdr, wigle, manual")
    source_file: Optional[str] = None

    # Location
    location: Optional[EvidenceLocation] = None

    # Signal
    rssi_dbm: Optional[float] = None
    frequency_mhz: Optional[float] = None
    channel: Optional[int] = None
    band: str = "unknown"
    radio_type: RadioType = RadioType.WIFI

    # Device identification
    mac: Optional[str] = None
    oui: Optional[str] = None
    oui_vendor: Optional[str] = None
    ssid: Optional[str] = None
    ble_name: Optional[str] = None
    ble_service_uuids: list[str] = Field(default_factory=list)
    ble_manufacturer_id: Optional[int] = None
    encryption_type: Optional[str] = None

    # Fingerprints
    probe_ie: Optional[ProbeIEFingerprint] = None
    rf_fingerprint: Optional[RfFingerprint] = None

    # What detection methods triggered
    detection_methods: list[DetectionMethod] = Field(default_factory=list)

    # Raw data for audit trail
    raw_payload: dict[str, Any] = Field(default_factory=dict)
    notes: Optional[str] = None

    def compute_hash(self) -> str:
        payload_str = json.dumps(self.raw_payload, sort_keys=True, default=str)
        self.raw_hash = hashlib.sha256(payload_str.encode()).hexdigest()
        return self.raw_hash


class PublicCorroboration(BaseModel):
    """Independent public source that corroborates a detection."""

    source_type: PublicSourceType
    source_name: str
    url: Optional[str] = None
    description: str = Field(..., description="What this source corroborates")
    verified: bool = Field(False, description="Human-verified")
    retrieved_at: Optional[datetime] = None
    raw_data: dict[str, Any] = Field(default_factory=dict)


class FCCHardwareMatch(BaseModel):
    """Result of an FCC equipment authorization database lookup."""

    fcc_id: str = Field(..., description="FCC ID (e.g., '2A3XX-FLK-CAM-01')")
    applicant: str = Field(..., description="Company that filed the application")
    grant_date: Optional[str] = None
    equipment_class: Optional[str] = None
    frequencies: list[str] = Field(default_factory=list, description="Authorized frequency ranges")
    power_output: Optional[str] = None
    modulation: Optional[str] = None
    description: Optional[str] = None
    confidence: str = Field("low", description="How well this FCC record matches the observed signature")
    url: Optional[str] = None


class EvidenceReport(BaseModel):
    """
    Final evidence report for a suspected Flock camera location.

    This is the Corpora output format:
    Candidate device: Flock-related infrastructure
    Observed: Wi-Fi/BLE signature
    Public corroboration: X
    FCC hardware match: Y
    Independent observations: Z
    Confidence: supported / probable / unconfirmed
    Evidence timestamp: …
    """

    report_id: str = Field(default_factory=lambda: str(uuid4()))
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Location
    location: EvidenceLocation

    # What was observed
    candidate_device: str = Field("Flock-related infrastructure")
    observed_signatures: list[str] = Field(default_factory=list, description="e.g., 'Wi-Fi/BLE signature', 'RF burst pattern'")

    # Evidence
    observations: list[EvidenceObservation] = Field(default_factory=list)
    independent_observation_count: int = 0
    independent_sources: list[str] = Field(default_factory=list, description="Distinct source device types")

    # Public corroboration
    public_corroboration: list[PublicCorroboration] = Field(default_factory=list)
    fcc_hardware_match: Optional[FCCHardwareMatch] = None

    # Confidence (deterministic, never set by LLM)
    confidence_tier: ConfidenceTier = ConfidenceTier.UNCONFIRMED
    confidence_explanation: Optional[str] = None

    # Evidence chain
    detection_methods: list[DetectionMethod] = Field(default_factory=list)

    # Timeline
    first_observed: Optional[datetime] = None
    last_observed: Optional[datetime] = None

    # Optional AI-assisted narrative (clearly labeled as AI-generated)
    ai_narrative: Optional[str] = Field(None, description="AI-generated explanation — clearly labeled, not authoritative")
    ai_generated: bool = Field(False, description="Whether narrative was AI-generated")

    # Legal
    legal_note: str = "Passive detection only. All findings require lawful verification. FCC records corroborate hardware, not physical location."

    def to_text(self) -> str:
        """Render as plain-text report matching the desired Corpora output format."""
        lines = []
        lines.append(f"Candidate device: {self.candidate_device}")
        lines.append(f"Observed: {', '.join(self.observed_signatures) or 'N/A'}")
        lines.append(f"Public corroboration: {len(self.public_corroboration)} source(s)")
        for src in self.public_corroboration:
            lines.append(f"  - [{src.source_type.value}] {src.source_name}: {src.description}")
        if self.fcc_hardware_match:
            lines.append(f"FCC hardware match: {self.fcc_hardware_match.fcc_id} ({self.fcc_hardware_match.applicant})")
            lines.append(f"  Confidence: {self.fcc_hardware_match.confidence}")
        else:
            lines.append("FCC hardware match: None")
        lines.append(f"Independent observations: {self.independent_observation_count}")
        lines.append(f"Confidence: {self.confidence_tier.value}")
        lines.append(f"Evidence timestamp: {self.generated_at.isoformat()}")
        if self.confidence_explanation:
            lines.append(f"Explanation: {self.confidence_explanation}")
        if self.first_observed and self.last_observed:
            lines.append(f"Observation window: {self.first_observed.isoformat()} to {self.last_observed.isoformat()}")
        lines.append(f"")
        lines.append(f"Detection methods: {', '.join(m.value for m in self.detection_methods) or 'N/A'}")
        lines.append(f"")
        if self.ai_narrative:
            lines.append(f"[AI-GENERATED ANALYSIS — NOT AUTHORITATIVE]")
            lines.append(self.ai_narrative)
            lines.append(f"")
        lines.append(f"Legal note: {self.legal_note}")
        return "\n".join(lines)
