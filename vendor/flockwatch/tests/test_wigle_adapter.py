"""Tests for the WiGLE CSV adapter."""

from pathlib import Path

from flockwatch.adapters.wigle import parse_wigle_csv


EXAMPLE_DIR = Path(__file__).parent.parent / "data" / "examples"


def test_parse_wigle_sample():
    csv_path = EXAMPLE_DIR / "wigle_sample.csv"
    observations = parse_wigle_csv(str(csv_path))

    assert len(observations) == 5

    # First observation should be a Flock device
    obs = observations[0]
    assert obs.source_type.value == "wigle"
    assert obs.device.mac == "C4:48:54:11:22:33"
    assert obs.device.oui == "C4:48:54"
    assert obs.device.ssid == "Flock-Cam-A1F2"
    assert obs.location.lat == 42.7392
    assert obs.location.lon == -84.4083
    assert obs.signal.rssi_dbm == -65.0
    assert obs.signal.channel == 6
    assert obs.signal.band.value == "2.4GHz"


def test_parse_wigle_frequency_calculation():
    csv_path = EXAMPLE_DIR / "wigle_sample.csv"
    observations = parse_wigle_csv(str(csv_path))

    # Channel 6 = 2412 + (6-1)*5 = 2437 MHz
    assert observations[0].signal.frequency_mhz == 2437.0

    # Channel 11 = 2412 + (11-1)*5 = 2462 MHz
    assert observations[1].signal.frequency_mhz == 2462.0


def test_parse_wigle_non_flock_device():
    csv_path = EXAMPLE_DIR / "wigle_sample.csv"
    observations = parse_wigle_csv(str(csv_path))

    # Last observation should be a regular home network
    obs = observations[4]
    assert obs.device.ssid == "HomeNetwork"
    assert obs.device.mac == "AA:BB:CC:DD:EE:FF"
