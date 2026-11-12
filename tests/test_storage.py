import unittest
import tempfile
from pathlib import Path
from daemon.prismex_core.storage.database import DatabaseManager
from daemon.prismex_core.security.keychain_vault import KeychainVault

class TestStorageSubsystem(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test_prismex.db"
        self.db = DatabaseManager(self.db_path)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_database_initialization_and_profiles(self):
        profiles = self.db.get_profiles()
        self.assertTrue(len(profiles) >= 4)
        names = [p["name"] for p in profiles]
        self.assertIn("Talking Head", names)
        self.assertIn("Podcast", names)

    def test_job_save_and_retrieve(self):
        job_data = {
            "id": "job_test_01",
            "sequence_id": "seq_test_01",
            "job_type": "MAGIC_ROUGH_CUT",
            "status": "INITIALIZING",
            "progress_percent": 15.0
        }
        self.db.save_job(job_data)
        retrieved = self.db.get_job("job_test_01")
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved["status"], "INITIALIZING")
        self.assertEqual(retrieved["progress_percent"], 15.0)

    def test_suggestions_save_and_status_update(self):
        suggestions = [
            {
                "id": "sugg_01",
                "job_id": "job_test_01",
                "sequence_id": "seq_test_01",
                "category": "SILENCE",
                "status": "PENDING",
                "start_seconds": 1.5,
                "end_seconds": 3.2,
                "duration_seconds": 1.7,
                "confidence": 0.98,
                "reason": "Dead air pause",
                "transcript_snippet": "[Silence]"
            }
        ]
        self.db.save_suggestions(suggestions)
        retrieved = self.db.get_suggestions("job_test_01")
        self.assertEqual(len(retrieved), 1)
        self.assertEqual(retrieved[0]["category"], "SILENCE")

        self.db.update_suggestion_status("sugg_01", "ACCEPTED")
        updated = self.db.get_suggestions("job_test_01")
        self.assertEqual(updated[0]["status"], "ACCEPTED")

    def test_keychain_vault_masking(self):
        masked = KeychainVault.mask_key("gsk_1234567890abcdef")
        self.assertTrue(masked.startswith("gsk"))
        self.assertTrue(masked.endswith("cdef"))
        self.assertIn("••••••••", masked)

if __name__ == "__main__":
    unittest.main()
