# US Coverage Model

## How Coverage Works

FlockWatch Compass analyzes detection coverage across the contiguous United States using a geographic grid system.

## Grid System

- **Grid resolution**: 2 degrees latitude × 2 degrees longitude
- **US bounds**: 24.5°N to 49.5°N, -125.0°W to -66.5°W
- **Total grid cells**: ~600 cells covering the contiguous US
- **Coverage metric**: percentage of grid cells with at least one detection cluster

## What Coverage Means

| Status | Meaning |
|--------|---------|
| **Covered** | At least one detection cluster exists in this grid cell. Does NOT confirm cameras are present — only that data was collected. |
| **Gap** | No detection data has been collected in this grid cell. Does NOT mean cameras are absent — only that no evidence has been gathered. |

## Important Caveats

1. **Gaps ≠ Absence**: A coverage gap means no one has collected data there, not that no cameras exist there.
2. **Detections ≠ Confirmation**: A detection lead is evidence-based but requires lawful verification.
3. **Density bias**: Coverage will naturally concentrate in populated areas where more people carry detection devices.
4. **Temporal decay**: Observations older than 30 days have reduced weight in the ranking.

## Hotspots

Hotspots are clusters with confidence scores ≥ 0.5, ranked by:
- Observation confidence
- Cross-source corroboration
- Recency
- RF fingerprint matches
- Observation density

## Data Sources for US Coverage

| Source | Coverage | Resolution |
|--------|----------|------------|
| WiGLE | Crowdsourced, urban-heavy | Individual Wi-Fi networks |
| ESP32 logs | User-collected | Exact GPS coordinates |
| Flipper Zero | User-collected | Exact GPS coordinates |
| SDR captures | User-collected | Exact GPS coordinates |

## Satellite Imagery

Satellite imagery layers (Sentinel-2, Landsat, NAIP) provide contextual map backgrounds for visualizing detection locations. They are NOT used for automatic camera detection — no computer vision model is trained to identify Flock cameras from satellite images.
