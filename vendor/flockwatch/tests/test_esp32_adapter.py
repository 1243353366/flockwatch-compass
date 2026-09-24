"""Tests for the ESP32 log adapter."""

from pathlib import Path

from flockwatch.adapters.esp32 import parse_esp32_log


EXAMPLE_DIR = Path(__file__).parent.parent / "data" / "examples"


def test_parse_esp32_sample():
    log_path = EXAMPLE_DIR / "esp32_sample.jsonl"
    observations = parse_esp32_log(str(log_path))

    assert len(observations) == 5

    # First should be Wi-Fi
    obs = observations[0]
    assert obs.source_type.value == "esp32_wifi"
    assert obs.device.mac == "C4:48:54:11:22:33"
    assert obs.device.ssid == "Flock-Cam-A1F2"
    assert obs.signal.rssi_dbm == -65.0
    assert obs.location.lat == 42.7392

    # Third should be BLE
    ble_obs = observations[2]
    assert ble_obs.source_type.value == "esp32_ble"
    assert ble_obs.device.ble_name == "Flock-Node-003"
    assert ble_obs.device.ble_service_uuids == ["0000fe59-0000-1000-8000-00805f9b34fb"]
    assert ble_obs.device.ble_manufacturer_id == 490


def test_parse_esp32_oui_extraction():
    log_path = EXAMPLE_DIR / "esp32_sample.jsonl"
    observations = parse_esp32_log(str(log_path))

    obs = observations[0]
    assert obs.device.oui == "C4:48:54"
