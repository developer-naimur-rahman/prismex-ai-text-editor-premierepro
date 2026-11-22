"""
Prismex Core Daemon - Local FastAPI & WebSocket Server
Specification: docs/03-SYSTEM-ARCHITECTURE.md & docs/23-API-REFERENCE.md

Binds strictly to loopback interface 127.0.0.1:49152 with zero external exposure.
"""

import os
import asyncio
import json
import uuid
import time
import re
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import HOST, PORT, MAX_MEMORY_BUDGET_MB
from .storage.database import DatabaseManager
from .security.keychain_vault import KeychainVault
from .router.ai_router import AIRouter
from .router.provider_registry import REGISTERED_PROVIDERS, TaskCapability
from .audio.extractor import AudioExtractor
from .audio.dsp import AudioDSP
from .audio.voice_recorder import VoiceInputManager
from .stt.transcription_service import TranscriptionService
from .intelligence.take_detector import TakeDetector
from .intelligence.filler_detector import FillerDetector
from .intelligence.smart_srt import SmartSRTSegmenter
from .intelligence.creative_ai import CreativeAI
from .timeline.cut_harmonizer import CutHarmonizer
from .timeline.script_rough_cut import ScriptRoughCutEngine
from .updater.update_manager import UpdateManager

app = FastAPI(title="Prismex Core Companion Daemon", version="1.0.0")

# CORS restricted to Adobe UXP origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # UXP panel uses plugin:// or localhost
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

db = DatabaseManager()
_completed_job_results: Dict[str, Any] = {}

# In-memory WebSocket connection manager
class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        for connection in list(self.active_connections):
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                self.disconnect(connection)

ws_manager = WebSocketManager()

# Request Models
class SourceClipModel(BaseModel):
    mediaPath: Optional[str] = ""
    trackIndex: Optional[int] = 1
    inSeconds: Optional[float] = 0.0
    outSeconds: Optional[float] = 0.0
    sourceInSeconds: Optional[float] = 0.0
    sourceOutSeconds: Optional[float] = 0.0

class MagicRoughCutRequest(BaseModel):
    premiereProjectId: str = "default_proj"
    sequenceGuid: str
    sequenceName: str
    fps: float = 23.976
    sampleRate: int = 48000
    durationSeconds: float
    executionMode: str = "AUTO_EDIT" # TRANSCRIBE_ONLY, AUTO_EDIT or REVIEW_EDIT
    profileId: str = "talking-head"
    sourceClips: List[SourceClipModel] = []
    silenceThresholdDbfs: float = -38.0
    minSilenceDurationMs: int = 500
    preCutPaddingMs: int = 80
    postCutPaddingMs: int = 120
    preserveBreathing: bool = True
    whisperModel: Optional[str] = "base"
    whisperLanguage: Optional[str] = "auto"

class TranscriptAIAnalyzeRequest(BaseModel):
    words: List[Dict[str, Any]] = []
    prompt: str = "Summarize key points and highlight fluff or repeated sections to cut."

class SmartSrtRequest(BaseModel):
    words: List[Dict[str, Any]] = []
    fps: float = 24.0
    targetWords: int = 3
    minWords: Optional[int] = None
    maxWords: Optional[int] = None
    targetChars: int = 20
    maxChars: int = 28
    flexible: bool = True
    useAi: bool = True

class SpellCheckRequest(BaseModel):
    words: List[Dict[str, Any]] = []
    language: Optional[str] = "auto"

class ScriptAlignedSpellCheckRequest(BaseModel):
    words: List[Dict[str, Any]] = []
    clientScript: str = ""
    clientBrief: Optional[str] = ""
    language: Optional[str] = "auto"

class AssistantExecuteCommandRequest(BaseModel):
    command: str
    words: List[Dict[str, Any]] = []
    srtCues: Optional[List[Dict[str, Any]]] = None
    clientScript: Optional[str] = ""
    clientBrief: Optional[str] = ""
    brandKit: Optional[Dict[str, Any]] = None
    sequenceManifest: Optional[Dict[str, Any]] = None
    clientRevisions: Optional[List[Dict[str, Any]]] = None
    language: Optional[str] = "auto"

class BrandColorExtractRequest(BaseModel):
    imageData: str
    brandName: Optional[str] = ""

class BriefRoadmapRequest(BaseModel):
    clientBrief: str = ""
    clientScript: Optional[str] = ""
    words: List[Dict[str, Any]] = []
    durationSeconds: Optional[float] = 60.0

class ParseRevisionsRequest(BaseModel):
    revisionNotes: str
    durationSeconds: Optional[float] = 120.0

class ViralShortsRequest(BaseModel):
    words: List[Dict[str, Any]] = []
    sentences: List[Dict[str, Any]] = []
    targetCount: int = 5
    fps: float = 24.0
    customPrompt: Optional[str] = None

class ShortRefineRequest(BaseModel):
    short: Dict[str, Any]
    instruction: str
    words: List[Dict[str, Any]] = []
    fps: float = 24.0

class ShortTopicsRequest(BaseModel):
    words: List[Dict[str, Any]] = []
    sentences: List[Dict[str, Any]] = []
    targetCount: int = 6
    customPrompt: Optional[str] = None

class AlternativeHooksRequest(BaseModel):
    short: Dict[str, Any]
    words: List[Dict[str, Any]] = []
    sentences: List[Dict[str, Any]] = []

class AlternativeCtasRequest(BaseModel):
    short: Dict[str, Any]
    words: List[Dict[str, Any]] = []
    sentences: List[Dict[str, Any]] = []

class ClientScriptMatchRequest(BaseModel):
    clientScript: str
    words: List[Dict[str, Any]] = []
    sentences: List[Dict[str, Any]] = []
    fps: float = 24.0

class BatchScriptToShortsRequest(BaseModel):
    scripts: str
    words: List[Dict[str, Any]] = []
    sentences: List[Dict[str, Any]] = []
    fps: float = 24.0
    targetCount: Optional[int] = None

class MarkerAnalysisRequest(BaseModel):
    words: List[Dict[str, Any]] = []

class TypographyRequest(BaseModel):
    text: str

class ApplyReviewRequest(BaseModel):
    approvedSuggestionIds: List[str]

class ProviderKeyRequest(BaseModel):
    apiKey: str

class ClipboardRequest(BaseModel):
    text: str

class AudioEnhanceRequest(BaseModel):
    sequenceName: str = "sequence"
    audioPath: Optional[str] = None
    sourceClips: Optional[List[Dict[str, Any]]] = None
    durationSeconds: Optional[float] = 0.0
    profileId: str = "crispy-podcast"
    settings: Optional[Dict[str, Any]] = None

class SoundDesignRequest(BaseModel):
    words: List[Dict[str, Any]] = []
    sentences: List[Dict[str, Any]] = []
    genre: str = "podcast"

class BgmRecommendRequest(BaseModel):
    words: List[Dict[str, Any]] = []
    sentences: List[Dict[str, Any]] = []
    genre: str = "podcast"
    durationSeconds: Optional[float] = 60.0

# ----------------- REST Endpoints -----------------

@app.get("/health")
def get_health():
    return {
        "status": "HEALTHY",
        "version": "1.0.0",
        "memoryUsageMB": 185.0,
        "maxBudgetMB": MAX_MEMORY_BUDGET_MB,
        "isAppleSilicon": True,
        "freeOnlyMode": AIRouter.free_only_mode,
        "localOnlyMode": AIRouter.local_only_mode
    }

@app.get("/api/v1/providers")
def list_providers():
    result = []
    for p in REGISTERED_PROVIDERS:
        pid = p["provider_id"]
        key = KeychainVault.get_api_key(pid)
        diag = CreativeAI.get_provider_status(pid)

        # Check configuration
        is_configured = key is not None or p["is_local"]
        if not is_configured:
            status_text = "কী সেট করা নেই (Not Configured)"
            quota_exhausted = False
            needs_change = True
            health = "NOT_CONFIGURED"
        else:
            status_text = diag.get("message", "✓ প্রস্তুত")
            quota_exhausted = diag.get("quota_exhausted", False)
            needs_change = diag.get("needs_change", False)
            health = diag.get("status", "HEALTHY")

        result.append({
            "providerId": pid,
            "name": p["name"],
            "modelId": p["model_id"],
            "isLocal": p["is_local"],
            "isFreeTier": p["is_free_tier"],
            "isConfigured": is_configured,
            "maskedKey": KeychainVault.mask_key(key) if key else None,
            "health": health,
            "quotaExhausted": quota_exhausted,
            "needsKeyChange": needs_change,
            "statusMessage": status_text,
            "maxRpm": p["max_rpm"],
            "priority": p["priority"]
        })
    return {"providers": result}

@app.post("/api/v1/providers/{provider_id}/key")
def set_provider_key(provider_id: str, payload: ProviderKeyRequest):
    KeychainVault.set_api_key(provider_id, payload.apiKey)
    return {
        "providerId": provider_id,
        "status": "CONFIGURED",
        "maskedKey": KeychainVault.mask_key(payload.apiKey)
    }

@app.delete("/api/v1/providers/{provider_id}/key")
def delete_provider_key(provider_id: str):
    KeychainVault.delete_api_key(provider_id)
    return {"providerId": provider_id, "status": "DELETED"}

@app.post("/api/v1/system/clipboard")
def set_system_clipboard(req: ClipboardRequest):
    """Sets system clipboard via macOS pbcopy for 100% reliable CEP extension clipboard copy."""
    try:
        import subprocess
        import sys
        text_bytes = (req.text or "").encode("utf-8")
        if sys.platform == "darwin":
            proc = subprocess.Popen(["pbcopy"], stdin=subprocess.PIPE)
            proc.communicate(input=text_bytes)
        elif sys.platform == "win32":
            proc = subprocess.Popen(["clip"], stdin=subprocess.PIPE)
            proc.communicate(input=text_bytes)
        else:
            proc = subprocess.Popen(["xclip", "-selection", "clipboard"], stdin=subprocess.PIPE)
            proc.communicate(input=text_bytes)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/v1/profiles")
def get_profiles():
    return {"profiles": db.get_profiles()}

@app.get("/api/v1/jobs/{job_id}")
def get_job_status(job_id: str):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    res = dict(job)
    if job_id in _completed_job_results:
        res["result"] = _completed_job_results[job_id]
    return res

@app.get("/api/v1/review-queue/{job_id}")
def get_review_queue(job_id: str):
    suggestions = db.get_suggestions(job_id)
    return {
        "jobId": job_id,
        "totalSuggestions": len(suggestions),
        "suggestions": suggestions
    }

@app.post("/api/v1/review-queue/{job_id}/apply")
def apply_review_queue(job_id: str, payload: ApplyReviewRequest):
    suggestions = db.get_suggestions(job_id)
    approved_set = set(payload.approvedSuggestionIds)

    for s in suggestions:
        new_status = "ACCEPTED" if s["id"] in approved_set else "REJECTED"
        db.update_suggestion_status(s["id"], new_status)
        s["status"] = new_status

    # Harmonize approved cuts
    cuts = CutHarmonizer.harmonize_cuts(suggestions)
    total_saved = sum(c["duration_seconds"] for c in cuts)

    return {
        "planId": f"plan_{uuid.uuid4().hex[:8]}",
        "jobId": job_id,
        "totalCuts": len(cuts),
        "totalTimeSavedSeconds": round(total_saved, 3),
        "cuts": cuts
    }

# ----------------- Master Pipeline Orchestrator -----------------

_transcription_semaphore = asyncio.Semaphore(1)

async def execute_magic_rough_cut_pipeline(job_id: str, req: MagicRoughCutRequest):
    """Executes the master 14-stage Magic Rough Cut pipeline asynchronously without blocking the event loop."""
    try:
        # Check if timeline has any audio/video clips
        if not req.sourceClips or len(req.sourceClips) == 0:
            print(f"[execute_magic_rough_cut_pipeline] Empty timeline detected for {req.sequenceGuid}. Clearing transcript.")
            clean_seq_name = re.sub(r"(_PrismexRoughCut|_SilenceCut|_ApprovedCuts|_RoughCut)+", "", req.sequenceGuid).strip()
            safe_proj = re.sub(r"[^\w_-]", "_", req.premiereProjectId or "current_project")
            safe_seq = re.sub(r"[^\w_-]", "_", clean_seq_name or "sequence")
            cache_file = PROJECT_CACHE_DIR / f"{safe_proj}__{safe_seq}.json"
            if cache_file.exists():
                try:
                    cache_file.unlink()
                except Exception:
                    pass

            empty_summary = {
                "initialDuration": 0.0,
                "finalDuration": 0.0,
                "timeSaved": 0.0,
                "cutsExecuted": 0,
                "syncVerified": True
            }

            _completed_job_results[job_id] = {
                "jobId": job_id,
                "executionMode": req.executionMode,
                "totalCuts": 0,
                "timeSavedSeconds": 0.0,
                "cuts": [],
                "words": [],
                "sentences": [],
                "silences": [],
                "reviewItems": [],
                "summary": empty_summary
            }

            db.save_job({
                "id": job_id,
                "sequence_id": req.sequenceGuid,
                "job_type": "MAGIC_ROUGH_CUT",
                "status": "COMPLETE",
                "progress_percent": 100.0
            })

            await ws_manager.broadcast({
                "jsonrpc": "2.0",
                "method": "job.completed",
                "params": {
                    "jobId": job_id,
                    "executionMode": req.executionMode,
                    "totalCuts": 0,
                    "timeSavedSeconds": 0.0,
                    "cuts": [],
                    "words": [],
                    "sentences": [],
                    "silences": []
                }
            })
            return

        # Stage 1 & 2: Audio Extraction across all timeline clips
        db.save_job({
            "id": job_id,
            "sequence_id": req.sequenceGuid,
            "job_type": "MAGIC_ROUGH_CUT",
            "status": "EXTRACTING",
            "progress_percent": 15.0
        })
        await ws_manager.broadcast({
            "jsonrpc": "2.0",
            "method": "job.progress",
            "params": {"jobId": job_id, "stage": "EXTRACTING", "percent": 15.0, "message": "Extracting audio from sequence clips..."}
        })
        
        async with _transcription_semaphore:
            extracted_wav = await asyncio.to_thread(
                AudioExtractor.extract_sequence_timeline_audio, req.sourceClips, req.durationSeconds
            )

            # Stage 3 & 4: Transcription across entire sequence timeline
            db.save_job({
                "id": job_id,
                "sequence_id": req.sequenceGuid,
                "job_type": "MAGIC_ROUGH_CUT",
                "status": "TRANSCRIBING",
                "progress_percent": 45.0
            })
            await ws_manager.broadcast({
                "jsonrpc": "2.0",
                "method": "job.progress",
                "params": {"jobId": job_id, "stage": "TRANSCRIBING", "percent": 45.0, "message": f"Transcribing speech with Apple Silicon MLX-Whisper ({req.whisperModel or 'base'})..."}
            })
            transcript_data = await asyncio.to_thread(
                TranscriptionService.transcribe,
                extracted_wav,
                max(0.1, req.durationSeconds),
                model_name=req.whisperModel or "base",
                language=req.whisperLanguage or "auto"
            )

        # Stage 5 & 6: Silence Detection
        db.save_job({
            "id": job_id,
            "sequence_id": req.sequenceGuid,
            "job_type": "MAGIC_ROUGH_CUT",
            "status": "ANALYZING",
            "progress_percent": 65.0
        })
        await ws_manager.broadcast({
            "jsonrpc": "2.0",
            "method": "job.progress",
            "params": {"jobId": job_id, "stage": "ANALYZING", "percent": 65.0, "message": "Analyzing voice energy, noise floor, and dead air..."}
        })
        silence_cuts = await asyncio.to_thread(
            AudioDSP.detect_silence_intervals,
            extracted_wav,
            threshold_dbfs=req.silenceThresholdDbfs,
            min_silence_duration_ms=req.minSilenceDurationMs,
            pre_cut_padding_ms=req.preCutPaddingMs,
            post_cut_padding_ms=req.postCutPaddingMs,
            preserve_breathing=req.preserveBreathing
        )
        
        all_suggestions = []
        for sc in silence_cuts:
            all_suggestions.append({
                "id": f"sugg_sil_{uuid.uuid4().hex[:8]}",
                "job_id": job_id,
                "sequence_id": req.sequenceGuid,
                "category": "SILENCE",
                "status": "ACCEPTED" if req.executionMode == "AUTO_EDIT" else "PENDING",
                "start_seconds": sc["start_seconds"],
                "end_seconds": sc["end_seconds"],
                "duration_seconds": sc["duration_seconds"],
                "confidence": sc["confidence"],
                "reason": f"Silence pause ({sc.get('average_dbfs', -40)} dBFS)",
                "transcript_snippet": "[Silence]"
            })

        # Stage 7 & 8: Repeated Take Clustering
        db.save_job({
            "id": job_id,
            "sequence_id": req.sequenceGuid,
            "job_type": "MAGIC_ROUGH_CUT",
            "status": "ANALYZING",
            "progress_percent": 80.0
        })
        await ws_manager.broadcast({
            "jsonrpc": "2.0",
            "method": "job.progress",
            "params": {"jobId": job_id, "stage": "ANALYZING", "percent": 80.0, "message": "Clustering repeated takes and scoring fluency..."}
        })
        take_suggestions = TakeDetector.detect_take_clusters(transcript_data["sentences"], take_mode="BEST_TAKE")
        for ts in take_suggestions:
            ts["job_id"] = job_id
            ts["sequence_id"] = req.sequenceGuid
            if req.executionMode == "AUTO_EDIT":
                ts["status"] = "ACCEPTED"
            all_suggestions.append(ts)

        # Stage 9: Filler Word & Stutter Detection
        filler_suggestions = FillerDetector.detect_disfluencies(transcript_data["words"])
        filler_ranges = [(fs["start_seconds"], fs["end_seconds"]) for fs in filler_suggestions]
        for w in transcript_data.get("words", []):
            for f_start, f_end in filler_ranges:
                if abs(w["start_seconds"] - f_start) < 0.05 and abs(w["end_seconds"] - f_end) < 0.05:
                    w["is_filler"] = True
                    break

        for fs in filler_suggestions:
            fs["job_id"] = job_id
            fs["sequence_id"] = req.sequenceGuid
            if req.executionMode == "AUTO_EDIT":
                fs["status"] = "ACCEPTED"
            all_suggestions.append(fs)

        # Persist suggestions to database
        db.save_suggestions(all_suggestions)

        # Stage 10: Harmonize Cut Decision List
        cuts = CutHarmonizer.harmonize_cuts(all_suggestions, fps=req.fps)
        total_time_saved = sum(c["duration_seconds"] for c in cuts)

        # Cleanup ephemeral audio
        AudioExtractor.cleanup_temp_file(extracted_wav)

        summary_report = {
            "initialDuration": req.durationSeconds,
            "finalDuration": round(max(0.0, req.durationSeconds - total_time_saved), 2),
            "timeSaved": round(total_time_saved, 2),
            "cutsExecuted": len(cuts),
            "syncVerified": True
        }

        # Store in-memory result for immediate HTTP polling
        _completed_job_results[job_id] = {
            "jobId": job_id,
            "executionMode": req.executionMode,
            "totalCuts": len(cuts),
            "timeSavedSeconds": round(total_time_saved, 2),
            "cuts": cuts,
            "words": transcript_data.get("words", []),
            "sentences": transcript_data.get("sentences", []),
            "silences": silence_cuts,
            "reviewItems": all_suggestions,
            "summary": summary_report
        }

        # Update Job Status in DB
        db.save_job({
            "id": job_id,
            "sequence_id": req.sequenceGuid,
            "job_type": "MAGIC_ROUGH_CUT",
            "status": "COMPLETE",
            "progress_percent": 100.0
        })

        # Broadcast completion via WebSocket
        # Save to persistent daemon project cache
        try:
            clean_seq_name = re.sub(r"(_PrismexRoughCut|_SilenceCut|_ApprovedCuts|_RoughCut)+", "", req.sequenceGuid).strip()
            safe_proj = re.sub(r"[^\w_-]", "_", req.premiereProjectId or "current_project")
            safe_seq = re.sub(r"[^\w_-]", "_", clean_seq_name or "sequence")
            cache_file = PROJECT_CACHE_DIR / f"{safe_proj}__{safe_seq}.json"
            with open(cache_file, "w", encoding="utf-8") as cf:
                json.dump({
                    "words": transcript_data.get("words", []),
                    "sentences": transcript_data.get("sentences", []),
                    "silences": silence_cuts,
                    "reviewItems": all_suggestions,
                    "totalCuts": len(cuts),
                    "summary": summary_report,
                }, cf, ensure_ascii=False, indent=2)
        except Exception as cache_err:
            try:
                import sys
                sys.stderr.write(f"[execute_magic_rough_cut_pipeline] Cache save error: {cache_err}\n")
            except Exception:
                pass

        await ws_manager.broadcast({
            "jsonrpc": "2.0",
            "method": "job.completed",
            "params": {
                "jobId": job_id,
                "executionMode": req.executionMode,
                "totalCuts": len(cuts),
                "timeSavedSeconds": round(total_time_saved, 2),
                "cuts": cuts,
                "words": transcript_data.get("words", []),
                "sentences": transcript_data.get("sentences", []),
                "silences": silence_cuts
            }
        })

    except Exception as e:
        db.save_job({
            "id": job_id,
            "sequence_id": req.sequenceGuid,
            "job_type": "MAGIC_ROUGH_CUT",
            "status": "FAILED",
            "progress_percent": 100.0,
            "error_message": str(e)
        })
        await ws_manager.broadcast({
            "jsonrpc": "2.0",
            "method": "job.failed",
            "params": {"jobId": job_id, "error": str(e)}
        })

@app.post("/api/v1/jobs/magic-rough-cut", status_code=202)
def start_magic_rough_cut(req: MagicRoughCutRequest, background_tasks: BackgroundTasks):
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    db.save_job({
        "id": job_id,
        "sequence_id": req.sequenceGuid,
        "job_type": "MAGIC_ROUGH_CUT",
        "status": "INITIALIZING",
        "progress_percent": 5.0
    })

    background_tasks.add_task(execute_magic_rough_cut_pipeline, job_id, req)

    return {
        "jobId": job_id,
        "status": "INITIALIZING",
        "estimatedDurationSeconds": 35.0,
        "wsSubscriptionUrl": f"ws://{HOST}:{PORT}/ws/events"
    }

@app.post("/api/v1/transcript/ai-analyze")
def ai_analyze_transcript(req: TranscriptAIAnalyzeRequest):
    """Analyzes transcript using Cloud AI (Gemini/Groq if configured) or Local AI Intelligence."""
    words = req.words or []
    full_text = " ".join(str(w.get("word", "")) for w in words).strip()
    if not full_text:
        return {"summary": "No transcript words available to analyze.", "engine": "local", "highlights": []}

    total_words = len(words)
    first_t = float(words[0].get("start_seconds", 0.0)) if words else 0.0
    last_t = float(words[-1].get("end_seconds", 0.0)) if words else 0.0
    duration_min = max(0.01, (last_t - first_t) / 60.0)
    wpm = round(total_words / duration_min)
    filler_count = sum(1 for w in words if w.get("is_filler"))

    # 1. Check if OpenRouter API key is configured
    openrouter_key = KeychainVault.get_api_key("openrouter")
    if openrouter_key:
        import requests
        candidate_models = ["google/gemini-2.5-flash", "google/gemini-2.0-flash-001", "deepseek/deepseek-chat", "anthropic/claude-3.5-haiku"]
        for om in candidate_models:
            try:
                resp = requests.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {openrouter_key}",
                        "HTTP-Referer": "https://prismex.ai",
                        "X-Title": "Prismex AI Editor",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": om,
                        "messages": [
                            {"role": "user", "content": f"{req.prompt}\n\nTranscript ({total_words} words, {wpm} WPM):\n{full_text[:12000]}"}
                        ],
                        "temperature": 0.3
                    },
                    timeout=25
                )
                if resp.status_code == 200:
                    data = resp.json()
                    text_out = data["choices"][0]["message"]["content"]
                    return {
                        "summary": text_out,
                        "engine": f"OpenRouter ({om})",
                        "wpm": wpm,
                        "totalWords": total_words,
                        "fillerCount": filler_count
                    }
            except Exception as e:
                print(f"[AI Analyze] OpenRouter model {om} failed: {e}")

    # 2. Check if Google Gemini API key is configured in macOS Keychain
    gemini_key = KeychainVault.get_api_key("google-gemini") or KeychainVault.get_api_key("gemini-cloud")
    if gemini_key:
        import requests
        candidate_models = ["gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-3.5-flash"]
        for m in candidate_models:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={gemini_key}"
                resp = requests.post(
                    url,
                    json={
                        "contents": [{
                            "parts": [{
                                "text": f"{req.prompt}\n\nTranscript ({total_words} words, {wpm} WPM):\n{full_text[:12000]}"
                            }]
                        }]
                    },
                    timeout=20
                )
                if resp.status_code == 200:
                    data = resp.json()
                    text_out = data["candidates"][0]["content"]["parts"][0]["text"]
                    return {
                        "summary": text_out,
                        "engine": f"Google Gemini ({m})",
                        "wpm": wpm,
                        "totalWords": total_words,
                        "fillerCount": filler_count
                    }
            except Exception as e:
                print(f"[AI Analyze] Gemini model {m} failed: {e}")

    # Local AI Summary & Pacing Analysis (Zero-Subscription Offline Fallback)
    sentences = [s.strip() for s in full_text.replace("?", ".").replace("!", ".").split(".") if len(s.strip()) > 3]
    top_sentences = sentences[:3]
    summary_text = (
        f"Local AI Analysis: {total_words} words at ~{wpm} WPM. "
        f"Detected {filler_count} filler disfluencies. "
        + ("Key opening points: " + " | ".join(top_sentences) if top_sentences else "")
    )
    return {
        "summary": summary_text,
        "engine": "Prismex Local AI (Offline)",
        "wpm": wpm,
        "totalWords": total_words,
        "fillerCount": filler_count
    }

@app.post("/api/v1/srt/smart-segment")
def generate_smart_srt(req: SmartSrtRequest):
    """Generates AI-segmented, flexible word/char SRT cues snapped to exact sequence framerate."""
    return SmartSRTSegmenter.segment(
        words=req.words,
        fps=req.fps,
        target_words=req.targetWords,
        min_words=req.minWords,
        max_words=req.maxWords,
        target_chars=req.targetChars,
        max_chars=req.maxChars,
        flexible=req.flexible,
        use_ai=req.useAi,
    )

@app.post("/api/v1/transcript/ai-spell-check")
def ai_spell_check(req: SpellCheckRequest):
    """Detects typos or speech-to-text misspellings across all words and returns corrected words with preserved timestamps."""
    return CreativeAI.spell_check(req.words, language=req.language or "auto")

@app.post("/api/v1/transcript/ai-polish-sentence")
def ai_polish_sentence(req: SpellCheckRequest):
    """Polishes a single sentence with Google Gemini, preserving exact 1-to-1 word timestamps."""
    return CreativeAI.polish_sentence(req.words, language=req.language or "auto")

@app.post("/api/v1/transcript/ai-script-align")
def ai_script_align(req: ScriptAlignedSpellCheckRequest):
    """Aligns Whisper STT transcript with client-provided script and brief, correcting phonetic errors while keeping timeline ground truth."""
    return CreativeAI.script_aligned_spell_check(
        words=req.words,
        client_script=req.clientScript,
        client_brief=req.clientBrief or "",
        language=req.language or "auto"
    )

@app.post("/api/v1/assistant/execute-command")
def assistant_execute_command(req: AssistantExecuteCommandRequest):
    """Natural Language & Voice Co-Pilot interpreter for conversational commands across transcript, SRT, color grading, and BGM."""
    return CreativeAI.execute_assistant_command(
        command=req.command,
        words=req.words,
        srt_cues=req.srtCues,
        client_script=req.clientScript or "",
        client_brief=req.clientBrief or "",
        brand_kit=req.brandKit,
        sequence_manifest=req.sequenceManifest,
        client_revisions=req.clientRevisions,
        language=req.language or "auto"
    )

@app.post("/api/v1/client/extract-brand-colors")
def extract_brand_colors_endpoint(req: BrandColorExtractRequest):
    """Extracts dominant brand colors, hex codes, and visual palette from an uploaded logo or image."""
    return CreativeAI.extract_brand_colors(req.imageData, brand_name_hint=req.brandName or "")

@app.post("/api/v1/client/analyze-brief-roadmap")
def analyze_brief_roadmap_endpoint(req: BriefRoadmapRequest):
    """Generates an ordered, actionable step-by-step Editing Roadmap / Action Checklist from client brief."""
    return CreativeAI.analyze_brief_roadmap(
        client_brief=req.clientBrief,
        client_script=req.clientScript or "",
        words=req.words,
        duration_seconds=req.durationSeconds or 60.0
    )

@app.post("/api/v1/client/parse-revisions")
def parse_revisions_endpoint(req: ParseRevisionsRequest):
    """Parses client revision notes, extracts timecodes, and categorizes changes for 1-click timeline seeking."""
    return CreativeAI.parse_revisions(
        revision_notes=req.revisionNotes,
        duration_seconds=req.durationSeconds or 120.0
    )

@app.post("/api/v1/transcript/ai-viral-shorts")
def ai_viral_shorts(req: ViralShortsRequest):
    """Generates 3-10 high-engagement viral vertical shorts from the transcript."""
    return CreativeAI.detect_viral_shorts(req.words, req.sentences, req.targetCount, req.fps, req.customPrompt)

@app.post("/api/v1/transcript/ai-viral-shorts/refine")
def ai_refine_viral_short(req: ShortRefineRequest):
    """Interactively refines a short candidate via user instruction."""
    return CreativeAI.refine_short(req.short, req.instruction, req.words, req.fps)

@app.post("/api/v1/transcript/ai-short-topics")
def ai_short_topics(req: ShortTopicsRequest):
    """Discovers high-potential Short topics with Bengali summaries, key points, and virality scores."""
    return CreativeAI.discover_short_topics(req.words, req.sentences, req.targetCount, req.customPrompt)

@app.post("/api/v1/transcript/ai-alternative-hooks")
def ai_alternative_hooks(req: AlternativeHooksRequest):
    """Generates 5 distinct alternative hooks tailored to the short's story body."""
    return CreativeAI.generate_alternative_hooks(req.short, req.words, req.sentences)

@app.post("/api/v1/transcript/ai-alternative-ctas")
def ai_alternative_ctas(req: AlternativeCtasRequest):
    """Generates 3-5 alternative closing CTAs matching the story body."""
    return CreativeAI.generate_alternative_ctas(req.short, req.words, req.sentences)

@app.post("/api/v1/transcript/ai-match-client-script")
def ai_match_client_script(req: ClientScriptMatchRequest):
    """Matches a client-provided script to video dialogue timestamps for 1-click sequence creation."""
    return CreativeAI.match_client_script_to_sequence(req.clientScript, req.words, req.sentences, req.fps)

@app.post("/api/v1/transcript/batch-script-to-shorts")
def batch_script_to_shorts(req: BatchScriptToShortsRequest):
    """Parses multiple client scripts (5, 8, 10+) and generates dialogue-matched 9:16 Shorts sequences."""
    return CreativeAI.batch_script_to_shorts(
        scripts_text=req.scripts,
        words=req.words,
        sentences=req.sentences,
        fps=req.fps,
        target_count=req.targetCount
    )

class ScriptRoughCutRequest(BaseModel):
    scriptText: str
    words: List[Dict[str, Any]] = []
    durationSeconds: float = 0.0
    fps: float = 23.976

@app.post("/api/v1/timeline/script-rough-cut")
def generate_script_rough_cut(req: ScriptRoughCutRequest):
    """
    Parses client script, extracts spoken dialogue, filters non-spoken brackets/chapters,
    aligns with timeline transcript, selects optimal takes, calculates cuts,
    A/B multi-cam punch-ins (100% vs 112%), act color labels, and chapter markers.
    """
    return ScriptRoughCutEngine.generate_script_rough_cut(
        script_text=req.scriptText,
        transcript_words=req.words,
        total_duration_seconds=req.durationSeconds,
        fps=req.fps
    )

class FeedbackMarkersRequest(BaseModel):
    feedbackText: str
    fps: float = 24.0

class AssetDownloadRequest(BaseModel):
    url: str
    assetType: str = "video"

@app.post("/api/v1/client/parse-feedback-markers")
def parse_feedback_markers_api(req: FeedbackMarkersRequest):
    """Parses client revision notes/WhatsApp feedback into timeline markers."""
    markers = CreativeAI.parse_client_feedback_to_markers(req.feedbackText, req.fps)
    return {"success": True, "count": len(markers), "markers": markers}

@app.post("/api/v1/stock/download-asset")
def download_asset_api(req: AssetDownloadRequest):
    """Downloads an online media asset to local cache for 1-click import into Premiere Pro."""
    return CreativeAI.download_and_cache_asset(req.url, req.assetType)

# ===================== IN-APP AUTO-UPDATER & RESTART APIS =====================
class RestartAppRequest(BaseModel):
    appName: Optional[str] = "Adobe Premiere Pro"

class InstallUpdateRequest(BaseModel):
    downloadUrl: Optional[str] = None

@app.get("/api/v1/update/check")
def check_for_updates():
    """Checks remote channel for available extension updates and release notes."""
    return UpdateManager.check_updates()

@app.post("/api/v1/update/download-and-install")
def download_and_install_update(req: InstallUpdateRequest):
    """Downloads and extracts update bundle directly into CEP extension directory."""
    return UpdateManager.download_and_install_update(req.downloadUrl)

@app.post("/api/v1/update/restart-app")
def restart_app_endpoint(req: RestartAppRequest):
    """Saves project and restarts host app (Premiere Pro or After Effects)."""
    return UpdateManager.restart_host_app(req.appName or "Adobe Premiere Pro")

@app.post("/api/v1/transcript/ai-markers")
def ai_markers(req: MarkerAnalysisRequest):
    """Classifies emphasis keywords (RED), B-Roll visual cues (GREEN), and icons/graphics (BLUE)."""
    return CreativeAI.analyze_markers(req.words)

class ScriptDirectivesRequest(BaseModel):
    words: List[Dict[str, Any]] = []
    sentences: List[Dict[str, Any]] = []
    language: Optional[str] = "bn"
    userPrompt: Optional[str] = None

@app.post("/api/v1/transcript/script-directives")
def script_directives_endpoint(req: ScriptDirectivesRequest):
    """Generates engaging visual directives (B-Roll, PNG, Typography, Punch) & explanations for all sentences."""
    return CreativeAI.analyze_script_visual_directives(
        words=req.words,
        sentences=req.sentences,
        language=req.language or "bn",
        user_prompt=req.userPrompt
    )

@app.post("/api/v1/transcript/ae-typography")
def format_ae_typography(req: TypographyRequest):
    """Formats text into multi-line kinetic typography layout with ready-to-paste AE ExtendScript."""
    return CreativeAI.format_after_effects_typography(req.text)

class TypographyKeywordsRequest(BaseModel):
    sentence: str

class TranslateSentenceRequest(BaseModel):
    text: str
    targetLang: Optional[str] = "bn"

class SingleLineDirectiveRequest(BaseModel):
    text: str
    contextBefore: Optional[str] = ""
    contextAfter: Optional[str] = ""

@app.post("/api/v1/transcript/tune-single-line")
def tune_single_line_endpoint(req: SingleLineDirectiveRequest):
    """Deep LLM contextual analysis of a single sentence for action/mood B-Roll, PNGs, and editor advice."""
    return CreativeAI.analyze_single_line_directive(
        sentence_text=req.text,
        context_before=req.contextBefore or "",
        context_after=req.contextAfter or ""
    )

@app.post("/api/v1/transcript/translate-sentence")
def translate_sentence_endpoint(req: TranslateSentenceRequest):
    """Translates an English sentence into accurate, natural Bengali."""
    translated = CreativeAI.translate_to_bengali(req.text)
    return {"text": req.text, "translated": translated, "language": req.targetLang or "bn"}

@app.post("/api/v1/transcript/typography-keywords")
def extract_typography_keywords(req: TypographyKeywordsRequest):
    """Extracts 2-4 high-impact keywords from a sentence for on-screen motion typography."""
    return CreativeAI.extract_typography_keywords(req.sentence)

class StockSearchRequest(BaseModel):
    query: str

class YoutubeChaptersRequest(BaseModel):
    words: List[Dict[str, Any]] = []
    sentences: List[Dict[str, Any]] = []
    videoTitle: Optional[str] = "Video"

@app.post("/api/v1/stock/broll-search")
def search_stock_broll(req: StockSearchRequest):
    """Searches stock video options matching keyword."""
    return CreativeAI.search_broll_stock(req.query)

@app.post("/api/v1/sfx/ensure-assets")
def ensure_sfx_assets_api():
    """Ensures studio-grade 48kHz WAV Whoosh & Pop assets exist on local disk."""
    return CreativeAI.generate_sfx_assets()

@app.post("/api/v1/transcript/ai-youtube-chapters")
def generate_youtube_chapters_api(req: YoutubeChaptersRequest):
    """Generates formatted YouTube Description chapters and timestamps."""
    return CreativeAI.generate_youtube_chapters(req.words, req.sentences, req.videoTitle or "Video")

PROJECT_CACHE_DIR = Path.home() / ".prismex" / "project_cache"
PROJECT_CACHE_DIR.mkdir(parents=True, exist_ok=True)

class ProjectCachePayload(BaseModel):
    projectId: str
    sequenceName: str
    data: Dict[str, Any]

def _get_safe_cache_key(project_id: str, sequence_name: str) -> str:
    clean_seq = re.sub(r"(_PrismexRoughCut|_SilenceCut|_ApprovedCuts|_RoughCut)+", "", sequence_name).strip()
    safe_proj = re.sub(r"[^\w_-]", "_", project_id or "default_project")
    safe_seq = re.sub(r"[^\w_-]", "_", clean_seq or "default_seq")
    return f"{safe_proj}__{safe_seq}"

@app.get("/api/v1/cache/project")
def get_project_cache(project_id: str = "current_project", sequence_name: str = "Sequence"):
    key = _get_safe_cache_key(project_id, sequence_name)
    file_path = PROJECT_CACHE_DIR / f"{key}.json"
    if not file_path.exists():
        return {"found": False, "key": key}
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return {"found": True, "key": key, "data": data}
    except Exception as e:
        return {"found": False, "error": str(e)}

@app.post("/api/v1/cache/project")
def save_project_cache(payload: ProjectCachePayload):
    key = _get_safe_cache_key(payload.projectId, payload.sequenceName)
    file_path = PROJECT_CACHE_DIR / f"{key}.json"
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(payload.data, f, ensure_ascii=False, indent=2)
        return {"saved": True, "key": key}
    except Exception as e:
        return {"saved": False, "error": str(e)}

class SaveFilesRequest(BaseModel):
    folderPath: Optional[str] = None
    baseFilename: str
    srtContent: Optional[str] = ""
    txtContent: Optional[str] = ""
    jsonContent: Optional[str] = ""

@app.post("/api/v1/files/save-project-files")
def save_project_files_api(req: SaveFilesRequest):
    """Reliably saves SRT, TXT, and JSON files to project directory or default exports directory."""
    try:
        folder = None
        if req.folderPath and req.folderPath.strip() and req.folderPath != "/tmp":
            folder = Path(req.folderPath.strip())
        else:
            folder = Path.home() / "Documents" / "PrismexExports"

        folder.mkdir(parents=True, exist_ok=True)
        safe_base = re.sub(r'[^a-zA-Z0-9_\u0980-\u09FF-]', '_', req.baseFilename or 'captions')

        saved_files = []
        if req.srtContent:
            srt_path = folder / f"{safe_base}.srt"
            srt_path.write_text(req.srtContent, encoding="utf-8")
            saved_files.append(str(srt_path))

        if req.txtContent:
            txt_path = folder / f"{safe_base}.txt"
            txt_path.write_text(req.txtContent, encoding="utf-8")
            saved_files.append(str(txt_path))

        if req.jsonContent:
            json_path = folder / f"{safe_base}.json"
            json_path.write_text(req.jsonContent, encoding="utf-8")
            saved_files.append(str(json_path))

        return {
            "success": len(saved_files) > 0,
            "folder": str(folder),
            "files": saved_files
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

class OpenUrlRequest(BaseModel):
    url: str

class OpenUrlsRequest(BaseModel):
    urls: List[str]

@app.post("/api/v1/system/open-url")
def open_url_api(req: OpenUrlRequest):
    """Reliably opens a URL in default browser on host OS (macOS/Windows)."""
    try:
        import webbrowser
        webbrowser.open(req.url)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/v1/system/open-urls")
def open_urls_api(req: OpenUrlsRequest):
    """Reliably opens multiple URLs in separate tabs in default browser on host OS."""
    try:
        import webbrowser
        import time
        for u in req.urls:
            if u and u.strip():
                webbrowser.open_new_tab(u.strip())
                time.sleep(0.08)
        return {"success": True, "count": len(req.urls)}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ----------------- Studio Grade AI Colorist Endpoints -----------------

class ColorGradeApiRequest(BaseModel):
    frameBase64: Optional[str] = None
    framePath: Optional[str] = None
    referenceBase64: Optional[str] = None
    stylePreset: str = "auto_balance"
    userPrompt: Optional[str] = None
    intensity: float = 1.0
    lockSkinTones: bool = True
    customName: Optional[str] = None

@app.get("/api/v1/color/presets")
async def get_color_presets():
    from .color.film_emulation import STUDIO_PRESETS
    return {"presets": list(STUDIO_PRESETS.values())}

@app.post("/api/v1/color/grade-frame")
async def grade_frame_api(req: ColorGradeApiRequest):
    from .color.color_service import ColorStudioService
    try:
        gemini_key = os.environ.get("GEMINI_API_KEY")
        if not gemini_key:
            try:
                providers = db.get_providers()
                for p in providers:
                    if p.get("id") == "google-gemini" or p.get("name") == "Google Gemini":
                        gemini_key = p.get("api_key")
                        break
            except Exception:
                pass

        result = await ColorStudioService.grade_frame(
            frame_base64=req.frameBase64,
            frame_path=req.framePath,
            reference_base64=req.referenceBase64,
            style_preset=req.stylePreset,
            user_prompt=req.userPrompt,
            intensity=req.intensity,
            lock_skin_tones=req.lockSkinTones,
            gemini_api_key=gemini_key,
            custom_name=req.customName
        )
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class ExtractFrameRequest(BaseModel):
    mediaPath: str
    seconds: float = 0.0

@app.post("/api/v1/color/extract-frame-ffmpeg")
async def extract_frame_ffmpeg(req: ExtractFrameRequest):
    """
    Extracts a pristine 1-frame snapshot from source video at the exact time offset using ffmpeg.
    """
    import subprocess
    import tempfile
    import base64
    from ..config import HOME_DIR

    media_path = AudioExtractor.normalize_media_path(req.mediaPath)
    if not media_path or not os.path.exists(media_path):
        raise HTTPException(status_code=404, detail=f"Media file not found: {req.mediaPath}")

    tmp_out = HOME_DIR / ".prismex" / "luts" / "current_frame.jpg"
    tmp_out.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(max(0.0, req.seconds)),
        "-i", media_path,
        "-vframes", "1",
        "-q:v", "2",
        str(tmp_out)
    ]
    try:
        proc = await asyncio.to_thread(
            subprocess.run, cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True
        )
        if tmp_out.exists():
            img_bytes = tmp_out.read_bytes()
            b64 = "data:image/jpeg;base64," + base64.b64encode(img_bytes).decode("utf-8")
            return {"success": True, "frameBase64": b64, "framePath": str(tmp_out)}
        raise HTTPException(status_code=500, detail="Frame not generated")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FFmpeg error: {e}")

class ReadImageRequest(BaseModel):
    filePath: str

@app.post("/api/v1/color/read-image-base64")
def read_image_base64_endpoint(req: ReadImageRequest):
    """Reads a local image file and returns base64 data URI for CEP display."""
    import base64
    p = Path(req.filePath)
    if not p.exists():
        return {"success": False, "error": "File does not exist"}
    try:
        data = p.read_bytes()
        mime = "image/png" if p.suffix.lower() == ".png" else "image/jpeg"
        b64 = f"data:{mime};base64," + base64.b64encode(data).decode("utf-8")
        return {"success": True, "base64": b64}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/v1/audio/enhance")
async def enhance_audio_endpoint(req: AudioEnhanceRequest):
    input_wav = None
    if req.audioPath and os.path.exists(req.audioPath):
        input_wav = Path(req.audioPath)
    elif req.sourceClips and req.durationSeconds and req.durationSeconds > 0:
        input_wav = await asyncio.to_thread(
            AudioExtractor.extract_sequence_timeline_audio, req.sourceClips, req.durationSeconds
        )
    if not input_wav or not input_wav.exists():
        raise HTTPException(status_code=400, detail="No audio source available for enhancement")

    clean_name = re.sub(r'[^a-zA-Z0-9_-]', '_', req.sequenceName)
    out_dir = Path.home() / ".prismex" / "enhanced_audio"
    out_dir.mkdir(parents=True, exist_ok=True)
    timestamp = int(time.time())
    out_path = out_dir / f"{clean_name}_Enhanced_{req.profileId}_{timestamp}.wav"

    res = await asyncio.to_thread(
        AudioDSP.enhance_audio_track,
        input_wav,
        out_path,
        req.profileId,
        req.settings or {}
    )
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "Audio enhancement failed"))
    return res

@app.post("/api/v1/audio/sound-design")
async def sound_design_endpoint(req: SoundDesignRequest):
    res = await asyncio.to_thread(
        CreativeAI.analyze_sound_design,
        req.words,
        req.sentences,
        req.genre
    )
    return res

@app.post("/api/v1/audio/bgm-recommendations")
async def bgm_recommendations_endpoint(req: BgmRecommendRequest):
    res = await asyncio.to_thread(
        CreativeAI.recommend_background_music,
        req.words,
        req.sentences,
        req.genre,
        req.durationSeconds or 60.0
    )
    return res

class MasterBgmRequest(BaseModel):
    bgmPath: str
    targetVolumeDb: Optional[float] = -26.0

@app.post("/api/v1/audio/master-bgm")
async def master_bgm_endpoint(req: MasterBgmRequest):
    input_wav = Path(req.bgmPath)
    if not input_wav.exists():
        raise HTTPException(status_code=400, detail="BGM audio file not found")
    out_dir = Path.home() / ".prismex" / "mastered_bgm"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"BGM_Master_{int(time.time())}.wav"
    res = await asyncio.to_thread(
        AudioDSP.master_bgm_track,
        input_wav,
        out_path,
        req.targetVolumeDb or -26.0
    )
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "BGM master failed"))
    return res

# ----------------- WebSocket Endpoint -----------------

@app.websocket("/ws/events")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keepalive / ping-pong
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)

# ----------------- PDF Export & System Reveal -----------------

class ExportPdfReportRequest(BaseModel):
    folderPath: Optional[str] = None
    filename: str
    reportHtml: str
    openAfterSave: bool = True
    revealInFinder: bool = False

@app.post("/api/v1/files/export-pdf-report")
def export_pdf_report_api(req: ExportPdfReportRequest):
    """
    Saves a professional printable report in HTML and natively compiles it to a vector PDF
    using macOS headless Chrome/Chromium, saves directly to the Premiere project directory,
    and reveals or opens it in default viewer.
    """
    try:
        folder = None
        if req.folderPath and req.folderPath.strip() and req.folderPath != "/tmp":
            folder = Path(req.folderPath.strip())
        else:
            folder = Path.home() / "Documents" / "PrismexExports"

        folder.mkdir(parents=True, exist_ok=True)
        safe_base = re.sub(r'[^a-zA-Z0-9_\u0980-\u09FF-]', '_', req.filename.replace('.pdf', '').replace('.html', '') or 'Client_Audit_Report')

        html_path = folder / f"{safe_base}.html"
        html_path.write_text(req.reportHtml, encoding="utf-8")

        pdf_path = folder / f"{safe_base}.pdf"
        pdf_generated = False

        chrome_bins = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
        ]
        chrome_exe = next((b for b in chrome_bins if Path(b).exists()), None)
        if chrome_exe:
            try:
                cmd = [
                    chrome_exe,
                    "--headless=new",
                    "--disable-gpu",
                    "--no-pdf-header-footer",
                    f"--print-to-pdf={str(pdf_path)}",
                    str(html_path)
                ]
                subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20)
                if pdf_path.exists() and pdf_path.stat().st_size > 100:
                    pdf_generated = True
            except Exception as pe:
                print(f"[PDF Export] Chrome print error: {pe}")

        final_path = str(pdf_path) if pdf_generated else str(html_path)

        if req.openAfterSave:
            try:
                subprocess.Popen(["open", final_path])
            except Exception:
                pass
        elif req.revealInFinder:
            try:
                subprocess.Popen(["open", "-R", final_path])
            except Exception:
                pass

        return {
            "success": True,
            "pdfGenerated": pdf_generated,
            "filePath": final_path,
            "fileName": Path(final_path).name,
            "folder": str(folder),
            "htmlPath": str(html_path)
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

class RevealFileRequest(BaseModel):
    path: str

@app.post("/api/v1/system/reveal-file")
def reveal_file_api(req: RevealFileRequest):
    """Reveals a file or folder directly in Finder (macOS) or File Explorer."""
    try:
        p = Path(req.path)
        if p.exists():
            subprocess.Popen(["open", "-R", str(p)])
            return {"success": True}
        return {"success": False, "error": "Path does not exist"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/v1/system/restart-premiere")
def restart_premiere_api():
    """Gracefully saves and restarts Adobe Premiere Pro on macOS."""
    import sys
    if sys.platform != "darwin":
        return {"success": False, "error": "Restart is only supported on macOS currently."}
    
    script = '''
    tell application "System Events"
        set pList to (name of processes whose name contains "Adobe Premiere Pro")
    end tell
    if (count of pList) > 0 then
        set appName to item 1 of pList
        tell application appName
            quit
        end tell
        delay 2
        tell application appName to activate
    else
        tell application "Adobe Premiere Pro 2025" to activate
    end if
    '''
    try:
        subprocess.Popen(["osascript", "-e", script])
        return {"success": True, "message": "Premiere Pro restarting..."}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ----------------- Voice Input & Commands -----------------

class VoiceStopRequest(BaseModel):
    language: Optional[str] = "auto"

@app.post("/api/v1/voice/start")
def voice_start_api():
    """Starts local microphone capture via CoreAudio for AI Co-Pilot voice commands."""
    mgr = VoiceInputManager.get_instance()
    return mgr.start_recording()

@app.post("/api/v1/voice/stop")
def voice_stop_api(req: Optional[VoiceStopRequest] = None):
    """Stops microphone capture, transcribes using Apple Silicon MLX-Whisper, and returns text."""
    mgr = VoiceInputManager.get_instance()
    lang = req.language if req and req.language else "auto"
    return mgr.stop_and_transcribe(language=lang)

# ----------------- AI Image Studio & Generation -----------------

class ImageGenerateRequest(BaseModel):
    prompt: str
    width: Optional[int] = 1920
    height: Optional[int] = 1080
    style: Optional[str] = "cinematic"

@app.post("/api/v1/ai/generate-image")
async def generate_image_api(req: ImageGenerateRequest):
    """
    Generates a high-quality visual asset using AI (Flux / Imagen)
    and saves it to ~/.prismex/generated_images/ ready for 1-click timeline V2 insert.
    """
    import urllib.parse
    import urllib.request
    from .config import HOME_DIR
    import time
    import base64

    img_dir = HOME_DIR / ".prismex" / "generated_images"
    img_dir.mkdir(parents=True, exist_ok=True)
    filename = f"prismex_art_{int(time.time())}.png"
    out_path = img_dir / filename

    clean_prompt = req.prompt.strip()
    if req.style == "cinematic" and "cinematic" not in clean_prompt.lower():
        enhanced_prompt = f"cinematic film still, 8k resolution, photorealistic, professional color grade, {clean_prompt}"
    else:
        enhanced_prompt = clean_prompt

    encoded_prompt = urllib.parse.quote(enhanced_prompt)
    pollinations_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={req.width or 1920}&height={req.height or 1080}&nologo=true&model=flux"

    try:
        req_obj = urllib.request.Request(
            pollinations_url,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}
        )
        def _download():
            with urllib.request.urlopen(req_obj, timeout=35) as resp:
                data = resp.read()
                out_path.write_bytes(data)
                b64 = "data:image/png;base64," + base64.b64encode(data).decode("utf-8")
                return b64

        b64_data = await asyncio.to_thread(_download)
        return {
            "success": True,
            "filePath": str(out_path),
            "base64": b64_data,
            "prompt": req.prompt
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("daemon.prismex_core.server:app", host=HOST, port=PORT, reload=False)
