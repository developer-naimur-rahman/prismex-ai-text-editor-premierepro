# Prismex AI Editor — Master Documentation Index

This document provides a structured map of all engineering documentation, system design specifications, and architectural diagrams for the **Prismex AI Editor** project.

---

## 1. Document Directory & Cross-Reference Map

```
docs/
├── 00-PRODUCT-OVERVIEW.md             [Core Vision & Strategy]
├── 01-PRODUCT-REQUIREMENTS.md         [Product Requirements Document / PRD]
├── 02-TECHNICAL-FEASIBILITY.md        [API Feasibility & Citation Matrix]
├── 03-SYSTEM-ARCHITECTURE.md          [End-to-End System Architecture]
├── 04-PREMIERE-PRO-INTEGRATION.md     [Adobe Premiere Pro UXP DOM Integration]
├── 05-PLUGIN-UI-UX.md                 [Panel UI/UX Design System & Views]
├── 06-AI-PROVIDER-ECOSYSTEM.md        [Cloud & Local AI Provider Matrix]
├── 07-AI-ROUTER.md                    [Task-Based AI Capability Router]
├── 08-TRANSCRIPTION-ENGINE.md         [Speech Recognition Architecture]
├── 09-WORD-ALIGNMENT.md               [Word-Level Forced Alignment Engine]
├── 10-SILENCE-DETECTION.md            [VAD & Signal Silence Detection]
├── 11-REPEATED-TAKE-DETECTION.md      [Linguistic Repeated Take Classifier]
├── 12-FILLER-STUTTER-DETECTION.md     [Filler Word & Stutter Heuristics]
├── 13-MAGIC-ROUGH-CUT.md              [Master Pipeline: Magic Rough Cut]
├── 14-REVIEW-QUEUE.md                 [Interactive Review Queue System]
├── 15-TIMELINE-EDITING-ENGINE.md      [Premiere Pro Timeline Manipulation]
├── 16-DATA-MODEL.md                   [SQLite Database Schema & TypeScript Types]
├── 17-SECURITY-PRIVACY.md             [Privacy Boundaries & Keychain Storage]
├── 18-PERFORMANCE-OPTIMIZATION.md     [Apple Silicon & 16GB RAM Tuning]
├── 19-ERROR-HANDLING.md               [Failure Scenarios & Recovery Cascades]
├── 20-TESTING-STRATEGY.md             [Comprehensive QA & Verification Suite]
├── 21-IMPLEMENTATION-ROADMAP.md       [Phased 12-Stage Delivery Plan]
├── 22-ACCEPTANCE-CRITERIA.md          [Feature Acceptance & Benchmark Criteria]
├── 23-API-REFERENCE.md                [Local Daemon REST & WebSocket Specs]
├── 24-DECISION-LOG.md                 [Architectural Decision Records / ADRs]
└── 25-GLOSSARY.md                     [Standardized Terminology & Definitions]
```

---

## 2. Diagram Inventory (Mermaid Architecture)

| Diagram File | Description | Primary Reference Docs |
|---|---|---|
| `MASTER-ARCHITECTURE.mmd` | Complete system topology: Premiere Pro UXP, Daemon, ML engines, and Cloud providers | `docs/03-SYSTEM-ARCHITECTURE.md` |
| `SYSTEM-DATA-FLOW.mmd` | End-to-end asynchronous sequence diagram from button click to rough cut delivery | `docs/03-SYSTEM-ARCHITECTURE.md`, `docs/13-MAGIC-ROUGH-CUT.md` |
| `MAGIC-ROUGH-CUT-FLOW.mmd` | Multi-stage pipeline logic, parallel analysis, cut consolidation, and branch modes | `docs/13-MAGIC-ROUGH-CUT.md` |
| `PROVIDER-ROUTING-FLOW.mmd` | Task capability evaluation, Free-Only budget guard, and automated failover | `docs/07-AI-ROUTER.md`, `docs/06-AI-PROVIDER-ECOSYSTEM.md` |
| `TIMELINE-EDITING-FLOW.mmd` | Non-destructive sequence cloning, track protection, and reverse-ripple execution | `docs/15-TIMELINE-EDITING-ENGINE.md`, `docs/04-PREMIERE-PRO-INTEGRATION.md` |

---

## 3. Reading Paths by Engineering Role

### For Adobe Premiere Pro Extension Engineers
1. `docs/04-PREMIERE-PRO-INTEGRATION.md` — UXP DOM, `SequenceEditor`, `TickTime`, and Manifest v5.
2. `docs/15-TIMELINE-EDITING-ENGINE.md` — Concrete timeline manipulation, reverse ripple editing, and clip syncing.
3. `docs/05-PLUGIN-UI-UX.md` — React panel structure, Adobe Spectrum styling, and dockable panel lifecycles.
4. `docs/23-API-REFERENCE.md` — WebSocket & REST client integration with the local companion daemon.

### For AI/ML Systems & Backend Engineers
1. `docs/03-SYSTEM-ARCHITECTURE.md` — Daemon process architecture, job queues, and IPC.
2. `docs/08-TRANSCRIPTION-ENGINE.md` — MLX-Whisper and Faster-Whisper integration on Apple Silicon.
3. `docs/09-WORD-ALIGNMENT.md` — Wav2Vec2 CTC forced alignment and microsecond timestamp extraction.
4. `docs/10-SILENCE-DETECTION.md` — Silero VAD v5 and adaptive RMS noise-floor detection.
5. `docs/11-REPEATED-TAKE-DETECTION.md` & `docs/12-FILLER-STUTTER-DETECTION.md` — Linguistic and semantic models.
6. `docs/06-AI-PROVIDER-ECOSYSTEM.md` & `docs/07-AI-ROUTER.md` — Cloud AI routing, free-tier rate limits, and fallback cascades.
7. `docs/18-PERFORMANCE-OPTIMIZATION.md` — 16 GB Apple Silicon unified memory budgeting and model lifecycle management.

### For Product Managers, QA Engineers & Documentation Leads
1. `docs/00-PRODUCT-OVERVIEW.md` & `docs/01-PRODUCT-REQUIREMENTS.md` — Scope, personas, and feature boundaries.
2. `docs/13-MAGIC-ROUGH-CUT.md` & `docs/14-REVIEW-QUEUE.md` — User journeys, state transitions, and edge cases.
3. `docs/20-TESTING-STRATEGY.md` & `docs/22-ACCEPTANCE-CRITERIA.md` — QA plans, test matrices, and pass/fail thresholds.
4. `docs/21-IMPLEMENTATION-ROADMAP.md` — Phase deliverables, dependencies, and risks.
5. `docs/24-DECISION-LOG.md` — ADR rationale behind all major architectural choices.

---

## 4. Technical Verification Summary

All specifications in this repository have been strictly verified against official documentation as of November 2026:
- **Adobe Premiere Pro UXP DOM**: Verified against Adobe UXP API v25.x reference (`@adobe/premierepro` `SequenceEditor`, `TickTime`, `Project.createSequence`).
- **Apple Silicon Hardware Bounds**: Verified against macOS 14+ / 15+ unified memory architecture on 16 GB M-series hardware.
- **Local Machine Learning**: Verified against Apple MLX framework (`mlx-whisper`), PyTorch CTC alignment (`torchaudio`/`wav2vec2`), and Silero VAD v5 ONNX runtime.
- **Cloud Providers**: Verified against Google AI Studio (Gemini Flash), Groq Cloud (Whisper-v3, Llama 3.3), and Cerebras Cloud free-tier documentation.
