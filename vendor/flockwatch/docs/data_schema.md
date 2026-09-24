# Data Schema

## Core Entities

### Observation

The `Observation` model is the core data entity. All source types are normalized into this schema.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID (str) | Unique observation identifier |
| `timestamp` | datetime | ISO 8601 timestamp with timezone |
| `source_type` | enum | wigle, esp32_wifi, esp32_ble, flipper, sdr |
| `source_file` | str | Original file name |
| `location` | Location | Geographic coordinates with accuracy |
| `signal` | SignalData | RSSI, frequency, channel, band |
| `device` | DeviceInfo | MAC, OUI, SSID, BLE fields |
| `rf_fingerprint` | RfFingerprint | RF features (SDR only) |
| `confidence` | ConfidenceBreakdown | Per-factor confidence scores |
| `confidence_overall` | float | Weighted overall confidence (0-1) |
| `confidence_explanation` | str | Human-readable explanation |
| `raw_data` | dict | Original source data for reference |
| `notes` | str | User notes |

### Location

| Field | Type | Description |
|-------|------|-------------|
| `lat` | float | Latitude (-90 to 90) |
| `lon` | float | Longitude (-180 to 180) |
| `accuracy_m` | float | Estimated accuracy in meters |

### SignalData

| Field | Type | Description |
|-------|------|-------------|
| `rssi_dbm` | float | RSSI in dBm |
| `frequency_mhz` | float | Center frequency in MHz |
| `channel` | int | Channel number |
| `band` | enum | 2.4GHz, 5GHz, subGHz, unknown |
| `snr_db` | float | Signal-to-noise ratio in dB |
| `noise_floor_dbm` | float | Noise floor in dBm |

### DeviceInfo

| Field | Type | Description |
|-------|------|-------------|
| `mac` | str | Full MAC address |
| `oui` | str | First 3 octets (OUI prefix) |
| `ssid` | str | Wi-Fi SSID |
| `ble_name` | str | BLE device name |
| `ble_service_uuids` | list[str] | BLE service UUIDs |
| `ble_manufacturer_id` | int | BLE manufacturer ID |
| `encryption_type` | str | Wi-Fi encryption type |

### RfFingerprint

| Field | Type | Description |
|-------|------|-------------|
| `capture_file` | str | Path to I/Q capture file |
| `sample_rate` | int | Sample rate in Hz |
| `center_freq_mhz` | float | Center frequency in MHz |
| `num_samples` | int | Number of I/Q samples processed |
| `psd_features` | list[float] | PSD feature vector (64 bins) |
| `psd_freq_bins_mhz` | list[float] | Frequency bins for PSD |
| `spectral_peaks` | list[dict] | Dominant peaks: {freq_mhz, power_db} |
| `burst_count` | int | Number of detected bursts |
| `burst_intervals_ms` | list[float] | Inter-burst intervals in ms |
| `mean_power_db` | float | Mean power in dB |
| `peak_power_db` | float | Peak power in dB |
| `template_similarity` | float | Cosine similarity to best template (0-1) |
| `matched_template` | str | Name of matched RF template |

### ConfidenceBreakdown

| Factor | Weight | Description |
|--------|--------|-------------|
| `oui_match` | 0.25 | OUI prefix match |
| `ssid_pattern` | 0.20 | SSID pattern match |
| `ble_pattern` | 0.15 | BLE name/UUID/manufacturer match |
| `rf_fingerprint` | 0.20 | RF template similarity |
| `cross_source` | 0.15 | Cross-source corroboration |
| `timing_pattern` | 0.05 | Regular burst timing |

Overall confidence = weighted sum of all factors, clamped to [0, 1].

## JSONL Format

Observations are serialized as one JSON object per line (JSONL):

```json
{"id": "uuid", "timestamp": "2026-09-23T18:30:00Z", "source_type": "wigle", ...}
```
