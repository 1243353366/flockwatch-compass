# FlockWatch Compass

**Agentic AI platform for locating Flock cameras across the United States.**

FlockWatch Compass combines passive detection, data fusion, RF fingerprinting, and AI agent reasoning into a single platform. It merges two projects:

- **[FlockWatch](https://github.com/1243353366/flockwatch)** — Python detection engine: WiGLE/ESP32/Flipper/SDR ingestion, confidence scoring, RF fingerprint extraction, interactive mapping
- **[Project Compass](https://github.com/1243353366/corpora-ai)** — Node.js decision-support framework: evidence chains, recommendation engine, web UI, security, rate limiting, optional AI narrative

The agentic layer uses AI reasoning to cluster detections, rank leads, generate evidence chains, identify coverage gaps, and produce actionable intelligence for analysts.

## What the Agent Does

1. **Ingests** observations from WiGLE, ESP32, Flipper Zero, and SDR sources
2. **Scores** each observation using multi-factor confidence (OUI, SSID, BLE, RF, timing, cross-source)
3. **Clusters** observations geographically
4. **Ranks** clusters by confidence, density, recency, cross-source corroboration, and RF evidence
5. **Generates evidence chains** for each lead: Evidence → Interpretation → Recommendation → Action → Owner → Dependency → Success criterion
6. **Analyzes US coverage** using a 2-degree geographic grid — identifies hotspots and gaps
7. **Produces AI intelligence summaries** with verification recommendations (or deterministic fallback)

## Architecture

```
Web UI (Node.js)
  ├── Agent Analysis — submit observations, get ranked leads with evidence chains
  ├── Data Ingestion — ingest from WiGLE/ESP32/Flipper/SDR sources
  ├── Coverage Map — US-wide coverage analysis with hotspots and gaps
  └── Signatures — view loaded detection rules

Agentic Layer (Node.js)
  ├── flock-agent-engine.js — clustering, ranking, evidence chains, coverage analysis
  └── ai-narrative.js — AI intelligence summaries (OpenAI-compatible, deterministic fallback)

Python Bridge
  └── flockwatch-runner.js — calls FlockWatch CLI for ingestion, scoring, mapping

FlockWatch Engine (Python)
  ├── Adapters: WiGLE CSV, ESP32 JSONL, Flipper logs, SDR I/Q metadata
  ├── Scoring: OUI match, SSID patterns, BLE UUIDs, RF fingerprint similarity
  ├── RF: PSD extraction, spectral peaks, burst timing, template matching
  └── Mapping: Folium HTML maps with Sentinel-2, Landsat, NAIP, OSM layers
```

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.9+ (for the FlockWatch detection engine)

### Install and Run

```bash
git clone https://github.com/1243353366/flockwatch-compass.git
cd flockwatch-compass

# Install Node.js dependencies
npm ci

# Install Python engine (from vendored FlockWatch)
cd vendor/flockwatch && pip install -e ".[dev]" && cd ../..

# Start the server
npm start
```

Open [http://localhost:8787](http://localhost:8787)

### Optional AI Narrative

```bash
cp .env.example .env
# Edit .env:
# AI_MODE=on
# AI_API_KEY=your-key
# AI_BASE_URL=https://api.openai.com/v1
# AI_MODEL=gpt-4o-mini
```

## API

### `POST /api/analyze`
Submit observations for agentic analysis. Returns ranked leads with evidence chains, coverage analysis, and optional AI narrative.

### `POST /api/ingest`
Ingest a source file (wigle/esp32/flipper/sdr) via the Python engine.

### `POST /api/score`
Score ingested observations with the confidence engine.

### `GET /api/coverage`
Get US-wide coverage analysis from all collected observations.

### `GET /api/signatures`
View loaded detection signatures.

## Detection Sources

| Source | What It Detects | Method |
|--------|----------------|--------|
| WiGLE exports | Known Flock OUI/MAC prefixes | OUI matching against crowd-sourced database |
| ESP32 Wi-Fi/BLE | Active Wi-Fi and BLE signatures | SSID patterns, BSSID OUI, BLE service UUIDs |
| Flipper Zero | Sub-1 GHz and 2.4 GHz transmissions | Protocol analysis, timing patterns |
| SDR I/Q captures | RF fingerprinting of device emissions | PSD, spectral peaks, burst timing, template matching |

## Evidence Chain Pattern

Every detection lead follows the auditable chain from Project Compass:

```
Evidence → Interpretation → Recommendation → Action → Owner → Dependency → Success criterion
```

This ensures every finding is traceable, every recommendation has an owner, and every action has a success criterion.

## US Coverage Model

The agent analyzes coverage using a 2-degree geographic grid across the contiguous US. Coverage gaps indicate regions where no data has been collected — NOT confirmed absence of cameras. See [docs/US-COVERAGE-MODEL.md](docs/US-COVERAGE-MODEL.md).

## Legal and Safety

This platform is for **passive detection and research only**:
- No active probing, jamming, deauthentication, or interference
- No extracted encryption keys or exploit code
- No instructions to compromise or access devices
- All data is user-provided from lawful captures and public datasets
- Satellite imagery is for map display, not automatic camera detection

See [docs/safety_and_legal.md](vendor/flockwatch/docs/safety_and_legal.md) for full details.

## License

Apache License 2.0

## Source Projects

- [FlockWatch](https://github.com/1243353366/flockwatch) — detection engine
- [Project Compass (corpora-ai)](https://github.com/1243353366/corpora-ai) — decision-support framework
- [WatchFlock](https://github.com/JakeSwiz/WatchFlock) — ESP32-C5 firmware (inspiration)
- [flock-finder](https://github.com/simeononsecurity/flock-finder) — WiGLE mapping (inspiration)
- [flock-detection](https://github.com/zmattmanz/flock-detection) — ESP32-S3 detection (inspiration)
- [FlipDeFlock](https://github.com/ReconGrunt/FlipDeFlock) — Flipper Zero detector (inspiration)
