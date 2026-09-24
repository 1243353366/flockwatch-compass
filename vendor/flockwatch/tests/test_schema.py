"""Tests for the unified data schema."""

from datetime import datetime, timezone

from flockwatch.schema import (
    Observation,
    SourceType,
    SignalData,
    DeviceInfo,
    Location,
    ConfidenceBreakdown,
    RfFingerprint,
    Band,
)


def test_observation_defaults():
    obs = Observation(source_type=SourceType.WIGLE)
    assert obs.id is not None
    assert obs.timestamp is not None
    assert obs.signal is not None
    assert obs.device is not None
    assert obs.confidence is None


def test_observation_with_location():
    obs = Observation(
        source_type=SourceType.ESP32_WIFI,
        location=Location(lat=42.739, lon=-84.408, accuracy_m=10.0),
    )
    assert obs.location.lat == 42.739
    assert obs.location.lon == -84.408
    assert obs.location.accuracy_m == 10.0


def test_confidence_breakdown_total():
    cb = ConfidenceBreakdown(
        oui_match=1.0,
        ssid_pattern=1.0,
        ble_pattern=0.0,
        rf_fingerprint=0.5,
        cross_source=0.0,
        timing_pattern=0.0,
    )
    # (1.0 * 0.25) + (1.0 * 0.20) + (0.0 * 0.15) + (0.5 * 0.20) + (0.0 * 0.15) + (0.0 * 0.05)
    # = 0.25 + 0.20 + 0.0 + 0.10 + 0.0 + 0.0 = 0.55
    assert abs(cb.total - 0.55) < 0.001


def test_confidence_breakdown_clamped():
    cb = ConfidenceBreakdown(
        oui_match=1.0,
        ssid_pattern=1.0,
        ble_pattern=1.0,
        rf_fingerprint=1.0,
        cross_source=1.0,
        timing_pattern=1.0,
    )
    assert cb.total == 1.0  # Should be clamped to 1.0


def test_observation_jsonl_serialization():
    obs = Observation(
        source_type=SourceType.SDR,
        timestamp=datetime(2026, 9, 23, 18, 30, 0, tzinfo=timezone.utc),
        signal=SignalData(rssi_dbm=-55, frequency_mhz=2437.0, band=Band.BAND_2_4_GHZ),
        device=DeviceInfo(mac="C4:48:54:11:22:33", oui="C4:48:54", ssid="Flock-Cam"),
    )
    jsonl = obs.to_jsonl()
    assert '"source_type":"sdr"' in jsonl
    assert '"rssi_dbm":-55.0' in jsonl


def test_rf_fingerprint_model():
    fp = RfFingerprint(
        capture_file="test.iq",
        sample_rate=2400000,
        center_freq_mhz=2437.0,
        psd_features=[-60.0, -55.0, -50.0],
        burst_count=3,
        burst_intervals_ms=[100.0, 150.0],
        mean_power_db=-45.0,
    )
    assert fp.capture_file == "test.iq"
    assert fp.burst_count == 3
    assert len(fp.psd_features) == 3
