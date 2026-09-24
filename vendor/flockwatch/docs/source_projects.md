# FlockWatch Source Projects

FlockWatch is a unified toolkit inspired by and combining concepts from the following open-source projects. All code in FlockWatch is original work. These projects are cited as inspiration for detection methodologies.

## WatchFlock
- **Repo**: [github.com/JakeSwiz/WatchFlock](https://github.com/JakeSwiz/WatchFlock)
- **Platform**: ESP32-C5 firmware
- **Contribution to FlockWatch**: Wi-Fi/BLE scanning methodology, Flock device behavioral signatures
- **Method**: Passive Wi-Fi and BLE monitoring on ESP32 hardware to detect Flock camera radio emissions

## flock-finder
- **Repo**: [github.com/simeononsecurity/flock-finder](https://github.com/simeononsecurity/flock-finder)
- **Platform**: Python, WiGLE API
- **Contribution to FlockWatch**: WiGLE data export ingestion, OUI/MAC prefix matching, geospatial mapping
- **Method**: Cross-references WiGLE crowd-sourced Wi-Fi data against known Flock vendor OUI prefixes

## flock-detection
- **Repo**: [github.com/zmattmanz/flock-detection](https://github.com/zmattmanz/flock-detection)
- **Platform**: ESP32-S3
- **Contribution to FlockWatch**: Confidence scoring model, Wi-Fi/BLE signature patterns, logging format
- **Method**: Multi-factor detection with confidence scoring combining Wi-Fi and BLE indicators

## FlipDeFlock
- **Repo**: [github.com/ReconGrunt/FlipDeFlock](https://github.com/ReconGrunt/FlipDeFlock)
- **Platform**: Flipper Zero + ESP32
- **Contribution to FlockWatch**: Sub-1 GHz and 2.4 GHz protocol analysis, Flipper Zero log format
- **Method**: Combines Flipper Zero sub-GHz scanning with ESP32 Wi-Fi/BLE detection for multi-band coverage

## What FlockWatch Adds

1. **Unified data schema** — single normalized format for all source types
2. **SDR I/Q fingerprinting** — radio wave fingerprint extraction and template matching
3. **Multi-source fusion** — cross-source corroboration boosts confidence when multiple sources detect the same device
4. **Open satellite imagery** — full US coverage via Sentinel-2, Landsat, and NAIP
5. **Modular adapters** — easy to extend with new data sources
