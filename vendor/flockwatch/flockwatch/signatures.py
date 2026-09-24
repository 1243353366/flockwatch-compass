"""
Signature database loader and query engine.

Loads detection rules from YAML files and provides matching functions
for OUI prefixes, Wi-Fi SSID patterns, BLE service UUIDs, and RF templates.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml

SIGNATURES_DIR = Path(__file__).parent.parent / "data" / "signatures"


@dataclass
class SignatureDatabase:
    """Loaded signature rules for Flock device detection."""

    oui_prefixes: list[str] = field(default_factory=list)
    wifi_ssid_patterns: list[re.Pattern] = field(default_factory=list)
    wifi_ssid_raw: list[str] = field(default_factory=list)
    ble_service_uuids: list[str] = field(default_factory=list)
    ble_name_patterns: list[re.Pattern] = field(default_factory=list)
    ble_name_raw: list[str] = field(default_factory=list)
    ble_manufacturer_ids: list[int] = field(default_factory=list)
    rf_templates: list[dict] = field(default_factory=list)

    @classmethod
    def load(cls, signatures_dir: Optional[Path] = None) -> "SignatureDatabase":
        """Load all signature files from the signatures directory."""
        sig_dir = signatures_dir or SIGNATURES_DIR
        db = cls()

        # OUI prefixes
        oui_path = sig_dir / "oui_prefixes.yaml"
        if oui_path.exists():
            data = _load_yaml(oui_path)
            db.oui_prefixes = [p.upper().replace(":", "") for p in data.get("oui_prefixes", [])]

        # Wi-Fi rules
        wifi_path = sig_dir / "wifi_rules.yaml"
        if wifi_path.exists():
            data = _load_yaml(wifi_path)
            db.wifi_ssid_raw = data.get("ssid_patterns", [])
            db.wifi_ssid_patterns = [re.compile(p, re.IGNORECASE) for p in db.wifi_ssid_raw]

        # BLE rules
        ble_path = sig_dir / "ble_rules.yaml"
        if ble_path.exists():
            data = _load_yaml(ble_path)
            db.ble_service_uuids = [u.lower() for u in data.get("service_uuids", [])]
            db.ble_name_raw = data.get("name_patterns", [])
            db.ble_name_patterns = [re.compile(p, re.IGNORECASE) for p in db.ble_name_raw]
            db.ble_manufacturer_ids = data.get("manufacturer_ids", [])

        # RF fingerprint templates
        rf_path = sig_dir / "rf_fingerprints.yaml"
        if rf_path.exists():
            data = _load_yaml(rf_path)
            db.rf_templates = data.get("templates", [])

        return db

    def match_oui(self, oui: Optional[str]) -> bool:
        """Check if an OUI prefix matches known Flock vendors."""
        if not oui:
            return False
        normalized = oui.upper().replace(":", "").replace("-", "")
        return normalized in self.oui_prefixes

    def match_ssid(self, ssid: Optional[str]) -> bool:
        """Check if an SSID matches known Flock patterns."""
        if not ssid:
            return False
        return any(p.search(ssid) for p in self.wifi_ssid_patterns)

    def match_ble_name(self, name: Optional[str]) -> bool:
        """Check if a BLE device name matches known Flock patterns."""
        if not name:
            return False
        return any(p.search(name) for p in self.ble_name_patterns)

    def match_ble_uuid(self, uuids: list[str]) -> bool:
        """Check if any BLE service UUID matches known Flock UUIDs."""
        if not uuids:
            return False
        lower_uuids = [u.lower() for u in uuids]
        return any(u in lower_uuids for u in self.ble_service_uuids)

    def match_ble_manufacturer(self, mfr_id: Optional[int]) -> bool:
        """Check if a BLE manufacturer ID matches known Flock manufacturers."""
        if mfr_id is None:
            return False
        return mfr_id in self.ble_manufacturer_ids


def _load_yaml(path: Path) -> dict:
    """Load a YAML file safely."""
    with open(path) as f:
        return yaml.safe_load(f) or {}
