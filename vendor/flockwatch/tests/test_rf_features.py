"""Tests for RF feature extraction."""

import struct
import tempfile
from pathlib import Path

import numpy as np

from flockwatch.rf.features import extract_features
from flockwatch.rf.fingerprint import match_fingerprint
from flockwatch.schema import RfFingerprint
from flockwatch.signatures import SignatureDatabase


def _create_test_iq(file_path: str, n_samples: int = 48000, sample_rate: int = 2400000):
    """Create a test I/Q file with a known signal (sine wave)."""
    t = np.arange(n_samples) / sample_rate
    # Create a signal with a burst pattern
    signal = np.zeros(n_samples, dtype=np.complex64)
    # Add bursts every 1000 samples
    for start in range(0, n_samples, 2000):
        end = min(start + 500, n_samples)
        t_burst = t[start:end]
        freq = 100000  # 100 kHz offset
        signal[start:end] = np.exp(1j * 2 * np.pi * freq * t_burst)

    # Add noise
    signal += (np.random.randn(n_samples) + 1j * np.random.randn(n_samples)) * 0.01

    signal.astype(np.complex64).tofile(file_path)


def test_extract_features_from_iq():
    with tempfile.TemporaryDirectory() as tmpdir:
        iq_path = str(Path(tmpdir) / "test.iq")
        _create_test_iq(iq_path)

        fp = extract_features(
            iq_path,
            sample_rate=2400000,
            center_freq_mhz=2437.0,
            fft_size=1024,
        )

        assert fp.capture_file == iq_path
        assert fp.sample_rate == 2400000
        assert fp.center_freq_mhz == 2437.0
        assert fp.num_samples > 0
        assert len(fp.psd_features) > 0
        assert len(fp.psd_freq_bins_mhz) > 0
        assert fp.burst_count >= 0


def test_extract_features_missing_file():
    fp = extract_features(
        "/nonexistent/file.iq",
        sample_rate=2400000,
        center_freq_mhz=2437.0,
    )
    assert fp.capture_file == "/nonexistent/file.iq"
    assert fp.num_samples is None
    assert len(fp.psd_features) == 0


def test_template_matching():
    sig_db = SignatureDatabase.load()

    # Create a fingerprint that should match one of the templates
    fp = RfFingerprint(
        capture_file="test.iq",
        sample_rate=2400000,
        center_freq_mhz=2437.0,
        psd_features=[-60, -58, -55, -52, -50, -48, -47, -46, -45, -44,
                      -43, -42, -41, -40, -39, -38, -37, -36, -35, -34,
                      -33, -32, -31, -30, -30, -31, -32, -33, -34, -35,
                      -36, -37, -38, -39, -40, -41, -42, -43, -44, -45,
                      -46, -47, -48, -49, -50, -51, -52, -53, -54, -55,
                      -56, -57, -58, -59, -60, -61, -62, -63, -64, -65,
                      -66, -67, -68, -69],
    )

    name, score = match_fingerprint(fp, sig_db)
    assert name is not None
    assert score > 0.5  # Should match the wifi beacon template
