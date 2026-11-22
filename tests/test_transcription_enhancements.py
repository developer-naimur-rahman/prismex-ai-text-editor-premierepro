"""
TestTranscriptionEnhancements - Verify Multi-Track Audio Priority and Anti-Hallucination
"""

import unittest
from pathlib import Path
from daemon.prismex_core.stt.transcription_service import TranscriptionService
from daemon.prismex_core.audio.extractor import AudioExtractor

class TestTranscriptionEnhancements(unittest.TestCase):
    def test_whisper_repetition_loop_filter(self):
        """Verifies that repetitive hallucination loops (e.g. 4x repeated phrases) are pruned."""
        hallucinated_segments = [
            {"start": 0.0, "end": 4.0, "text": "Welcome to today's episode."},
            {"start": 4.0, "end": 8.0, "text": "And subscribe to stay up to date with perfect strategies."},
            {"start": 8.0, "end": 12.0, "text": "And subscribe to stay up to date with perfect strategies."},
            {"start": 12.0, "end": 16.0, "text": "And subscribe to stay up to date with perfect strategies."},
            {"start": 16.0, "end": 20.0, "text": "And subscribe to stay up to date with perfect strategies."},
            {"start": 20.0, "end": 25.0, "text": "Here is the next tip."}
        ]

        raw_result = {
            "segments": hallucinated_segments,
            "language": "en"
        }

        formatted = TranscriptionService._format_whisper_result(raw_result, 30.0, "test-model")
        sentences = formatted["sentences"]
        sentence_texts = [s["sentence"] for s in sentences]

        # The initial real sentence should remain
        self.assertIn("Welcome to today's episode.", sentence_texts)
        # The subsequent real sentence should remain
        self.assertIn("Here is the next tip.", sentence_texts)

        # The repeated hallucination should only appear once (duplicates pruned)
        rep_count = sum(1 for t in sentence_texts if "subscribe to stay up to date" in t)
        self.assertEqual(rep_count, 1)

    def test_audio_extractor_generates_valid_wav_structure(self):
        """Verifies that sequence timeline audio creates a valid non-empty 16kHz mono WAV."""
        test_wav = Path("/tmp/test_enhancement_audio.wav")
        try:
            res_path = AudioExtractor.extract_sequence_timeline_audio(
                source_clips=[
                    {"mediaPath": "", "trackIndex": 1, "inSeconds": 0.0, "outSeconds": 2.0},
                    {"mediaPath": "", "trackIndex": 2, "inSeconds": 0.0, "outSeconds": 2.0}
                ],
                total_duration_seconds=2.0,
                target_wav_path=test_wav
            )
            self.assertTrue(res_path.exists())
            self.assertGreater(res_path.stat().st_size, 1000)
        finally:
            AudioExtractor.cleanup_temp_file(test_wav)

if __name__ == "__main__":
    unittest.main()
