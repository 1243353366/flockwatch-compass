"""
Geospatial utilities for observation clustering and correlation.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from .schema import Observation


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points in meters.

    Uses the Haversine formula.
    """
    R = 6371000  # Earth radius in meters

    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


@dataclass
class Cluster:
    """A cluster of nearby observations."""

    center_lat: float
    center_lon: float
    observation_ids: list[str]
    source_types: set[str]


def cluster_observations(
    observations: list[Observation],
    max_distance_m: float = 50.0,
) -> list[Cluster]:
    """
    Group observations that are within max_distance_m of each other.

    Uses a simple greedy approach — not optimal for large datasets but
    fine for typical detection runs.
    """
    clusters: list[Cluster] = []
    assigned: set[str] = set()

    for obs in observations:
        if obs.id in assigned or obs.location is None:
            continue

        # Find a nearby existing cluster
        found_cluster = False
        for cluster in clusters:
            dist = haversine_distance(
                obs.location.lat, obs.location.lon,
                cluster.center_lat, cluster.center_lon,
            )
            if dist <= max_distance_m:
                cluster.observation_ids.append(obs.id)
                cluster.source_types.add(obs.source_type.value)
                # Update center as average
                _update_cluster_center(cluster, obs)
                assigned.add(obs.id)
                found_cluster = True
                break

        if not found_cluster:
            clusters.append(Cluster(
                center_lat=obs.location.lat,
                center_lon=obs.location.lon,
                observation_ids=[obs.id],
                source_types={obs.source_type.value},
            ))
            assigned.add(obs.id)

    return clusters


def _update_cluster_center(cluster: Cluster, new_obs: Observation) -> None:
    """Recalculate cluster center as simple average of all members."""
    # For simplicity, just use a weighted average toward the new observation
    n = len(cluster.observation_ids)
    weight = 1.0 / (n + 1)
    cluster.center_lat = cluster.center_lat * (1 - weight) + new_obs.location.lat * weight
    cluster.center_lon = cluster.center_lon * (1 - weight) + new_obs.location.lon * weight


def find_correlated(
    observations: list[Observation],
    max_distance_m: float = 50.0,
    max_time_diff_s: float = 300.0,
) -> dict[str, list[str]]:
    """
    Find observations that corroborate each other (close in space and time,
    from different sources).

    Returns a mapping of observation_id -> list of correlated observation_ids.
    """
    from datetime import timedelta

    correlations: dict[str, list[str]] = {}

    for i, obs_a in enumerate(observations):
        if obs_a.location is None:
            continue
        for obs_b in observations[i + 1:]:
            if obs_b.location is None:
                continue
            if obs_a.source_type == obs_b.source_type:
                continue

            dist = haversine_distance(
                obs_a.location.lat, obs_a.location.lon,
                obs_b.location.lat, obs_b.location.lon,
            )
            if dist > max_distance_m:
                continue

            time_diff = abs((obs_a.timestamp - obs_b.timestamp).total_seconds())
            if time_diff > max_time_diff_s:
                continue

            correlations.setdefault(obs_a.id, []).append(obs_b.id)
            correlations.setdefault(obs_b.id, []).append(obs_a.id)

    return correlations
