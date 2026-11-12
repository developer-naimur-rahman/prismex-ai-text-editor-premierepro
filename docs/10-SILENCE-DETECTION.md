# 10 — Silence Detection & Removal Specification

## 1. Dual-Engine Architecture

Silence detection in Prismex AI Editor operates via two complementary, coexisting engines:

```
                                [ Audio Stream (16kHz Mono) ]
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      │                                               │
                      ▼                                               ▼
          [ Engine 1: Rule-Based DSP ]                    [ Engine 2: Neural VAD ]
          - Sliding-Window RMS (30ms)                     - Silero VAD v5 (ONNX)
          - Dynamic Noise Floor Tracking                  - Deep Acoustic Feature Map
          - dBFS Energy Threshold                         - Speech Probability Score
                      │                                               │
                      └───────────────────────┬───────────────────────┘
                                              │
                                              ▼
                             [ Harmonizer & Cadence Filter ]
                             - Differentiates Dead Air vs. Natural Breaths
                             - Applies Pre-Roll & Post-Roll Padding
                                              │
                                              ▼
                             [ Qualified Silence Cut Intervals ]
```

---

## 2. Engine 1: Rule-Based Signal Processing (DSP)

The rule-based engine operates deterministically with **zero AI dependencies**, guaranteeing full offline functionality on any machine.

### Algorithm Steps:
1. **Windowed Frame Extraction**: Slices audio into 30ms non-overlapping frames (480 samples at 16 kHz).
2. **Root Mean Square (RMS) Calculation**:
   $$\text{RMS} = \sqrt{\frac{1}{N} \sum_{i=1}^{N} x[i]^2}$$
3. **Decibels Relative to Full Scale (dBFS)**:
   $$\text{dBFS} = 20 \log_{10}(\text{RMS} + \epsilon)$$
4. **Adaptive Noise Floor Calibration**: The background room tone is dynamically estimated by taking the 15th percentile of all frame energy values over a rolling 60-second window. The dynamic threshold is set to:
   $$\text{Threshold}_{\text{dynamic}} = \max(\text{Threshold}_{\text{user}}, \text{NoiseFloor} + 6.0\,\text{dB})$$
5. **Interval Clustering**: Contiguous frames below the threshold exceeding the user-configured minimum duration (e.g., 500ms) are grouped into candidate silence intervals.

---

## 3. Engine 2: Neural Voice Activity Detection (Silero VAD v5)

While RMS measures raw energy, it cannot distinguish between quiet vocal whispers and loud background noise (e.g., HVAC hum, keyboard clicks, paper rustling).

**Silero VAD v5** provides neural classification:
- **Model Size**: ~35 MB ONNX runtime model.
- **Performance**: Evaluates a 30ms audio chunk in under 1.2ms on Apple Silicon CPU/Neural Engine.
- **Output**: Returns a continuous probability value $P(\text{speech}) \in [0.0, 1.0]$.
- **Invariance**: Unaffected by room acoustic variations, microphone gain differences, or ambient hum.

---

## 4. Cadence & Breath Preservation Heuristics

Completely excising all pauses creates an unnatural, robotic, anxiety-inducing cadence. Prismex applies **Cadence-Aware Filtering**:

### 1. Inhalation Breath Detection
- Human speakers take a deep inhalation (breath) 150ms–300ms before commencing an utterance.
- Inhalations exhibit distinct spectral energy (broadband high-frequency noise around 2 kHz–4 kHz with low RMS energy).
- **Rule**: If a silence region concludes with an inhalation breath directly preceding a sentence onset, the cut offset is shifted backward to preserve the natural breath.

### 2. Conversational Rhythm Preservation
- Pauses between rapid back-and-forth dialogue or comma clauses (200ms–400ms) are preserved.
- Pauses between major topic transitions or paragraphs are shortened to a pleasant target duration (e.g., clamped from 3.5 seconds down to 600ms, rather than deleted entirely).

---

## 5. User Controls & Parameter Configuration

| Parameter | UI Control Type | Range | Default (Talking Head) | Description |
|---|---|---|---|---|
| **Silence Threshold** | Slider / Numeric input | `-60 dBFS` to `-20 dBFS` | `-38 dBFS` | Energy level below which audio is considered silence. |
| **Minimum Silence Duration** | Slider / Numeric input | `200 ms` to `3,000 ms` | `500 ms` | Minimum pause duration required to trigger a cut. |
| **Target Pause Duration** | Dropdown / Slider | `0 ms` (Full Delete) to `800 ms` | `350 ms` (Natural Clamp) | Whether to delete silence entirely or leave a natural pause. |
| **Pre-Cut Padding** | Stepper input | `0 ms` to `400 ms` | `80 ms` | Safety buffer before speech re-enters to prevent clipped consonants. |
| **Post-Cut Padding** | Stepper input | `0 ms` to `400 ms` | `120 ms` | Safety buffer after speech ends to capture natural room decay. |
| **Breathing Preservation** | Toggle Switch | On / Off | `On` | Protects inhalation sounds before sentence starts. |

---

## 6. Cut Boundary Construction Formula

For any detected silence interval starting at $T_{\text{start}}$ and ending at $T_{\text{end}}$:

```
Audio:  [ Spoken Word A ] ─── [ Silence Interval ] ─── [ Spoken Word B ]
                            ^                    ^
                            |                    |
                         T_start               T_end

Cut Start: Cut_Start = T_start + PostCutPadding (e.g., +120ms)
Cut End:   Cut_End   = T_end   - PreCutPadding  (e.g., -80ms)

Condition: If (Cut_End - Cut_Start) < MinCutDuration (e.g., 100ms) -> DISCARD CUT
```

If the padded cut duration is shorter than 100ms (roughly 2.4 video frames), the cut is safely discarded to prevent micro-stuttering or flickering video artifacts.
