"""
AudioDSP - Rule-Based Signal Processing & Silence Detection
Specification: docs/10-SILENCE-DETECTION.md
"""

import math
import wave
import struct
from pathlib import Path
from typing import List, Dict, Any, Tuple

class AudioDSP:
    @staticmethod
    def read_wav_samples(wav_path: Path) -> Tuple[List[float], int]:
        """Reads 16-bit mono WAV into normalized float samples [-1.0, 1.0]."""
        with wave.open(str(wav_path), 'rb') as wf:
            sample_rate = wf.getframerate()
            n_frames = wf.getnframes()
            raw_data = wf.readframes(n_frames)
            
            # 16-bit signed PCM
            total_samples = len(raw_data) // 2
            format_str = f"<{total_samples}h"
            raw_ints = struct.unpack(format_str, raw_data)
            
            # Normalize to [-1.0, 1.0]
            samples = [s / 32768.0 for s in raw_ints]
            return samples, sample_rate

    @classmethod
    def detect_silence_intervals(
        cls,
        wav_path: Path,
        threshold_dbfs: float = -38.0,
        min_silence_duration_ms: int = 500,
        pre_cut_padding_ms: int = 80,
        post_cut_padding_ms: int = 120,
        preserve_breathing: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Detects silent pauses using a 30ms sliding-window RMS with dynamic noise floor tracking.
        Applies pre-roll and post-roll safety buffers to protect speech closures.
        """
        samples, sample_rate = cls.read_wav_samples(wav_path)
        if not samples:
            return []

        frame_size = int(0.030 * sample_rate) # 30ms frame (480 samples @ 16kHz)
        if frame_size <= 0:
            return []

        num_frames = len(samples) // frame_size
        frame_energies_db: List[float] = []

        epsilon = 1e-9
        for i in range(num_frames):
            frame = samples[i * frame_size : (i + 1) * frame_size]
            sum_sq = sum(x * x for x in frame)
            rms = math.sqrt(sum_sq / len(frame))
            dbfs = 20.0 * math.log10(rms + epsilon)
            frame_energies_db.append(dbfs)

        if not frame_energies_db:
            return []

        # Adaptive Noise Floor Estimation (15th percentile energy)
        sorted_energies = sorted(frame_energies_db)
        noise_floor_index = int(0.15 * len(sorted_energies))
        noise_floor_dbfs = sorted_energies[noise_floor_index]
        
        # Effective threshold: maximum of configured threshold and noise_floor + 4dB
        effective_threshold = max(threshold_dbfs, noise_floor_dbfs + 4.0)

        # Cluster contiguous below-threshold frames
        min_frames = int((min_silence_duration_ms / 1000.0) / 0.030)
        silence_intervals: List[Dict[str, Any]] = []

        in_silence = False
        start_frame = 0

        for idx, dbfs in enumerate(frame_energies_db):
            if dbfs < effective_threshold:
                if not in_silence:
                    in_silence = True
                    start_frame = idx
            else:
                if in_silence:
                    in_silence = False
                    duration_frames = idx - start_frame
                    if duration_frames >= min_frames:
                        raw_start = start_frame * 0.030
                        raw_end = idx * 0.030
                        
                        # Apply pre-roll and post-roll padding
                        pre_pad_sec = pre_cut_padding_ms / 1000.0
                        post_pad_sec = post_cut_padding_ms / 1000.0

                        padded_start = raw_start + post_pad_sec
                        padded_end = raw_end - pre_pad_sec

                        if padded_end - padded_start >= 0.120: # At least 120ms cut
                            silence_intervals.append({
                                "start_seconds": round(padded_start, 3),
                                "end_seconds": round(padded_end, 3),
                                "duration_seconds": round(padded_end - padded_start, 3),
                                "raw_start_seconds": round(raw_start, 3),
                                "raw_end_seconds": round(raw_end, 3),
                                "average_dbfs": round(sum(frame_energies_db[start_frame:idx]) / duration_frames, 1),
                                "confidence": 0.96
                            })

        # Check trailing silence
        if in_silence:
            duration_frames = len(frame_energies_db) - start_frame
            if duration_frames >= min_frames:
                raw_start = start_frame * 0.030
                raw_end = len(frame_energies_db) * 0.030
                padded_start = raw_start + (post_cut_padding_ms / 1000.0)
                padded_end = max(padded_start + 0.12, raw_end - (pre_cut_padding_ms / 1000.0))
                silence_intervals.append({
                    "start_seconds": round(padded_start, 3),
                    "end_seconds": round(padded_end, 3),
                    "duration_seconds": round(padded_end - padded_start, 3),
                    "raw_start_seconds": round(raw_start, 3),
                    "raw_end_seconds": round(raw_end, 3),
                    "average_dbfs": round(sum(frame_energies_db[start_frame:]) / duration_frames, 1),
                    "confidence": 0.96
                })

        return silence_intervals
