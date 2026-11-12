import unittest
from daemon.prismex_core.intelligence.take_detector import TakeDetector
from daemon.prismex_core.intelligence.filler_detector import FillerDetector

class TestIntelligenceLayer(unittest.TestCase):
    def test_levenshtein_similarity(self):
        s1 = "The primary benefit of our architecture is scalability."
        s2 = "The primary benefit of our architecture is that it scales."
        sim = TakeDetector.calculate_levenshtein_similarity(s1, s2)
        self.assertTrue(sim > 0.70)

        sim_diff = TakeDetector.calculate_levenshtein_similarity("Hello world", "Completely different topic")
        self.assertTrue(sim_diff < 0.30)

    def test_take_clustering_and_best_take_selection(self):
        sentences = [
            {
                "sentence": "The primary benefit is... wait, sorry, let me restart.",
                "start_seconds": 10.0,
                "end_seconds": 14.5,
                "words": [{"word": "sorry", "is_stutter": True, "start_seconds": 12.0, "end_seconds": 12.5}]
            },
            {
                "sentence": "The primary benefit of our architecture is effortless scalability.",
                "start_seconds": 16.0,
                "end_seconds": 21.0,
                "words": [{"word": "scalability", "is_stutter": False, "start_seconds": 19.5, "end_seconds": 21.0}]
            }
        ]

        # In BEST_TAKE mode, candidate 1 should be pruned, candidate 2 retained
        suggestions = TakeDetector.detect_take_clusters(sentences, take_mode="BEST_TAKE")
        self.assertEqual(len(suggestions), 1)
        s = suggestions[0]
        self.assertEqual(s["category"], "REPEATED_TAKE")
        self.assertEqual(s["start_seconds"], 10.0)
        self.assertEqual(s["end_seconds"], 14.5)
        self.assertEqual(s["take_details"]["candidate_index"], 1)

    def test_vocalic_filler_and_repetition_detection(self):
        words = [
            {"word": "So", "start_seconds": 1.0, "end_seconds": 1.3},
            {"word": "um,", "start_seconds": 1.4, "end_seconds": 1.8},
            {"word": "we", "start_seconds": 2.0, "end_seconds": 2.2},
            {"word": "we", "start_seconds": 2.3, "end_seconds": 2.5},
            {"word": "deployed", "start_seconds": 2.6, "end_seconds": 3.0}
        ]

        suggestions = FillerDetector.detect_disfluencies(words)
        self.assertEqual(len(suggestions), 2)
        categories = [s["category"] for s in suggestions]
        self.assertIn("FILLER_WORD", categories)

    def test_semantic_safety_of_like(self):
        # "I like this" -> "like" must NOT be flagged as filler
        words_verb = [
            {"word": "I", "start_seconds": 0.5, "end_seconds": 0.7},
            {"word": "like", "start_seconds": 0.8, "end_seconds": 1.0},
            {"word": "clean", "start_seconds": 1.1, "end_seconds": 1.4},
            {"word": "code", "start_seconds": 1.5, "end_seconds": 1.8}
        ]
        sugg_verb = FillerDetector.detect_disfluencies(words_verb)
        self.assertEqual(len(sugg_verb), 0) # Must NOT delete verb

if __name__ == "__main__":
    unittest.main()
