# 00 — Product Overview: Prismex AI Editor

## 1. Product Mission & Vision

**Prismex AI Editor** is an intelligent rough-cutting and video assembly system developed specifically for **Adobe Premiere Pro**. 

In modern video production, content creators, podcast editors, documentary filmmakers, corporate videographers, and educators spend up to 60–70% of their total editing time on raw assembly: scrubbing through unedited footage, locating usable takes, chopping out dead air or awkward pauses, excising filler words (*"um"*, *"uh"*, *"you know"*), and fixing verbal stutters.

Prismex AI Editor eliminates this assembly fatigue directly inside the professional video editor's primary environment—Adobe Premiere Pro—without requiring third-party cloud hosting, external web browser tools, or round-trip video exports.

---

## 2. Target Audience & Key Personas

| Persona | Workflow Profile | Key Pain Point Solved |
|---|---|---|
| **Solo YouTube / Creator** | Records 30–60 minutes of unscripted or semi-scripted A-roll to produce an 8–12 minute video. Multiple restarts per sentence. | Cuts 3 hours of manual timeline blading down to a 45-second one-click rough cut. |
| **Podcast / Interview Editor** | Multi-speaker, long-form conversation (45–120 minutes). High volume of pauses, hesitations, and conversational fillers. | Automatically trims pauses while preserving natural conversational cadence; synchronizes multi-track audio. |
| **Corporate / Screencast Producer** | Explainer videos, product demos, software tutorials. Frequent re-takes of technical explanations. | Identifies repeated takes automatically, keeping only the final polished delivery or AI-judged clearest delivery. |
| **Agency / Production House Editor** | Heavy commercial workload across tight deadlines; works under strict confidentiality and privacy agreements. | Runs 100% locally on Apple Silicon Mac without uploading client media or corporate audio to the public cloud. |

---

## 3. Core Value Proposition & Differentiators

```
Traditional Workflow (3-5 Hours)
[Raw Footage] ──> [Scrub Timeline] ──> [Manual Razor Blade] ──> [Ripple Delete] ──> [Rough Cut]
                                                                                      ▲
Prismex Workflow (45-90 Seconds)                                                      │
[Raw Footage] ──> [Click "Magic Rough Cut"] ──> [AI Analysis & Sync Guard] ───────────┘
```

1. **Native Adobe Premiere Pro Integration**: Built as a native UXP panel inside Premiere Pro (v24.x and v25.x). No round-tripping through XML exports or third-party web apps (like Descript).
2. **Apple Silicon Hardware Optimization**: Tailored specifically for Apple Silicon M-series MacBooks with 16 GB of Unified Memory, leveraging Apple MLX, CoreML, and GPU/Neural Engine acceleration.
3. **Zero Subscription Requirement**: The core application functions with zero mandatory subscriptions. Local models (MLX-Whisper, Silero VAD, Wav2Vec2) execute offline.
4. **Free-Only Cloud AI Guard**: Users who wish to leverage cloud speed can supply free-tier API keys (Google Gemini Flash, Groq Whisper/Llama, Cerebras). A hardware-enforced budget guard prevents accidental billing.
5. **Non-Destructive Philosophy**: Original sequences and raw media files are never altered. Edits are generated on a newly duplicated sequence (`[Sequence]_PrismexRoughCut`), enabling instant A/B comparison.
6. **Dual Operating Modes**: Supports fully automated 1-click execution (**Magic Auto Edit**) and human-in-the-loop inspection (**Magic Review Edit**).

---

## 4. Hardware & Platform Constraints

The entire architecture is designed under strict constraints to ensure fluid performance on a standard production workstation:

- **Host Platform**: Apple Silicon MacBook (M1/M2/M3/M4, Pro, or Max), running macOS 14.0 (Sonoma) or macOS 15.0 (Sequoia).
- **RAM Constraint**: 16 GB Unified Memory.
  - *Hard Memory Budget for Prismex*: Maximum **2.5 GB RAM** allocated across all background processes.
  - *Host Reserve*: Minimum **13.5 GB RAM** preserved exclusively for Adobe Premiere Pro rendering, playback buffers, and macOS system services.
- **Host Application**: Adobe Premiere Pro v24.0 or higher (exclusively; no After Effects or multi-host abstractions).
- **Execution Model**: Single model in memory at any point in time; aggressive dynamic model loading and unloading.

---

## 5. System Philosophy & Non-Negotiables

1. **Audio/Video Sync is Inviolable**: An AI rough-cutting tool is useless if audio drifts by a single frame. Sync across linked and multi-camera tracks is verified before and after every timeline cut.
2. **Local Fallback Always Available**: If cloud APIs fail, rate limit, or go offline, the system must seamlessly fall back to local Apple Silicon engines without user intervention.
3. **Transparent Decision Making**: Every cut suggested by the system includes an auditable rationale (e.g., *"Silence: 1.4s duration, -38 dBFS"*, *"Filler: 'um' confidence 0.94"*, *"Take 3 of 3: Fluency score 9.2 vs 6.1"*).
4. **Privacy-First**: No media, audio, or transcript data is ever transmitted to an external server unless the user has explicitly selected a cloud provider and provided their personal API key.
