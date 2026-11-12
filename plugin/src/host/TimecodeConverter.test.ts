import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TimecodeConverter } from './TimecodeConverter.ts';

describe('TimecodeConverter', () => {
  it('converts 1 second to exact 254016000000 ticks', () => {
    const ticks = TimecodeConverter.secondsToTicks(1.0);
    assert.strictEqual(ticks, '254016000000');
  });

  it('converts ticks string back to seconds accurately', () => {
    const seconds = TimecodeConverter.ticksToSeconds('254016000000');
    assert.strictEqual(seconds, 1.0);
  });

  it('handles fractional seconds with sub-millisecond precision', () => {
    const original = 14.285;
    const ticks = TimecodeConverter.secondsToTicks(original);
    const roundtrip = TimecodeConverter.ticksToSeconds(ticks);
    assert.ok(Math.abs(original - roundtrip) < 0.000001);
  });

  it('snaps accurately to 24fps frame boundaries', () => {
    const snapped = TimecodeConverter.snapToFrame(1.02, 24.0);
    // 1.02 * 24 = 24.48 -> frame 24 -> 24 / 24 = 1.0
    assert.strictEqual(snapped, 1.0);
  });

  it('formats standard SMPTE timecodes properly', () => {
    const tc = TimecodeConverter.formatTimecode(65.5, 24.0);
    // 65.5s = 1m 5s 12 frames
    assert.strictEqual(tc, '00:01:05:12');
  });
});
