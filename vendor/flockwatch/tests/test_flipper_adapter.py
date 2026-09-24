"""Tests for the Flipper Zero log adapter."""

from pathlib import Path

from flockwatch.adapters.flipper import parse_flipper_log


EXAMPLE_DIR = Path(__file__).parent.parent / "data" / "examples"


def test_parse_flipper_json_format():
    log_path = EXAMPLE_DIR / "flipper_sample.txt"
    observations = parse_flipper_log(str(log_path))

    assert len(observations) == 3

    # First observation — sub-GHz
    obs = observations[0]
    assert obs.source_type.value == "flipper"
    assert obs.signal.frequency_mhz == 915.0
    assert obs.signal.band.value == "subGHz"
    assert obs.signal.rssi_dbm == -45.0

    # Second — 2.4 GHz
    obs2 = observations[1]
    assert obs2.signal.frequency_mhz == 2412.0
    assert obs2.signal.band.value == "2.4GHz"


def test_parse_flipper_burst_data():
    log_path = EXAMPLE_DIR / "flipper_sample.txt"
    observations = parse_flipper_log(str(log_path))

    obs = observations[0]
    assert obs.raw_data["burst_count"] == 3
    assert obs.raw_data["burst_intervals_ms"] == [100.0, 150.0]
