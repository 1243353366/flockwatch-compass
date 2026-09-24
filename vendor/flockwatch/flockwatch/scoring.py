"""
Multi-factor confidence scoring engine.

Scores observations based on OUI matching, SSID patterns, BLE service UUIDs,
RF fingerprint similarity, transmission timing, and cross-source corroboration.
"""

from __future__ import annotations

from typing import Optional

from .schema import ConfidenceBreakdown, Observation, ScoredObservation
from .signatures import SignatureDatabase
from .geo import find_correlated


class ScoringEngine:
    """
    Evaluates observations against signature rules and produces
    confidence-scored detections.
    """

    def __init__(
        self,
        signatures: Optional[SignatureDatabase] = None,
        threshold: float = 0.5,
        max_correlation_distance_m: float = 50.0,
        max_correlation_time_s: float = 300.0,
    ):
        self.signatures = signatures or SignatureDatabase.load()
        self.threshold = threshold
        self.max_correlation_distance_m = max_correlation_distance_m
        self.max_correlation_time_s = max_correlation_time_s

    def score_all(self, observations: list[Observation]) -> list[ScoredObservation]:
        """
        Score all observations and apply cross-source correlation.

        Cross-source corroboration boosts confidence when multiple source
        types detect evidence near the same location and time.
        """
        # First pass: score each observation independently
        for obs in observations:
            self._score_single(obs)

        # Second pass: cross-source correlation
        correlations = find_correlated(
            observations,
            max_distance_m=self.max_correlation_distance_m,
            max_time_diff_s=self.max_correlation_time_s,
        )

        for obs in observations:
            correlated = correlations.get(obs.id, [])
            if correlated:
                # Boost cross_source confidence
                if obs.confidence is None:
                    obs.confidence = ConfidenceBreakdown()
                # Each correlated observation from a different source adds confidence
                unique_sources = set()
                for corr_id in correlated:
                    corr_obs = next((o for o in observations if o.id == corr_id), None)
                    if corr_obs:
                        unique_sources.add(corr_obs.source_type.value)
                boost = min(1.0, len(unique_sources) * 0.3)
                obs.confidence.cross_source = boost
                obs.confidence_overall = obs.confidence.total
                if not obs.confidence_explanation:
                    obs.confidence_explanation = ""
                obs.confidence_explanation += f" Cross-source corroboration from {len(unique_sources)} source type(s)."

        # Build results
        results = []
        for obs in observations:
            overall = obs.confidence.total if obs.confidence else 0.0
            is_detection = overall >= self.threshold
            results.append(ScoredObservation(
                observation=obs,
                is_detection=is_detection,
                confidence_threshold=self.threshold,
                correlated_observations=correlations.get(obs.id, []),
            ))

        return results

    def _score_single(self, obs: Observation) -> None:
        """Score a single observation against all signature rules."""
        breakdown = ConfidenceBreakdown()
        explanations = []

        # OUI match
        if self.signatures.match_oui(obs.device.oui):
            breakdown.oui_match = 1.0
            explanations.append(f"OUI prefix {obs.device.oui} matched known Flock vendor")
        elif obs.device.oui:
            # Partial match — OUI is in a known range but not exact
            oui_norm = obs.device.oui.upper().replace(":", "").replace("-", "")
            for prefix in self.signatures.oui_prefixes:
                if oui_norm.startswith(prefix[:3]):
                    breakdown.oui_match = 0.3
                    explanations.append(f"OUI {obs.device.oui} partially matches known prefix {prefix}")
                    break

        # SSID pattern match
        if self.signatures.match_ssid(obs.device.ssid):
            breakdown.ssid_pattern = 1.0
            explanations.append(f"SSID '{obs.device.ssid}' matched known Flock pattern")
        elif obs.device.ssid:
            # Fuzzy check — contains "flock" or "alpr"
            ssid_lower = obs.device.ssid.lower()
            if "flock" in ssid_lower or "alpr" in ssid_lower or "safety" in ssid_lower:
                breakdown.ssid_pattern = 0.7
                explanations.append(f"SSID '{obs.device.ssid}' contains suspicious keywords")

        # BLE pattern match
        ble_matched = False
        if self.signatures.match_ble_name(obs.device.ble_name):
            breakdown.ble_pattern = 0.8
            explanations.append(f"BLE name '{obs.device.ble_name}' matched known pattern")
            ble_matched = True
        if self.signatures.match_ble_uuid(obs.device.ble_service_uuids):
            breakdown.ble_pattern = max(breakdown.ble_pattern, 0.9)
            explanations.append("BLE service UUID matched known Flock UUID")
            ble_matched = True
        if self.signatures.match_ble_manufacturer(obs.device.ble_manufacturer_id):
            breakdown.ble_pattern = max(breakdown.ble_pattern, 0.6)
            explanations.append(f"BLE manufacturer ID {obs.device.ble_manufacturer_id} matched")
            ble_matched = True

        # RF fingerprint similarity
        if obs.rf_fingerprint and obs.rf_fingerprint.template_similarity is not None:
            breakdown.rf_fingerprint = obs.rf_fingerprint.template_similarity
            if obs.rf_fingerprint.matched_template:
                explanations.append(
                    f"RF fingerprint matched template '{obs.rf_fingerprint.matched_template}' "
                    f"with similarity {obs.rf_fingerprint.template_similarity:.2f}"
                )

        # Timing pattern
        if obs.rf_fingerprint and obs.rf_fingerprint.burst_intervals_ms:
            intervals = obs.rf_fingerprint.burst_intervals_ms
            # Check for regular periodic patterns typical of beaconing
            if len(intervals) >= 3:
                import statistics
                mean_interval = statistics.mean(intervals)
                if mean_interval > 0:
                    stdev = statistics.stdev(intervals) if len(intervals) > 1 else 0
                    cv = stdev / mean_interval if mean_interval > 0 else 1
                    # Low coefficient of variation = regular periodic = more likely beaconing device
                    if cv < 0.2:
                        breakdown.timing_pattern = 0.8
                        explanations.append(f"Regular burst timing detected (CV={cv:.2f}, mean={mean_interval:.1f}ms)")
                    elif cv < 0.5:
                        breakdown.timing_pattern = 0.4
                        explanations.append(f"Semi-regular burst timing (CV={cv:.2f})")

        obs.confidence = breakdown
        obs.confidence_overall = breakdown.total
        obs.confidence_explanation = "; ".join(explanations) if explanations else "No matching signatures found"
