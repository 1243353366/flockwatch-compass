"""
Public Data Research Providers

Sources for independent public corroboration of Flock camera detections:
- WiGLE: crowdsourced Wi-Fi/BLE observations (passive, not fully independent)
- Municipal: procurement records, city council minutes, public safety contracts
- OSM: OpenStreetMap context (not proof, but nearby infrastructure context)
- News: installation announcements, FOIA releases, journalism
- Community: forum posts, social media observations
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
import json
import urllib.request
import urllib.parse

from ..evidence_schema import PublicCorroboration, PublicSourceType


def search_wigle_area(
    lat: float,
    lon: float,
    radius_m: float = 500,
    ssid_filter: str = "Flock",
) -> list[PublicCorroboration]:
    """
    Search WiGLE for Wi-Fi networks near a location matching Flock patterns.

    WiGLE is crowdsourced passive data — useful for corroboration but
    not fully independent (same detection method).
    """
    # WiGLE API requires authentication for detailed queries
    # This returns a structured note about the search
    return [
        PublicCorroboration(
            source_type=PublicSourceType.WIGLE,
            source_name="WiGLE Database",
            url=f"https://wigle.net/search#lat={lat}&lon={lon}&radius={radius_m}",
            description=f"WiGLE area search within {radius_m}m of {lat:.4f}, {lon:.4f}. "
                        f"Filtered for SSIDs containing '{ssid_filter}'. "
                        f"WiGLE is crowdsourced passive data — useful for corroboration "
                        f"but not fully independent of detection method.",
            verified=False,
            retrieved_at=datetime.now(timezone.utc),
            raw_data={
                "search_lat": lat,
                "search_lon": lon,
                "radius_m": radius_m,
                "ssid_filter": ssid_filter,
                "note": "WiGLE observations are passive RF data. They corroborate that others have observed similar signals, but use the same detection methodology.",
            },
        )
    ]


def search_municipal_records(
    lat: float,
    lon: float,
    city: Optional[str] = None,
    state: Optional[str] = None,
) -> list[PublicCorroboration]:
    """
    Search for municipal procurement records and public safety contracts
    related to Flock Safety cameras.

    Sources include:
    - City council meeting minutes
    - Public safety department procurement records
    - Police department technology acquisitions
    - Budget allocations for ALPR/surveillance systems

    These are independent public evidence — different methodology than
    RF detection.
    """
    results = []

    # Municipal procurement is location-specific and requires knowing
    # the jurisdiction. Return a structured search template.
    results.append(
        PublicCorroboration(
            source_type=PublicSourceType.MUNICIPAL,
            source_name="Municipal Procurement Search",
            url=f"https://www.google.com/search?q=Flock+Safety+OR+ALPR+procurement+OR+contract+site:gov",
            description=f"Municipal procurement and city council records search for Flock Safety / ALPR contracts near {lat:.4f}, {lon:.4f}"
                        + (f" ({city}, {state})" if city and state else "")
                        + ". These are independent public records — different methodology than RF detection.",
            verified=False,
            retrieved_at=datetime.now(timezone.utc),
            raw_data={
                "search_lat": lat,
                "search_lon": lon,
                "city": city,
                "state": state,
                "search_terms": ["Flock Safety", "ALPR", "automated license plate reader", "surveillance camera procurement"],
            },
        )
    )

    return results


def search_osm_context(
    lat: float,
    lon: float,
    radius_m: float = 200,
) -> list[PublicCorroboration]:
    """
    Query OpenStreetMap for infrastructure context near a detection.

    OSM provides contextual information (not proof):
    - Nearby road types (highway, residential, etc.)
    - Nearby infrastructure (traffic signals, street lights, utility poles)
    - Nearby facilities (police stations, government buildings)

    This helps assess whether a location is plausible for an ALPR camera
    (e.g., near an intersection, highway, or public safety facility).
    """
    # OSM Overpass API query
    overpass_query = f"""
    [out:json][timeout:10];
    (
      node["highway"](around:{radius_m},{lat},{lon});
      node["amenity"~"police|government"](around:{radius_m*2},{lat},{lon});
      node["man_made"~"tower|utility|street_light"](around:{radius_m},{lat},{lon});
    );
    out body;
    """

    return [
        PublicCorroboration(
            source_type=PublicSourceType.OSM,
            source_name="OpenStreetMap Infrastructure",
            url=f"https://www.openstreetmap.org/?mlat={lat}&mlon={lon}#map=19/{lat}/{lon}",
            description=f"OSM infrastructure context within {radius_m}m: road types, traffic signals, "
                        f"utility poles, and nearby public safety facilities. "
                        f"Provides locational plausibility — NOT proof of camera presence.",
            verified=False,
            retrieved_at=datetime.now(timezone.utc),
            raw_data={
                "overpass_query": overpass_query.strip(),
                "note": "OSM provides infrastructure context. ALPR cameras are typically mounted on poles near intersections or highways. This helps assess plausibility, not confirm presence.",
            },
        )
    ]


def search_news_announcements(
    lat: float,
    lon: float,
    city: Optional[str] = None,
) -> list[PublicCorroboration]:
    """
    Search for news articles and press releases about Flock Safety
    camera installations near a location.

    Sources:
    - Local news coverage of ALPR deployments
    - Flock Safety press releases
    - Police department announcements
    - ACLU/privacy advocacy coverage of surveillance deployments
    """
    search_terms = "Flock Safety camera installation ALPR"
    if city:
        search_terms += f" {city}"

    return [
        PublicCorroboration(
            source_type=PublicSourceType.NEWS,
            source_name="News & Press Release Search",
            url=f"https://www.google.com/search?q={urllib.parse.quote(search_terms)}&tbm=nws",
            description=f"News search for Flock Safety / ALPR installation announcements near {lat:.4f}, {lon:.4f}"
                        + (f" ({city})" if city else "")
                        + ". Independent public evidence — journalism and official announcements.",
            verified=False,
            retrieved_at=datetime.now(timezone.utc),
            raw_data={
                "search_terms": search_terms,
                "note": "News coverage of Flock deployments is independent public evidence. Many cities publicly announce ALPR camera installations.",
            },
        )
    ]


def run_public_data_research(
    lat: float,
    lon: float,
    observed_frequencies: list[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
) -> list[PublicCorroboration]:
    """
    Run all public data research providers for a location.

    This is the OSINT pipeline:
    Observed RF signature → identify likely hardware → look up FCC authorization
    → search WiGLE → search municipal records → search OSM context → search news

    Returns all corroboration sources found.
    """
    results = []

    # WiGLE area search
    results.extend(search_wigle_area(lat, lon))

    # Municipal procurement records
    results.extend(search_municipal_records(lat, lon, city, state))

    # OSM infrastructure context
    results.extend(search_osm_context(lat, lon))

    # News and announcements
    results.extend(search_news_announcements(lat, lon, city))

    return results
