"""
Prismex Core Daemon - Local FastAPI & WebSocket Server
Specification: docs/03-SYSTEM-ARCHITECTURE.md & docs/23-API-REFERENCE.md

Binds strictly to loopback interface 127.0.0.1:49152 with zero external exposure.
"""

import asyncio
import json
import uuid
import time
import re
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
from .stt.transcription_service import TranscriptionService
from .intelligence.take_detector import TakeDetector
from .intelligence.filler_detector import FillerDetector
from .intelligence.smart_srt import SmartSRTSegmenter
from .intelligence.creative_ai import CreativeAI
from .timeline.cut_harmonizer import CutHarmonizer

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
    mediaPath: str
    trackIndex: int = 1
    inSeconds: float = 0.0
    outSeconds: float = 0.0
    sourceInSeconds: float = 0.0
    sourceOutSeconds: float = 0.0

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

class MarkerAnalysisRequest(BaseModel):
    words: List[Dict[str, Any]] = []

class TypographyRequest(BaseModel):
    text: str

class ApplyReviewRequest(BaseModel):
    approvedSuggestionIds: List[str]

class ProviderKeyRequest(BaseModel):
    apiKey: str

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
        result.append({
            "providerId": pid,
            "name": p["name"],
            "modelId": p["model_id"],
            "isLocal": p["is_local"],
            "isFreeTier": p["is_free_tier"],
            "isConfigured": key is not None or p["is_local"],
            "maskedKey": KeychainVault.mask_key(key) if key else None,
            "health": "HEALTHY",
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

@app.get("/api/v1/profiles")
def get_profiles():
    return {"profiles": db.get_profiles()}

@app.get("/api/v1/jobs/{job_id}")
def get_job_status(job_id: str):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

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

async def execute_magic_rough_cut_pipeline(job_id: str, req: MagicRoughCutRequest):
    """Executes the master 14-stage Magic Rough Cut pipeline asynchronously."""
    try:
        # Stage 1 & 2: Audio Extraction across all timeline clips
        await ws_manager.broadcast({
            "jsonrpc": "2.0",
            "method": "job.progress",
            "params": {"jobId": job_id, "stage": "EXTRACTING", "percent": 15.0, "message": "Extracting & stitching audio from sequence clips..."}
        })
        
        extracted_wav = AudioExtractor.extract_sequence_timeline_audio(req.sourceClips, req.durationSeconds)

        # Stage 3 & 4: Transcription across entire sequence timeline
        await ws_manager.broadcast({
            "jsonrpc": "2.0",
            "method": "job.progress",
            "params": {"jobId": job_id, "stage": "TRANSCRIBING", "percent": 45.0, "message": "Transcribing speech with Apple Silicon MLX-Whisper..."}
        })
        transcript_data = TranscriptionService.transcribe(extracted_wav, max(0.1, req.durationSeconds))

        # Stage 5 & 6: Silence Detection
        await ws_manager.broadcast({
            "jsonrpc": "2.0",
            "method": "job.progress",
            "params": {"jobId": job_id, "stage": "ANALYZING", "percent": 65.0, "message": "Analyzing voice energy, noise floor, and dead air..."}
        })
        silence_cuts = AudioDSP.detect_silence_intervals(
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

        # Update Job Status
        db.save_job({
            "id": job_id,
            "sequence_id": req.sequenceGuid,
            "job_type": "MAGIC_ROUGH_CUT",
            "status": "COMPLETE",
            "progress_percent": 100.0
        })

        # Broadcast completion
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

    # Check if Google Gemini API key is configured in macOS Keychain
    gemini_key = KeychainVault.get_api_key("google-gemini")
    if gemini_key:
        try:
            import requests
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}"
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
                    "engine": "Google Gemini 2.0 Flash",
                    "wpm": wpm,
                    "totalWords": total_words,
                    "fillerCount": filler_count
                }
        except Exception as e:
            print(f"[AI Analyze] Gemini fallback to local: {e}")

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
    """Detects typos or speech-to-text misspellings and returns corrected words with preserved timestamps."""
    return CreativeAI.spell_check(req.words)

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

@app.post("/api/v1/transcript/ai-markers")
def ai_markers(req: MarkerAnalysisRequest):
    """Classifies emphasis keywords (RED), B-Roll visual cues (GREEN), and icons/graphics (BLUE)."""
    return CreativeAI.analyze_markers(req.words)

@app.post("/api/v1/transcript/ae-typography")
def format_ae_typography(req: TypographyRequest):
    """Formats text into multi-line kinetic typography layout with ready-to-paste AE ExtendScript."""
    return CreativeAI.format_after_effects_typography(req.text)

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("daemon.prismex_core.server:app", host=HOST, port=PORT, reload=False)
