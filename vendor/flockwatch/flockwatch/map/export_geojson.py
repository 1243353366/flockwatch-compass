"""
Export observations to GeoJSON format.
"""

from __future__ import annotations

import json
from datetime import datetime

from ..schema import Observation, ScoredObservation


def observations_to_geojson(observations: list[Observation]) -> dict:
    """
    Convert a list of observations to a GeoJSON FeatureCollection.

    Each observation becomes a Point feature with properties containing
    all relevant metadata.
    """
    features = []

    for obs in observations:
        if obs.location is None:
            continue

        props = {
            "id": obs.id,
            "timestamp": obs.timestamp.isoformat(),
            "source_type": obs.source_type.value,
            "source_file": obs.source_file or "",
            "confidence_overall": obs.confidence_overall,
            "confidence_explanation": obs.confidence_explanation or "",
            "rssi_dbm": obs.signal.rssi_dbm,
            "frequency_mhz": obs.signal.frequency_mhz,
            "channel": obs.signal.channel,
            "band": obs.signal.band.value,
            "mac": obs.device.mac or "",
            "oui": obs.device.oui or "",
            "ssid": obs.device.ssid or "",
            "ble_name": obs.device.ble_name or "",
            "is_flock_detection": obs.confidence_overall is not None and obs.confidence_overall >= 0.5,
        }

        if obs.rf_fingerprint:
            props["rf_template"] = obs.rf_fingerprint.matched_template or ""
            props["rf_similarity"] = obs.rf_fingerprint.template_similarity
            props["burst_count"] = obs.rf_fingerprint.burst_count

        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [obs.location.lon, obs.location.lat],
            },
            "properties": props,
        }
        features.append(feature)

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "generated": datetime.now().isoformat(),
            "total_observations": len(observations),
            "total_features": len(features),
        },
    }


def scored_to_geojson(scored: list[ScoredObservation]) -> dict:
    """Convert scored observations to GeoJSON (only detections)."""
    detections = [s.observation for s in scored if s.is_detection]
    return observations_to_geojson(detections)


def write_geojson(observations: list[Observation], output_path: str, detections_only: bool = False) -> None:
    """Write observations to a GeoJSON file."""
    if detections_only:
        data = observations_to_geojson(
            [o for o in observations if o.confidence_overall is not None and o.confidence_overall >= 0.5]
        )
    else:
        data = observations_to_geojson(observations)

    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)
