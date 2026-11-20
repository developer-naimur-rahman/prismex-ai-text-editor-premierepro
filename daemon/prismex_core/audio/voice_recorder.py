"""
Voice Recorder & STT Transcriber for Prismex AI Co-Pilot
Uses CoreAudio (sounddevice) and Apple Silicon MLX-Whisper for zero-latency,
100% offline speech-to-text without depending on browser Web Speech API.
"""

import threading
import time
import numpy as np
from pathlib import Path
from typing import Optional, Dict, Any
import sounddevice as sd

class VoiceInputManager:
    _instance = None
    _lock = threading.Lock()

    def __init__(self):
        self.is_recording = False
        self.samplerate = 16000
        self.audio_frames = []
        self.stream: Optional[sd.InputStream] = None
        self.start_time = 0.0

    @classmethod
    def get_instance(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def _audio_callback(self, indata, frames, time_info, status):
        if self.is_recording:
            self.audio_frames.append(indata.copy())

    def start_recording(self) -> Dict[str, Any]:
        with self._lock:
            if self.is_recording:
                return {"success": True, "alreadyRecording": True}
            
            self.audio_frames = []
            self.is_recording = True
            self.start_time = time.time()

            try:
                self.stream = sd.InputStream(
                    samplerate=self.samplerate,
                    channels=1,
                    dtype='float32',
                    callback=self._audio_callback
                )
                self.stream.start()
                return {"success": True, "recording": True, "samplerate": self.samplerate}
            except Exception as e:
                self.is_recording = False
                self.stream = None
                return {"success": False, "error": str(e)}

    def stop_and_transcribe(self, language: str = "auto") -> Dict[str, Any]:
        with self._lock:
            if not self.is_recording:
                return {"success": False, "error": "Not currently recording"}

            self.is_recording = False
            duration = time.time() - self.start_time

            try:
                if self.stream:
                    self.stream.stop()
                    self.stream.close()
                    self.stream = None
            except Exception as se:
                print(f"[VoiceRecorder] Stream close error: {se}")

            if not self.audio_frames:
                return {"success": False, "error": "No audio frames captured", "text": ""}

            try:
                audio_np = np.concatenate(self.audio_frames, axis=0).flatten()
            except Exception as ce:
                return {"success": False, "error": f"Concat error: {ce}", "text": ""}

            # Check signal strength
            peak = float(np.max(np.abs(audio_np))) if len(audio_np) > 0 else 0.0
            if peak < 0.015:
                return {
                    "success": True,
                    "text": "",
                    "warning": "ভয়েস খুব মৃদু বা মাইক মিউট করা ছিল। দয়া করে মাইকের কাছাকাছি এসে স্পষ্ট করে বলুন।",
                    "peak": peak,
                    "duration": duration
                }

            # Transcribe with MLX-Whisper
            transcribed_text = ""
            try:
                import mlx_whisper
                whisper_kwargs: Dict[str, Any] = {
                    "path_or_hf_repo": "mlx-community/whisper-tiny-mlx",
                    "word_timestamps": False
                }
                if language and language != "auto":
                    whisper_kwargs["language"] = language

                result = mlx_whisper.transcribe(audio_np, **whisper_kwargs)
                transcribed_text = (result.get("text") or "").strip()
            except Exception as we:
                print(f"[VoiceRecorder] MLX-Whisper tiny error: {we}. Trying base...")
                try:
                    import mlx_whisper
                    result = mlx_whisper.transcribe(
                        audio_np,
                        path_or_hf_repo="mlx-community/whisper-base-mlx",
                        word_timestamps=False
                    )
                    transcribed_text = (result.get("text") or "").strip()
                except Exception as we2:
                    print(f"[VoiceRecorder] MLX-Whisper fallback error: {we2}")
                    return {"success": False, "error": f"Transcription error: {we2}", "text": ""}

            return {
                "success": True,
                "text": transcribed_text,
                "duration": round(duration, 2),
                "peak": round(peak, 3)
            }
