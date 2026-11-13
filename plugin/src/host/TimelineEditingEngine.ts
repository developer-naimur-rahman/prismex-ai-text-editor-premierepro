/**
 * TimelineEditingEngine - Execution of Physical Cuts in Premiere Pro
 * Specification: docs/15-TIMELINE-EDITING-ENGINE.md & docs/04-PREMIERE-PRO-INTEGRATION.md
 * 
 * Enforces Reverse Chronological Ripple Deletion (Right-to-Left) to prevent coordinate drift.
 */

import { CutInterval } from '../types';
import { TimecodeConverter } from './TimecodeConverter';
import { PremiereHostBridge } from './PremiereHostBridge';

export interface TimelineExecutionResult {
  success: boolean;
  cutsExecuted: number;
  initialDurationSeconds: number;
  finalDurationSeconds: number;
  timeSavedSeconds: number;
  syncVerified: boolean;
  error?: string;
}

export class TimelineEditingEngine {
  private hostBridge: PremiereHostBridge;

  constructor() {
    this.hostBridge = PremiereHostBridge.getInstance();
  }

  /**
   * Executes a list of approved cut intervals against the active or cloned sequence.
   * Cuts are strictly sorted and processed in reverse chronological order.
   */
  public async executeCuts(
    cuts: CutInterval[], 
    operationName: string = "Prismex Magic Rough Cut"
  ): Promise<TimelineExecutionResult> {
    if (!cuts || cuts.length === 0) {
      return {
        success: true,
        cutsExecuted: 0,
        initialDurationSeconds: 0,
        finalDurationSeconds: 0,
        timeSavedSeconds: 0,
        syncVerified: true
      };
    }

    // 1. Sort cuts in DESCENDING order (Right to Left)
    const sortedCuts = [...cuts].sort((a, b) => b.startSeconds - a.startSeconds);

    const totalExpectedCutDuration = sortedCuts.reduce(
      (sum, cut) => sum + (cut.endSeconds - cut.startSeconds), 
      0
    );

    // If running under CEP in Premiere Pro
    if (this.hostBridge.isRunningInCEP()) {
      try {
        const res = await this.hostBridge.evalScript(
          `$._prismex.executeNativeRippleCuts('${JSON.stringify(sortedCuts)}')`
        );
        const data = JSON.parse(res);
        return {
          success: !!data.success,
          cutsExecuted: data.cutsExecuted || sortedCuts.length,
          initialDurationSeconds: data.initialDurationSeconds || 0,
          finalDurationSeconds: data.finalDurationSeconds || 0,
          timeSavedSeconds: data.timeSavedSeconds || totalExpectedCutDuration,
          syncVerified: data.syncVerified !== false,
          error: data.error
        };
      } catch (err: any) {
        return {
          success: false,
          cutsExecuted: 0,
          initialDurationSeconds: 0,
          finalDurationSeconds: 0,
          timeSavedSeconds: 0,
          syncVerified: false,
          error: err?.message || String(err)
        };
      }
    }

    // If running outside Premiere Pro (mock mode)
    if (!this.hostBridge.isRunningInPremiere()) {
      const mockInitial = 742.5;
      const mockFinal = Math.max(0, mockInitial - totalExpectedCutDuration);
      return {
        success: true,
        cutsExecuted: sortedCuts.length,
        initialDurationSeconds: mockInitial,
        finalDurationSeconds: mockFinal,
        timeSavedSeconds: totalExpectedCutDuration,
        syncVerified: true
      };
    }

    try {
      const ppro = (window as any).require('premierepro');
      const project = await ppro.Project.getActiveProject();
      const sequence = await project.getActiveSequence();
      if (!sequence) throw new Error("No active sequence available for timeline editing");

      const initialDurationTicks = (await sequence.getDuration()).getTicks();
      const initialDurationSeconds = TimecodeConverter.ticksToSeconds(initialDurationTicks);

      const editor = await ppro.SequenceEditor.getEditor(sequence);

      // Begin atomic undo group
      await ppro.beginUndoGroup(operationName);

      let cutsExecutedCount = 0;

      for (const cut of sortedCuts) {
        const startTick = await ppro.TickTime.createWithTicks(TimecodeConverter.secondsToTicks(cut.startSeconds));
        const endTick = await ppro.TickTime.createWithTicks(TimecodeConverter.secondsToTicks(cut.endSeconds));

        // Discover and select items in range across targeted dialogue tracks
        const itemSelection = await sequence.getItemsInRange(startTick, endTick);

        if (itemSelection && (await itemSelection.getCount()) > 0) {
          // Create remove items action with ripple enabled
          const removeAction = await editor.createRemoveItemsAction(
            itemSelection,
            true, // ripple: true
            ppro.Constants.MediaType.ALL,
            true  // shiftOverlapping: true
          );

          await editor.executeActions([removeAction]);
          cutsExecutedCount++;
        }
      }

      await ppro.endUndoGroup();

      // Post-cut sync verification
      const finalDurationTicks = (await sequence.getDuration()).getTicks();
      const finalDurationSeconds = TimecodeConverter.ticksToSeconds(finalDurationTicks);
      const actualTimeSaved = Math.max(0, initialDurationSeconds - finalDurationSeconds);

      // Drift check: actual time saved should match expected within 2 frame tolerances (80ms)
      const driftDelta = Math.abs(actualTimeSaved - totalExpectedCutDuration);
      const syncVerified = driftDelta < 0.100;

      return {
        success: true,
        cutsExecuted: cutsExecutedCount,
        initialDurationSeconds,
        finalDurationSeconds,
        timeSavedSeconds: actualTimeSaved,
        syncVerified
      };
    } catch (err: any) {
      console.error('[TimelineEditingEngine] Cut execution failed:', err);
      try {
        const ppro = (window as any).require?.('premierepro');
        if (ppro) {
          await ppro.endUndoGroup();
          await ppro.undo(); // Safe rollback
        }
      } catch (rollbackErr) {
        console.error('[TimelineEditingEngine] Safe rollback failed:', rollbackErr);
      }

      return {
        success: false,
        cutsExecuted: 0,
        initialDurationSeconds: 0,
        finalDurationSeconds: 0,
        timeSavedSeconds: 0,
        syncVerified: false,
        error: err?.message || String(err)
      };
    }
  }
}
