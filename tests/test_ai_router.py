import unittest
from daemon.prismex_core.router.ai_router import AIRouter, FreeOnlyViolationError
from daemon.prismex_core.router.provider_registry import TaskCapability
from daemon.prismex_core.security.keychain_vault import KeychainVault

class TestAIRouter(unittest.TestCase):
    def setUp(self):
        AIRouter.free_only_mode = True
        AIRouter.local_only_mode = False
        # Reset circuit breakers
        AIRouter._circuit_breakers.clear()

    def test_select_local_fallback_when_no_cloud_keys(self):
        # When no cloud keys are in keychain, selecting STT should return local-mlx
        engine = AIRouter.select_engine(TaskCapability.SPEECH_TO_TEXT)
        self.assertEqual(engine["provider_id"], "local-mlx")
        self.assertTrue(engine["is_local"])

    def test_select_groq_when_key_configured(self):
        # Configure Groq key in keychain vault
        KeychainVault.set_api_key("groq-cloud", "gsk_test_key_12345678")
        try:
            engine = AIRouter.select_engine(TaskCapability.SPEECH_TO_TEXT)
            # Priority 1 is groq-cloud, priority 2 is local-mlx
            self.assertEqual(engine["provider_id"], "groq-cloud")
        finally:
            KeychainVault.delete_api_key("groq-cloud")

    def test_local_only_mode_blocks_cloud(self):
        KeychainVault.set_api_key("groq-cloud", "gsk_test_key_12345678")
        try:
            AIRouter.local_only_mode = True
            engine = AIRouter.select_engine(TaskCapability.SPEECH_TO_TEXT)
            self.assertEqual(engine["provider_id"], "local-mlx")
        finally:
            KeychainVault.delete_api_key("groq-cloud")
            AIRouter.local_only_mode = False

    def test_circuit_breaker_cascade_to_local(self):
        KeychainVault.set_api_key("groq-cloud", "gsk_test_key_12345678")
        try:
            # Simulate 3 consecutive failures on groq
            AIRouter.record_task_outcome("groq-cloud", success=False, status_code=429)
            AIRouter.record_task_outcome("groq-cloud", success=False, status_code=429)
            AIRouter.record_task_outcome("groq-cloud", success=False, status_code=429)

            # Circuit breaker should now trip and cascade to local-mlx
            engine = AIRouter.select_engine(TaskCapability.SPEECH_TO_TEXT)
            self.assertEqual(engine["provider_id"], "local-mlx")
        finally:
            KeychainVault.delete_api_key("groq-cloud")

if __name__ == "__main__":
    unittest.main()
