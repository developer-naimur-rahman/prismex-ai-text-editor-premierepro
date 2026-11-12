"""
CutHarmonizer - Cut Decision Harmonization & Conflict Resolution Engine
Specification: docs/13-MAGIC-ROUGH-CUT.md & docs/15-TIMELINE-EDITING-ENGINE.md

Reconciles overlapping cut intervals from multiple detection engines (Silence, Fillers, Takes).
Generates deterministic, drift-free Cut Decision Lists with BigInt TickTime values.
"""

from typing import List, Dict, Any

TICKS_PER_SECOND = 254016000000

class CutHarmonizer:
    @staticmethod
    def seconds_to_ticks(seconds: float) -> str:
        ticks = int(round(seconds * TICKS_PER_SECOND))
        return str(ticks)

    @classmethod
    def harmonize_cuts(
        cls, 
        raw_suggestions: List[Dict[str, Any]],
        fps: float = 23.976
    ) -> List[Dict[str, Any]]:
        """
        Merges overlapping or tightly contiguous cut intervals into an atomic Cut Decision List.
        Applies frame snapping and reverse chronological sorting.
        """
        # Filter for approved/accepted cuts only
        valid_cuts = [
            s for s in raw_suggestions 
            if s.get("status") in ("ACCEPTED", "APPROVED") or s.get("auto_approved", True)
        ]

        if not valid_cuts:
            return []

        # Sort chronologically by start time for interval merging
        sorted_intervals = sorted(
            [{"start": s["start_seconds"], "end": s["end_seconds"]} for s in valid_cuts],
            key=lambda x: x["start"]
        )

        merged: List[Dict[str, float]] = []
        current = sorted_intervals[0].copy()

        # Merge intervals separated by less than 120ms (bridge mini-gaps)
        MIN_MERGE_GAP_SECONDS = 0.120

        for nxt in sorted_intervals[1:]:
            if nxt["start"] <= (current["end"] + MIN_MERGE_GAP_SECONDS):
                # Overlap or close proximity -> extend current interval
                current["end"] = max(current["end"], nxt["end"])
            else:
                # Disjoint interval
                merged.append(current)
                current = nxt.copy()
        merged.append(current)

        # Snap boundaries to integer frame boundaries to eliminate fractional frame drift
        frame_duration = 1.0 / fps if fps > 0 else 1.0 / 24.0
        final_cuts: List[Dict[str, Any]] = []

        for m in merged:
            start_frame = round(m["start"] / frame_duration)
            end_frame = round(m["end"] / frame_duration)

            snapped_start = round(start_frame * frame_duration, 4)
            snapped_end = round(end_frame * frame_duration, 4)

            # Minimum cut length check (at least 2 frames)
            if (snapped_end - snapped_start) >= (frame_duration * 2):
                final_cuts.append({
                    "start_seconds": snapped_start,
                    "end_seconds": snapped_end,
                    "start_tick": cls.seconds_to_ticks(snapped_start),
                    "end_tick": cls.seconds_to_ticks(snapped_end),
                    "duration_seconds": round(snapped_end - snapped_start, 4)
                })

        # Final sort: REVERSE CHRONOLOGICAL ORDER (Right-to-Left)
        # Inviolable rule for Premiere Pro ripple deletion stability
        final_cuts.sort(key=lambda x: x["start_seconds"], reverse=True)
        return final_cuts
