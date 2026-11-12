# 13 — Magic Rough Cut Master Specification

## 1. Feature Vision: One-Click Rough Cutting

**Magic Rough Cut** is the flagship capability of Prismex AI Editor. 

With a single click, an editor can transform raw, unedited, mistake-laden footage into a tight, professional, rhythmically balanced rough cut inside Adobe Premiere Pro.

```
+-------------------------------------------------------------------------------+
|                             RAW SEQUENCE IN PREMIERE                          |
|  [Take 1 - Stumbled] [Silence] [Take 2 - Restart] [Um] [Take 3 - Good] [Pause]|
+-------------------------------------------------------------------------------+
                                        │
                                        │ User clicks "Magic Rough Cut"
                                        ▼
+-------------------------------------------------------------------------------+
|                    NEW CLONED SEQUENCE: [Name]_PrismexRoughCut                |
|  [Take 3 - Good (Tightened)]                                                  |
+-------------------------------------------------------------------------------+
```

---

## 2. The 14-Step Processing Pipeline

Every execution of Magic Rough Cut follows a strictly orchestrated 14-stage lifecycle:

```
Step 1: Sequence Inspection & Track Manifest Generation
   │
Step 2: High-Speed Audio Extraction (FFmpeg ARM64 or Premiere Mixdown)
   │
Step 3: Audio Preprocessing & Level Normalization (-23 LUFS / 16kHz Mono)
   │
Step 4: Full Speech Transcription (MLX-Whisper or Groq Cloud)
   │
Step 5: Word-Level Forced Alignment (Wav2Vec2 CTC / Sub-frame precision)
   │
Step 6: Sentence & Semantic Boundary Partitioning
   │
Step 7: Dual-Engine Silence Detection (Silero VAD + Adaptive RMS)
   │
Step 8: Filler Word & Phonemic Stutter Detection
   │
Step 9: Repeated Take Grouping (Lexical & Semantic Clustering)
   │
Step 10: Best-Take Selection & Ranking (Last Take / AI Scoring)
   │
Step 11: Cut Decision Harmonizer & Boundary Padding Enforcement
   │
Step 12: Execution Branching:
   ├──> Mode A: Direct Timeline Application on Cloned Sequence
   └──> Mode B: Populate Interactive Review Queue
   │
Step 13: Timeline Audio/Video Synchronization Integrity Verification
   │
Step 14: Rough Cut Summary Report Generation & Database Persistence
```

---

## 3. Operational Modes: Auto Edit vs. Review Edit

### Mode A: Magic Auto Edit (Zero-Friction Fast Path)
- **Target User**: Solo creators, YouTubers, fast-turnaround video editors.
- **Workflow**:
  1. Editor selects sequence and clicks **Magic Rough Cut (Auto Edit)**.
  2. The system processes the 14-step pipeline in the background.
  3. A new sequence `[SequenceName]_PrismexRoughCut` is automatically created.
  4. All cuts (silence, fillers, bad takes) are executed programmatically in reverse chronological order.
  5. The panel switches focus to the new rough-cut sequence in Premiere Pro and displays the completion report.
  6. Original sequence remains untouched in the project bin.

### Mode B: Magic Review Edit (Human-in-the-Loop Audit Path)
- **Target User**: Documentary editors, client interviewers, commercial editors.
- **Workflow**:
  1. Editor selects sequence and clicks **Magic Rough Cut (Review Edit)**.
  2. The system executes Stages 1 through 11, generating a consolidated list of proposed cuts.
  3. The panel transitions to the **Review Queue** view.
  4. The editor reviews suggested cuts with interactive waveform previews and keyboard shortcuts (`Y` accept, `N` reject).
  5. Once satisfied, the editor clicks **Apply Approved Edits**.
  6. The system clones the sequence and applies only the approved subset of cuts.

---

## 4. Cut Decision Harmonization (Conflict Resolution)

A frequent technical hazard occurs when multiple detection engines generate overlapping cut suggestions (e.g., a silence interval overlaps with a rejected repeated take or filler word).

The **Cut Decision Harmonizer** reconciles overlapping intervals before timeline execution:

```
Engine 1 (Silence):        [=== Silence 1.2s ===]
Engine 2 (Repeated Take):             [========= Bad Take 4.5s =========]
Engine 3 (Filler "um"):                                            [= Um =]

Harmonized Interval:       [================ Combined Cut 6.2s ==========]
```

### Harmonization Rules:
1. **Union of Overlapping Intervals**: If Cut Interval $A$ and Cut Interval $B$ overlap or are separated by less than the minimum retainable speech duration (120ms), they are merged into a single continuous cut interval:
   $$\text{Interval}_{\text{merged}} = [\min(A_{\text{start}}, B_{\text{start}}), \max(A_{\text{end}}, B_{\text{end}})]$$
2. **Speech Incursion Guard**: If a silence cut accidentally encroaches on a valid recognized spoken word (due to padding), the cut boundary is clamped to preserve the word onset/offset plus safety margins.
3. **Minimum Segment Ceiling**: No cut is executed if the resulting video clip between cuts would be less than 4 frames (< 160ms at 24fps), preventing visual flicker.

---

## 5. Non-Destructive Invariant & Sequence Duplication

> [!IMPORTANT]
> **Prismex AI Editor never modifies the original sequence by default.**

1. **Cloned Sequence Creation**: The system issues a `createCloneAction()` against the active sequence in Premiere Pro.
2. **Naming Convention**: The cloned sequence is named using a user-configurable template:
   - Default: `{OriginalSequenceName}_PrismexRoughCut`
   - Example: `Interview_CamA_PrismexRoughCut`
3. **Bin Organization**: A project bin named `_Prismex Rough Cuts` is automatically created in the Premiere Pro Project panel to neatly house all generated iterations.
4. **Instant A/B Toggling**: The editor can switch between the original timeline tab and the rough-cut tab inside Premiere Pro to audit pacing improvements in real time.

---

## 6. Rough Cut Summary Report

Upon pipeline completion, Prismex renders an interactive report card:

```
+--------------------------------------------------------------------------------+
| ✨ MAGIC ROUGH CUT COMPLETE                                                    |
+--------------------------------------------------------------------------------+
| Sequence: "Interview_CamA_PrismexRoughCut"                                     |
|                                                                                |
| ⏱  Original Duration:    18:24.12                                             |
| ⚡️ Rough Cut Duration:   11:08.05  (39.1% Time Saved)                         |
|                                                                                |
| ✂️ Cuts Applied:          86 total timeline edits                              |
|   • Silences Removed:     52 pauses (4m 12s total dead air)                    |
|   • Takes Pruned:          7 restart clusters (2m 45s saved)                   |
|   • Fillers Excised:      27 disfluencies ("um", "uh", "like")                 |
|                                                                                |
| 🛡 A/V Sync Status:       Verified (0 frame drift across 4 tracks)             |
| ⚙️ Engine Used:           Local MLX-Whisper (Zero Cloud Cost)                  |
|                                                                                |
| [ Open in Timeline ]  [ View in Review Queue ]  [ Export PDF Summary ]         |
+--------------------------------------------------------------------------------+
```
