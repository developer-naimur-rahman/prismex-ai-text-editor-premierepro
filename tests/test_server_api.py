import unittest
from fastapi.testclient import TestClient
from daemon.prismex_core.server import app

class TestServerAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_endpoint(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "HEALTHY")
        self.assertEqual(data["version"], "1.0.0")
        self.assertTrue(data["isAppleSilicon"])

    def test_providers_endpoint(self):
        res = self.client.get("/api/v1/providers")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("providers", data)
        self.assertTrue(len(data["providers"]) >= 4)

    def test_profiles_endpoint(self):
        res = self.client.get("/api/v1/profiles")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("profiles", data)
        profile_names = [p["name"] for p in data["profiles"]]
        self.assertIn("Talking Head", profile_names)

    def test_magic_rough_cut_and_review_flow(self):
        # 1. Trigger Magic Rough Cut in REVIEW_EDIT mode
        payload = {
            "premiereProjectId": "proj_test_123",
            "sequenceGuid": "seq_test_guid",
            "sequenceName": "Test_Sequence",
            "fps": 23.976,
            "sampleRate": 48000,
            "durationSeconds": 45.0,
            "executionMode": "REVIEW_EDIT",
            "profileId": "talking-head",
            "sourceClips": [
                {
                    "mediaPath": "/test/clip.mov",
                    "trackIndex": 1,
                    "inSeconds": 0.0,
                    "outSeconds": 45.0
                }
            ]
        }
        res = self.client.post("/api/v1/jobs/magic-rough-cut", json=payload)
        self.assertEqual(res.status_code, 202)
        job_data = res.json()
        self.assertIn("jobId", job_data)
        job_id = job_data["jobId"]

        # Check job status
        res_job = self.client.get(f"/api/v1/jobs/{job_id}")
        self.assertEqual(res_job.status_code, 200)

if __name__ == "__main__":
    unittest.main()
