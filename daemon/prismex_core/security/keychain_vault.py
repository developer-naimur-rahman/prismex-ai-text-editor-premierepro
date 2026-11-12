"""
KeychainVault - Secure Credential Vault via macOS Keychain
Specification: docs/06-AI-PROVIDER-ECOSYSTEM.md & docs/17-SECURITY-PRIVACY.md

API keys are never written to plain-text files or SQLite databases.
"""

import subprocess
from typing import Optional, Dict

KEYCHAIN_SERVICE = "com.prismex.editor.credentials"

class KeychainVault:
    _in_memory_fallback: Dict[str, str] = {}

    @classmethod
    def set_api_key(cls, provider_id: str, api_key: str) -> None:
        """Stores API key securely in macOS Keychain."""
        if not api_key or not api_key.strip():
            raise ValueError("API key cannot be empty.")

        clean_key = api_key.strip()

        try:
            # Use macOS native security tool to add or update generic password
            cmd = [
                "security", "add-generic-password",
                "-a", provider_id,
                "-s", KEYCHAIN_SERVICE,
                "-w", clean_key,
                "-U"  # Update if exists
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if result.returncode != 0:
                cls._in_memory_fallback[provider_id] = clean_key
        except Exception:
            cls._in_memory_fallback[provider_id] = clean_key

    @classmethod
    def get_api_key(cls, provider_id: str) -> Optional[str]:
        """Retrieves raw API key from macOS Keychain."""
        try:
            cmd = [
                "security", "find-generic-password",
                "-a", provider_id,
                "-s", KEYCHAIN_SERVICE,
                "-w"
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if result.returncode == 0:
                return result.stdout.strip()
        except Exception:
            pass

        return cls._in_memory_fallback.get(provider_id)

    @classmethod
    def delete_api_key(cls, provider_id: str) -> bool:
        """Deletes API key from macOS Keychain."""
        cls._in_memory_fallback.pop(provider_id, None)
        try:
            cmd = [
                "security", "delete-generic-password",
                "-a", provider_id,
                "-s", KEYCHAIN_SERVICE
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, check=False)
            return result.returncode == 0
        except Exception:
            return False

    @classmethod
    def mask_key(cls, key: Optional[str]) -> Optional[str]:
        """Returns masked version of the key (e.g. 'sk-••••••••abcd') for safe UI display."""
        if not key:
            return None
        if len(key) <= 8:
            return "••••" + key[-2:]
        prefix = key[:3]
        suffix = key[-4:]
        return f"{prefix}••••••••{suffix}"
