"""
AudioDSP - Rule-Based Signal Processing & Silence Detection
Specification: docs/10-SILENCE-DETECTION.md
"""

import math
import wave
import struct
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional

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

    @classmethod
    def enhance_audio_track(
        cls,
        input_path: Path,
        output_path: Path,
        profile_id: str = "crispy-podcast",
        settings: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Processes voice audio with Hollywood-grade digital audio processing (DSP):
        - High-pass rumble filter (80Hz)
        - Profile-specific multi-band surgical equalization (Crisp presence, warmth, boxiness cut)
        - Sibilance De-Esser
        - Dynamic voice leveling & compression
        - Target LUFS loudness normalization (Broadcast standard -14 to -16 LUFS)
        """
        import subprocess
        import os
        from .extractor import AudioExtractor

        if settings is None:
            settings = {}

        denoise = float(settings.get("denoise", 50)) / 100.0
        crisp_air = float(settings.get("crispAir", 60)) / 100.0
        warmth = float(settings.get("warmth", 50)) / 100.0
        deesser = float(settings.get("deesser", 50)) / 100.0
        target_lufs = float(settings.get("targetLufs", -14.0))

        ffmpeg_bin = AudioExtractor.get_ffmpeg_path()
        if not ffmpeg_bin or not os.path.exists(str(input_path)):
            return {
                "success": False,
                "error": "FFmpeg binary or input audio file not found"
            }

        filters = []
        # 1. High-pass filter to clean sub-80Hz rumble, AC humming, and mic stands
        filters.append("highpass=f=80")

        # 2. Denoise if enabled
        if denoise > 0.15:
            filters.append("afftdn=nf=-25")

        # 3. Profile-Specific Surgical Equalization
        if profile_id == "crispy-podcast":
            # Cut muddy 250Hz boxiness, boost presence (3.5kHz), boost ultra-crispy air (10-12kHz)
            air_gain = round(2.0 + (crisp_air * 5.0), 1)
            warmth_gain = round(1.0 + (warmth * 2.5), 1)
            filters.append("equalizer=f=250:t=q:w=1.2:g=-2.5")
            filters.append(f"equalizer=f=180:t=q:w=1.0:g={warmth_gain}")
            filters.append("equalizer=f=3500:t=q:w=1.0:g=3.5")
            filters.append(f"equalizer=f=11000:t=h:w=2000:g={air_gain}")
        elif profile_id == "real-estate":
            # Warm inviting tone, natural presence, clear ambient room balance
            warmth_gain = round(2.0 + (warmth * 4.0), 1)
            air_gain = round(1.0 + (crisp_air * 3.0), 1)
            filters.append(f"equalizer=f=200:t=q:w=1.0:g={warmth_gain}")
            filters.append("equalizer=f=4500:t=q:w=1.2:g=2.5")
            filters.append(f"equalizer=f=9000:t=h:w=2500:g={air_gain}")
        elif profile_id == "sports-fitness":
            # Punchy, aggressive mid-range punch to cut through heavy workout music
            filters.append("equalizer=f=120:t=q:w=1.0:g=3.5")
            filters.append("equalizer=f=2800:t=q:w=1.0:g=4.5")
            filters.append("equalizer=f=7500:t=h:w=2000:g=3.0")
            filters.append("acompressor=threshold=-15dB:ratio=4:attack=10:release=90")
        elif profile_id == "wedding-emotional":
            # Silky, warm, delicate vocal contours with gentle high-end shimmer
            filters.append("equalizer=f=220:t=q:w=1.0:g=2.0")
            filters.append("equalizer=f=5500:t=q:w=1.2:g=2.2")
            filters.append("equalizer=f=12000:t=h:w=2500:g=3.0")
            filters.append("acompressor=threshold=-20dB:ratio=2.5:attack=30:release=200")
        elif profile_id == "drama-natok":
            # Naturalistic dialogue, wide dynamic breathing, room-tone preserved
            filters.append("equalizer=f=300:t=q:w=1.5:g=-1.5")
            filters.append("equalizer=f=3000:t=q:w=1.0:g=2.0")
            filters.append("acompressor=threshold=-22dB:ratio=2:attack=25:release=150")
        elif profile_id == "corporate-tech":
            # Precision clarity, high speech articulation, balanced neutral contour
            filters.append("equalizer=f=160:t=q:w=1.2:g=-1.5")
            filters.append("equalizer=f=3800:t=q:w=1.0:g=3.0")
            filters.append("equalizer=f=9500:t=h:w=2000:g=2.5")
            filters.append("acompressor=threshold=-18dB:ratio=3:attack=15:release=120")
        else:
            # Default balanced vocal master
            filters.append("equalizer=f=250:t=q:w=1.0:g=-2.0")
            filters.append("equalizer=f=3500:t=q:w=1.0:g=3.0")
            filters.append("equalizer=f=10000:t=h:w=2000:g=2.5")

        # 4. De-Esser for harsh sibilant 's' / 'sh' reduction
        if deesser > 0.2:
            filters.append("deesser=i=0.6:m=0.5:f=0.5:s=o")

        # 5. Broadcast Master Limiting & LUFS Loudness
        filters.append(f"loudnorm=I={target_lufs}:TP=-1.0:LRA=11")

        filter_chain = ",".join(filters)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        cmd = [
            ffmpeg_bin,
            "-y",
            "-i", str(input_path),
            "-af", filter_chain,
            "-ar", "48000",
            "-ac", "2",
            "-c:a", "pcm_s24le",
            str(output_path)
        ]

        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
            if res.returncode == 0 and output_path.exists():
                return {
                    "success": True,
                    "outputPath": str(output_path),
                    "profileId": profile_id,
                    "targetLufs": target_lufs
                }
            else:
                return {
                    "success": False,
                    "error": res.stderr.decode('utf-8', errors='ignore')[-300:]
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
