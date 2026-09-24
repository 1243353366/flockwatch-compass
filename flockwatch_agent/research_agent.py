"""
FlockWatch Research Agent

The main OSINT correlation pipeline:
  Observation → Evidence normalization → Correlation → Public-source research
  → FCC hardware lookup → Deterministic confidence → Report → Optional AI narrative

This is NOT a chatbot. It's a structured research pipeline that produces
defensible evidence reports with deterministic confidence tiers.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
import json

from .evidence_schema import (
    EvidenceObservation,
    EvidenceReport,
    ConfidenceTier,
    FCCHardwareMatch,
    PublicCorroboration,
    DetectionMethod,
    RadioType,
)
from .evidence_engine import (
    build_evidence_report,
    determine_confidence_tier,
    cluster_observations,
)
from .fcc.lookup import (
    lookup_fcc_equipment,
    lookup_fcc_uls,
    fcc_corroboration_as_public_source,
)
from .research.providers import run_public_data_research


def normalize_flockwatch_observation(fw_obs: dict) -> EvidenceObservation:
    """
    Convert a FlockWatch observation (from the Python detection engine)
    into an RF OSINT EvidenceObservation.

    Maps FlockWatch's schema fields to the evidence schema.
    """
    # Determine radio type
    source_type = fw_obs.get("source_type", "")
    radio_type = RadioType.WIFI
    if source_type in ("esp32_wifi", "wigle"):
        radio_type = RadioType.WIFI
    elif source_type in ("esp32_ble",):
        radio_type = RadioType.BLE
    elif source_type == "flipper":
        radio_type = RadioType.SUB_GHZ
    elif source_type == "sdr":
        radio_type = RadioType.SDR

    # Map detection methods from confidence breakdown
    detection_methods = []
    conf = fw_obs.get("confidence") or {}
    if conf.get("oui_match", 0) > 0:
        detection_methods.append(DetectionMethod.OUI_MATCH)
    if conf.get("ssid_pattern", 0) > 0:
        detection_methods.append(DetectionMethod.SSID_PATTERN)
    if conf.get("ble_pattern", 0) > 0:
        detection_methods.append(DetectionMethod.BLE_UUID)
    if conf.get("rf_fingerprint", 0) > 0:
        detection_methods.append(DetectionMethod.RF_FINGERPRINT)
    if conf.get("timing_pattern", 0) > 0:
        detection_methods.append(DetectionMethod.BURST_TIMING)
    if conf.get("cross_source", 0) > 0:
        detection_methods.append(DetectionMethod.CROSS_SOURCE)

    # Map location
    location = None
    loc = fw_obs.get("location")
    if loc:
        location = {
            "lat": loc.get("lat", 0),
            "lon": loc.get("lon", 0),
            "accuracy_m": loc.get("accuracy_m"),
        }

    # Map signal
    signal = fw_obs.get("signal") or {}

    # Map device
    device = fw_obs.get("device") or {}

    # Map RF fingerprint
    rf_fp = None
    if fw_obs.get("rf_fingerprint"):
        rf_data = fw_obs["rf_fingerprint"]
        rf_fp = {
            "capture_file": rf_data.get("capture_file"),
            "sample_rate": rf_data.get("sample_rate"),
            "center_freq_mhz": rf_data.get("center_freq_mhz"),
            "num_samples": rf_data.get("num_samples"),
            "psd_features": rf_data.get("psd_features", []),
            "spectral_peaks": rf_data.get("spectral_peaks", []),
            "burst_count": rf_data.get("burst_count", 0),
            "burst_intervals_ms": rf_data.get("burst_intervals_ms", []),
            "mean_power_db": rf_data.get("mean_power_db"),
            "peak_power_db": rf_data.get("peak_power_db"),
            "template_similarity": rf_data.get("template_similarity"),
            "matched_template": rf_data.get("matched_template"),
        }

    obs = EvidenceObservation(
        source_device=fw_obs.get("source_type", "manual"),
        source_file=fw_obs.get("source_file"),
        location=location,
        rssi_dbm=signal.get("rssi_dbm"),
        frequency_mhz=signal.get("frequency_mhz"),
        channel=signal.get("channel"),
        band=signal.get("band", "unknown"),
        radio_type=radio_type,
        mac=device.get("mac"),
        oui=device.get("oui"),
        ssid=device.get("ssid"),
        ble_name=device.get("ble_name"),
        ble_service_uuids=device.get("ble_service_uuids", []),
        ble_manufacturer_id=device.get("ble_manufacturer_id"),
        encryption_type=device.get("encryption_type"),
        rf_fingerprint=rf_fp,
        detection_methods=detection_methods,
        raw_payload=fw_obs,
    )

    obs.compute_hash()
    return obs


def run_research_pipeline(
    observations: list[EvidenceObservation],
    city: Optional[str] = None,
    state: Optional[str] = None,
    skip_public_lookup: bool = False,
) -> EvidenceReport:
    """
    Run the full RF OSINT research pipeline.

    1. Cluster observations by location
    2. Look up FCC equipment authorization for observed hardware
    3. Search public data sources (WiGLE, municipal, OSM, news)
    4. Determine confidence tier (deterministic)
    5. Build evidence report

    The LLM is NOT involved in any of these steps.
    """
    # Step 1: Cluster
    clusters = cluster_observations(observations)
    if not clusters:
        # No located observations
        return build_evidence_report(observations, human_verified=human_verified)

    # Use the largest cluster
    primary = max(clusters, key=len)

    # Get location from primary cluster
    loc = primary[0].location
    if not loc:
        return build_evidence_report(observations, human_verified=human_verified)

    lat, lon = loc.lat, loc.lon

    # Step 2: FCC equipment lookup
    # Collect observed frequencies
    observed_freqs = []
    for obs in primary:
        if obs.frequency_mhz:
            if 2400 <= obs.frequency_mhz <= 2500:
                observed_freqs.append("2.4 GHz")
            elif 5000 <= obs.frequency_mhz <= 6000:
                observed_freqs.append("5.8 GHz")
            elif 902 <= obs.frequency_mhz <= 928:
                observed_freqs.append("902-928 MHz")
    observed_freqs = list(set(observed_freqs))

    # Look up FCC equipment
    fcc_match = lookup_fcc_equipment(
        observed_oui=primary[0].oui,
        observed_frequencies=observed_freqs,
    )

    # Step 3: Public data research
    public_sources = []
    if not skip_public_lookup:
        # FCC ULS search (negative evidence — rules out licensed transmitters)
        public_sources.extend(lookup_fcc_uls(lat, lon))

        # Full public data research
        public_sources.extend(
            run_public_data_research(lat, lon, observed_freqs, city, state)
        )

        # Add FCC equipment match as corroboration source
        if fcc_match:
            public_sources.append(fcc_corroboration_as_public_source(fcc_match))

    # Step 4: Build evidence report (deterministic confidence, no manual verification)
    report = build_evidence_report(
        observations=observations,
        public_corroboration=public_sources,
        fcc_match=fcc_match,
    )

    return report


def generate_ai_narrative_prompt(report: EvidenceReport) -> str:
    """
    Generate the prompt for an optional AI narrative.

    The AI is asked to EXPLAIN the evidence, not to determine whether
    a camera exists. The confidence tier is already set deterministically.
    """
    return f"""You are analyzing an evidence report for a suspected Flock Safety ALPR camera.

Your job is to EXPLAIN the evidence in plain language. You do NOT decide whether a camera exists — that determination has already been made by the deterministic evidence engine. You explain what was found, why it matters, and what the analyst should check next.

## Evidence Report

Candidate device: {report.candidate_device}
Observed: {', '.join(report.observed_signatures) or 'N/A'}
Public corroboration: {len(report.public_corroboration)} source(s)
FCC hardware match: {report.fcc_hardware_match.fcc_id if report.fcc_hardware_match else 'None'}
Independent observations: {report.independent_observation_count}
Confidence tier: {report.confidence_tier.value} — {report.confidence_tier.display_name}
Confidence explanation: {report.confidence_explanation or 'N/A'}
First observed: {report.first_observed.isoformat() if report.first_observed else 'N/A'}
Last observed: {report.last_observed.isoformat() if report.last_observed else 'N/A'}

## Detection Methods
{', '.join(m.value for m in report.detection_methods) or 'N/A'}

## Public Corroboration Sources
{chr(10).join(f'- [{s.source_type.value}] {s.source_name}: {s.description}' for s in report.public_corroboration) or 'None'}

## FCC Hardware Match
{f'FCC ID: {report.fcc_hardware_match.fcc_id}' + chr(10) + f'Applicant: {report.fcc_hardware_match.applicant}' + chr(10) + f'Frequencies: {", ".join(report.fcc_hardware_match.frequencies)}' + chr(10) + f'Description: {report.fcc_hardware_match.description}' if report.fcc_hardware_match else 'No FCC match found'}

## Instructions
Write a 3-4 paragraph plain-language explanation of this evidence. Cover:
1. What was detected and how
2. What public sources corroborate (or don't corroborate) the detection
3. What the confidence tier means in practical terms
4. What the analyst should verify next

Do NOT state that a camera definitely exists or does not exist. Use phrases like 'the evidence suggests', 'the detection is consistent with', 'additional verification is recommended'. Always note that FCC records corroborate hardware, not physical location.
"""
