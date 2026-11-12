/**
 * TimecodeConverter - Microsecond Precision & Premiere Pro Tick Operations
 * Specification: docs/04-PREMIERE-PRO-INTEGRATION.md & docs/15-TIMELINE-EDITING-ENGINE.md
 * 
 * Adobe Premiere Pro represents all timeline coordinates as TickTime:
 * Exactly 254,016,000,000 ticks per second.
 */

export class TimecodeConverter {
  public static readonly TICKS_PER_SECOND = 254016000000n;

  /**
   * Converts floating-point seconds into 64-bit BigInt tick string for Premiere Pro.
   */
  public static secondsToTicks(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) {
      return "0";
    }
    const ticksBigInt = BigInt(Math.round(seconds * Number(this.TICKS_PER_SECOND)));
    return ticksBigInt.toString();
  }

  /**
   * Converts Premiere Pro tick string back into floating-point seconds.
   */
  public static ticksToSeconds(ticksString: string): number {
    try {
      const ticks = BigInt(ticksString);
      return Number(ticks) / Number(this.TICKS_PER_SECOND);
    } catch {
      return 0.0;
    }
  }

  /**
   * Snaps a time in seconds to the nearest integer video frame boundary to eliminate
   * frame quantization drift across sequence edits.
   */
  public static snapToFrame(seconds: number, fps: number): number {
    if (fps <= 0) return seconds;
    const frameNumber = Math.round(seconds * fps);
    return frameNumber / fps;
  }

  /**
   * Formats seconds into standard SMPTE timecode string HH:MM:SS:FF.
   */
  public static formatTimecode(seconds: number, fps: number = 24.0): string {
    const totalFrames = Math.max(0, Math.floor(seconds * fps));
    const intFps = Math.round(fps);
    
    const frames = totalFrames % intFps;
    const totalSeconds = Math.floor(totalFrames / intFps);
    const secs = totalSeconds % 60;
    const mins = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);

    const pad = (n: number, z: number = 2) => String(n).padStart(z, '0');
    return `${pad(hours)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
  }
}
