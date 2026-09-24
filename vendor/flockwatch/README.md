# FlockWatch

**Unified Flock camera detection, data fusion, and RF fingerprinting toolkit.**

FlockWatch combines multiple detection modalities — Wi-Fi/BLE scanning, WiGLE data exports, Flipper Zero logs, and SDR I/Q captures — into a single framework with a unified data schema, confidence scoring, and interactive mapping.

## What It Does

- **Ingests** data from four source types: WiGLE CSV/KML exports, ESP32 Wi-Fi/BLE logs, Flipper Zero captures, and SDR I/Q recordings
- **Normalizes** everything into a unified observation schema with timestamps, locations, signal data, and confidence scores
- **Scores** detections using weighted multi-factor confidence: OUI matching, SSID/BLE patterns, RF fingerprint similarity, and cross-source corroboration
- **Fingerprints** radio emissions via SDR I/Q analysis (power spectral density, spectral peaks, burst timing)
- **Maps** detections to interactive HTML maps with configurable satellite imagery layers covering the full US

## Detection Modalities

| Source | What It Detects | Method |
|--------|----------------|--------|
| WiGLE exports | Known Flock OUI/MAC prefixes in Wi-Fi data | OUI prefix matching against crowd-sourced database |
| ESP32 Wi-Fi/BLE | Active Wi-Fi and BLE advertisement signatures | SSID patterns, BSSID OUI, BLE service UUIDs |
| Flipper Zero | Sub-1 GHz and 2.4 GHz transmissions | Protocol analysis, timing patterns |
| SDR I/Q captures | RF fingerprinting of device emissions | Spectral analysis, power density, burst timing, template matching |

## Unified Schema

All observations are normalized to this schema:

```json
{
  "id": "uuid",
  "timestamp": "ISO 8601 with timezone",
  "source_type": "wigle | esp32_wifi | esp32_ble | flipper | sdr",
  "source_file": "original file name",
  "location": {
    "lat": 42.739,
    "lon": -84.408,
    "accuracy_m": 10.0
  },
  "signal": {
    "rssi_dbm": -65,
    "frequency_mhz": 2412,
    "channel": 1,
    "band": "2.4GHz"
  },
  "device": {
    "mac": "AA:BB:CC:DD:EE:FF",
    "oui": "AA:BB:CC",
    "ssid": "Flock-XXXX",
    "ble_service_uuids": []
  },
  "rf_fingerprint": {
    "capture_file": "path/to/capture.iq",
    "sample_rate": 2400000,
    "center_freq_mhz": 2412,
    "psd_features": [],
    "spectral_peaks": [],
    "burst_count": 0,
    "burst_intervals_ms": [],
    "template_similarity": 0.0
  },
  "confidence": {
    "overall": 0.75,
    "breakdown": {
      "oui_match": 0.3,
      "ssid_pattern": 0.2,
      "ble_pattern": 0.0,
      "rf_fingerprint": 0.15,
      "cross_source": 0.1
    },
    "explanation": "OUI prefix matched known Flock vendor; SSID contains Flock pattern"
  }
}
```

## Quick Start

```bash
# Install
pip install -e .

# Ingest WiGLE export
flockwatch ingest --type wigle --file data/examples/wigle_sample.csv --output observations.jsonl

# Ingest ESP32 log
flockwatch ingest --type esp32 --file data/examples/esp32_sample.jsonl --output observations.jsonl --append

# Ingest Flipper Zero log
flockwatch ingest --type flipper --file data/examples/flipper_sample.txt --output observations.jsonl --append

# Ingest SDR metadata
flockwatch ingest --type sdr --file data/examples/sdr_metadata_sample.json --output observations.jsonl --append

# Score and correlate detections
flockwatch score --input observations.jsonl --output scored.jsonl

# Generate interactive map
flockwatch map --input scored.jsonl --output map.html --imagery sentinel2
```

## Satellite Imagery Layers

FlockWatch supports open-source satellite and aerial imagery for the full United States:

| Layer | Source | Type | Resolution |
|-------|--------|------|------------|
| OpenStreetMap | OSM | Vector base map | n/a |
| Sentinel-2 | Copernicus/EU | True satellite | 10m |
| Landsat 8/9 | USGS/NASA | True satellite | 30m |
| NAIP | USDA/USGS | Aerial imagery | 1m |
| USGS Topo | USGS | Topographic | Vector |

Use `--imagery` flag with `flockwatch map` to select a base layer.

## RF Fingerprinting

The SDR module extracts distinctive features from I/Q captures:

- **Power Spectral Density** — frequency-domain power distribution
- **Spectral Peaks** — dominant frequency components
- **Burst Timing** — transmission interval patterns
- **Template Similarity** — cosine similarity against known device signatures

```bash
# Extract RF features from a raw I/Q capture
flockwatch rf-extract --file capture.iq --sample-rate 2.4e6 --center-freq 2412e6 --output features.json
```

## Signature Database

Detection rules are stored in human-editable YAML files under `data/signatures/`:

- `oui_prefixes.yaml` — Known Flock vendor OUI prefixes
- `wifi_rules.yaml` — Wi-Fi SSID patterns and BSSID rules
- `ble_rules.yaml` — BLE service UUIDs and advertisement patterns
- `rf_fingerprints.yaml` — Reference RF fingerprint templates

## Source Projects

FlockWatch draws inspiration from these open-source projects. See `docs/source_projects.md` for details.

- [WatchFlock](https://github.com/JakeSwiz/WatchFlock) — ESP32-C5 firmware for Flock camera detection
- [flock-finder](https://github.com/simeononsecurity/flock-finder) — Maps suspected Flock cameras using WiGLE data
- [flock-detection](https://github.com/zmattmanz/flock-detection) — ESP32-S3 Flock hardware identification
- [FlipDeFlock](https://github.com/ReconGrunt/FlipDeFlock) — Flipper Zero + ESP32 surveillance detector

## Legal and Safety

This project is for **passive detection and research only**. It does not include:

- Active probing, jamming, deauthentication, or interference
- Extracted encryption keys or exploit code
- Instructions to compromise or access devices
- Any active attack capabilities

All data ingested is user-provided from their own lawful captures and public datasets. See `docs/safety_and_legal.md` for full details.

## License

Apache License 2.0
