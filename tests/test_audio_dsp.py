import unittest
import tempfile
import wave
import struct
import math
from pathlib import Path
from daemon.prismex_core.audio.extractor import AudioExtractor
from daemon.prismex_core.audio.dsp import AudioDSP

class TestAudioDSP(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_path = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_audio_extractor_dummy_wav(self):
        wav_path = self.temp_path / "test_dummy.wav"
        AudioExtractor._create_dummy_wav(wav_path, 2.5)
        self.assertTrue(wav_path.exists())
        
        with wave.open(str(wav_path), 'rb') as wf:
            self.assertEqual(wf.getnchannels(), 1)
            self.assertEqual(wf.getframerate(), 16000)
            self.assertEqual(wf.getsampwidth(), 2)
            self.assertEqual(wf.getnframes(), int(2.5 * 16000))

    def test_silence_detection_on_synthetic_signal(self):
        # Create 1s tone (loud), 2s silence (quiet), 1s tone (loud)
        wav_path = self.temp_path / "synthetic_dialogue.wav"
        sample_rate = 16000
        
        frames = []
        # 1.0s tone @ 440Hz
        for i in range(16000):
            val = int(20000.0 * math.sin(2 * math.pi * 440.0 * i / sample_rate))
            frames.append(struct.pack('<h', val))
            
        # 2.0s silence
        for _ in range(32000):
            frames.append(struct.pack('<h', 0))
            
        # 1.0s tone @ 440Hz
        for i in range(16000):
            val = int(20000.0 * math.sin(2 * math.pi * 440.0 * i / sample_rate))
            frames.append(struct.pack('<h', val))

        with wave.open(str(wav_path), 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(b''.join(frames))

        intervals = AudioDSP.detect_silence_intervals(
            wav_path,
            threshold_dbfs=-38.0,
            min_silence_duration_ms=500,
            pre_cut_padding_ms=80,
            post_cut_padding_ms=120
        )

        self.assertEqual(len(intervals), 1)
        silence = intervals[0]
        # Raw silence started at 1.0s and ended at 3.0s (2.0s duration)
        # Padded start = 1.0 + 0.12 = 1.12s
        # Padded end = 3.0 - 0.08 = 2.92s
        self.assertAlmostEqual(silence["raw_start_seconds"], 1.0, delta=0.05)
        self.assertAlmostEqual(silence["raw_end_seconds"], 3.0, delta=0.05)
        self.assertAlmostEqual(silence["start_seconds"], 1.12, delta=0.05)
        self.assertAlmostEqual(silence["end_seconds"], 2.92, delta=0.05)

if __name__ == "__main__":
    unittest.main()
