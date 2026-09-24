"""
Evidence Engine — deterministic confidence assessment.

Maps evidence strength to confidence tiers:
  Unconfirmed — one weak/ambiguous indicator
  Probable    — multiple independent passive indicators or repeated observations
  Supported   — passive detection + independent public corroboration
  Verified    — repeated observations / human confirmation

The LLM NEVER sets the tier. This is 100% deterministic.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from collections import defaultdict

from .evidence_schema import (
    ConfidenceTier,
    DetectionMethod,
    EvidenceObservation,
    EvidenceReport,
    PublicCorroboration,
    FCCHardwareMatch,
    EvidenceLocation,
    PublicSourceType,
)


def determine_confidence_tier(
    observations: list[EvidenceObservation],
    public_corroboration: list[PublicCorroboration] = None,
    fcc_match: Optional[FCCHardwareMatch] = None,
) -> tuple[ConfidenceTier, str]:
    """
    Determine confidence tier based on evidence strength.

    No manual verification required — machine_supported is the highest
    automated tier, achievable through:
    - Repeated observations across time
    - Multiple RF modes (Wi-Fi + BLE + ISM)
    - Independent public corroboration (FCC, municipal, news)

    The LLM NEVER sets the tier. This is 100% deterministic.
    """
    public_corroboration = public_corroboration or []

    # Collect all detection methods across observations
    all_methods = set()
    source_devices = set()
    radio_types = set()
    timestamps = set()

    for obs in observations:
        all_methods.update(obs.detection_methods)
        source_devices.add(obs.source_device)
        if obs.radio_type:
            radio_types.add(obs.radio_type.value if hasattr(obs.radio_type, 'value') else str(obs.radio_type))
        timestamps.add(obs.timestamp.date().isoformat() if obs.timestamp else None)

    # Count distinct passive detection methods
    passive_methods = all_methods - {DetectionMethod.CROSS_SOURCE}
    distinct_passive = len(passive_methods)
    distinct_sources = len(source_devices)
    distinct_radio_types = len(radio_types)
    distinct_days = len([t for t in timestamps if t])  # Repeated across multiple days

    # Count independent public evidence sources
    public_sources = [s for s in public_corroboration if s.source_type != PublicSourceType.WIGLE]
    has_public_evidence = len(public_sources) > 0

    # FCC hardware match is corroboration of hardware, not location
    fcc_corroborates_hardware = fcc_match is not None and fcc_match.confidence in ("medium", "high")

    # TIER: MACHINE_SUPPORTED — highest automated tier
    # Requires: repeated observations (2+ days) + multiple RF modes + public corroboration
    if distinct_days >= 2 and distinct_radio_types >= 2 and has_public_evidence and distinct_passive >= 2:
        return (
            ConfidenceTier.MACHINE_SUPPORTED,
            f"Repeated automated observations across {distinct_days} day(s) using {distinct_radio_types} radio type(s) "
            f"({distinct_passive} detection methods), corroborated by {len(public_sources)} independent public source(s). "
            f"No manual verification required."
        )

    # TIER: SUPPORTED — passive + independent public evidence
    if has_public_evidence and distinct_passive >= 2:
        public_names = [s.source_name for s in public_sources[:3]]
        return (
            ConfidenceTier.SUPPORTED,
            f"Passive detection ({distinct_passive} methods, {distinct_sources} sources) "
            f"corroborated by {len(public_sources)} independent public source(s): {', '.join(public_names)}"
        )

    # TIER: SUPPORTED — also if FCC hardware match + multiple passive methods
    if fcc_corroborates_hardware and distinct_passive >= 2:
        return (
            ConfidenceTier.SUPPORTED,
            f"Multiple passive indicators ({distinct_passive} methods) with FCC hardware match "
            f"({fcc_match.fcc_id}, {fcc_match.applicant})"
        )

    # TIER: PROBABLE — multiple independent passive indicators
    if distinct_passive >= 2 or (distinct_passive >= 1 and distinct_sources >= 2):
        method_names = [m.value for m in passive_methods]
        return (
            ConfidenceTier.PROBABLE,
            f"Multiple independent passive indicators: {distinct_passive} detection method(s) "
            f"({', '.join(method_names)}), {distinct_sources} source device(s)"
        )

    # TIER: PROBABLE — single method but repeated observations across time
    if len(observations) >= 3 and distinct_days >= 2:
        return (
            ConfidenceTier.PROBABLE,
            f"Repeated observations ({len(observations)} times across {distinct_days} day(s)) at same location"
        )

    # TIER: UNCONFIRMED — single weak indicator
    if distinct_passive >= 1:
        return (
            ConfidenceTier.UNCONFIRMED,
            "Single passive indicator — weak evidence, may be false positive"
        )

    return ConfidenceTier.UNCONFIRMED, "Insufficient evidence for classification"


def cluster_observations(
    observations: list[EvidenceObservation],
    max_distance_m: float = 50.0,
) -> list[list[EvidenceObservation]]:
    """Group observations by geographic proximity."""
    import math

    if not observations:
        return []

    clusters: list[list[EvidenceObservation]] = []
    assigned = set()

    for obs in observations:
        if obs.id in assigned or obs.location is None:
            continue

        found = False
        for cluster in clusters:
            # Compare to cluster centroid
            clat = sum(o.location.lat for o in cluster) / len(cluster)
            clon = sum(o.location.lon for o in cluster) / len(cluster)
            dist = _haversine(obs.location.lat, obs.location.lon, clat, clon)
            if dist <= max_distance_m:
                cluster.append(obs)
                assigned.add(obs.id)
                found = True
                break

        if not found:
            clusters.append([obs])
            assigned.add(obs.id)

    return clusters


def build_evidence_report(
    observations: list[EvidenceObservation],
    public_corroboration: list[PublicCorroboration] = None,
    fcc_match: Optional[FCCHardwareMatch] = None,
    location: Optional[EvidenceLocation] = None,
) -> EvidenceReport:
    """
    Build a complete evidence report from observations and public data.
    No manual verification required — the highest tier is machine_supported.
    """
    public_corroboration = public_corroboration or []

    # Cluster observations by location
    clusters = cluster_observations(observations)

    # Use the largest cluster as the primary location
    if not clusters:
        primary = observations
    else:
        primary = max(clusters, key=len)

    # Determine location
    if location is None and primary and primary[0].location:
        locs = [o.location for o in primary if o.location]
        if locs:
            lat = sum(l.lat for l in locs) / len(locs)
            lon = sum(l.lon for l in locs) / len(locs)
            location = EvidenceLocation(lat=lat, lon=lon, accuracy_m=15.0)

    if location is None:
        location = EvidenceLocation(lat=0, lon=0)

    # Collect observed signatures
    observed_signatures = []
    radio_types = set()
    for obs in primary:
        radio_types.add(obs.radio_type.value)
    if radio_types:
        observed_signatures.append(f"{'/'.join(sorted(radio_types))} signature")

    # Check for RF fingerprint
    has_rf = any(o.rf_fingerprint and o.rf_fingerprint.template_similarity for o in primary)
    if has_rf:
        observed_signatures.append("RF spectral fingerprint match")

    # Check for probe/IE fingerprint
    has_probe = any(o.probe_ie and o.probe_ie.fingerprint_hash for o in primary)
    if has_probe:
        observed_signatures.append("Wi-Fi probe/IE fingerprint")

    # Collect all detection methods
    all_methods = set()
    source_devices = set()
    for obs in primary:
        all_methods.update(obs.detection_methods)
        source_devices.add(obs.source_device)

    # Timeline
    timestamps = [o.timestamp for o in primary]
    first_observed = min(timestamps) if timestamps else None
    last_observed = max(timestamps) if timestamps else None

    # Determine confidence (no manual verification required)
    tier, explanation = determine_confidence_tier(
        primary, public_corroboration, fcc_match
    )

    return EvidenceReport(
        location=location,
        candidate_device="Flock-related infrastructure",
        observed_signatures=observed_signatures,
        observations=primary,
        independent_observation_count=len(primary),
        independent_sources=list(source_devices),
        public_corroboration=public_corroboration,
        fcc_hardware_match=fcc_match,
        confidence_tier=tier,
        confidence_explanation=explanation,
        detection_methods=list(all_methods),
        first_observed=first_observed,
        last_observed=last_observed,
    )


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in meters."""
    R = 6371000
    import math
    lat1_r, lat2_r = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
