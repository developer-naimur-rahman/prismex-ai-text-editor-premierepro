"""
TestMagicRoughCutE2E - End-to-End Pipeline Verification
Specification: docs/13-MAGIC-ROUGH-CUT.md & docs/22-ACCEPTANCE-CRITERIA.md
"""

import unittest
from fastapi.testclient import TestClient
from daemon.prismex_core.server import app, db

class TestMagicRoughCutE2E(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_full_pipeline_auto_edit_execution(self):
        payload = {
            "premiereProjectId": "proj_e2e_test",
            "sequenceGuid": "seq_e2e_12345",
            "sequenceName": "Episode_50_Rough",
            "fps": 24.0,
            "sampleRate": 48000,
            "durationSeconds": 60.0,
            "executionMode": "AUTO_EDIT",
            "profileId": "talking-head",
            "sourceClips": [
                {
                    "mediaPath": "/Volumes/Media/Ep50/CamA.MOV",
                    "trackIndex": 1,
                    "inSeconds": 0.0,
                    "outSeconds": 60.0
                }
            ]
        }

        # Step 1: Start job
        res = self.client.post("/api/v1/jobs/magic-rough-cut", json=payload)
        self.assertEqual(res.status_code, 202)
        job_id = res.json()["jobId"]

        # Step 2: Poll job status until complete
        job = db.get_job(job_id)
        self.assertIsNotNone(job)
        self.assertEqual(job["sequence_id"], "seq_e2e_12345")

        # Step 3: Verify suggestions were generated in database
        suggestions = db.get_suggestions(job_id)
        self.assertTrue(len(suggestions) > 0)
        
        # In AUTO_EDIT mode, suggestions are auto-accepted
        accepted_suggestions = [s for s in suggestions if s["status"] == "ACCEPTED"]
        self.assertTrue(len(accepted_suggestions) > 0)

    def test_review_edit_and_apply_flow(self):
        payload = {
            "premiereProjectId": "proj_e2e_review",
            "sequenceGuid": "seq_e2e_review_99",
            "sequenceName": "Episode_51_Interview",
            "fps": 23.976,
            "sampleRate": 48000,
            "durationSeconds": 90.0,
            "executionMode": "REVIEW_EDIT",
            "profileId": "podcast",
            "sourceClips": [
                {
                    "mediaPath": "/Volumes/Media/Ep51/CamA.MOV",
                    "trackIndex": 1,
                    "inSeconds": 0.0,
                    "outSeconds": 90.0
                }
            ]
        }

        # Step 1: Trigger review edit job
        res = self.client.post("/api/v1/jobs/magic-rough-cut", json=payload)
        self.assertEqual(res.status_code, 202)
        job_id = res.json()["jobId"]

        # Step 2: Fetch review queue
        res_queue = self.client.get(f"/api/v1/review-queue/{job_id}")
        self.assertEqual(res_queue.status_code, 200)
        queue_data = res_queue.json()
        suggestions = queue_data["suggestions"]
        self.assertTrue(len(suggestions) > 0)

        # Step 3: Approve a subset of suggestions
        approved_ids = [s["id"] for s in suggestions[:2]]
        res_apply = self.client.post(
            f"/api/v1/review-queue/{job_id}/apply",
            json={"approvedSuggestionIds": approved_ids}
        )
        self.assertEqual(res_apply.status_code, 200)
        cut_plan = res_apply.json()
        self.assertEqual(cut_plan["jobId"], job_id)
        self.assertTrue(cut_plan["totalCuts"] > 0)
        self.assertTrue(cut_plan["totalTimeSavedSeconds"] > 0)

if __name__ == "__main__":
    unittest.main()
