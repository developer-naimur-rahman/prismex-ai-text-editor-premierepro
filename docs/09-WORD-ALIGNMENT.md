# 09 — Word-Level Forced Alignment Specification

## 1. The Critical Role of Sub-Frame Word Alignment

In video editing, speech cuts cannot tolerate temporal ambiguity. A cutting tool that clips the initial consonant of a word (e.g., cutting off the *"P"* in *"Prismex"*) or leaves an awkward breath remnant sounds amateurish and distracting.

At 24 frames per second, a single video frame spans **41.67 milliseconds** (10,584,000,000 Premiere ticks). A 100ms timestamp error spans **more than two full video frames**, guaranteeing audio truncation or glitching.

Prismex AI Editor mandates **sub-frame, microsecond-accurate word alignment** (< 15 ms error margin) across all supported languages.

---

## 2. Comparison: Whisper DTW vs. CTC Forced Alignment

| Dimension | Whisper Built-in DTW Alignment | Wav2Vec2 CTC Forced Alignment |
|---|---|---|
| **Mechanism** | Dynamic Time Warping on cross-attention matrix | Acoustic phoneme classification using Connectionist Temporal Classification (CTC) |
| **Acoustic Resolution** | 20 ms – 50 ms encoder frame steps | 10 ms frame steps with phoneme emission probabilities |
| **Boundary Precision** | ± 120 ms to 250 ms (often drifts on fast speech or noise) | **± 10 ms to 15 ms** (sharp acoustic transition detection) |
| **Consonant Onset Capture** | Poor (tends to crop unvoiced plosives like /p/, /t/, /k/) | **Superior** (captures pre-voicing and consonant bursts) |
| **Execution Memory** | 0 MB additional (reuses Whisper weights) | ~450 MB RAM (separate model pass) |
| **Role in Prismex** | Fast-path draft alignment | **Production-grade final alignment** |

---

## 3. CTC Forced Alignment Pipeline

```
[ Transcript Text from STT ]              [ High-Res Audio 16kHz WAV ]
             │                                         │
             ▼                                         ▼
[ Phoneme Lexicon Mapping ]               [ Wav2Vec2 Acoustic Model ]
(e.g., "Prismex" -> P R IH Z M EH K S)                 │
             │                                         ▼
             │                        [ Phoneme Emission Probabilities Matrix ]
             │                                         │
             └───────────────────┬─────────────────────┘
                                 │
                                 ▼
                     [ Dynamic Viterbi Trellis ]
                     (Optimal Alignment Path Search)
                                 │
                                 ▼
                     [ Word Boundary Timestamps ]
                     (Start: 04.120s, End: 04.640s)
                                 │
                                 ▼
                     [ Pre-Roll & Post-Roll Padding ]
                     (Enforce 40ms attack / 60ms decay margin)
```

### Step 1: Text-to-Phoneme Normalization
The recognized text transcript is normalized to remove punctuation and mapped to phonemic representations using a phonetic dictionary (CMUdict for English, or multilingual grapheme-to-phoneme engines).

### Step 2: Emission Probability Generation
The audio is processed through `facebook/wav2vec2-base-960h` (or language-specific checkpoint). The model outputs a probability distribution over the phoneme vocabulary for every 20ms audio frame.

### Step 3: Viterbi Trellis Decoding
The algorithm constructs a trellis constraining the sequence of allowed phonemes to match the exact transcript. Backtracking through the trellis identifies the optimal alignment path, yielding exact start and end frame indices for each phoneme and word.

---

## 4. Acoustic Safety Padding & Plosive Protection

Human speech does not start or end instantaneously at the acoustic threshold:
- **Plosive Consonants** (/p/, /t/, /k/, /b/, /d/, /g/): Feature an unvoiced closure phase (silent buildup) lasting 30ms–80ms before the acoustic burst. If a cut is placed exactly at the burst, the consonant sounds clipped.
- **Vowel Trailing Decays**: Voiced vowels taper off gradually. Cutting prematurely causes unnatural popping.

### Prismex Padding Rules:
```
      [Word Start - 40ms]                 [Word End + 60ms]
       │                                   │
───────┼──[== Silent Closure ==]──[==== Spoken Word ====]──[== Decay ==]──┼───────
       │                                                                  │
       |<────────────── Protected Audio Retention Zone ──────────────────>|
```

1. **Pre-Roll Padding**: Every preserved word onset is padded by **-40 ms** (or up to the end of the previous word) to preserve plosive closures.
2. **Post-Roll Padding**: Every preserved word offset is padded by **+60 ms** (or up to the start of the next word) to preserve acoustic vowel decays.
3. **Collision Avoidance**: If padding causes overlap with an adjacent retained word, the boundary is snapped to the exact midpoint between the words.

---

## 5. Timeline Coordinate Mapping (`TickTime`)

Once microsecond boundaries are established, they are converted into Adobe Premiere Pro `TickTime` values to eliminate floating-point rounding errors:

```typescript
export function wordToTickBoundary(word: TranscriptWord): { startTick: string; endTick: string } {
  // Convert seconds (double) to exact 254,016,000,000 ticks per second
  const TICKS_PER_SEC = 254016000000n;
  
  const startTicks = BigInt(Math.round(word.startSeconds * Number(TICKS_PER_SEC)));
  const endTicks = BigInt(Math.round(word.endSeconds * Number(TICKS_PER_SEC)));
  
  return {
    startTick: startTicks.toString(),
    endTick: endTicks.toString()
  };
}
```
This ensures zero drift when timeline edits are executed across sequences exceeding 2 hours in length.
