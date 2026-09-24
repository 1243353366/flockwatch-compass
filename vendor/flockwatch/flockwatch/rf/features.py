"""
RF feature extraction from SDR I/Q captures.

Extracts distinctive features from raw I/Q data for device fingerprinting:
- Power Spectral Density (PSD)
- Spectral peaks
- Burst detection and timing
- Mean/peak power
"""

from __future__ import annotations

import struct
from pathlib import Path
from typing import Optional

import numpy as np

from ..schema import RfFingerprint


def extract_features(
    capture_file: str,
    sample_rate: int = 2400000,
    center_freq_mhz: float = 2412.0,
    fft_size: int = 1024,
    max_samples: int = 2_400_000,
) -> RfFingerprint:
    """
    Extract RF fingerprint features from a raw I/Q capture file.

    Supports:
    - Interleaved complex int16 (most common SDR format, e.g., RTL-SDR)
    - Complex float32 (GNU Radio format)
    - Complex64 numpy format

    Args:
        capture_file: Path to the I/Q capture file
        sample_rate: Sample rate in Hz
        center_freq_mhz: Center frequency in MHz
        fft_size: FFT size for PSD computation
        max_samples: Maximum number of samples to process (avoids OOM on large captures)

    Returns:
        RfFingerprint with extracted features
    """
    path = Path(capture_file)
    if not path.exists():
        return RfFingerprint(
            capture_file=capture_file,
            sample_rate=sample_rate,
            center_freq_mhz=center_freq_mhz,
        )

    iq_data = _load_iq(capture_file, max_samples)

    if iq_data is None or len(iq_data) == 0:
        return RfFingerprint(
            capture_file=capture_file,
            sample_rate=sample_rate,
            center_freq_mhz=center_freq_mhz,
        )

    # Compute Power Spectral Density
    psd_features, freq_bins = _compute_psd(iq_data, sample_rate, center_freq_mhz, fft_size)

    # Find spectral peaks
    peaks = _find_spectral_peaks(psd_features, freq_bins)

    # Detect bursts and timing
    burst_count, burst_intervals = _detect_bursts(iq_data, sample_rate)

    # Power statistics
    power = np.abs(iq_data) ** 2
    mean_power_db = 10 * np.log10(np.mean(power) + 1e-12)
    peak_power_db = 10 * np.log10(np.max(power) + 1e-12)

    return RfFingerprint(
        capture_file=capture_file,
        sample_rate=sample_rate,
        center_freq_mhz=center_freq_mhz,
        num_samples=len(iq_data),
        psd_features=_to_float_list(psd_features),
        psd_freq_bins_mhz=_to_float_list(freq_bins),
        spectral_peaks=peaks,
        burst_count=burst_count,
        burst_intervals_ms=_to_float_list(burst_intervals),
        mean_power_db=float(mean_power_db),
        peak_power_db=float(peak_power_db),
    )


def _load_iq(file_path: str, max_samples: int) -> Optional[np.ndarray]:
    """
    Load I/Q data from a file.

    Tries multiple formats: interleaved int16, complex float32, complex64.
    """
    path = Path(file_path)

    # Try complex64 first (numpy .npy or raw)
    try:
        data = np.fromfile(str(path), dtype=np.complex64, count=max_samples)
        if len(data) > 0:
            return data
    except Exception:
        pass

    # Try interleaved int16 (RTL-SDR format: I, Q, I, Q, ...)
    try:
        raw = np.fromfile(str(path), dtype=np.int16, count=max_samples * 2)
        if len(raw) >= 2:
            iq = raw[: len(raw) // 2 * 2].astype(np.float32).view(np.complex64)
            # Normalize
            iq = iq / 32768.0
            return iq
    except Exception:
        pass

    # Try interleaved float32 (I, Q, I, Q, ...)
    try:
        raw = np.fromfile(str(path), dtype=np.float32, count=max_samples * 2)
        if len(raw) >= 2:
            iq = raw[: len(raw) // 2 * 2].view(np.complex64)
            return iq
    except Exception:
        pass

    return None


def _compute_psd(
    iq_data: np.ndarray,
    sample_rate: int,
    center_freq_mhz: float,
    fft_size: int,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Compute average Power Spectral Density using Welch's method.

    Returns PSD values (in dB) and corresponding frequency bins (in MHz).
    """
    from scipy.signal import welch

    # Use Welch's method for averaged PSD
    nperseg = min(fft_size, len(iq_data))
    if nperseg < 2:
        return np.array([]), np.array([])

    freqs, psd = welch(iq_data, fs=sample_rate, nperseg=nperseg, return_onesided=False)

    # Convert to dB
    psd_db = 10 * np.log10(psd + 1e-12)

    # Convert frequencies to MHz and shift so center is at center_freq_mhz
    freq_mhz = freqs / 1e6 + center_freq_mhz

    # Shift to put center frequency in the middle
    shift_idx = len(psd_db) // 2
    psd_db = np.roll(psd_db, shift_idx)
    freq_mhz = np.roll(freq_mhz, shift_idx)

    # Downsample if too many bins
    if len(psd_db) > 64:
        step = len(psd_db) // 64
        psd_db = psd_db[::step][:64]
        freq_mhz = freq_mhz[::step][:64]

    return psd_db, freq_mhz


def _find_spectral_peaks(
    psd: np.ndarray,
    freqs: np.ndarray,
    min_prominence_db: float = 3.0,
    max_peaks: int = 5,
) -> list[dict[str, float]]:
    """Find dominant spectral peaks in the PSD."""
    if len(psd) < 3:
        return []

    from scipy.signal import find_peaks

    noise_floor = np.median(psd)
    threshold = noise_floor + min_prominence_db

    peak_indices, properties = find_peaks(psd, height=threshold, distance=2)

    # Sort by power (descending) and take top N
    if len(peak_indices) > 0:
        peak_powers = psd[peak_indices]
        sorted_idx = np.argsort(peak_powers)[::-1][:max_peaks]
        peak_indices = peak_indices[sorted_idx]

    peaks = []
    for idx in peak_indices:
        peaks.append({
            "freq_mhz": float(freqs[idx]),
            "power_db": float(psd[idx]),
        })

    return peaks


def _detect_bursts(
    iq_data: np.ndarray,
    sample_rate: int,
    threshold_factor: float = 2.0,
    min_burst_samples: int = 100,
) -> tuple[int, list[float]]:
    """
    Detect transmission bursts in the I/Q data.

    Uses an energy detector: compute instantaneous power, find segments
    above threshold, and measure inter-burst intervals.

    Returns (burst_count, burst_intervals_ms).
    """
    power = np.abs(iq_data) ** 2

    # Adaptive threshold based on median + factor
    noise_level = np.median(power)
    threshold = noise_level * threshold_factor

    # Binary mask of above-threshold samples
    above = power > threshold

    # Find transitions (rising edges = burst starts)
    rising = np.diff(above.astype(int)) == 1
    falling = np.diff(above.astype(int)) == -1

    burst_starts = np.where(rising)[0] + 1
    burst_ends = np.where(falling)[0] + 1

    # Ensure equal length
    if len(burst_starts) == 0:
        return 0, []

    if len(burst_ends) < len(burst_starts):
        burst_starts = burst_starts[: len(burst_ends)]
    elif len(burst_ends) > len(burst_starts):
        burst_ends = burst_ends[: len(burst_starts)]

    # Filter out very short bursts (noise spikes)
    valid_bursts = []
    for start, end in zip(burst_starts, burst_ends):
        burst_len = end - start
        if burst_len >= min_burst_samples:
            valid_bursts.append((start, end))

    if len(valid_bursts) < 2:
        return len(valid_bursts), []

    # Compute inter-burst intervals
    intervals = []
    for i in range(1, len(valid_bursts)):
        prev_end = valid_bursts[i - 1][1]
        curr_start = valid_bursts[i][0]
        interval_samples = curr_start - prev_end
        interval_ms = (interval_samples / sample_rate) * 1000
        if interval_ms > 0:
            intervals.append(interval_ms)

    return len(valid_bursts), intervals


def _to_float_list(arr) -> list[float]:
    """Convert numpy array to list of Python floats."""
    return [float(x) for x in arr]
