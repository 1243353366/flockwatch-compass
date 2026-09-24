"""Tests for the confidence scoring engine."""

from datetime import datetime, timezone

from flockwatch.schema import (
    Observation,
    SourceType,
    SignalData,
    DeviceInfo,
    Location,
    ConfidenceBreakdown,
    Band,
)
from flockwatch.scoring import ScoringEngine
from flockwatch.signatures import SignatureDatabase


def test_oui_match_scoring():
    sig_db = SignatureDatabase.load()
    engine = ScoringEngine(signatures=sig_db, threshold=0.4)

    obs = Observation(
        source_type=SourceType.WIGLE,
        timestamp=datetime(2026, 9, 23, 18, 30, 0, tzinfo=timezone.utc),
        location=Location(lat=42.739, lon=-84.408),
        signal=SignalData(rssi_dbm=-65, frequency_mhz=2437, band=Band.BAND_2_4_GHZ),
        device=DeviceInfo(mac="C4:48:54:11:22:33", oui="C4:48:54", ssid="Flock-Cam"),
    )

    scored = engine.score_all([obs])
    assert len(scored) == 1

    s = scored[0]
    assert s.is_detection  # Should be above threshold
    assert s.observation.confidence.oui_match == 1.0
    assert s.observation.confidence.ssid_pattern == 1.0


def test_no_match_scoring():
    sig_db = SignatureDatabase.load()
    engine = ScoringEngine(signatures=sig_db, threshold=0.5)

    obs = Observation(
        source_type=SourceType.WIGLE,
        timestamp=datetime(2026, 9, 23, 18, 30, 0, tzinfo=timezone.utc),
        location=Location(lat=42.739, lon=-84.408),
        signal=SignalData(rssi_dbm=-55, band=Band.BAND_2_4_GHZ),
        device=DeviceInfo(mac="AA:BB:CC:DD:EE:FF", oui="AA:BB:CC", ssid="HomeNetwork"),
    )

    scored = engine.score_all([obs])
    s = scored[0]
    assert not s.is_detection
    assert s.observation.confidence_overall < 0.5


def test_cross_source_correlation():
    sig_db = SignatureDatabase.load()
    engine = ScoringEngine(signatures=sig_db, threshold=0.3)

    # Two observations from different sources at the same location
    obs1 = Observation(
        source_type=SourceType.WIGLE,
        timestamp=datetime(2026, 9, 23, 18, 30, 0, tzinfo=timezone.utc),
        location=Location(lat=42.739, lon=-84.408),
        device=DeviceInfo(mac="C4:48:54:11:22:33", oui="C4:48:54", ssid="Flock-Cam"),
    )
    obs2 = Observation(
        source_type=SourceType.ESP32_BLE,
        timestamp=datetime(2026, 9, 23, 18, 30, 5, tzinfo=timezone.utc),
        location=Location(lat=42.7391, lon=-84.4081),
        device=DeviceInfo(mac="C4:48:54:55:66:77", oui="C4:48:54", ble_name="Flock-Node"),
    )

    scored = engine.score_all([obs1, obs2])

    # Both should have cross-source corroboration
    for s in scored:
        assert s.observation.confidence.cross_source > 0
        assert len(s.correlated_observations) > 0
