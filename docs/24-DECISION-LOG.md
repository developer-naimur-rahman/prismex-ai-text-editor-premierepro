# 24 — Architectural Decision Records (ADR Log)

This document formally records the architectural decisions, trade-offs, and design rationale governing **Prismex AI Editor**.

---

## ADR-01: UXP Architecture over Legacy CEP/ExtendScript
- **Status**: **ACCEPTED**
- **Context**: Adobe has historically used CEP (HTML/Node) combined with ExtendScript (`.jsx`) for Premiere Pro extensions. However, CEP is deprecated, synchronous, prone to freezing during playback, and being phased out in Premiere Pro v24+.
- **Decision**: Build exclusively on Adobe's **UXP (Unified Extensibility Platform)** targeting Premiere Pro v24.0+ and v25.0+.
- **Consequences**:
  - *Positive*: Direct modern V8 JavaScript engine, asynchronous native C++ bindings (`require("premierepro")`), superior UI performance, and active Adobe engineering support.
  - *Negative*: Older Premiere Pro versions (v23 and below) cannot run the plugin.

---

## ADR-02: Decoupled Local Companion Daemon over Pure In-Plugin Execution
- **Status**: **ACCEPTED**
- **Context**: While UXP can run JavaScript, running gigabyte-scale neural models (Whisper, Wav2Vec2, ONNX) inside Premiere Pro's main UI process leads to severe memory contention, playback stutter, and fatal host crashes.
- **Decision**: Decouple heavy compute into a standalone, local macOS background companion daemon (`PrismexCore`) communicating with UXP via WebSocket / REST on `127.0.0.1:49152`.
- **Consequences**:
  - *Positive*: Host isolation; memory ceilings can be enforced independently; daemon crash never brings down Premiere Pro; background jobs run smoothly while editor scrubs the timeline.
  - *Negative*: Requires packaging and installing a secondary local binary on macOS.

---

## ADR-03: MLX-Whisper on Apple Silicon over Standard PyTorch Whisper
- **Status**: **ACCEPTED**
- **Context**: Standard PyTorch Whisper implementations on macOS utilize MPS (Metal Performance Shaders) with high memory overhead and sluggish transcription speeds on unified memory.
- **Decision**: Adopt Apple Machine Learning Research's **`mlx-whisper`** with 4-bit quantization as the primary local transcription engine.
- **Consequences**:
  - *Positive*: Native Apple Silicon GPU/ANE acceleration; 20x–25x faster than real-time; memory consumption drops from 3.1 GB down to ~1.15 GB.
  - *Negative*: Hardware constraint: restricted exclusively to Apple Silicon (M1/M2/M3/M4) hardware.

---

## ADR-04: Wav2Vec2 CTC Forced Alignment over Whisper Cross-Attention DTW
- **Status**: **ACCEPTED**
- **Context**: Whisper's built-in word timestamps (derived from cross-attention weights and DTW) suffer from jitter of ±150ms–300ms, frequently cutting off leading plosive consonants (/p/, /t/, /k/).
- **Decision**: Implement a two-stage speech pipeline: Whisper generates text tokens; a dedicated **Wav2Vec2 CTC forced alignment model** establishes definitive microsecond word boundaries.
- **Consequences**:
  - *Positive*: Sub-frame temporal accuracy (<15ms error margin), eliminating clipped words and audio glitches.
  - *Negative*: Requires an additional 6–8 seconds of processing and sequential model loading.

---

## ADR-05: Non-Destructive Cloned Sequences over In-Place Editing
- **Status**: **ACCEPTED**
- **Context**: Applying dozens of automated cuts directly to an editor's active working sequence risks irreversible project damage if the editor dislikes the pacing.
- **Decision**: Original sequences are **never modified by default**. Magic Rough Cut automatically clones the sequence (`[Original]_PrismexRoughCut`) and applies edits exclusively to the duplicate.
- **Consequences**:
  - *Positive*: Absolute editor safety, zero risk of work loss, instant A/B timeline comparison.
  - *Negative*: Adds a duplicate sequence entry to the project bin.

---

## ADR-06: Reverse Chronological Ripple Deletion over Forward Deletion
- **Status**: **ACCEPTED**
- **Context**: Executing ripple deletions from left to right causes coordinate drift: every cut shifts subsequent timeline material, invalidating all downstream cut timestamps.
- **Decision**: All timeline slice and ripple delete operations are pre-sorted and executed strictly in **reverse chronological order (right-to-left)**.
- **Consequences**:
  - *Positive*: Timecodes earlier on the timeline remain 100% stable throughout the entire batch execution.
  - *Negative*: Requires complete pre-computation of all cut intervals prior to timeline manipulation.

---

## ADR-07: Embedded SQLite with WAL Mode over Flat JSON Files
- **Status**: **ACCEPTED**
- **Context**: Large projects generate hundreds of thousands of word timestamps, review items, and editing decisions. Flat JSON files suffer from slow deserialization, race conditions, and corruption during sudden power loss.
- **Decision**: Utilize embedded **SQLite 3** operating in **WAL (Write-Ahead Logging)** mode.
- **Consequences**:
  - *Positive*: ACID transactional safety, microsecond indexed queries, zero external database servers.
  - *Negative*: Requires managing database schema migrations.

---

## ADR-08: macOS Keychain Vault over File-Based API Key Storage
- **Status**: **ACCEPTED**
- **Context**: Storing API keys in `.env` files or JSON settings creates severe credential leakage vulnerabilities (accidental git commits, malware scanning).
- **Decision**: Store all external AI provider credentials directly in the **macOS Keychain** using the native `security` framework.
- **Consequences**:
  - *Positive*: Hardware-backed AES-256 encryption, protected by macOS user authentication, zero plain-text keys on disk.
  - *Negative*: Restricted strictly to macOS operating systems.

---

## ADR-09: Direct FFmpeg Audio Demuxing over Adobe Media Encoder Queues
- **Status**: **ACCEPTED**
- **Context**: Exporting sequence audio through Adobe Media Encoder (AME) is slow, frequently requiring 60–120 seconds to initialize AME in the background.
- **Decision**: For contiguous source clips, read file paths via UXP (`item.getMediaPath()`) and extract 16kHz mono WAV audio directly via native ARM64 FFmpeg.
- **Consequences**:
  - *Positive*: 120x real-time extraction speed (8 minutes of audio extracted in ~4 seconds).
  - *Negative*: Fallback to Premiere sequence mixdown is required for complex multi-layered audio sequences with native Premiere transitions.

---

## ADR-10: Strict Free-Only Cloud Guard with Zero Accidental Spend
- **Status**: **ACCEPTED**
- **Context**: Users are terrified of AI plugins incurring runaway API bills on cloud services.
- **Decision**: Implement an in-memory **Free-Only Guard** in the local daemon that blocks all non-free endpoints by default and requires explicit spend cap configuration to unlock.
- **Consequences**:
  - *Positive*: Total user trust; impossible to accidentally incur billing charges.
  - *Negative*: Blocks premium models (e.g., GPT-4o) unless the user deliberately configures a budget.
