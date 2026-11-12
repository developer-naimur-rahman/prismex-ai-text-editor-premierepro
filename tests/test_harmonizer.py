import unittest
from daemon.prismex_core.timeline.cut_harmonizer import CutHarmonizer

class TestCutHarmonizer(unittest.TestCase):
    def test_interval_merging_and_reverse_sorting(self):
        # 3 suggestions: two overlapping (1.0-3.0 and 2.5-4.5) and one later (10.0-12.0)
        suggestions = [
            {"start_seconds": 1.0, "end_seconds": 3.0, "status": "ACCEPTED"},
            {"start_seconds": 2.5, "end_seconds": 4.5, "status": "ACCEPTED"},
            {"start_seconds": 10.0, "end_seconds": 12.0, "status": "ACCEPTED"}
        ]

        cuts = CutHarmonizer.harmonize_cuts(suggestions, fps=24.0)
        self.assertEqual(len(cuts), 2)

        # Cuts must be sorted in REVERSE chronological order (right-to-left)
        # Cut 0: 10.0 to 12.0
        # Cut 1: 1.0 to 4.5
        self.assertAlmostEqual(cuts[0]["start_seconds"], 10.0, delta=0.05)
        self.assertAlmostEqual(cuts[0]["end_seconds"], 12.0, delta=0.05)

        self.assertAlmostEqual(cuts[1]["start_seconds"], 1.0, delta=0.05)
        self.assertAlmostEqual(cuts[1]["end_seconds"], 4.5, delta=0.05)

        # Verify TickTime generation
        self.assertTrue(int(cuts[0]["start_tick"]) > int(cuts[1]["start_tick"]))
        self.assertEqual(cuts[1]["start_tick"], "254016000000") # Exactly 1 second

    def test_bridge_small_gaps(self):
        # Two cuts separated by only 50ms (< 120ms gap threshold)
        suggestions = [
            {"start_seconds": 1.0, "end_seconds": 2.0, "status": "ACCEPTED"},
            {"start_seconds": 2.05, "end_seconds": 3.5, "status": "ACCEPTED"}
        ]

        cuts = CutHarmonizer.harmonize_cuts(suggestions, fps=24.0)
        # Should bridge into one continuous cut: 1.0 to 3.5
        self.assertEqual(len(cuts), 1)
        self.assertAlmostEqual(cuts[0]["start_seconds"], 1.0, delta=0.05)
        self.assertAlmostEqual(cuts[0]["end_seconds"], 3.5, delta=0.05)

if __name__ == "__main__":
    unittest.main()
