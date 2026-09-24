# FlockWatch Workflow Example

This document walks through a complete detection workflow using FlockWatch.

## Prerequisites

```bash
# Install FlockWatch
pip install -e .

# Verify signature database
flockwatch list-sigs
```

## Step 1: Collect Data

Gather captures from your detection hardware:

1. **WiGLE** — Export a Wi-Fi survey CSV from [wigle.net](https://wigle.net)
2. **ESP32** — Run your ESP32 detection firmware and save logs as JSONL
3. **Flipper Zero** — Capture sub-GHz and 2.4 GHz logs
4. **SDR** — Record I/Q captures with your RTL-SDR or similar device

## Step 2: Ingest All Sources

```bash
# Start fresh with WiGLE data
flockwatch ingest --type wigle --file wigle_export.csv --output observations.jsonl

# Add ESP32 Wi-Fi/BLE logs
flockwatch ingest --type esp32 --file esp32_log.jsonl --output observations.jsonl --append

# Add Flipper Zero captures
flockwatch ingest --type flipper --file flipper_log.txt --output observations.jsonl --append

# Add SDR metadata (auto-extracts RF features if I/Q files are present)
flockwatch ingest --type sdr --file sdr_metadata.json --output observations.jsonl --append
```

## Step 3: Score and Correlate

```bash
# Apply confidence scoring with cross-source correlation
flockwatch score --input observations.jsonl --output scored.jsonl --threshold 0.5
```

This will:
- Match OUI prefixes against known Flock vendors
- Check SSID and BLE name patterns
- Match BLE service UUIDs
- Compare RF fingerprints against templates
- Detect regular burst timing patterns
- Boost confidence when multiple sources detect the same location

## Step 4: Generate Map

```bash
# Create an interactive map with satellite imagery
flockwatch map --input scored.jsonl --output map.html --imagery sentinel2
```

Open `map.html` in your browser to see:
- All observations color-coded by source type
- Detections above threshold highlighted in red
- Popups with full observation details
- Switchable satellite imagery layers (Sentinel-2, NAIP, OSM)

## Step 5: Export GeoJSON (Optional)

```python
from flockwatch.map.export_geojson import write_geojson
from flockwatch.schema import Observation

# Load scored observations
observations = []
with open("scored.jsonl") as f:
    for line in f:
        observations.append(Observation.model_validate_json(line.strip()))

# Export all observations
write_geojson(observations, "all_observations.geojson")

# Export only detections
write_geojson(observations, "detections.geojson", detections_only=True)
```

## Step 6: RF Feature Extraction (Standalone)

If you have raw I/Q captures and want to extract features without full ingestion:

```bash
# Extract features from a raw I/Q file
flockwatch rf-extract \
    --file captures/suspect_signal.iq \
    --sample-rate 2400000 \
    --center-freq 2437000000 \
    --output features.json
```

## Tips

- **WiGLE exports** — Use the standard CSV export from the WiGLE app or website
- **ESP32 logs** — Format as JSONL with the fields shown in `data/examples/esp32_sample.jsonl`
- **Flipper Zero** — Both JSON and plain text log formats are supported
- **SDR captures** — Use interleaved int16 format (RTL-SDR default) or complex float32
- **Confidence threshold** — Adjust with `--threshold` (0.3 = sensitive, 0.7 = conservative)
- **Map imagery** — Use `--imagery naip` for highest resolution aerial, `--imagery sentinel2` for satellite
