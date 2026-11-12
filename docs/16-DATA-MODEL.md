# 16 — Data Model & Storage Specification

## 1. Storage Architecture Overview

Prismex AI Editor requires persistent storage for transcripts, word timestamps, take clusters, review decisions, and editing profiles. 

### Storage Invariants:
1. **Embedded & Local**: Powered by **SQLite 3** operating in **WAL (Write-Ahead Logging)** mode. No external database servers or Docker containers required.
2. **Project-Scoped Isolation**: Each Premiere Pro project maintains its own isolated database file located at:
   `~/Library/Application Support/Prismex/projects/[ProjectUUID]/prismex_project.db`
3. **Zero Secrets in Database**: API keys and external credentials are strictly forbidden from SQLite storage; they reside exclusively in the macOS Keychain.
4. **Crash-Resistant Transactions**: Atomic SQLite transactions ensure that a sudden Premiere crash or power loss cannot corrupt existing transcripts or review queues.

---

## 2. Entity-Relationship Model (ERD)

```
+--------------------+        1:N        +-----------------------+
|      Project       | ────────────────> |       Sequence        |
+--------------------+                   +-----------------------+
                                                     │ 1:N
                                                     ├──────────────────────────┐
                                                     ▼                          ▼
                                          +---------------------+    +---------------------+
                                          |     Transcript      |    |    ProcessingJob    |
                                          +---------------------+    +---------------------+
                                                     │ 1:N                      │ 1:N
                                                     ▼                          ▼
                                          +---------------------+    +---------------------+
                                          |   TranscriptWord    |    |  EditingSuggestion  |
                                          +---------------------+    +---------------------+
                                                                                │ 1:1
                                                                                ▼
                                                                     +---------------------+
                                                                     |   ReviewDecision    |
                                                                     +---------------------+
```

---

## 3. SQL Database Schema (DDL)

```sql
-- Prismex Core Schema Version 1.0.0
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 1. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    premiere_project_path TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Sequences Table
CREATE TABLE IF NOT EXISTS sequences (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    premiere_sequence_guid TEXT NOT NULL,
    name TEXT NOT NULL,
    fps REAL NOT NULL,
    sample_rate INTEGER NOT NULL,
    duration_ticks TEXT NOT NULL,
    duration_seconds REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_seq_guid ON sequences(premiere_sequence_guid);

-- 3. Transcripts Table
CREATE TABLE IF NOT EXISTS transcripts (
    id TEXT PRIMARY KEY,
    sequence_id TEXT NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
    language TEXT DEFAULT 'en-US',
    engine_used TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transcripts_seq ON transcripts(sequence_id);

-- 4. Transcript Words Table (Microsecond Precision)
CREATE TABLE IF NOT EXISTS transcript_words (
    id TEXT PRIMARY KEY,
    transcript_id TEXT NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
    word TEXT NOT NULL,
    start_seconds REAL NOT NULL,
    end_seconds REAL NOT NULL,
    confidence REAL NOT NULL,
    speaker_tag TEXT,
    is_filler BOOLEAN DEFAULT 0,
    is_stutter BOOLEAN DEFAULT 0,
    take_group_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_words_time ON transcript_words(transcript_id, start_seconds);

-- 5. Take Groups Table
CREATE TABLE IF NOT EXISTS take_groups (
    id TEXT PRIMARY KEY,
    sequence_id TEXT NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
    canonical_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Take Candidates Table
CREATE TABLE IF NOT EXISTS take_candidates (
    id TEXT PRIMARY KEY,
    take_group_id TEXT NOT NULL REFERENCES take_groups(id) ON DELETE CASCADE,
    candidate_index INTEGER NOT NULL,
    start_seconds REAL NOT NULL,
    end_seconds REAL NOT NULL,
    transcript TEXT NOT NULL,
    fluency_score REAL,
    is_recommended BOOLEAN DEFAULT 0,
    rejection_reason TEXT
);

-- 7. Processing Jobs Table
CREATE TABLE IF NOT EXISTS processing_jobs (
    id TEXT PRIMARY KEY,
    sequence_id TEXT NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL, -- 'MAGIC_ROUGH_CUT', 'TRANSCRIPTION_ONLY', etc.
    status TEXT NOT NULL,   -- 'INITIALIZING', 'EXTRACTING', 'TRANSCRIBING', 'ANALYZING', 'COMPLETE', 'FAILED'
    progress_percent REAL DEFAULT 0.0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- 8. Editing Suggestions Table (Review Queue Items)
CREATE TABLE IF NOT EXISTS editing_suggestions (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
    sequence_id TEXT NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- 'SILENCE', 'FILLER_WORD', 'STUTTER', 'REPEATED_TAKE'
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'REJECTED', 'MODIFIED'
    start_seconds REAL NOT NULL,
    end_seconds REAL NOT NULL,
    duration_seconds REAL NOT NULL,
    confidence REAL NOT NULL,
    reason TEXT NOT NULL,
    transcript_snippet TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON editing_suggestions(sequence_id, status);

-- 9. Editing Profiles Table
CREATE TABLE IF NOT EXISTS editing_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_built_in BOOLEAN DEFAULT 0,
    silence_threshold_dbfs REAL DEFAULT -38.0,
    min_silence_duration_ms INTEGER DEFAULT 500,
    pre_cut_padding_ms INTEGER DEFAULT 80,
    post_cut_padding_ms INTEGER DEFAULT 120,
    remove_fillers BOOLEAN DEFAULT 1,
    remove_stutters BOOLEAN DEFAULT 1,
    take_mode TEXT DEFAULT 'BEST_TAKE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Provider Usage Ledger Table (Zero Secrets)
CREATE TABLE IF NOT EXISTS provider_usage (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    task_type TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    audio_seconds REAL DEFAULT 0.0,
    latency_ms INTEGER NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_usage_time ON provider_usage(provider_id, created_at);
```

---

## 4. Schema Migration Strategy

Database schema evolution is managed via an embedded lightweight migration runner:
1. **Schema Version Tracking**: SQLite's `user_version` PRAGMA records the current schema version (`PRAGMA user_version;`).
2. **Deterministic SQL Upgrades**: Migrations are versioned SQL files (`001_initial_schema.sql`, `002_add_speaker_diarization.sql`) applied sequentially within an atomic transaction.
3. **Forward-Compatible Downgrade Protection**: If a database is opened with a `user_version` higher than the running daemon's supported version, the daemon displays an upgrade notice and opens in read-only mode to prevent schema corruption.
