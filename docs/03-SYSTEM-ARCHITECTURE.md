# 03 — System Architecture & Component Specification

## 1. High-Level Architectural Model

Prismex AI Editor utilizes a decoupled, resilient **Hybrid Host-Companion Architecture**:

1. **Premiere Pro Host Layer (UXP Plugin)**: A lightweight, responsive UI panel running inside Adobe Premiere Pro's V8 JavaScript environment. It owns DOM interaction, timeline inspection, user input, and sequence manipulation via `@adobe/premierepro`.
2. **Local Processing Core (Companion Daemon)**: A high-performance Python 3.11 / native ARM64 background service running as a daemon on macOS. It owns heavy compute: audio extraction, AI model execution, signal processing, database persistence, and external cloud communication.
3. **External AI Provider Ecosystem**: Remote LLM and speech endpoints (Google Gemini, Groq, Cerebras) accessed securely over TLS using user-provided API keys.

```
+-----------------------------------------------------------------------------------+
|                            Adobe Premiere Pro Host                                |
|  +-----------------------------------------------------------------------------+  |
|  |                 Prismex UXP Plugin Panel (React 18 / Zustand)               |  |
|  |  [Dashboard] [Magic Rough Cut] [Transcript Editor] [Review Queue] [Settings] |  |
|  +---------------------------------------+-------------------------------------+  |
|                                          |                                        |
|                          UXP Host Bridge | SequenceEditor / TickTime              |
|                                          v                                        |
|                       +--------------------------------------+                    |
|                       |  Premiere Pro Native C++ Core Engine |                    |
|                       +--------------------------------------+                    |
+------------------------------------------+----------------------------------------+
                                           |
                                           | Bi-directional IPC (JSON-RPC 2.0)
                                           | WebSocket / HTTP: 127.0.0.1:49152
                                           v
+-----------------------------------------------------------------------------------+
|               Prismex Local Core Companion Daemon (macOS Apple Silicon)           |
|                                                                                   |
|  +-----------------------+ +-------------------------+ +-----------------------+  |
|  | FastAPI Gateway & WS  | |  Async Job Orchestrator | | SQLite Store (WAL)    |  |
|  +-----------------------+ +-------------------------+ +-----------------------+  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                     Audio Extraction & Signal Pipeline                      |  |
|  |       [FFmpeg ARM64 Neon] ---> [Silero VAD v5] ---> [Adaptive RMS DSP]      |  |
|  +-----------------------------------------------------------------------------+  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                Local Intelligence & Transcription Pipeline                  |  |
|  |      [MLX-Whisper GPU/ANE] ---> [Wav2Vec2 Forced Aligner] ---> [Take Match] |  |
|  +-----------------------------------------------------------------------------+  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                     AI Provider Router & Free-Only Guard                    |  |
|  |           [Capability Matcher] ---> [Spend Guard] ---> [Keychain Vault]     |  |
|  +---------------------------------------+-------------------------------------+  |
+------------------------------------------+----------------------------------------+
                                           |
                                           | HTTPS / TLS 1.3 (Opt-in User Keys)
                                           v
+-----------------------------------------------------------------------------------+
|                            External Cloud AI Providers                            |
|             [Google Gemini Flash]  |  [Groq Whisper / Llama]  |  [Cerebras]       |
+-----------------------------------------------------------------------------------+
```

---

## 2. Component Breakdown & Responsibilities

### Component A: Premiere Pro Plugin UI (UXP Panel)
- **Framework**: React 18, TypeScript, Tailwind CSS, Adobe Spectrum Web Components.
- **Location**: Installed in `~/Library/Application Support/Adobe/UXP/Extensions/com.prismex.editor/`.
- **Key Responsibilities**:
  - Render all 10 plugin views (Dashboard, Magic Cut, Transcript, Review Queue, etc.).
  - Query Premiere Pro active sequence metadata (framerate, duration, tracks, clips).
  - Convert transcript click events into timeline playhead scrub actions (`sequence.setPlayerPosition`).
  - Send sequence manifests and cut execution plans to the local companion daemon.
  - Execute approved cut lists on the timeline using `ppro.SequenceEditor`.
  - Maintain client-side cache and UI state using Zustand.

### Component B: Local Processing Core Daemon
- **Runtime**: Python 3.11 ARM64 virtual environment packaged as a standalone macOS Application / Helper (`PrismexService.app`).
- **Location**: Installed in `~/Library/Application Support/Prismex/bin/`.
- **Key Responsibilities**:
  - Expose REST endpoints and a real-time WebSocket connection on `http://127.0.0.1:49152`.
  - Manage async job priority queues for audio extraction, transcription, and take analysis.
  - Isolate memory-heavy ML models; dynamically load and evict models to respect the 2.5 GB RAM budget.
  - Coordinate the signal processing pipeline (FFmpeg, Silero VAD, MLX-Whisper, Wav2Vec2).
  - Execute take similarity matching, filler-word classification, and cut plan optimization.
  - Persist all project, sequence, transcript, and cut data in embedded SQLite (`prismex_project.db`).

### Component C: AI Provider Manager & Router
- **Key Responsibilities**:
  - Securely store and retrieve API keys from the macOS Keychain (`security` CLI / Python `keyring`).
  - Maintain the Provider Capability Registry (matching tasks to qualified engines).
  - Enforce the **Free-Only Guard**: block paid endpoints unless explicitly unlocked with a user-configured budget.
  - Monitor rate limits, error rates, and latency; trigger automated fallbacks to local engines when cloud endpoints degrade.

### Component D: Timeline Editing Engine
- **Key Responsibilities**:
  - Translate high-level cut suggestions into an atomic, frame-accurate Cut Decision List.
  - Convert seconds to sequence frame numbers and microsecond `TickTime` values (`1 second = 254,016,000,000 ticks`).
  - Sort cuts in reverse chronological order to prevent ripple deletion coordinate drift.
  - Protect user-designated tracks (music, sound effects, B-roll, adjustment layers).
  - Verify sequence duration and track alignment before and after edit execution.

### Component E: Project Data Layer
- **Storage**: Embedded SQLite 3 database operating in WAL (Write-Ahead Logging) mode.
- **Location**: `~/Library/Application Support/Prismex/projects/[ProjectUUID]/prismex.db`.
- **Key Responsibilities**:
  - Store sequences, raw audio manifests, verbatim transcripts, and word-level timestamps.
  - Record full review history (accepted, rejected, edited suggestions).
  - Maintain editing profiles and provider usage logs.

---

## 3. Inter-Process Communication (IPC) Protocol

The UXP panel and the local companion daemon communicate over the loopback interface (`127.0.0.1:49152`):

1. **Control Channel (HTTP REST)**:
   - Used for unary commands: health checks, configuration updates, provider management, and job creation.
   - Example: `POST /api/v1/jobs/magic-rough-cut`
2. **Streaming Event Channel (WebSocket)**:
   - Used for real-time progress updates, task logs, wave analysis telemetry, and job completion notifications.
   - Endpoint: `ws://127.0.0.1:49152/ws/events`
   - Payload format: JSON-RPC 2.0 compliant event objects.

### WebSocket Event Protocol Example
```json
{
  "jsonrpc": "2.0",
  "method": "job.progress",
  "params": {
    "jobId": "job_01h9x8y7z6",
    "stage": "TRANSCRIPTION",
    "percentComplete": 42.5,
    "elapsedSeconds": 14.2,
    "currentTask": "Transcribing chunk 3 of 7 (mlx-whisper-turbo)",
    "memoryUsageMB": 1420
  }
}
```

---

## 4. Process Lifecycle & Daemon Management

```
[System Boot or Plugin Launch]
       │
       ▼
Check Daemon Health: GET http://127.0.0.1:49152/health
       │
       ├───> [HTTP 200 OK] ───> Connect WebSocket ───> Ready
       │
       └───> [Connection Refused / Not Running]
                 │
                 ▼
             Spawn Daemon via macOS launchd or Background Process:
             ~/Library/Application Support/Prismex/bin/prismex-daemon
                 │
                 ▼
             Poll /health with exponential backoff (max 5s)
                 │
                 ├───> [Success] ───> Connect WebSocket ───> Ready
                 └───> [Timeout] ───> Display User Alert: "Companion service failed to start"
```

1. **Daemon Startup**: Managed via a user-level `launchd` agent (`~/Library/LaunchAgents/com.prismex.daemon.plist`). If the agent is not registered, the UXP panel triggers an automated spawn command via a local helper script.
2. **Heartbeat & Keepalive**: The UXP panel sends a WebSocket ping every 15 seconds. If connection drops, the panel displays a non-blocking reconnecting banner and attempts reconnection.
3. **Graceful Shutdown**: The daemon listens for `SIGTERM` and `SIGINT`, commits pending SQLite transactions, shreds temporary audio files, and terminates cleanly.
