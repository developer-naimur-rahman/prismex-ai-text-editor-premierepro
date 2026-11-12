"""
AIRouter - Task-Based Router & Free-Only Protection Guard
Specification: docs/06-AI-PROVIDER-ECOSYSTEM.md & docs/07-AI-ROUTER.md

Invariants:
1. Strict Free-Only Mode defaults to ACTIVE.
2. Paid endpoints and unverified billing configurations are hard-blocked.
3. Automated circuit-breaker fallback to Local Apple Silicon engines.
"""

import time
from typing import List, Dict, Any, Optional
from .provider_registry import REGISTERED_PROVIDERS, TaskCapability
from ..security.keychain_vault import KeychainVault

class FreeOnlyViolationError(Exception):
    """Raised when an operation attempts to call a paid endpoint under Free-Only mode."""
    pass

class CircuitBreaker:
    def __init__(self, cooldown_seconds: float = 60.0):
        self.cooldown_seconds = cooldown_seconds
        self.consecutive_errors: int = 0
        self.tripped_at: Optional[float] = None

    def record_success(self) -> None:
        self.consecutive_errors = 0
        self.tripped_at = None

    def record_error(self) -> None:
        self.consecutive_errors += 1
        if self.consecutive_errors >= 3:
            self.tripped_at = time.time()

    def is_available(self) -> bool:
        if self.tripped_at is None:
            return True
        # Check if cooldown timer expired
        if (time.time() - self.tripped_at) > self.cooldown_seconds:
            # Half-open probe
            return True
        return False

class AIRouter:
    _circuit_breakers: Dict[str, CircuitBreaker] = {}
    free_only_mode: bool = True
    local_only_mode: bool = False
    monthly_budget_usd: float = 0.0
    tracked_spend_usd: float = 0.0

    @classmethod
    def get_circuit_breaker(cls, provider_id: str) -> CircuitBreaker:
        if provider_id not in cls._circuit_breakers:
            cls._circuit_breakers[provider_id] = CircuitBreaker()
        return cls._circuit_breakers[provider_id]

    @classmethod
    def select_engine(cls, capability: TaskCapability) -> Dict[str, Any]:
        """
        Selects the optimal provider engine matching the capability,
        respecting Free-Only Guard and Circuit Breaker states.
        """
        # Filter by capability
        eligible = [
            p for p in REGISTERED_PROVIDERS 
            if capability in p["capabilities"]
        ]

        if not eligible:
            raise ValueError(f"No registered providers support capability {capability.value}")

        # Local-Only Mode filter
        if cls.local_only_mode:
            eligible = [p for p in eligible if p["is_local"]]

        # Free-Only Guard filter
        if cls.free_only_mode:
            non_free = [p for p in eligible if not p.get("is_free_tier", False)]
            if non_free and not any(p.get("is_free_tier", False) for p in eligible):
                raise FreeOnlyViolationError(
                    f"Requested task '{capability.value}' requires a paid endpoint, "
                    "which is blocked by the Free-Only Guard."
                )
            eligible = [p for p in eligible if p.get("is_free_tier", False)]

        # Filter out circuit-broken providers
        available = [
            p for p in eligible 
            if cls.get_circuit_breaker(p["provider_id"]).is_available()
        ]

        if not available:
            # Fallback to local engine regardless of priority if cloud is tripped
            local_fallback = [p for p in eligible if p["is_local"]]
            if local_fallback:
                return local_fallback[0]
            raise RuntimeError(f"All eligible providers for {capability.value} are circuit-broken.")

        # For cloud providers, check if user has configured an API key in Keychain
        final_candidates = []
        for p in available:
            if p["is_local"]:
                final_candidates.append(p)
            else:
                has_key = KeychainVault.get_api_key(p["provider_id"]) is not None
                if has_key:
                    final_candidates.append(p)

        if not final_candidates:
            # Fallback to local engines
            local_fallback = [p for p in eligible if p["is_local"]]
            if local_fallback:
                return local_fallback[0]
            raise RuntimeError("No configured providers or local fallback available.")

        # Sort by priority (lowest integer = highest priority)
        final_candidates.sort(key=lambda x: x["priority"])
        return final_candidates[0]

    @classmethod
    def record_task_outcome(
        cls, 
        provider_id: str, 
        success: bool, 
        status_code: int = 200
    ) -> None:
        """Updates circuit breaker and error counts."""
        cb = cls.get_circuit_breaker(provider_id)
        if success:
            cb.record_success()
        else:
            cb.record_error()
