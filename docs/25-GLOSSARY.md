# 25 — Standardized Project Glossary

This glossary establishes unambiguous, standardized definitions for video editing, Adobe UXP, machine learning, and Prismex domain terminology.

---

## 1. Video Editing Terminology

- **A-Roll**: The primary audio and video footage that delivers the main narrative or dialogue of a video (e.g., an on-camera interview or host delivery).
- **B-Roll**: Secondary visual footage intercut with the A-roll to illustrate topics, mask jump cuts, or add atmospheric context.
- **Rough Cut**: The initial assembled version of a video sequence where content, pacing, and dialogue order are established, prior to fine color grading, audio sweetening, or visual effects.
- **Ripple Delete**: An editing operation where a selected clip or region is deleted from a timeline track, and all subsequent clips are shifted backward in time to close the resulting empty gap.
- **Razor / Blading**: The action of slicing an existing clip on a timeline track into two separate contiguous track items at a specific timecode.
- **Current Time Indicator (CTI)**: The blue vertical playhead line marking the active temporal position in the Premiere Pro timeline and Program Monitor.
- **In / Out Points**: Markers defining the start (In) and end (Out) of a selected temporal range on a sequence or source clip.
- **Timecode**: A standardized temporal addressing system formatted as `HH:MM:SS:FF` (Hours, Minutes, Seconds, Frames).
- **Timebase / FPS**: The playback frame rate of a sequence (e.g., 23.976 fps, 24.0 fps, 29.97 fps, 60.0 fps).
- **Non-Destructive Editing**: An editing paradigm where edits and cuts manipulate references to media clips on a timeline without altering or deleting the underlying original source media files on disk.

---

## 2. Adobe Premiere Pro UXP Concepts

- **UXP (Unified Extensibility Platform)**: Adobe's modern extensibility framework replacing CEP and ExtendScript, featuring a unified V8 JavaScript engine and asynchronous native C++ host bindings.
- **`premierepro` Module**: The official JavaScript entry point (`const ppro = require("premierepro")`) exposing the Premiere Pro host DOM.
- **`SequenceEditor`**: The UXP class responsible for generating and dispatching timeline modification actions (inserting clips, removing items, slicing tracks).
- **`TickTime`**: Adobe Premiere Pro's internal high-precision temporal coordinate representation, defined as **254,016,000,000 ticks per second**.
- **`TrackItem`**: An individual instance of a media clip, title, or graphic resting on a video or audio track inside a sequence.
- **`TrackItemSelection`**: A collection of targeted track items passed to `SequenceEditor` actions to perform batch operations (such as multi-track ripple deletion).
- **`createCloneAction()`**: The native UXP method that generates an atomic action to duplicate a sequence non-destructively.
- **`beginUndoGroup()` / `endUndoGroup()`**: Host methods that bundle multiple discrete timeline operations into a single user-facing undo transaction (`Cmd+Z`).

---

## 3. Speech, Audio & AI Terminology

- **Speech-to-Text (STT)**: The automated conversion of spoken acoustic signals into digital text representations.
- **MLX**: An open-source machine learning framework developed by Apple Silicon research, optimized for unified memory and Metal Performance Shaders on Apple M-series chips.
- **Forced Alignment**: The computational process of aligning a known text transcript against an audio waveform to calculate microsecond-accurate start and end timestamps for every word and phoneme.
- **Connectionist Temporal Classification (CTC)**: A neural network output layer and loss function that enables acoustic models (such as Wav2Vec2) to output phoneme probabilities across time without pre-segmented training data.
- **Viterbi Decoding**: A dynamic programming algorithm that finds the most probable sequence of hidden states (phonemes) in a CTC emission trellis.
- **Voice Activity Detection (VAD)**: An algorithm or neural model that classifies audio frames as containing active human speech versus non-speech silence/background noise.
- **Silero VAD v5**: A lightweight, high-performance neural voice activity detector with sub-30ms temporal precision.
- **Root Mean Square (RMS)**: A statistical measure of the magnitude of a varying audio signal, used to estimate perceived signal energy.
- **dBFS (Decibels Relative to Full Scale)**: A logarithmic unit of measure for audio amplitude in digital systems, where 0 dBFS represents the maximum possible digital level before clipping.
- **Plosive Consonant**: A speech sound produced by completely stopping the airflow in the vocal tract and then abruptly releasing it (e.g., /p/, /t/, /k/, /b/, /d/, /g/).
- **Pre-Roll / Post-Roll Padding**: Safety buffers (measured in milliseconds) prepended to the start or appended to the end of a cut interval to preserve natural speech transitions and plosive closures.

---

## 4. Prismex Domain Terminology

- **Magic Rough Cut**: The central feature of Prismex AI Editor that automatically transcribes, analyzes, and cuts a Premiere Pro sequence with a single click.
- **Mode A (Magic Auto Edit)**: Automated execution mode where approved editing rules are directly applied to a newly cloned rough-cut sequence without user intervention.
- **Mode B (Magic Review Edit)**: Collaborative execution mode where detected edits are staged in the Review Queue for human inspection and auditioning before timeline application.
- **Take Group**: A structured cluster of repeated spoken sentences or restart attempts identified as referring to the same intended line of dialogue.
- **Take Candidate**: An individual delivery variation within a Take Group.
- **Last Take Mode**: A deterministic, zero-AI take selection mode that automatically selects the chronologically final take in a group.
- **Best Take Mode**: An AI-assisted take selection mode that scores candidates on fluency, clarity, articulation, and delivery.
- **Hybrid Take Mode**: An operating mode that pre-selects the Last Take as the baseline while surfacing AI quality recommendations.
- **Review Queue**: The interactive panel view displaying all proposed cuts with category filters, audio auditioning, and approval controls.
- **Cut Decision Harmonizer**: The algorithmic reconciliation layer that merges overlapping cut intervals, resolves conflicts between detection engines, and enforces boundary padding.
- **Free-Only Guard**: A hard software security and budget guard that blocks all paid model endpoints and guarantees zero accidental cloud billing.
- **Local Core Companion Daemon**: The native background service (`PrismexCore`) running on `127.0.0.1:49152` that executes audio extraction, neural models, database operations, and cloud routing.
