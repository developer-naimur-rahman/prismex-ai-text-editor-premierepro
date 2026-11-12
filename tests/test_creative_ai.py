import unittest
from daemon.prismex_core.intelligence.creative_ai import CreativeAI


class TestCreativeAI(unittest.TestCase):
    def setUp(self):
        self.words = [
            {"word": "Hey", "start_seconds": 0.0, "end_seconds": 0.3},
            {"word": "guys,", "start_seconds": 0.31, "end_seconds": 0.7},
            {"word": "look", "start_seconds": 0.75, "end_seconds": 1.0},      # B-Roll trigger
            {"word": "at", "start_seconds": 1.01, "end_seconds": 1.15},
            {"word": "this", "start_seconds": 1.16, "end_seconds": 1.35},
            {"word": "insane", "start_seconds": 1.36, "end_seconds": 1.8},     # Emphasis trigger
            {"word": "app.", "start_seconds": 1.82, "end_seconds": 2.2},      # Icon trigger
            {"word": "Click", "start_seconds": 2.5, "end_seconds": 2.8},      # Icon trigger
            {"word": "the", "start_seconds": 2.81, "end_seconds": 2.95},
            {"word": "download", "start_seconds": 2.96, "end_seconds": 3.4},   # Icon trigger
            {"word": "button.", "start_seconds": 3.42, "end_seconds": 3.9},   # Icon trigger
        ]
        self.sentences = [
            {"text": "Hey guys, look at this insane app.", "start_seconds": 0.0, "end_seconds": 2.2},
            {"text": "Click the download button.", "start_seconds": 2.5, "end_seconds": 3.9},
        ]

    def test_marker_classification(self):
        res = CreativeAI.analyze_markers(self.words)
        markers = res["markers"]
        self.assertTrue(len(markers) > 0)
        colors = {m["color"] for m in markers}
        # Verify emphasis, b-roll and icon categories
        self.assertTrue(any(m["type"] == "EMPHASIS" and m["color"] == "RED" for m in markers))
        self.assertTrue(any(m["type"] == "BROLL" and m["color"] == "GREEN" for m in markers))
        self.assertTrue(any(m["type"] == "ICON" and m["color"] == "BLUE" for m in markers))

    def test_viral_shorts_chunking(self):
        shorts = CreativeAI.detect_viral_shorts(self.words, self.sentences, target_count=3, fps=25.0)
        self.assertTrue(len(shorts) > 0)
        first_short = shorts[0]
        self.assertIn("startSeconds", first_short)
        self.assertIn("endSeconds", first_short)
        self.assertEqual(first_short["aspectRatio"], "9:16 (1080x1920)")

    def test_after_effects_typography(self):
        res = CreativeAI.format_after_effects_typography("Look at this insane application")
        self.assertIn("formattedText", res)
        self.assertIn("aeSnippet", res)
        self.assertIn("app.beginUndoGroup", res["aeSnippet"])
        self.assertTrue(len(res["lines"]) >= 2)

    def test_offline_spell_check(self):
        test_words = [{"word": "i"}, {"word": "dont"}, {"word": "cant"}]
        res = CreativeAI.spell_check(test_words)
        self.assertEqual(res["words"][0]["word"], "I")
        self.assertEqual(res["words"][1]["word"], "don't")
        self.assertEqual(res["words"][2]["word"], "can't")


if __name__ == "__main__":
    unittest.main()
