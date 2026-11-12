# 22 — Acceptance Criteria & Quality Gates

This specification defines the formal **Given-When-Then** acceptance criteria and measurable quality gates required for every production capability of Prismex AI Editor.

---

## 1. Magic Rough Cut — Core Scenarios

### Scenario 1.1: 1-Click Magic Auto Edit Execution
- **Given**: An active Premiere Pro sequence containing 15 minutes of unedited A-roll with natural pauses, 5 repeated takes, and verbal disfluencies.
- **When**: The user clicks **"Magic Rough Cut"** in **Auto Edit** mode with the "Talking Head" profile.
- **Then**:
  1. A new cloned sequence named `[OriginalName]_PrismexRoughCut` is created in Premiere Pro.
  2. The original sequence remains 100% untouched and identical to its pre-operation state.
  3. Pauses exceeding 500ms are removed, with 80ms pre-roll and 120ms post-roll padding applied.
  4. All repeated takes except the recommended candidates are excised.
  5. Obvious vocalic fillers (*"um"*, *"uh"*) are removed without clipping adjacent words.
  6. The active timeline focus switches to the new rough-cut sequence.
  7. An interactive Summary Report modal is displayed with metrics.
  8. Total elapsed processing time is under **60 seconds** on an Apple M-series Mac.

### Scenario 1.2: Magic Review Edit & Queue Population
- **Given**: An active sequence selected in Premiere Pro.
- **When**: The user clicks **"Magic Rough Cut"** in **Review Edit** mode.
- **Then**:
  1. No timeline cuts are executed initially.
  2. The panel navigates to the Review Queue view.
  3. All proposed edits are displayed as interactive cards categorized by type (Silence, Take, Filler).
  4. Each card displays timecode range, duration, confidence, reason, and preview controls.
  5. The original sequence remains completely unmodified.

---

## 2. Audio/Video Synchronization Quality Gate

### Scenario 2.1: Multi-Track Zero-Frame Drift Verification
- **Given**: A test sequence containing linked video on `V1` and multi-channel dialogue on `A1-A2`, plus background music on `A3` (marked protected).
- **When**: A batch of 50 ripple cuts is executed by the timeline engine.
- **Then**:
  1. The frame-by-frame relationship between `V1` video and `A1-A2` dialogue exhibits **0.00 frames of drift**.
  2. On the Synthetic Flash/Beep benchmark, 100% of the 1 kHz audio beeps align precisely with their corresponding 1-frame visual white flashes.
  3. The music track on `A3` remains intact and continuous without razor cuts or ripple shifts.

---

## 3. Local-Only & Offline Integrity Gate

### Scenario 3.1: Air-Gapped Operation
- **Given**: A MacBook with Wi-Fi disabled and Ethernet disconnected.
- **When**: The user launches Premiere Pro, opens Prismex, and triggers a Magic Rough Cut.
- **Then**:
  1. The system operates without displaying network connection errors.
  2. Audio extraction executes locally via native ARM64 FFmpeg.
  3. Transcription executes locally via `mlx-whisper`.
  4. Silence detection executes locally via Silero VAD and RMS DSP.
  5. All cuts apply successfully to the timeline.
  6. Zero outgoing socket connections outside `127.0.0.1` are attempted.

---

## 4. Free-Only Protection & Credential Security Gate

### Scenario 4.1: Blocking Paid Model Invocation
- **Given**: Free-Only Protection is enabled (default state).
- **When**: A request is initiated that targets a paid model or an endpoint with unknown billing status.
- **Then**:
  1. The AI Router intercepts and halts the request prior to socket transmission.
  2. An HTTP 403 / System Alert is generated: *"Operation blocked by Free-Only Guard."*
  3. The user's account is billed $0.00.
  4. The router automatically falls back to an eligible free-tier provider or local engine.

### Scenario 4.2: Zero Plain-Text Credential Storage
- **Given**: A user enters their personal API keys for Google Gemini and Groq Cloud.
- **When**: The filesystem, SQLite database, and log files are inspected.
- **Then**:
  1. No API keys appear in `prismex_project.db`.
  2. No API keys appear in application logs or crash dumps.
  3. Keys are stored exclusively within the encrypted macOS Keychain (`com.prismex.editor.credentials`).

---

## 5. Semantic Safety Gate (Filler Word Removal)

### Scenario 5.1: Contextual Disambiguation of "Like" and "So"
- **Given**: A transcript containing:
  - Clause 1: *"I really like this camera lens."* (Verb)
  - Clause 2: *"And it was, like, twenty minutes late."* (Filler)
  - Clause 3: *"So we decided to leave."* (Conjunction)
- **When**: The filler-removal engine evaluates the text.
- **Then**:
  1. Clause 1 *"like"* is classified as a verb and strictly preserved.
  2. Clause 2 *"like"* is classified as an interjection/filler and flagged for excision.
  3. Clause 3 *"so"* is preserved as a discourse conjunction.
  4. Zero grammatical corruptions are introduced into the final speech stream.

---

## 6. Performance & Memory Threshold Gates

| Quality Dimension | Test Condition | Maximum Allowed Threshold | Status |
|---|---|---|---|
| **Resident Daemon RAM** | Continuous processing of 60m sequence | $\le 2,500 \text{ MB}$ (2.5 GB) | **MANDATORY PASS** |
| **Model Eviction Time** | Post-transcription memory cleanup | $\le 1.5 \text{ seconds}$ to return to baseline (<400MB) | **MANDATORY PASS** |
| **Timeline Scrub Latency** | Clicking transcript word to CTI playhead move | $\le 50 \text{ ms}$ response time | **MANDATORY PASS** |
| **Atomic Undo Latency** | `Cmd+Z` reversal of 80 cuts in Premiere | $\le 1.0 \text{ second}$ instant restoration | **MANDATORY PASS** |
| **Crash Rate** | 100 consecutive automated rough cuts | $0 \text{ fatal crashes}$ | **MANDATORY PASS** |
