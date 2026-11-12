# Prismex AI Editor — Architectural Specification & Engineering Blueprint

[![Platform](https://img.shields.io/badge/Platform-Adobe%20Premiere%20Pro%20(v24%2B%20%2F%20v25%2B)-blue.svg)]()
[![Target OS](https://img.shields.io/badge/OS-macOS%20Apple%20Silicon%20(M--Series)-black.svg)]()
[![Hardware](https://img.shields.io/badge/Hardware-16%20GB%20RAM%20Unified%20Memory-purple.svg)]()
[![Architecture](https://img.shields.io/badge/Architecture-UXP%20Plugin%20%2B%20Local%20Daemon%20(FastAPI%20%2F%20MLX)-emerald.svg)]()
[![Licensing / Cost](https://img.shields.io/badge/AI%20Cost-Zero%20Subscription%20%2F%20Free--Only%20Guard-green.svg)]()

Welcome to the comprehensive, implementation-ready technical documentation repository for **Prismex AI Editor**, an advanced AI-assisted rough-cutting and video editing system integrated directly inside Adobe Premiere Pro.

---

## Executive Summary

Prismex AI Editor accelerates long-form video editing (such as talking-head videos, podcasts, interviews, tutorials, and real estate presentations) by automating the tedious initial assembly phases:
1. **Automated Transcription & Word-Level Forced Alignment**: Generates millisecond-accurate timestamps for every spoken word using Apple Silicon-native MLX-Whisper and Wav2Vec2 CTC alignment.
2. **Deterministic & AI-Assisted Signal Analysis**: Detects awkward silences (Silero VAD + adaptive RMS energy), filler words (*"um"*, *"uh"*, *"like"*), verbal stutters, and repeated sentences/takes.
3. **Magic Rough Cut Engine**: Translates speech and content decisions into non-destructive Premiere Pro timeline edits at the click of a single button—either automatically or via an interactive human-in-the-loop Review Queue.
4. **Local-First & Free-Only Guarantee**: Engineered specifically for Apple Silicon MacBooks with 16 GB RAM. The core runs 100% locally with zero subscription requirements, while supporting user-supplied free-tier cloud AI providers (Google Gemini Flash, Groq Cloud, Cerebras) protected by a strict Free-Only budget guard.

---

## Architectural Highlights

```
┌────────────────────────────────────────────────────────┐
│               Adobe Premiere Pro (Host)               │
│  ┌──────────────────────────────────────────────────┐  │
│  │   Prismex UXP Plugin Panel (React 18 + Tailwind) │  │
│  │   - Dashboard, Review Queue, Transcript Editor   │  │
│  │   - UXP Premiere DOM Bridge (SequenceEditor API) │  │
│  └────────────────────────┬─────────────────────────┘  │
└───────────────────────────┼────────────────────────────┘
                            │ JSON-RPC / WebSocket (127.0.0.1:49152)
┌───────────────────────────▼────────────────────────────┐
│         Prismex Local Core Daemon (macOS ARM64)        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ FastAPI Gateway + Async Job Queue + SQLite WAL   │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ Local Engines: MLX-Whisper, Wav2Vec2, Silero VAD │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ AI Router + Free-Only Guard + macOS Keychain     │  │
│  └────────────────────────┬─────────────────────────┘  │
└───────────────────────────┼────────────────────────────┘
                            │ HTTPS / TLS (Optional User Keys)
┌───────────────────────────▼────────────────────────────┐
│      Free-Tier Cloud AI Ecosystem (Groq / Gemini)       │
└────────────────────────────────────────────────────────┘
```

---

## Documentation Navigation

This documentation suite is organized into 26 numbered modular specifications and visual diagrams:

| Index | Document | Purpose & Scope |
|---|---|---|
| **00** | [Product Overview](docs/00-PRODUCT-OVERVIEW.md) | Vision, target audience, core value proposition, hardware constraints, and operating modes |
| **01** | [Product Requirements (PRD)](docs/01-PRODUCT-REQUIREMENTS.md) | Detailed functional, non-functional, operational, and user persona requirements |
| **02** | [Technical Feasibility Matrix](docs/02-TECHNICAL-FEASIBILITY.md) | Evidence-backed verification of Premiere UXP APIs, ML models, and providers with citations |
| **03** | [System Architecture](docs/03-SYSTEM-ARCHITECTURE.md) | Deep architectural blueprint, IPC protocol, subsystem boundaries, and data flows |
| **04** | [Premiere Pro Integration](docs/04-PREMIERE-PRO-INTEGRATION.md) | UXP DOM (`premierepro`), `SequenceEditor`, `TickTime`, manifest v5, and timeline bridge |
| **05** | [Plugin UI & UX](docs/05-PLUGIN-UI-UX.md) | Spectrum-compliant panel design, 10 view specifications, layout wireframes, keyboard shortcuts |
| **06** | [AI Provider Ecosystem](docs/06-AI-PROVIDER-ECOSYSTEM.md) | Cloud & local model matrix, rate limits, free-tier quotas, and secure keychain credential vault |
| **07** | [Task-Based AI Router](docs/07-AI-ROUTER.md) | Capability-based routing algorithm, fallback cascades, circuit breakers, and Free-Only guards |
| **08** | [Transcription Engine](docs/08-TRANSCRIPTION-ENGINE.md) | MLX-Whisper, Faster-Whisper, audio chunking, VAD pre-segmentation, and benchmark profiles |
| **09** | [Word-Level Alignment](docs/09-WORD-ALIGNMENT.md) | Wav2Vec2 CTC forced alignment vs DTW cross-attention, phoneme mapping, microsecond accuracy |
| **10** | [Silence Detection](docs/10-SILENCE-DETECTION.md) | Dual-engine silence detection (Silero VAD v5 + adaptive RMS energy) and natural breath preservation |
| **11** | [Repeated Take Detection](docs/11-REPEATED-TAKE-DETECTION.md) | Last Take, Best Take, and Hybrid modes; Levenshtein, n-gram, and semantic similarity scoring |
| **12** | [Filler Word & Stutter Detection](docs/12-FILLER-STUTTER-DETECTION.md) | Multi-lingual filler catalogs, token repetition detection, and semantic protection heuristics |
| **13** | [Magic Rough Cut Specification](docs/13-MAGIC-ROUGH-CUT.md) | End-to-end master feature specification: Auto Edit vs Review Edit, conflict resolution, cut lists |
| **14** | [Review Queue](docs/14-REVIEW-QUEUE.md) | Human-in-the-loop review interface, card anatomy, scrubbing preview, and batch approvals |
| **15** | [Timeline Editing Engine](docs/15-TIMELINE-EDITING-ENGINE.md) | Concrete timeline operations, Backward Ripple Delete vs Reassembly, track locking, sync protection |
| **16** | [Data Model & Storage](docs/16-DATA-MODEL.md) | SQLite 3 relational schema (WAL mode), TypeScript interfaces, DDL tables, migration plan |
| **17** | [Security & Privacy](docs/17-SECURITY-PRIVACY.md) | Zero-trust cloud consent, macOS Keychain isolation, ephemeral audio shredding, audit logging |
| **18** | [Performance & Resource Management](docs/18-PERFORMANCE-OPTIMIZATION.md) | 16 GB Apple Silicon memory budgeting (<2.5 GB daemon ceiling), dynamic model eviction, Neon SIMD |
| **19** | [Error Handling & Fallbacks](docs/19-ERROR-HANDLING.md) | 16+ failure scenarios, diagnostic messages, automated fallbacks, and recovery protocols |
| **20** | [Testing Strategy](docs/20-TESTING-STRATEGY.md) | Unit, integration, audio/video sync drift verification (flash/beep), synthetic timelines |
| **21** | [Implementation Roadmap](docs/21-IMPLEMENTATION-ROADMAP.md) | 12-phase development plan (Phase 0 to Phase 11) with milestones, risks, and acceptance criteria |
| **22** | [Acceptance Criteria](docs/22-ACCEPTANCE-CRITERIA.md) | Rigorous Given-When-Then criteria for all core features and performance benchmarks |
| **23** | [API Reference](docs/23-API-REFERENCE.md) | Comprehensive REST and WebSocket API schemas, JSON-RPC payloads, and error codes |
| **24** | [Architectural Decision Records (ADR)](docs/24-DECISION-LOG.md) | Documented justifications for 10 foundational architectural decisions |
| **25** | [Glossary](docs/25-GLOSSARY.md) | Comprehensive definitions of video editing, AI/ML, and Adobe UXP concepts |

---

## Architectural Diagrams (Mermaid)

- [Master Architecture Diagram](MASTER-ARCHITECTURE.mmd)
- [System Data Flow Sequence](SYSTEM-DATA-FLOW.mmd)
- [Magic Rough Cut Pipeline Flow](MAGIC-ROUGH-CUT-FLOW.mmd)
- [AI Provider Routing Flow](PROVIDER-ROUTING-FLOW.mmd)
- [Timeline Editing Execution Flow](TIMELINE-EDITING-FLOW.mmd)

---

## Non-Negotiable Core Principles

1. **Non-Destructive by Design**: Original sequences and original media are never modified or overwritten. All edits are applied to a freshly cloned sequence (`SequenceName_PrismexRoughCut`).
2. **Zero-Subscription Local Baseline**: Core transcription, silence removal, filler-word filtering, and timeline editing function 100% offline using Apple Silicon accelerated models.
3. **Free-Only Cloud Guard**: External cloud APIs are strictly opt-in and restricted to verified free-tier models with explicit zero-dollar cost controls.
4. **Preserved Audio/Video Sync**: Multi-track linked clips and sync relationships are strictly maintained using microsecond `TickTime` conversions and atomic sequence editor actions.
5. **Human-in-the-Loop Review**: In addition to one-click automatic rough cuts, users maintain total editorial control via an interactive Review Queue.
