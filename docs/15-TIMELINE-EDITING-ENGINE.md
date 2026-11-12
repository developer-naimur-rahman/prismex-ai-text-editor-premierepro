# 15 — Timeline Editing Engine Specification

## 1. Technical Purpose & Core Challenge

The **Timeline Editing Engine** translates abstract cut ranges (e.g., *"Delete 04:12.40 to 04:18.90"*) into physical timeline operations inside Adobe Premiere Pro.

### The Fundamental Coordinate Drift Challenge:
If an editor deletes 5 seconds from minute 01:00 with a ripple delete, every clip, cut point, and marker occurring *after* minute 01:00 shifts leftward by exactly 5 seconds. If subsequent cuts were planned using original sequence timecodes, every subsequent cut will land on the wrong footage, causing catastrophic timeline corruption.

Prismex AI Editor eliminates coordinate drift through two robust architectural strategies:
1. **Strategy A: Reverse Chronological Ripple Deletion** (Right-to-Left execution).
2. **Strategy B: Deterministic Sequence Reassembly** (Keep-Range extraction).

---

## 2. Strategy A: Reverse Chronological Ripple Deletion

When working within an existing sequence structure, cuts must be executed strictly from the **end of the timeline toward the beginning**:

```
Original Timeline:  [Cut 1 @ 01:00] ... [Cut 2 @ 05:00] ... [Cut 3 @ 10:00]

Step 1: Execute Cut 3 @ 10:00.
        (Footage before 10:00 remains at exact original timecodes!)
        
Step 2: Execute Cut 2 @ 05:00.
        (Footage before 05:00 remains at exact original timecodes!)
        
Step 3: Execute Cut 1 @ 01:00.
        (All planned cuts landed on 100% accurate timecodes!)
```

### Execution Implementation via UXP:
```typescript
export async function executeReverseRippleEdits(
  sequence: ppro.Sequence,
  cuts: Array<{ startSeconds: number; endSeconds: number }>
): Promise<void> {
  const editor = await ppro.SequenceEditor.getEditor(sequence);

  // 1. Sort cuts in descending order of start time (Right to Left)
  const sortedCuts = [...cuts].sort((a, b) => b.startSeconds - a.startSeconds);

  // 2. Wrap all operations in an atomic undo container
  const app = require("premierepro");
  await app.beginUndoGroup("Prismex Magic Rough Cut");

  try {
    for (const cut of sortedCuts) {
      const startTick = TimecodeConverter.secondsToTicks(cut.startSeconds);
      const endTick = TimecodeConverter.secondsToTicks(cut.endSeconds);

      // Select track items in target range across unlocked tracks
      const itemSelection = await sequence.getItemsInRange(startTick, endTick);

      if (itemSelection && (await itemSelection.getCount()) > 0) {
        // Execute ripple deletion
        const removeAction = await editor.createRemoveItemsAction(
          itemSelection,
          true, // ripple = true
          ppro.Constants.MediaType.ALL,
          true  // shiftOverlapping = true
        );
        await editor.executeActions([removeAction]);
      }
    }
  } finally {
    await app.endUndoGroup();
  }
}
```

---

## 3. Strategy B: Deterministic Sequence Reassembly (Keep-Ranges)

For multi-track sequences or complex nested timelines where ripple deleting could introduce unintended sync shifts on secondary tracks, Prismex provides **Deterministic Reassembly**:

Instead of thinking in *"what to delete"*, the engine computes the inverse: **what to keep**.

```
Full Sequence:      [Keep 1]──[Cut A]──[Keep 2]──[Cut B]──[Keep 3]

Inverse Cut List -> Keep Ranges:
- Keep Range 1: 00:00.00 to 01:14.20
- Keep Range 2: 01:22.80 to 04:05.10
- Keep Range 3: 04:12.00 to 08:30.00

Execution:
1. Create a pristine new sequence matching original settings.
2. Sequentially insert Keep Range 1, Keep Range 2, Keep Range 3.
3. Result is 100% drift-free and mathematically immutable.
```

---

## 4. Multi-Track Handling & Protected Tracks

In modern production, a timeline contains multiple layers:
- **Track V1 / A1-A2**: Primary A-Roll dialogue & sync audio (Targeted for cuts).
- **Track V2 / V3**: B-Roll inserts and reaction shots.
- **Track V4**: Adjustment layers, titles, and color grading clips.
- **Track A3 / A4**: Background music (Score) and sound effects (SFX).

### Track Protection Rules:
1. **Explicit Track Selection**: The Prismex UI allows the editor to designate which tracks are **Active Dialogue Tracks** and which are **Protected Tracks**.
2. **Locked Track Invariant**: Any track locked via the Premiere Pro lock icon (`padlock`) is automatically recognized by UXP and excluded from all razor and ripple actions.
3. **Music & SFX Safety**: Background music tracks are **never ripple-deleted**. Ripple-deleting a music track causes jarring cuts in the song. The engine retains music tracks intact or prompts the user to edit dialogue first.
4. **Adjustment Layer Preservation**: Adjustment layers spanning the entire video are excluded from slice-and-delete operations.

---

## 5. Linked Audio/Video Clips & Sync Protection

A major risk in automated timeline editing is separating audio from video (e.g., deleting a video slice while leaving orphan audio, or vice versa).

### Audio/Video Sync Invariants:
1. **Linked Group Discovery**: Before blading or removing any track item, the engine calls `await trackItem.getLinkedItems()`.
2. **Unified Selection**: If a video item on `V1` is linked to audio on `A1` and `A2`, all three items are bundled into the same `TrackItemSelection`.
3. **Atomic Cut**: The slice or ripple delete is executed simultaneously across all linked elements.
4. **Post-Cut Verification**: The engine verifies that the `startTick` of the video item on `V1` exactly equals the `startTick` of the audio item on `A1`. Any discrepancy triggers an immediate rollback.

---

## 6. Microsecond Precision & Drift Analysis

Video frames (24fps, 29.97fps, 59.94fps) and audio samples (48,000 Hz) operate on different timebases:
- Frame Duration at 23.976 fps: ~41.708 ms (10,594,624,000 ticks).
- Audio Sample Duration at 48,000 Hz: ~0.0208 ms (5,292,000 ticks).

To prevent frame quantization drift:
1. All calculations in the Local Core Daemon are executed in 64-bit IEEE floating-point seconds.
2. Boundaries are mapped to the nearest integer video frame boundary:
   $$\text{FrameNumber} = \text{round}(\text{TimeInSeconds} \times \text{FPS})$$
   $$\text{SnappedSeconds} = \frac{\text{FrameNumber}}{\text{FPS}}$$
3. Snapped seconds are converted into 64-bit BigInt `TickTime` values for Adobe Premiere Pro.
4. **Result**: Zero fractional-frame drift across infinite cuts.
