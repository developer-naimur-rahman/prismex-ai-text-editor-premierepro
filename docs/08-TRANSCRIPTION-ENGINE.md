# 08 — Transcription Engine Specification

## 1. Transcription Architecture Overview

Speech-to-Text (STT) is the perceptual foundation of Prismex AI Editor. The transcription engine must convert speech audio into a verbatim, punctuated text stream with microsecond-accurate word boundaries, sentence divisions, and speaker tags.

```
[ Raw Audio WAV 16kHz ] ──> [ Silero VAD Pre-Segmentation ] ──> [ Speech Chunks ]
                                                                      │
                                                                      ▼
                                                      [ Speech Recognition Model ]
                                                      (MLX-Whisper / Groq Cloud)
                                                                      │
                                                                      ▼
                                                      [ Raw Segment Text & Tokens ]
                                                                      │
                                                                      ▼
                                                      [ Normalizer & Grouping Engine ]
                                                      (Sentences, Paragraphs, Punctuation)
                                                                      │
                                                                      ▼
                                                      [ Structured Transcript Model ]
```

---

## 2. Speech Engine Evaluation for Apple Silicon (16 GB RAM)

| Engine | Execution Runtime | Model Size / Quant | RAM Peak | Speed (RTF) | Apple Silicon Suitability | Recommendation |
|---|---|---|---|---|---|---|
| **MLX-Whisper** | Apple MLX (Metal GPU/ANE) | `large-v3-turbo` (4-bit) | **1.15 GB** | **0.05x** (20x RT) | **Native / Optimal** | **Primary Local Engine** |
| **Faster-Whisper** | CTranslate2 (ARM NEON) | `small.en` (int8) | **680 MB** | **0.18x** (5.5x RT) | High (CPU only) | **Local Fallback Engine** |
| **OpenAI Whisper (PyTorch)** | PyTorch MPS | `base.en` (fp16) | **1.85 GB** | **0.35x** (2.8x RT) | Moderate (High VRAM overhead) | Excluded (High memory) |
| **WhisperX** | PyTorch + Torchaudio | `large-v3` + Wav2Vec2 | **3.20 GB** | **0.12x** (8x RT) | Exceeds single-model RAM budget | Modularized (Components split) |
| **Groq Whisper** | Remote Cloud LPU | `whisper-large-v3` | **0 MB Local** | **0.01x** (100x RT) | Zero local footprint | **Primary Cloud Engine** |

### Selected Architecture:
1. **Primary Local Engine**: `mlx-whisper` using `mlx-community/whisper-large-v3-turbo-4bit`. It operates natively on Apple Silicon's unified memory architecture, utilizing the GPU and Neural Engine with sub-1.2 GB RAM footprint.
2. **Local CPU Fallback**: `faster-whisper` (`small.en` int8) if MLX compilation encounters unexpected macOS kernel issues.
3. **High-Speed Cloud Engine**: Groq Cloud `whisper-large-v3-turbo` for instantaneous (~5-second) turnaround when internet and API keys are available.

---

## 3. Audio Chunking & VAD Pre-Segmentation

Feeding long audio files (e.g., 60–120 minutes) directly into Whisper causes attention drift, hallucination loops during extended silence, and excessive memory accumulation.

Prismex utilizes **VAD-Guided Acoustic Chunking**:
1. **Silero VAD Scan**: Audio is scanned with a 30ms window to identify continuous speech blocks.
2. **Chunk Boundary Splitting**: Split boundaries are placed only within verified silence regions (>600ms of non-speech), preventing words from being sliced in half.
3. **Chunk Duration Ceiling**: Chunks are sized between 15 and 28 seconds (Whisper's native receptive field is 30 seconds).
4. **Context Carry-Over**: The last 20 tokens of the previous chunk are supplied as a prompt prefix to maintain grammatical consistency across boundaries.

---

## 4. Distinguishing Speech Recognition, Forced Alignment, and Diarization

A frequent failure mode in automated editing systems is assuming an STT model provides accurate word boundaries.

```
+-------------------------------------------------------------------------------+
| STT Decoding (Whisper)                                                        |
| Predicts: "We are building an incredible AI video editor."                    |
| Timestamps: Derived from cross-attention weights. Inherent jitter: ±150-300ms.|
+-------------------------------------------------------------------------------+
                                        │
                                        ▼
+-------------------------------------------------------------------------------+
| Phoneme Forced Alignment (Wav2Vec2 CTC)                                       |
| Aligns known transcript phonemes against exact acoustic waveform features.     |
| Microsecond Accuracy: Precision < 15ms. Inviolable word onsets/offsets.       |
+-------------------------------------------------------------------------------+
                                        │
                                        ▼
+-------------------------------------------------------------------------------+
| Speaker Diarization (Optional Multi-Speaker Mode)                             |
| Generates speaker acoustic embeddings to assign labels: [Speaker A, Speaker B] |
+-------------------------------------------------------------------------------+
```

---

## 5. Transcript Data Model

The transcription engine yields a strongly-typed hierarchical data structure:

```typescript
export interface TranscriptWord {
  id: string;
  word: string;
  startSeconds: number;
  endSeconds: number;
  confidence: number;
  speakerTag?: string;
  isFiller: boolean;
  isStutter: boolean;
  takeGroupId?: string;
}

export interface TranscriptSentence {
  id: string;
  sentence: string;
  startSeconds: number;
  endSeconds: number;
  words: TranscriptWord[];
}

export interface TranscriptParagraph {
  id: string;
  sentences: TranscriptSentence[];
  startSeconds: number;
  endSeconds: number;
  speakerTag?: string;
}

export interface CompleteTranscript {
  sequenceId: string;
  totalDurationSeconds: number;
  wordsCount: number;
  paragraphs: TranscriptParagraph[];
}
```

---

## 6. Text Normalization & Punctuation Restoration

Raw STT output often lacks clean sentence boundaries. The engine applies:
1. **Standard Whisper Normalizer**: Normalizes numbers (*"twenty-two"* -> *"22"*), currencies, and abbreviations while preserving spoken verbatim forms in the word array.
2. **Acoustic Pause Sentence Segmentation**: Pauses greater than 450ms combined with terminal punctuation (`.`, `?`, `!`) trigger sentence boundaries.
3. **Paragraph Segmentation**: Pauses greater than 1,200ms or speaker shifts trigger paragraph breaks, matching natural video pacing.
