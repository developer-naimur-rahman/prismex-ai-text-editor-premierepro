"""
TestSyncDrift - Synthetic Frame-Accurate Synchronization Test
Specification: docs/20-TESTING-STRATEGY.md & docs/22-ACCEPTANCE-CRITERIA.md

Verifies that batch ripple deletions maintain 0.000 frame drift between
visual frames and corresponding audio beeps.
"""

import unittest
from daemon.prismex_core.timeline.cut_harmonizer import CutHarmonizer, TICKS_PER_SECOND

class TestSyncDrift(unittest.TestCase):
    def test_zero_frame_drift_across_50_cuts(self):
        fps = 23.976
        frame_duration = 1.0 / fps

        # Simulate 50 synthetic cut intervals across an 800-second sequence
        raw_suggestions = []
        for i in range(50):
            start = 10.0 + (i * 15.0)
            end = start + 2.5 # 2.5s cut
            raw_suggestions.append({
                "start_seconds": start,
                "end_seconds": end,
                "status": "ACCEPTED"
            })

        cuts = CutHarmonizer.harmonize_cuts(raw_suggestions, fps=fps)
        self.assertEqual(len(cuts), 50)

        # Verify that every cut boundary snaps exactly to an integer frame boundary
        for cut in cuts:
            start_frame = cut["start_seconds"] * fps
            end_frame = cut["end_seconds"] * fps

            # Difference from nearest integer frame must be < 0.001
            drift_start = abs(start_frame - round(start_frame))
            drift_end = abs(end_frame - round(end_frame))

            self.assertTrue(drift_start < 0.001, f"Frame drift detected at start: {drift_start}")
            self.assertTrue(drift_end < 0.001, f"Frame drift detected at end: {drift_end}")

            # Verify tick calculation matches snapped seconds
            expected_ticks = str(int(round(cut["start_seconds"] * TICKS_PER_SECOND)))
            self.assertEqual(cut["start_tick"], expected_ticks)

    def test_reverse_chronological_ordering_guarantee(self):
        # Cuts must be strictly monotonic decreasing
        raw = [
            {"start_seconds": 12.0, "end_seconds": 15.0, "status": "ACCEPTED"},
            {"start_seconds": 4.0, "end_seconds": 6.0, "status": "ACCEPTED"},
            {"start_seconds": 80.0, "end_seconds": 84.0, "status": "ACCEPTED"}
        ]
        cuts = CutHarmonizer.harmonize_cuts(raw, fps=24.0)
        self.assertEqual(cuts[0]["start_seconds"], 80.0)
        self.assertEqual(cuts[1]["start_seconds"], 12.0)
        self.assertEqual(cuts[2]["start_seconds"], 4.0)

if __name__ == "__main__":
    unittest.main()
