# 19 — Error Handling & Fallback Cascades

## 1. Resilience Philosophy

Video editing is a high-stress, deadline-driven discipline. An unexpected crash, frozen modal, or silent data corruption destroys editor trust.

Prismex AI Editor enforces three foundational error principles:
1. **Never Silently Corrupt**: If an error occurs during timeline cutting, the operation halts immediately, the user is notified with clear diagnostics, and the sequence rolls back cleanly.
2. **Transparent Diagnostic Messaging**: Error messages must state: 1) What went wrong, 2) Why it occurred, and 3) The exact action required to resolve it (no cryptic `Error: -1` codes).
3. **Automated Degradation & Fallback**: Network failures or cloud rate limits never halt work; they trigger automatic fallbacks to local offline engines.

---

## 2. Failure Scenarios & Recovery Matrix

| # | Failure Scenario | Detection Mechanism | User-Facing Diagnostic Message | Automated Recovery & Fallback Action | Can Resume? |
|---|---|---|---|---|---|
| **1** | **No API Key Provided** | Provider validation during cloud request dispatch | *"No API key found for Groq. Add your free key in AI Providers, or switch to Local MLX Engine."* | Route immediately to Local `mlx-whisper` engine. Prompt user in Settings. | Yes |
| **2** | **Invalid API Key (401/403)** | HTTP response code from provider endpoint | *"Authentication failed with Google Gemini. Your API key appears invalid or expired. Check key in AI Providers."* | Flag provider as `AUTH_FAILED` in UI; cascade task to next eligible provider or local engine. | Yes |
| **3** | **Rate Limit Exceeded (429)** | HTTP 429 response or header `x-ratelimit-remaining: 0` | *"Groq free-tier rate limit reached (20 RPM). Automatically switching to Local MLX Engine to finish your cut."* | Trip provider circuit breaker for 60 seconds; cascade current task to `local-mlx`. | Yes |
| **4** | **Internet Disconnected** | Network unreachable / socket timeout | *"Internet connection lost. Prismex is now running in 100% Offline Local Mode."* | Seamlessly redirect all pending cloud tasks to local Apple Silicon models. | Yes |
| **5** | **Cloud Model 503 / Outage** | HTTP 500, 502, 503 from cloud API | *"Google Gemini service temporarily unavailable. Falling back to Groq Cloud."* | Retry once with exponential backoff (1.5s); if failure persists, route to secondary cloud or local. | Yes |
| **6** | **Local Model Download Interrupted** | Hash mismatch or truncated download stream | *"Model download interrupted. Please check disk space and click 'Resume Download'."* | Hugging Face Hub cache resumes downloading from last verified byte range using SHA-256 validation. | Yes |
| **7** | **Insufficient RAM (Memory Pressure)** | macOS `vm.page_free_target` or process memory > 2.4 GB | *"System memory pressure high. Prismex has unloaded non-essential models to protect Premiere Pro."* | Evict cached language models; garbage collect MLX Metal buffers; fallback to lightweight `small.en` int8. | Yes |
| **8** | **Transcription Noise / Garbled Speech** | Average word log-probability < -1.2 | *"Low audio intelligibility detected in segment 03:12 - 03:45. Speech may be muffled or obscured by music."* | Flag low-confidence segment in Review Queue; do not execute automatic cuts on ambiguous audio. | Yes |
| **9** | **Word Alignment Drift** | Cumulative phoneme deviation > 150ms | *"Audio alignment drift detected. Re-calibrating word boundaries with acoustic Viterbi aligner."* | Re-run Wav2Vec2 aligner with wider search window or snap boundaries to nearest Silero VAD speech onsets. | Yes |
| **10** | **Sequence Closed During Processing** | Premiere UXP `getActiveSequence()` returns null | *"Target sequence was closed in Premiere Pro. Re-open sequence '[Name]' to apply edits."* | Persist processed cut list in SQLite database; notify user with 'Apply to Reopened Sequence' button. | Yes |
| **11** | **Timeline Track Locked** | Premiere UXP `track.isLocked()` returns true | *"Track 'V2' is locked in Premiere Pro. Unlock the track or mark it as Protected in Prismex settings."* | Pause timeline edit execution; prompt editor to either unlock track or exclude it from ripple delete. | Yes |
| **12** | **A/V Sync Mismatch Detected** | Post-cut duration delta between V1 and A1 > 0 frames | *"Sync drift warning: Video and audio duration mismatch detected. Timeline edits rolled back safely."* | Trigger atomic rollback (`app.undo()`); report discrepancy with exact timeline timecode. | No (Safety Stop) |
| **13** | **Companion Daemon Crash** | UXP WebSocket connection dropped abruptly | *"Prismex companion service disconnected unexpectedly. Restarting background service..."* | UXP panel auto-spawns daemon via launchd; re-establishes WebSocket; restores state from SQLite database. | Yes |
| **14** | **FFmpeg Incompatible Media Codec** | FFmpeg returns non-zero exit code | *"Direct audio extraction failed for codec. Exporting audio mixdown via Premiere Pro engine..."* | Fallback automatically to secondary audio extraction path (`app.encoder.encodeSequence`). | Yes |
| **15** | **SQLite DB Corruption / Lock** | SQLite `SQLITE_CORRUPT` or `SQLITE_BUSY` | *"Project database locked. Re-indexing project store..."* | Force checkpoint WAL file; if corrupt, recreate database from sequence manifest cache. | Yes |
| **16** | **Free-Only Budget Cap Reached** | Spend calculator exceeds configured dollar limit | *"Configured monthly AI budget ($5.00) reached. Cloud calls paused. Local processing remains active."* | Block outgoing cloud requests; switch to 100% offline local processing. | Yes |

---

## 3. Rollback & Atomic Recovery Protocol

When executing timeline modifications inside Adobe Premiere Pro:

```typescript
export async function executeSafeTimelineTransaction(
  sequence: ppro.Sequence,
  operationName: string,
  actions: () => Promise<void>
): Promise<boolean> {
  const app = require("premierepro");
  await app.beginUndoGroup(operationName);

  try {
    await actions();
    
    // Post-execution sync verification
    const isSyncValid = await verifyTimelineSync(sequence);
    if (!isSyncValid) {
      throw new Error("Post-cut audio/video synchronization verification failed.");
    }

    await app.endUndoGroup();
    return true;
  } catch (error) {
    console.error(`[Prismex] Error in ${operationName}:`, error);
    
    // Roll back entire batch inside Premiere Pro
    await app.endUndoGroup();
    await app.undo();
    
    // Alert user
    showErrorDialog(`Transaction failed: ${error.message}. Timeline has been restored.`);
    return false;
  }
}
```
This guarantees that an unanticipated API failure during cut #47 out of #50 never leaves the editor's sequence in a broken, half-edited state.
