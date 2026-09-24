"""
Interactive map rendering using Folium.

Generates HTML maps with configurable satellite imagery layers
covering the full United States.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import folium

from ..schema import Observation, ScoredObservation

# Tile layer configurations for open-source satellite imagery
TILE_LAYERS = {
    "osm": {
        "name": "OpenStreetMap",
        "tiles": "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "attr": "&copy; OpenStreetMap contributors",
        "subdomains": "abc",
        "max_zoom": 19,
    },
    "sentinel2": {
        "name": "Sentinel-2 (10m satellite)",
        "tiles": "https://server.arcgisonline.com/ArcGIS/rest/services/Sentinel2/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        "attr": "Imagery &copy; Esri, Maxar, Earthstar Geographics, USDA/USGS, Copernicus Sentinel-2",
        "max_zoom": 16,
    },
    "landsat": {
        "name": "Landsat (USGS satellite)",
        "tiles": "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}",
        "attr": "Imagery courtesy of the USGS National Map",
        "max_zoom": 16,
    },
    "naip": {
        "name": "NAIP (1m aerial)",
        "tiles": "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}",
        "attr": "Imagery courtesy of the USGS National Map (NAIP)",
        "max_zoom": 18,
    },
    "usgs_topo": {
        "name": "USGS Topographic",
        "tiles": "https://basemap.nationalmap.gov/arcgis/rest/services/USTopo/MapServer/tile/{z}/{y}/{x}",
        "attr": "Topo courtesy of the USGS National Map",
        "max_zoom": 16,
    },
}

# Color scheme for source types
SOURCE_COLORS = {
    "wigle": "blue",
    "esp32_wifi": "green",
    "esp32_ble": "purple",
    "flipper": "orange",
    "sdr": "red",
}


def render_map(
    observations: list[Observation],
    output_path: str = "flockwatch_map.html",
    imagery: str = "osm",
    detections_only: bool = False,
    title: str = "FlockWatch Detection Map",
) -> str:
    """
    Render an interactive HTML map of observations.

    Args:
        observations: List of observations to plot
        output_path: Path for the output HTML file
        imagery: Base layer type (osm, sentinel2, landsat, naip, usgs_topo)
        detections_only: If True, only show detections above threshold
        title: Map title

    Returns:
        Path to the generated HTML file.
    """
    # Filter observations
    if detections_only:
        obs_list = [
            o for o in observations
            if o.confidence_overall is not None and o.confidence_overall >= 0.5
        ]
    else:
        obs_list = [o for o in observations if o.location is not None]

    # Determine map center (default to US center if no observations)
    if obs_list and obs_list[0].location:
        center_lat = obs_list[0].location.lat
        center_lon = obs_list[0].location.lon
    else:
        # Center of contiguous US
        center_lat = 39.8283
        center_lon = -98.5795

    # Get tile layer config
    tile_config = TILE_LAYERS.get(imagery, TILE_LAYERS["osm"])

    m = folium.Map(
        location=[center_lat, center_lon],
        zoom_start=10,
        tiles=None,
    )

    # Add base layer
    folium.TileLayer(
        tiles=tile_config["tiles"],
        attr=tile_config["attr"],
        name=tile_config["name"],
        max_zoom=tile_config.get("max_zoom", 18),
        subdomains=tile_config.get("subdomains", "abc"),
    ).add_to(m)

    # Add layer switcher (add OSM as alternative)
    if imagery != "osm":
        osm_config = TILE_LAYERS["osm"]
        folium.TileLayer(
            tiles=osm_config["tiles"],
            attr=osm_config["attr"],
            name=osm_config["name"],
            max_zoom=osm_config.get("max_zoom", 19),
            subdomains=osm_config.get("subdomains", "abc"),
        ).add_to(m)

    # Add satellite layers as toggleable options
    for layer_key in ["sentinel2", "naip"]:
        if layer_key != imagery:
            cfg = TILE_LAYERS[layer_key]
            folium.TileLayer(
                tiles=cfg["tiles"],
                attr=cfg["attr"],
                name=cfg["name"],
                max_zoom=cfg.get("max_zoom", 16),
            ).add_to(m)

    # Add title
    title_html = f"""
    <div style="position: fixed; z-index: 1000; top: 10px; left: 50px;
                background: white; padding: 10px 20px; border-radius: 5px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3); font-size: 16px; font-weight: bold;">
        {title}
    </div>
    """
    m.get_root().html.add_child(folium.Element(title_html))

    # Add observations
    for obs in obs_list:
        if obs.location is None:
            continue

        color = SOURCE_COLORS.get(obs.source_type.value, "gray")

        # Determine if detection
        is_detection = obs.confidence_overall is not None and obs.confidence_overall >= 0.5
        if is_detection:
            color = "red"
            radius = 8
        else:
            radius = 5

        # Build popup text
        popup_parts = [
            f"<b>Source:</b> {obs.source_type.value}",
            f"<b>Time:</b> {obs.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}",
        ]
        if obs.signal.rssi_dbm is not None:
            popup_parts.append(f"<b>RSSI:</b> {obs.signal.rssi_dbm} dBm")
        if obs.signal.frequency_mhz is not None:
            popup_parts.append(f"<b>Freq:</b> {obs.signal.frequency_mhz:.1f} MHz")
        if obs.device.mac:
            popup_parts.append(f"<b>MAC:</b> {obs.device.mac}")
        if obs.device.oui:
            popup_parts.append(f"<b>OUI:</b> {obs.device.oui}")
        if obs.device.ssid:
            popup_parts.append(f"<b>SSID:</b> {obs.device.ssid}")
        if obs.confidence_overall is not None:
            popup_parts.append(f"<b>Confidence:</b> {obs.confidence_overall:.1%}")
            if obs.confidence_explanation:
                popup_parts.append(f"<b>Reason:</b> {obs.confidence_explanation}")
        if obs.rf_fingerprint and obs.rf_fingerprint.matched_template:
            popup_parts.append(f"<b>RF Match:</b> {obs.rf_fingerprint.matched_template} ({obs.rf_fingerprint.template_similarity:.2f})")

        popup_html = "<br>".join(popup_parts)

        folium.CircleMarker(
            location=[obs.location.lat, obs.location.lon],
            radius=radius,
            popup=folium.Popup(popup_html, max_width=400),
            color=color,
            fill=True,
            fillColor=color,
            fillOpacity=0.7,
            weight=1,
        ).add_to(m)

    # Add legend
    legend_html = """
    <div style="position: fixed; bottom: 30px; left: 50px; z-index: 1000;
                background: white; padding: 15px; border-radius: 5px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3); font-size: 13px;">
        <b>Legend</b><br>
        <span style="color: red;">&#9679; Flock Detection</span><br>
        <span style="color: blue;">&#9679; WiGLE</span><br>
        <span style="color: green;">&#9679; ESP32 Wi-Fi</span><br>
        <span style="color: purple;">&#9679; ESP32 BLE</span><br>
        <span style="color: orange;">&#9679; Flipper Zero</span><br>
        <span style="color: red;">&#9679; SDR / RF</span><br>
    </div>
    """
    m.get_root().html.add_child(folium.Element(legend_html))

    # Add layer control
    folium.LayerControl().add_to(m)

    # Save
    m.save(output_path)
    return output_path


def render_scored_map(
    scored: list[ScoredObservation],
    output_path: str = "flockwatch_map.html",
    imagery: str = "osm",
    title: str = "FlockWatch Detection Map",
) -> str:
    """Render a map from scored observations."""
    observations = [s.observation for s in scored]
    return render_map(
        observations,
        output_path=output_path,
        imagery=imagery,
        detections_only=False,
        title=title,
    )
