# 07 — Task-Based AI Router Specification

## 1. Architectural Purpose & Overview

Different video editing tasks require radically different machine learning capabilities:

| Task | Required ML / Algorithmic Capability | Unsuitable Providers | Ideal Providers |
|---|---|---|---|
| **Transcription (STT)** | Acoustic speech recognition & token decoding | Text-only LLMs (Llama 3, Cerebras) | `mlx-whisper`, Groq Whisper-v3 |
| **Word Alignment** | Phoneme acoustic matching / CTC decoding | High-level generative LLMs | Wav2Vec2 CTC, Whisper DTW |
| **Silence Detection** | High-resolution voice activity / energy analysis | Generative text/audio models | Silero VAD v5, NumPy RMS |
| **Repeated Take Grouping** | Lexical similarity / token distance | Speech recognition models | Levenshtein, MiniLM Embeddings |
| **Best-Take Selection** | Contextual reasoning & speech fluency analysis | Pure acoustic aligners | Groq Llama 3.3, Gemini Flash |
| **Filler Context Check** | Semantic grammar & conversational coherence | Signal DSP engines | Gemini Flash, Cerebras Llama 3.1 |

The **Task-Based AI Router** acts as an intelligent traffic controller. It inspects incoming task requirements, evaluates provider availability and latency, enforces the Free-Only budget guard, and dispatches the job to the optimal engine.

---

## 2. Provider Capability Registry

The registry is an in-memory configuration in the Local Core Daemon mapping capabilities to candidate providers:

```typescript
export enum TaskCapability {
  SPEECH_TO_TEXT = "SPEECH_TO_TEXT",
  WORD_ALIGNMENT = "WORD_ALIGNMENT",
  VOICE_ACTIVITY_DETECTION = "VOICE_ACTIVITY_DETECTION",
  TEXT_SIMILARITY = "TEXT_SIMILARITY",
  FLUENCY_REASONING = "FLUENCY_REASONING",
  GRAMMATICAL_EVALUATION = "GRAMMATICAL_EVALUATION"
}

export interface ProviderCapabilityRecord {
  providerId: string;
  modelId: string;
  isLocal: boolean;
  isFreeTier: boolean;
  capabilities: TaskCapability[];
  priority: number; // 1 = highest priority
  maxRpm: number;
  circuitBreakerCooldownSeconds: number;
}
```

### Registered Provider Capabilities
```json
[
  {
    "providerId": "local-mlx",
    "modelId": "mlx-community/whisper-large-v3-turbo-4bit",
    "isLocal": true,
    "isFreeTier": true,
    "capabilities": ["SPEECH_TO_TEXT", "WORD_ALIGNMENT"],
    "priority": 2,
    "maxRpm": 999999
  },
  {
    "providerId": "groq-cloud",
    "modelId": "whisper-large-v3-turbo",
    "isLocal": false,
    "isFreeTier": true,
    "capabilities": ["SPEECH_TO_TEXT", "WORD_ALIGNMENT"],
    "priority": 1,
    "maxRpm": 20
  },
  {
    "providerId": "local-silero",
    "modelId": "silero-vad-v5",
    "isLocal": true,
    "isFreeTier": true,
    "capabilities": ["VOICE_ACTIVITY_DETECTION"],
    "priority": 1,
    "maxRpm": 999999
  },
  {
    "providerId": "gemini-cloud",
    "modelId": "gemini-1.5-flash",
    "isLocal": false,
    "isFreeTier": true,
    "capabilities": ["FLUENCY_REASONING", "GRAMMATICAL_EVALUATION"],
    "priority": 1,
    "maxRpm": 15
  },
  {
    "providerId": "groq-cloud-llama",
    "modelId": "llama-3.3-70b-versatile",
    "isLocal": false,
    "isFreeTier": true,
    "capabilities": ["FLUENCY_REASONING", "GRAMMATICAL_EVALUATION"],
    "priority": 2,
    "maxRpm": 30
  }
]
```

---

## 3. The Routing Algorithm

```
                             [ Task Request Received ]
                                         │
                                         ▼
                     Extract Required Capability (e.g., SPEECH_TO_TEXT)
                                         │
                                         ▼
                   Filter Providers Supporting Capability from Registry
                                         │
                                         ▼
                     Apply User Constraints:
                     - Is Local-Only Mode Active?
                     - Is Free-Only Guard Active?
                                         │
                                         ▼
                     Filter Out Unhealthy / Circuit-Broken Providers
                                         │
                                         ▼
                     Sort Remaining Eligible Engines by Priority:
                     1. Fast Free Cloud (if allowed and within rate limits)
                     2. Local Apple Silicon Engine (MLX / Silero / Heuristic)
                                         │
                                         ▼
                     Attempt Dispatch to Primary Engine
                                         │
                     ┌───────────────────┴───────────────────┐
                     │ SUCCESS                               │ FAILURE (429, 500, Timeout)
                     ▼                                       ▼
            Return Task Result                    Trigger Circuit Breaker
            Record Token / Latency Metrics        Cascade to Next Eligible Engine
                                                             │
                                                             ▼
                                                  Did All Cloud Engines Fail?
                                                             │
                                                  ┌──────────┴──────────┐
                                                  │ YES                 │ NO
                                                  ▼                     ▼
                                          [Route to Local Fallback]   [Retry]
```

---

## 4. Circuit Breaker & Fallback Cascades

To prevent user workflows from freezing when external APIs experience outages or rate limits, the router implements an automated **Three-State Circuit Breaker**:

```
          [ Closed: Normal Operation ]
                       │
             3 Consecutive Errors (429 / 5xx)
                       │
                       ▼
          [ Open: Temporarily Tripped ] ───> Route all traffic to Local Fallback
                       │
             Cooldown Timer Expires (60s)
                       │
                       ▼
          [ Half-Open: Probe Request ]
                       │
             ┌─────────┴─────────┐
             │ SUCCESS           │ FAILURE
             ▼                   ▼
       [ Re-Close ]        [ Re-Open for 120s ]
```

### Concrete Fallback Cascade Matrix:
1. **Transcription (STT)**:
   - Primary: `groq-cloud` (`whisper-large-v3-turbo`)
   - Fallback 1: `local-mlx` (`mlx-whisper-large-v3-turbo-4bit`)
   - Fallback 2: `local-cpu` (`faster-whisper-small.en` via CTranslate2)
2. **Best-Take Selection**:
   - Primary: `groq-cloud-llama` (`llama-3.3-70b-versatile`)
   - Fallback 1: `gemini-cloud` (`gemini-1.5-flash`)
   - Fallback 2: `cerebras-cloud` (`llama-3.1-70b`)
   - Fallback 3: **Deterministic Heuristic** (Automatic fallback to Last-Take Mode; requires 0 AI calls).

---

## 5. Zero-Cloud Local-Only Mode Enforcement

When the user activates **Local-Only Mode** in settings:
1. The router immediately purges all external network endpoints from the active routing table.
2. The HTTP client socket adapter rejects outgoing requests outside `127.0.0.1`.
3. All operations (VAD, transcription, forced alignment, repeated-take matching) execute strictly within macOS local memory.
4. Total privacy is mathematically guaranteed: zero bytes leave the physical machine.
