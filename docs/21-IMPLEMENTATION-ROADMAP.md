# 21 — Implementation Roadmap (Phases 0 – 11)

## 1. Phased Delivery Overview

The implementation roadmap is structured into 12 engineering phases. Each phase establishes a verifiable capability and serves as a strict dependency for subsequent phases.

```
[Phase 0: Feasibility & Spike] ──> [Phase 1: Foundation & IPC] ──> [Phase 2: Local Transcription]
                                                                                │
[Phase 5: Timeline Engine] <── [Phase 4: Silence Detection] <── [Phase 3: Transcript UI]
            │
            ▼
[Phase 6: Magic Rough Cut] ──> [Phase 7: Review Queue] ──> [Phase 8: AI Router & Cloud]
                                                                        │
[Phase 11: Packaging & Release] <── [Phase 10: Fillers & Stutters] <── [Phase 9: Repeated Takes]
```

---

## 2. Phase-by-Phase Detailed Specifications

### Phase 0: Technical Feasibility & API Validation Spike
- **Objectives**: Validate Adobe Premiere Pro UXP `SequenceEditor` capabilities and measure local Apple Silicon FFmpeg extraction throughput.
- **Dependencies**: Adobe UXP Developer Tool (UDT), Premiere Pro v24.x/v25.x, macOS Apple Silicon workstation.
- **Deliverables**:
  - Standalone prototype UXP panel verifying `createCloneAction()` and `createRemoveItemsAction()`.
  - Python benchmark measuring ARM64 FFmpeg audio extraction latency on 4K ProRes and H.264 files.
- **Risks**: UXP `SequenceEditor` nuances across minor Premiere releases.
- **Acceptance Criteria**: Cloned sequence created and 10 test ripple cuts executed without crash or desync.
- **Complexity**: Medium | **Duration Estimate**: 1 Sprint

### Phase 1: Plugin Foundation & Local Companion Service
- **Objectives**: Establish the host-daemon communication bridge and database persistence layer.
- **Dependencies**: Phase 0.
- **Deliverables**:
  - React 18 / TypeScript UXP panel shell styled with Adobe Spectrum CSS variables.
  - FastAPI daemon listening on `127.0.0.1:49152` with bidirectional WebSocket connection.
  - SQLite database (`prismex_project.db`) with WAL mode and initial DDL migrations.
- **Risks**: macOS loopback permission blocks in `manifest.json`.
- **Acceptance Criteria**: WebSocket ping-pong round-trip < 5ms; sequence metadata stored in SQLite.
- **Complexity**: Medium | **Duration Estimate**: 1 Sprint

### Phase 2: Local Transcription & Word-Level Alignment
- **Objectives**: Implement offline speech-to-text and microsecond-precision forced alignment.
- **Dependencies**: Phase 1.
- **Deliverables**:
  - `mlx-whisper` integration utilizing Apple Silicon GPU/ANE acceleration.
  - Wav2Vec2 CTC forced alignment pipeline converting audio and text into `TranscriptWord[]`.
  - Sequential model eviction and garbage collection to stay within RAM budget.
- **Risks**: First-time model download bandwidth and caching.
- **Acceptance Criteria**: 8-minute audio transcribed and aligned in < 35 seconds with word boundary error < 15ms.
- **Complexity**: High | **Duration Estimate**: 2 Sprints

### Phase 3: Transcript Editor & Timeline Navigation
- **Objectives**: Build text-based timeline navigation inside the Premiere Pro panel.
- **Dependencies**: Phase 2.
- **Deliverables**:
  - Interactive transcript viewer with search, selection, and paragraph grouping.
  - Timeline scrubbing: Clicking a word sets Premiere playhead (`TickTime`) to the exact audio onset.
  - Real-time karaoke-style word highlighting following playback.
- **Risks**: Playhead polling overhead during high-speed playback.
- **Acceptance Criteria**: Playhead updates within 50ms of word click; zero lag during timeline playback.
- **Complexity**: Medium | **Duration Estimate**: 1 Sprint

### Phase 4: Rule-Based Silence Detection
- **Objectives**: Implement offline, zero-AI silence detection using DSP and neural VAD.
- **Dependencies**: Phase 1, Phase 2.
- **Deliverables**:
  - Sliding-window RMS energy analyzer with adaptive noise floor calibration.
  - Silero VAD v5 ONNX integration.
  - Pre-roll (80ms) and post-roll (120ms) safety padding logic.
- **Risks**: False positives on quiet vocal whispers.
- **Acceptance Criteria**: >98% recall on pauses >500ms; natural breathing protected.
- **Complexity**: Medium | **Duration Estimate**: 1 Sprint

### Phase 5: Timeline Editing Engine
- **Objectives**: Build the physical timeline cutting engine supporting reverse ripple deletion.
- **Dependencies**: Phase 0, Phase 4.
- **Deliverables**:
  - Reverse chronological ripple deletion engine (`executeReverseRippleEdits`).
  - Linked audio/video item selection discovery to preserve sync.
  - Protected track enforcement (locked tracks, music, adjustment layers).
  - Atomic undo/redo wrapper (`beginUndoGroup`).
- **Risks**: Accidental audio/video drift.
- **Acceptance Criteria**: Pass Synthetic Flash/Beep Benchmark with 0 frame drift across 50 cuts.
- **Complexity**: High | **Duration Estimate**: 2 Sprints

### Phase 6: Magic Rough Cut (Core Feature - Mode A)
- **Objectives**: Deliver the 1-click automatic rough cut pipeline.
- **Dependencies**: Phases 1 through 5.
- **Deliverables**:
  - Master 14-step pipeline orchestrator in companion daemon.
  - Automatic sequence cloning (`[Original]_PrismexRoughCut`).
  - Cut Decision Harmonizer resolving overlapping cut boundaries.
  - Rough Cut Summary Report UI.
- **Risks**: Pipeline stalling on long sequences (>60 minutes).
- **Acceptance Criteria**: 1-click execution produces a tight rough cut on a cloned sequence in <60 seconds.
- **Complexity**: Very High | **Duration Estimate**: 2 Sprints

### Phase 7: Review Queue (Core Feature - Mode B)
- **Objectives**: Deliver the human-in-the-loop review cockpit.
- **Dependencies**: Phase 6.
- **Deliverables**:
  - Review Queue UI with category filtering (Silence, Takes, Fillers).
  - Pre-roll/post-roll audition audio player with waveform visualizer.
  - Keyboard shortcut navigation (`J-K-L`, `Y`, `N`, `P`, `Cmd+Enter`).
  - Batch approval filters and one-click apply.
- **Risks**: UI responsiveness when managing 250+ review cards.
- **Acceptance Criteria**: Audition playback starts <100ms; approved batch applies to timeline cleanly.
- **Complexity**: High | **Duration Estimate**: 2 Sprints

### Phase 8: AI Provider Manager & Task Router
- **Objectives**: Integrate external free-tier cloud AI providers with strict spend protection.
- **Dependencies**: Phase 1.
- **Deliverables**:
  - macOS Keychain credential vault (`KeychainVault`).
  - **Free-Only Guard** blocking paid models and uncertain billing tiers.
  - Groq Cloud (Whisper-v3, Llama 3.3) and Google Gemini Flash connectors.
  - Automatic circuit breaker cascading to local MLX engines on 429 rate limits.
- **Risks**: Upstream provider rate limit fluctuations.
- **Acceptance Criteria**: Free-only guard verified; rate-limited Groq call gracefully cascades to local MLX.
- **Complexity**: High | **Duration Estimate**: 1.5 Sprints

### Phase 9: Repeated Take Detection
- **Objectives**: Implement automated detection and pruning of video restarts.
- **Dependencies**: Phase 2, Phase 8.
- **Deliverables**:
  - Lexical and semantic clustering algorithm forming `TakeGroup` objects.
  - Last Take Mode (deterministic, 0 AI tokens).
  - Best Take Mode (LLM fluency scoring via Groq/Gemini).
  - Dedicated Repeated Takes inspection workspace.
- **Risks**: Over-aggressive clustering of intentional recurring rhetorical refrains.
- **Acceptance Criteria**: >90% precision in identifying multi-take restarts within a 90s window.
- **Complexity**: High | **Duration Estimate**: 1.5 Sprints

### Phase 10: Advanced AI Editing (Fillers & Stutters)
- **Objectives**: Excise conversational disfluencies with grammatical safety guards.
- **Dependencies**: Phase 2, Phase 8.
- **Deliverables**:
  - Multi-tier filler engine (vocalic dictionary, POS disambiguation for "like"/"so").
  - Acoustic phoneme stutter detection.
  - Contextual LLM safety filter preventing semantic corruption.
- **Risks**: Truncating grammatical verbs ("I like this").
- **Acceptance Criteria**: 0% false positive deletion on grammatical instances of "like" and "so".
- **Complexity**: Medium | **Duration Estimate**: 1 Sprint

### Phase 11: Optimization, Testing & Packaging
- **Objectives**: Harden performance, run memory leak tests, and package release bundles.
- **Dependencies**: All prior phases.
- **Deliverables**:
  - Memory ceiling verification: Instruments profiling confirming <2.5 GB RAM resident ceiling.
  - Signed and notarized `.ccx` UXP panel and `PrismexCore.app` daemon.
  - macOS universal installer pkg with launchd auto-start agent.
  - Complete user documentation and offline help guide.
- **Risks**: Apple Notarization service rejections.
- **Acceptance Criteria**: Clean installation on fresh macOS Sequoia machine; passes all test tiers.
- **Complexity**: Medium | **Duration Estimate**: 1.5 Sprints
