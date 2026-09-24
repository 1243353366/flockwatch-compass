# Architecture

## Overview

FlockWatch is built as a modular Python package with a CLI interface. The design separates data ingestion, normalization, scoring, RF analysis, and visualization into distinct modules.

```
┌─────────────────────────────────────────────────────────┐
│                      CLI (cli.py)                        │
│  ingest │ score │ map │ rf-extract │ list-signatures     │
├─────────────────────────────────────────────────────────┤
│                    Adapters Layer                        │
│  ┌──────┐ ┌──────┐ ┌────────┐ ┌──────┐                  │
│  │WiGLE │ │ESP32 │ │Flipper │ │ SDR  │                  │
│  └──┬───┘ └──┬───┘ └───┬────┘ └──┬───┘                  │
│     │        │         │         │                       │
│     └────────┴─────────┴─────────┘                       │
│                    ↓                                     │
│            Unified Schema (schema.py)                    │
│     Observation │ Emitter │ RfFingerprint                 │
├─────────────────────────────────────────────────────────┤
│                 Scoring Engine                           │
│  OUI match │ SSID patterns │ BLE UUIDs │ RF similarity  │
│  Cross-source corroboration → Confidence score           │
├─────────────────────────────────────────────────────────┤
│              RF Fingerprinting (rf/)                     │
│  PSD extraction │ Spectral peaks │ Burst timing         │
│  Template matching (cosine similarity)                   │
├─────────────────────────────────────────────────────────┤
│              Geospatial & Mapping (map/)                 │
│  GeoJSON export │ Folium interactive map                │
│  Satellite layers: Sentinel-2 │ Landsat │ NAIP │ OSM     │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

1. **Ingest** — Adapter parses source file → produces list of raw observations
2. **Normalize** — Raw observations mapped to unified `Observation` schema
3. **Score** — Scoring engine evaluates each observation against signature rules → produces `ScoredObservation`
4. **Correlate** — Nearby detections from different sources boost confidence (cross-source corroboration)
5. **Export** — Scored observations exported as JSONL, GeoJSON, or interactive map

## Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| `schema.py` | Pydantic models for all data entities |
| `scoring.py` | Multi-factor confidence scoring engine |
| `signatures.py` | Load and query signature rule files |
| `geo.py` | Geospatial utilities (distance, clustering) |
| `adapters/wigle.py` | Parse WiGLE CSV/KML exports |
| `adapters/esp32.py` | Parse ESP32 Wi-Fi/BLE logs |
| `adapters/flipper.py` | Parse Flipper Zero logs |
| `adapters/sdr.py` | Parse SDR I/Q metadata and trigger RF extraction |
| `rf/features.py` | Extract RF features from I/Q data |
| `rf/fingerprint.py` | Template matching and similarity scoring |
| `map/export_geojson.py` | Convert observations to GeoJSON |
| `map/render.py` | Generate interactive Folium maps |
| `cli.py` | Command-line interface |
