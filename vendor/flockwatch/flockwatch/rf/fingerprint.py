"""
RF fingerprint template matching.

Compares extracted RF features against known device templates
using cosine similarity.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import numpy as np
import yaml

from ..schema import RfFingerprint
from ..signatures import SignatureDatabase, SIGNATURES_DIR


def match_fingerprint(
    fingerprint: RfFingerprint,
    signatures: Optional[SignatureDatabase] = None,
) -> tuple[Optional[str], float]:
    """
    Match an RF fingerprint against known templates.

    Uses cosine similarity on PSD feature vectors.

    Args:
        fingerprint: The extracted RF fingerprint
        signatures: Loaded signature database with templates

    Returns:
        (matched_template_name, similarity_score) or (None, 0.0)
    """
    if not fingerprint.psd_features:
        return None, 0.0

    sig_db = signatures or SignatureDatabase.load()

    if not sig_db.rf_templates:
        return None, 0.0

    fp_vec = np.array(fingerprint.psd_features, dtype=np.float64)
    best_match = None
    best_score = 0.0

    for template in sig_db.rf_templates:
        template_psd = template.get("psd_features", [])
        if not template_psd:
            continue

        # Align lengths (pad or truncate)
        t_vec = np.array(template_psd, dtype=np.float64)
        if len(t_vec) != len(fp_vec):
            min_len = min(len(t_vec), len(fp_vec))
            t_vec = t_vec[:min_len]
            fp_vec_aligned = fp_vec[:min_len]
        else:
            fp_vec_aligned = fp_vec

        # Cosine similarity
        dot = np.dot(fp_vec_aligned, t_vec)
        norm_fp = np.linalg.norm(fp_vec_aligned)
        norm_t = np.linalg.norm(t_vec)

        if norm_fp > 0 and norm_t > 0:
            similarity = dot / (norm_fp * norm_t)
            similarity = max(0.0, float(similarity))  # Clamp to [0, 1]

            if similarity > best_score:
                best_score = similarity
                best_match = template.get("name", "unknown")

    return best_match, best_score


def apply_template_match(fingerprint: RfFingerprint, signatures: Optional[SignatureDatabase] = None) -> RfFingerprint:
    """
    Match fingerprint against templates and update the fingerprint with results.

    Args:
        fingerprint: The RF fingerprint to match (modified in place)
        signatures: Loaded signature database

    Returns:
        The updated fingerprint with template_similarity and matched_template set.
    """
    name, score = match_fingerprint(fingerprint, signatures)
    fingerprint.matched_template = name
    fingerprint.template_similarity = score
    return fingerprint
