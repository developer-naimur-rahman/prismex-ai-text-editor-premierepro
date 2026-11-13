import unittest
from daemon.prismex_core.intelligence.creative_ai import CreativeAI

class TestScriptDirectives(unittest.TestCase):
    def test_script_directives_generation(self):
        sample_words = [
            {"word": "Why", "start_seconds": 0.0, "end_seconds": 0.5},
            {"word": "we", "start_seconds": 0.5, "end_seconds": 0.8},
            {"word": "left", "start_seconds": 0.8, "end_seconds": 1.2},
            {"word": "California", "start_seconds": 1.2, "end_seconds": 2.0},
            {"word": "moving", "start_seconds": 2.1, "end_seconds": 2.8},
            {"word": "truck", "start_seconds": 2.8, "end_seconds": 3.5},
            {"word": "was", "start_seconds": 3.5, "end_seconds": 3.8},
            {"word": "ten", "start_seconds": 3.8, "end_seconds": 4.1},
            {"word": "thousand", "start_seconds": 4.1, "end_seconds": 4.6},
            {"word": "dollars.", "start_seconds": 4.6, "end_seconds": 5.2},
            {"word": "It", "start_seconds": 5.3, "end_seconds": 5.6},
            {"word": "was", "start_seconds": 5.6, "end_seconds": 5.9},
            {"word": "an", "start_seconds": 5.9, "end_seconds": 6.1},
            {"word": "insane", "start_seconds": 6.1, "end_seconds": 6.8},
            {"word": "secret.", "start_seconds": 6.8, "end_seconds": 7.5}
        ]

        sample_sentences = [
            {"text": "Why we left California.", "start_seconds": 0.0, "end_seconds": 2.0},
            {"text": "Moving truck was ten thousand dollars.", "start_seconds": 2.1, "end_seconds": 5.2},
            {"text": "It was an insane secret.", "start_seconds": 5.3, "end_seconds": 7.5}
        ]

        res = CreativeAI.analyze_script_visual_directives(sample_words, sample_sentences, language="bn")
        self.assertIn("directives", res)
        self.assertEqual(len(res["directives"]), 3)

        # Check visual types
        v_types = [d["visualType"] for d in res["directives"]]
        self.assertTrue(any(t in ["BROLL", "PNG", "TEXT_ANIMATION", "PUNCH"] for t in v_types))

        # Check that Bengali explanations and editing suggestions are populated
        for d in res["directives"]:
            self.assertTrue(len(d["banglaExplanation"]) > 0)
            self.assertTrue(len(d["editingSuggestion"]) > 0)
            self.assertTrue("https://www.google.com" in d["googleImagesUrl"])
            self.assertTrue("https://www.pexels.com" in d["pexelsUrl"])

if __name__ == "__main__":
    unittest.main()
