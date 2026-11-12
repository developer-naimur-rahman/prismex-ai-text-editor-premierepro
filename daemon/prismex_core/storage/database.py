"""
DatabaseManager - SQLite 3 Embedded Database with WAL Mode
Specification: docs/16-DATA-MODEL.md
"""

import sqlite3
from pathlib import Path
from typing import List, Dict, Any, Optional
from ..config import DEFAULT_DB_PATH

class DatabaseManager:
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = str(db_path or DEFAULT_DB_PATH)
        self.init_db()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    def init_db(self) -> None:
        """Initializes tables and indexes according to Data Model specification."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.executescript("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                premiere_project_path TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sequences (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                premiere_sequence_guid TEXT NOT NULL,
                name TEXT NOT NULL,
                fps REAL NOT NULL,
                sample_rate INTEGER NOT NULL,
                duration_ticks TEXT NOT NULL,
                duration_seconds REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_seq_guid ON sequences(premiere_sequence_guid);

            CREATE TABLE IF NOT EXISTS transcripts (
                id TEXT PRIMARY KEY,
                sequence_id TEXT NOT NULL,
                language TEXT DEFAULT 'en-US',
                engine_used TEXT NOT NULL,
                raw_text TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS transcript_words (
                id TEXT PRIMARY KEY,
                transcript_id TEXT NOT NULL,
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

            CREATE TABLE IF NOT EXISTS processing_jobs (
                id TEXT PRIMARY KEY,
                sequence_id TEXT NOT NULL,
                job_type TEXT NOT NULL,
                status TEXT NOT NULL,
                progress_percent REAL DEFAULT 0.0,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS editing_suggestions (
                id TEXT PRIMARY KEY,
                job_id TEXT NOT NULL,
                sequence_id TEXT NOT NULL,
                category TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'PENDING',
                start_seconds REAL NOT NULL,
                end_seconds REAL NOT NULL,
                duration_seconds REAL NOT NULL,
                confidence REAL NOT NULL,
                reason TEXT NOT NULL,
                transcript_snippet TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_suggestions_status ON editing_suggestions(sequence_id, status);

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
            """)

            # Seed default profiles if not present
            cursor.execute("SELECT COUNT(*) FROM editing_profiles")
            if cursor.fetchone()[0] == 0:
                cursor.executescript("""
                INSERT INTO editing_profiles (id, name, is_built_in, silence_threshold_dbfs, min_silence_duration_ms, pre_cut_padding_ms, post_cut_padding_ms, remove_fillers, remove_stutters, take_mode)
                VALUES 
                ('talking-head', 'Talking Head', 1, -38.0, 500, 80, 120, 1, 1, 'BEST_TAKE'),
                ('podcast', 'Podcast', 1, -42.0, 700, 100, 150, 1, 0, 'LAST_TAKE'),
                ('aggressive-cut', 'Aggressive Cut', 1, -32.0, 300, 40, 60, 1, 1, 'BEST_TAKE'),
                ('real-estate', 'Real Estate Walkthrough', 1, -45.0, 1200, 150, 200, 0, 0, 'MANUAL');
                """)
            conn.commit()

    def save_job(self, job_data: Dict[str, Any]) -> None:
        with self.get_connection() as conn:
            conn.execute("""
            INSERT OR REPLACE INTO processing_jobs (id, sequence_id, job_type, status, progress_percent, error_message)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (
                job_data["id"],
                job_data["sequence_id"],
                job_data["job_type"],
                job_data["status"],
                job_data.get("progress_percent", 0.0),
                job_data.get("error_message")
            ))
            conn.commit()

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            row = conn.execute("SELECT * FROM processing_jobs WHERE id = ?", (job_id,)).fetchone()
            return dict(row) if row else None

    def save_suggestions(self, suggestions: List[Dict[str, Any]]) -> None:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            for s in suggestions:
                cursor.execute("""
                INSERT OR REPLACE INTO editing_suggestions 
                (id, job_id, sequence_id, category, status, start_seconds, end_seconds, duration_seconds, confidence, reason, transcript_snippet)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    s["id"], s["job_id"], s["sequence_id"], s["category"],
                    s.get("status", "PENDING"), s["start_seconds"], s["end_seconds"],
                    s["duration_seconds"], s["confidence"], s["reason"], s.get("transcript_snippet", "")
                ))
            conn.commit()

    def get_suggestions(self, job_id: str) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            rows = conn.execute("SELECT * FROM editing_suggestions WHERE job_id = ? ORDER BY start_seconds ASC", (job_id,)).fetchall()
            return [dict(r) for r in rows]

    def update_suggestion_status(self, suggestion_id: str, status: str) -> None:
        with self.get_connection() as conn:
            conn.execute("UPDATE editing_suggestions SET status = ? WHERE id = ?", (status, suggestion_id))
            conn.commit()

    def get_profiles(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            rows = conn.execute("SELECT * FROM editing_profiles ORDER BY is_built_in DESC, name ASC").fetchall()
            return [dict(r) for r in rows]
