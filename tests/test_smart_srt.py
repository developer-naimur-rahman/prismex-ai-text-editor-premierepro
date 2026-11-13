import unittest
from daemon.prismex_core.intelligence.smart_srt import SmartSRTSegmenter, format_srt_timestamp


class TestSmartSRTSegmenter(unittest.TestCase):
    def setUp(self):
        # Sample transcript: "This is a great day. We are building the next generation AI tool."
        self.words = [
            {"word": "This", "start_seconds": 0.0, "end_seconds": 0.25},
            {"word": "is", "start_seconds": 0.26, "end_seconds": 0.40},
            {"word": "a", "start_seconds": 0.41, "end_seconds": 0.50},
            {"word": "great", "start_seconds": 0.52, "end_seconds": 0.85},
            {"word": "day.", "start_seconds": 0.86, "end_seconds": 1.20},
            {"word": "We", "start_seconds": 1.70, "end_seconds": 1.90},  # 0.5s pause before "We"
            {"word": "are", "start_seconds": 1.91, "end_seconds": 2.10},
            {"word": "building", "start_seconds": 2.12, "end_seconds": 2.50},
            {"word": "the", "start_seconds": 2.52, "end_seconds": 2.65},
            {"word": "next", "start_seconds": 2.67, "end_seconds": 2.95},
            {"word": "generation", "start_seconds": 2.98, "end_seconds": 3.45},
            {"word": "AI", "start_seconds": 3.48, "end_seconds": 3.70},
            {"word": "tool.", "start_seconds": 3.72, "end_seconds": 4.10},
        ]

    def test_flexible_word_and_char_limits(self):
        # Target ~3 words, flexible between 2 and 5 words, max 28 chars
        res = SmartSRTSegmenter.segment(
            words=self.words,
            fps=24.0,
            target_words=3,
            min_words=2,
            max_words=5,
            target_chars=20,
            max_chars=28,
            flexible=True,
            use_ai=False,  # Test deterministic local semantic engine
        )

        cues = res["cues"]
        self.assertTrue(len(cues) >= 3)

        # Verify no hanging words like "a" or "the" at cue end if possible
        for cue in cues:
            words_in_cue = cue["text"].split()
            last_word = words_in_cue[-1].lower().rstrip(".,?!")
            self.assertNotIn(last_word, {"a", "the", "to", "of"})

            # Verify character limit guardrail
            self.assertLessEqual(cue["charCount"], 32)  # allows small flex if sentence finishes

    def test_zero_frame_drift_and_no_overlap(self):
        res = SmartSRTSegmenter.segment(
            words=self.words,
            fps=25.0,
            target_words=3,
            flexible=True,
            use_ai=False,
        )
        cues = res["cues"]

        for i in range(len(cues)):
            cue = cues[i]
            # Frame numbers must be non-negative integers and startFrame < endFrame
            self.assertGreater(cue["endFrame"], cue["startFrame"])
            self.assertGreaterEqual(cue["startFrame"], 0)

            # Strict non-overlapping invariant: cue[i].endFrame <= cue[i+1].startFrame
            if i + 1 < len(cues):
                next_cue = cues[i + 1]
                self.assertLessEqual(
                    cue["endFrame"],
                    next_cue["startFrame"],
                    f"Frame overlap detected between cue {cue['index']} and {next_cue['index']}",
                )

    def test_srt_output_format(self):
        res = SmartSRTSegmenter.segment(
            words=self.words,
            fps=29.97,
            target_words=3,
            flexible=True,
            use_ai=False,
        )
        srt = res["srt"]
        self.assertIn("1\n", srt)
        self.assertIn(" --> ", srt)
        self.assertIn("day.", srt)
        self.assertIn("tool.", srt)

    def test_timestamp_formatting(self):
        self.assertEqual(format_srt_timestamp(0.0), "00:00:00,000")
        self.assertEqual(format_srt_timestamp(65.123), "00:01:05,123")
        self.assertEqual(format_srt_timestamp(3661.050), "01:01:01,050")

    def test_user_exact_clause_boundaries(self):
        # User case 1: "Why we left California and moved back to Washington state"
        # Should keep "Why we left California" intact as a complete clause (not "Why we left" | "California and moved")
        # and coordinated clause starts with "and moved..."
        words_case1 = [
            {"word": "Why", "start_seconds": 0.0, "end_seconds": 0.20},
            {"word": "we", "start_seconds": 0.22, "end_seconds": 0.35},
            {"word": "left", "start_seconds": 0.38, "end_seconds": 0.65},
            {"word": "California", "start_seconds": 0.68, "end_seconds": 1.15},
            {"word": "and", "start_seconds": 1.25, "end_seconds": 1.40},
            {"word": "moved", "start_seconds": 1.42, "end_seconds": 1.75},
            {"word": "back", "start_seconds": 1.78, "end_seconds": 1.95},
            {"word": "to", "start_seconds": 1.98, "end_seconds": 2.10},
            {"word": "Washington", "start_seconds": 2.12, "end_seconds": 2.50},
            {"word": "state.", "start_seconds": 2.52, "end_seconds": 2.90},
        ]

        res1 = SmartSRTSegmenter.segment(
            words=words_case1,
            fps=30.0,
            target_words=3,
            min_words=2,
            max_words=5,
            target_chars=22,
            max_chars=40,
            flexible=True,
            use_ai=False,
        )
        texts1 = [c["text"] for c in res1["cues"]]
        # Verify first cue is "Why we left California"
        self.assertEqual(texts1[0], "Why we left California")
        # Verify second cue starts with "and"
        self.assertTrue(texts1[1].startswith("and moved"))
        # Verify "Washington" and "state." are NEVER separated
        self.assertTrue("Washington state." in texts1[1] or (len(texts1) > 2 and "Washington state." in texts1[2]))

        # User case 2: "Whenever you tell someone you love California"
        words_case2 = [
            {"word": "Whenever", "start_seconds": 0.0, "end_seconds": 0.35},
            {"word": "you", "start_seconds": 0.38, "end_seconds": 0.50},
            {"word": "tell", "start_seconds": 0.52, "end_seconds": 0.75},
            {"word": "someone", "start_seconds": 0.78, "end_seconds": 1.10},
            {"word": "you", "start_seconds": 1.25, "end_seconds": 1.40},  # small 0.15s pause
            {"word": "love", "start_seconds": 1.42, "end_seconds": 1.65},
            {"word": "California.", "start_seconds": 1.68, "end_seconds": 2.15},
        ]
        res2 = SmartSRTSegmenter.segment(
            words=words_case2,
            fps=30.0,
            target_words=3,
            min_words=2,
            max_words=4,
            target_chars=22,
            max_chars=35,
            flexible=True,
            use_ai=False,
        )
        texts2 = [c["text"] for c in res2["cues"]]
        self.assertEqual(texts2[0], "Whenever you tell someone")
        self.assertEqual(texts2[1], "you love California.")


if __name__ == "__main__":
    unittest.main()
