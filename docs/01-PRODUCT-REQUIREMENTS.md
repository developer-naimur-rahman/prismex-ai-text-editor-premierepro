# 01 — Product Requirements Document (PRD)

## 1. Product Identification
- **Product Name**: Prismex AI Editor
- **Classification**: Adobe Premiere Pro UXP Extension & Companion AI Engine
- **Target OS**: macOS (Apple Silicon ARM64, Sonoma / Sequoia)
- **Target Host**: Adobe Premiere Pro (v24.0.0+ / v25.0.0+)

---

## 2. Functional Requirements (FR)

### FR-1: Sequence & Media Ingestion
- **FR-1.1**: The plugin must detect the currently active Premiere Pro sequence automatically via UXP DOM.
- **FR-1.2**: The plugin must read sequence characteristics: name, frame rate (timebase), audio sample rate, total duration, track count, and clip boundaries.
- **FR-1.3**: The plugin must extract high-fidelity 16 kHz mono WAV audio from the active sequence.
  - *Primary method*: Direct audio extraction from source media files via native ARM64 FFmpeg.
  - *Secondary fallback*: Exporting sequence mixdown audio via Premiere Pro's media encoder API.
- **FR-1.4**: Ingestion must support sequences ranging from 30 seconds to over 120 minutes in duration.

### FR-2: Transcription & Alignment
- **FR-2.1**: The system must generate a full verbatim text transcript of the extracted audio.
- **FR-2.2**: The system must produce microsecond-accurate start and end timestamps for every single recognized word.
- **FR-2.3**: The transcript must be automatically grouped into logical sentences and paragraphs based on acoustic pauses and punctuation markers.
- **FR-2.4**: The system must support speaker diarization/labeling where multi-speaker audio is detected.
- **FR-2.5**: The user must be able to search the transcript, highlight text, and select words, sentences, or paragraphs.
- **FR-2.6**: Clicking any word in the transcript UI must immediately position the Premiere Pro timeline playhead (`TickTime`) to the exact audio onset of that word.
- **FR-2.7**: Deleting a word, sentence, or paragraph in the transcript editor must trigger an option to ripple-delete the corresponding footage from the Premiere Pro sequence.

### FR-3: Silence & Pause Detection
- **FR-3.1**: The system must detect non-speech pauses using dual methodologies:
  - *Rule-Based Engine*: Sliding-window RMS energy with dynamic noise-floor calibration.
  - *AI-Assisted Engine*: Deep neural Voice Activity Detection (Silero VAD v5).
- **FR-3.2**: The user must be able to configure:
  - Minimum silence duration threshold (default: 500 ms; range: 200 ms – 5000 ms).
  - Audio silence threshold (dBFS, range: -60 dBFS to -20 dBFS).
  - Pre-roll safety padding (default: 80 ms; range: 0 ms – 500 ms).
  - Post-roll safety padding (default: 120 ms; range: 0 ms – 500 ms).
- **FR-3.3**: The system must distinguish between unnatural dead air and natural conversational breathing pauses.

### FR-4: Filler Word & Stutter Detection
- **FR-4.1**: The system must detect lexical fillers (*"um"*, *"uh"*, *"er"*, *"ah"*, *"like"*, *"you know"*, *"so"*, *"actually"*).
- **FR-4.2**: The system must detect phonemic stutters (e.g., *"th-th-the"*) and accidental word repetitions (*"I went to the to the store"*).
- **FR-4.3**: The system must allow users to define custom filler-word lists and language dictionaries.
- **FR-4.4**: The system must prevent deletion if removing a token causes grammatical or semantic incoherence (using context window evaluation).

### FR-5: Repeated Take Detection
- **FR-5.1**: The system must identify repeated sentences, restarts, and re-recordings of identical or semi-identical lines.
- **FR-5.2**: The system must group repeated utterances into an atomic `TakeGroup`.
- **FR-5.3**: The system must support three take-selection modes:
  - **Last Take Mode**: Deterministically selects the final chronological take (standard creator convention; requires 0 AI tokens).
  - **Best Take Mode**: Uses LLM reasoning and acoustic evaluation to select the candidate with highest clarity, best pacing, and fewest speech errors.
  - **Manual Selection Mode**: Surfaces all takes in the UI for 1-click human selection.
- **FR-5.4**: The system must provide a Hybrid Mode that pre-selects the Last Take while surfacing AI confidence metrics.

### FR-6: Magic Rough Cut (Core Feature)
- **FR-6.1**: The user must be able to click a single primary call-to-action button (**Magic Rough Cut**) to process the sequence.
- **FR-6.2**: The system must support two execution modes:
  - **Mode A (Magic Auto Edit)**: Automatically executes audio extraction, transcription, silence removal, filler removal, and take pruning, producing a finished rough-cut sequence without user intervention.
  - **Mode B (Magic Review Edit)**: Analyzes the footage and populates an interactive Review Queue, allowing the editor to approve, reject, or fine-tune cuts before applying them.
- **FR-6.3**: The system must never modify the original sequence. All edits must be applied to an automatically cloned sequence named `[OriginalName]_PrismexRoughCut`.
- **FR-6.4**: The system must generate a comprehensive Rough Cut Summary Report (duration saved, cuts applied, filler count, take reduction).

### FR-7: Timeline Editing Engine
- **FR-7.1**: The engine must translate abstract cut ranges into sequence operations using Premiere Pro's official UXP `SequenceEditor` API.
- **FR-7.2**: The engine must execute ripple deletes in reverse chronological order (right-to-left) to preserve timeline coordinate validity.
- **FR-7.3**: The engine must maintain strict synchronization between linked video and audio tracks.
- **FR-7.4**: The engine must respect protected tracks (e.g., locked tracks, background music, sound effects, B-roll, adjustment layers).
- **FR-7.5**: The system must support atomic undo/redo inside Premiere Pro.

### FR-8: AI Provider Manager & Free-Only Guard
- **FR-8.1**: The system must manage both local engines and external cloud AI providers.
- **FR-8.2**: Supported cloud providers: Google Gemini (1.5/2.0 Flash), Groq Cloud (Whisper-v3, Llama 3.3), Cerebras Cloud, and OpenRouter (free tier).
- **FR-8.3**: **Free-Only Protection Guard**:
  - The system must default to strict Free-Only mode.
  - The system must refuse to call any paid endpoint or model without explicit user confirmation.
  - If a user enables paid features, they must configure a hard spend cap ($0.00 – $50.00).
- **FR-8.4**: API keys must be securely stored in the macOS Keychain (`security` subsystem) and never written to disk in plain text.
- **FR-8.5**: The system must track request counts, token consumption, and rate limits locally.

---

## 3. Non-Functional Requirements (NFR)

### NFR-1: Performance & Latency
- **NFR-1.1**: For an 8-minute 1080p/4K talking-head video on an M-series Mac:
  - Audio extraction: < 5 seconds.
  - Transcription & forced alignment (local MLX): < 35 seconds.
  - Transcription (cloud Groq Whisper): < 8 seconds.
  - Silence & take detection: < 5 seconds.
  - Total time to Rough Cut: < 60 seconds (local) / < 25 seconds (cloud).
- **NFR-1.2**: Timeline edit execution in Premiere Pro must process at least 2 cuts per second.

### NFR-2: Memory Budgeting (16 GB Unified Memory Target)
- **NFR-2.1**: The total resident memory of all Prismex background processes must not exceed **2.5 GB RAM**.
- **NFR-2.2**: Only one machine learning model may be loaded in memory at any given time.
- **NFR-2.3**: Models must be evicted from memory immediately upon task completion.

### NFR-3: Reliability & Data Integrity
- **NFR-3.1**: Zero data loss guarantee: Original sequences and source media files must remain 100% read-only.
- **NFR-3.2**: Audio/video synchronization must drift by zero frames (drift tolerance = 0.000 ms).
- **NFR-3.3**: The system must withstand daemon crashes or Premiere restarts without corrupting project databases.

### NFR-4: Security & Privacy
- **NFR-4.1**: Local-first processing: The software must be fully functional with internet connectivity severed.
- **NFR-4.2**: Cloud consent: Media, audio, or text must never leave the machine without explicit user opt-in per provider.
- **NFR-4.3**: Ephemeral audio storage: Extracted temporary WAV files must be scrubbed automatically after job completion.

---

## 4. User Persona Scenarios

### Scenario 1: YouTube Solo Creator
*Mark records a 22-minute tutorial with 14 retakes and frequent pauses.*
1. Mark opens Premiere Pro, selects his sequence, and opens the Prismex panel.
2. He clicks **Magic Rough Cut** in **Auto Edit** mode using the "Talking Head" profile.
3. In 42 seconds, a new sequence `Tutorial_PrismexRoughCut` is created.
4. Total duration is reduced from 22:15 to 8:40. 38 awkward pauses and 9 repeated takes are removed. Audio and video remain in perfect sync.

### Scenario 2: Agency Interview Editor
*Elena edits an executive client interview under strict NDA.*
1. Elena sets Prismex to **Local-Only Mode** (disabling all cloud APIs).
2. She selects **Magic Review Edit** mode.
3. The Review Queue populates with 64 suggested cuts.
4. She uses keyboard shortcuts (`J-K-L` and `Space` for playback, `Y` for approve, `N` for reject) to audit the cuts in 4 minutes.
5. She clicks **Apply Approved Edits**. Premiere Pro duplicates the sequence and executes the 58 approved cuts. No data ever left Elena's MacBook.
