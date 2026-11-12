# 17 — Security & Privacy Specification

## 1. Security Architecture & Threat Model

Video editing projects frequently involve highly sensitive, unreleased intellectual property: confidential corporate announcements, unreleased product demos, legal depositions, celebrity interviews, and private family archives.

Prismex AI Editor enforces a **Zero-Trust Privacy Architecture**.

```
+-------------------------------------------------------------------------------+
|                           LOCAL TRUST BOUNDARY (AIR-GAPPED)                   |
|                                                                               |
|  [ Adobe Premiere Pro Host ] <─── Loopback Only ───> [ Local Companion Core ] |
|  - Raw Video Assets                                   - SQLite Database       |
|  - Timeline Tracks                                    - Ephemeral Audio Cache |
|  - Sequence Audio                                     - Apple Silicon Models  |
|                                                                               |
|  [ macOS Keychain Vault ] <── Native Security API ──── [ Local Companion Core ]|
|  - AES-256 Encrypted Keys                             (Keys never hit disk)   |
+-------------------------------------------------------------------------------+
                                        │
                                        │ EXPLICIT USER CONSENT PER PROVIDER
                                        ▼ (TLS 1.3 Encrypted Socket)
+-------------------------------------------------------------------------------+
|                      EXTERNAL CLOUD PERIMETER (OPT-IN ONLY)                   |
|                      [Google AI Studio]  |  [Groq Cloud]                      |
+-------------------------------------------------------------------------------+
```

---

## 2. Secure Credential Storage via macOS Keychain

1. **Operating System Isolation**: Credentials are never written to plain-text configuration files, SQLite records, environment files (`.env`), or serialized frontend storage.
2. **Access Control**: API keys are saved directly into the user's macOS login keychain under the service identifier `com.prismex.editor.credentials`.
3. **Keychain Entitlements**: Only the notarized companion daemon binary can request credentials from this keychain service.
4. **Key Masking in UI**: When displayed in the Settings or Provider views, API keys are always masked with only the final 4 characters visible (`sk-••••••••••••9a2F`).

---

## 3. Cloud Upload Consent & Local-Only Privacy Guarantee

> [!IMPORTANT]
> **No media, audio, or transcript data is ever transmitted to an external cloud server without an explicit, understandable user setting.**

### The Three Privacy Levels:
1. **Level 1: Local-Only Mode (Maximum Privacy / Air-Gapped)**:
   - External network calls are physically blocked at the socket level.
   - All transcription is handled by local `mlx-whisper`.
   - All silence detection is handled by local Silero VAD and RMS DSP.
   - All take reasoning is handled by local heuristics or local language models.
   - Compliant with strict corporate NDAs, HIPAA, and GDPR requirements.
2. **Level 2: Free Cloud Assisted Mode (Opt-In)**:
   - User explicitly inputs free-tier API keys for Groq or Google Gemini.
   - Only extracted dialogue audio or textual sentences are sent; full raw video files are **never** uploaded.
   - Clear banner displayed during processing: *"Transcribing 8m audio via Groq Cloud (Free Tier)..."*
3. **Zero Telemetry / No Tracking**:
   - Prismex AI Editor contains zero analytics trackers, user behavior tracking, or third-party marketing SDKs.

---

## 4. Ephemeral Audio File Lifecycle & Shredding

When audio is extracted from Premiere Pro for transcription and VAD analysis, it is written to a dedicated, restricted cache folder:
`~/Library/Caches/com.prismex.editor/temp_audio/`

### Ephemeral Cleanup Protocol:
1. **File Naming**: Audio chunks are named using cryptographically random UUIDs (`chunk_8f91a2bc-3341-4c12.wav`).
2. **POSIX File Permissions**: Files are created with `0600` permissions (read/write exclusively by the current macOS user).
3. **Immediate Post-Processing Shredding**: As soon as transcription and forced alignment complete, the temporary WAV files are unlinked from disk (`os.remove()`).
4. **Daemon Exit Garbage Collection**: Upon daemon startup or shutdown, any orphan audio files older than 60 minutes are automatically scrubbed from the cache directory.

---

## 5. Secret-Redacted Audit Logging

Application logs are indispensable for debugging, but must never leak sensitive information.

### Log Redaction Filter:
All logging streams pass through an automated regex sanitization pipeline:
```python
# prismex_core/utils/logging_sanitizer.py
import re

PATTERNS_TO_REDACT = [
    (re.compile(r'sk-[a-zA-Z0-9]{20,60}'), '[REDACTED_API_KEY]'),
    (re.compile(r'AIzaSy[a-zA-Z0-9_-]{33}'), '[REDACTED_GEMINI_KEY]'),
    (re.compile(r'Bearer\s+[a-zA-Z0-9_\-\.]+'), 'Bearer [REDACTED_TOKEN]'),
    (re.compile(r'/Users/[a-zA-Z0-9_.-]+/'), '/Users/[USER]/')
]

def sanitize_log_message(msg: str) -> str:
    for pattern, replacement in PATTERNS_TO_REDACT:
        msg = pattern.sub(replacement, msg)
    return msg
```
This guarantees that diagnostic logs shared with support or archived on disk contain zero credentials or private user home directories.
