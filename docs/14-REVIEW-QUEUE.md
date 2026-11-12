# 14 — Review Queue Specification

## 1. Architectural Role: The Human-in-the-Loop Hub

The **Review Queue** is the editorial cockpit of Prismex AI Editor. While automated algorithms are exceptionally fast, professional video editors require absolute authority over pacing, comedic timing, and rhetorical pauses.

The Review Queue bridges automation and human discernment by transforming abstract algorithmic detections into concrete, auditionable, one-click editorial proposals.

```
[ Raw Algorithmic Detections ] ──> [ Cut Decision Harmonizer ]
                                                │
                                                ▼
                                    [ Structured Review Queue ]
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 │                              │                              │
                 ▼                              ▼                              ▼
          [ Audition Clip ]              [ Accept / Reject ]           [ Fine-Tune Bounds ]
          (Audio scrubbing /             (Keyboard Y / N or            (Interactive padding
           Premiere playhead)             bulk filter chips)            slider controls)
                                                │
                                                ▼
                                   [ Apply Approved Cuts ]
                                   (Batch timeline execution)
```

---

## 2. Review Item Data Structure

Every card in the Review Queue is backed by a strongly-typed schema:

```typescript
export enum SuggestionCategory {
  SILENCE = "SILENCE",
  FILLER_WORD = "FILLER_WORD",
  STUTTER = "STUTTER",
  REPEATED_TAKE = "REPEATED_TAKE",
  SENTENCE_CUT = "SENTENCE_CUT"
}

export enum ReviewStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  MODIFIED = "MODIFIED"
}

export interface ReviewQueueItem {
  id: string;
  category: SuggestionCategory;
  status: ReviewStatus;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  confidence: number;
  reason: string;
  transcriptSnippet: string;
  takeDetails?: {
    clusterId: string;
    candidateIndex: number;
    totalCandidates: number;
    isRecommended: boolean;
  };
  audioPeakDbfs?: number;
}
```

---

## 3. Card Anatomy & Visual Hierarchy

```
+--------------------------------------------------------------------------------+
| [#24] REPEATED TAKE                    02:14.20 - 02:22.80 (Duration: 8.60s)   |
| [Take 1 of 3 (Rejected)]               Confidence: 96%                         |
+--------------------------------------------------------------------------------+
| Transcript:                                                                    |
| "And that brings us to the... uh, wait, let me reset that sentence."          |
|                                                                                |
| AI Rationale:                                                                  |
| Replaced by Take 3 at 02:30.15 (Fluent delivery, zero hesitations).           |
|                                                                                |
| Audio Audition:                                                                |
| [ ▶ Play Selection (Space) ]  [ ◀ Jump to Timeline ]  [ ⟲ Loop Audio ]         |
|                                                                                |
| Quick Decisions:                                                               |
|   [ ✓ Accept (Y) ]     [ ✗ Reject (N) ]     [ ✎ Adjust Bounds ]               |
+--------------------------------------------------------------------------------+
```

---

## 4. Bulk Operations & Category Filtering

When analyzing a 60-minute interview, the Review Queue may hold 200+ suggestions. To avoid review fatigue, the UI provides high-level filtering and bulk-approval workflows:

```
+--------------------------------------------------------------------------------+
| Filters: [ All (142) ] [ Silence (78) ] [ Fillers (42) ] [ Takes (22) ]        |
| Sort:    [ Timeline Order ▼ ]   Status: [ Pending Only ▼ ]                     |
+--------------------------------------------------------------------------------+
| Quick Actions:                                                                 |
|   [ ✓ Approve All 78 Silences ]         [ ✓ Approve All 42 Vocalic Fillers ]   |
|   [ ✗ Reject Low Confidence (< 70%) ]   [ ⚡️ Apply All Approved (120) ]         |
+--------------------------------------------------------------------------------+
```

### Filtering Capabilities:
1. **Category Pills**: Instantly isolates a single problem type (e.g., focus strictly on Repeated Takes before reviewing Silences).
2. **Confidence Threshold Slider**: Allows the editor to batch-approve all suggestions above 90% confidence with one click, leaving only borderline suggestions for manual inspection.
3. **Timeline Sorting vs. Duration Sorting**: Allows sorting by chronological appearance or by largest time-saver (e.g., review the longest awkward silences first).

---

## 5. Auditioning & Playhead Synchronization

Reviewing cuts requires listening to the context before and after the cut:

1. **Pre-Roll / Post-Roll Playback**: Clicking **Audition** (`P` key) plays the 1.5 seconds preceding the cut, skips over the cut section, and immediately plays the 1.5 seconds following the cut. This lets the editor verify that the spliced sentence sounds natural.
2. **Timeline Playhead Lock**: When a card is selected, the Premiere Pro CTI is automatically moved to the cut location, allowing the editor to inspect the Program Monitor visual frame.
3. **Interactive Boundary Trim**: If an editor feels a cut clips a word too tightly, dragging the card's boundary slider dynamically adjusts the `startSeconds` and `endSeconds` padding by ±10ms increments.

---

## 6. Execution & Undo Transactions

1. **Batch Execution**: Clicking **Apply Approved Edits** calculates the final harmonized cut list from all items marked `ACCEPTED` or `MODIFIED`.
2. **Atomic Undo Group**: All resulting timeline slices and ripple deletes inside Premiere Pro are wrapped in an atomic undo container (`app.beginUndoGroup("Prismex Review Apply")`).
3. **One-Step Undo**: Pressing `Cmd+Z` inside Premiere Pro reverts all 100+ cuts in a single step, restoring the timeline to its exact pre-execution state.
