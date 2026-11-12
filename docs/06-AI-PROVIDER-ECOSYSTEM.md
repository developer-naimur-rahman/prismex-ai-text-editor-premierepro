# 06 — AI Provider Ecosystem & Credential Vault

## 1. Provider Ecosystem Strategy & Philosophy

Prismex AI Editor is built on an **Independent, Multi-Provider Architecture**. 

To deliver the best possible editing experience without vendor lock-in or recurring subscription fees, Prismex supports:
1. **Local-First Native Engines**: Fully offline, Apple Silicon-optimized models (MLX-Whisper, Silero VAD, Wav2Vec2) that require no internet connection, no API keys, and zero external costs.
2. **User-Supplied Free-Tier Cloud Providers**: External APIs where users register for legitimate free-tier developer keys (Google Gemini, Groq, Cerebras, OpenRouter).
3. **Strict Free-Only Protection**: A system-level safeguard that guarantees the user is never billed a single cent without explicit, informed confirmation.

---

## 2. Comprehensive Provider Capability Matrix

| Provider | Model / Endpoint | Free-Tier Limits & Quota | Audio Input? | Word Timestamps? | Best Task Fit | Limitations & Caveats |
|---|---|---|---|---|---|---|
| **Local (Apple Silicon)** | `mlx-whisper-large-v3-turbo` / `small.en` | **Unlimited** (Offline) | Yes | Yes (DTW + Wav2Vec2 CTC) | Core STT, forced alignment, 100% privacy | Requires Apple Silicon hardware; uses ~1.2 GB Unified RAM. |
| **Local (Apple Silicon)** | `Silero VAD v5` (ONNX) | **Unlimited** (Offline) | Yes | N/A | Sub-second silence & speech boundary detection | Analyzes audio energy; does not transcribe. |
| **Google Gemini** | `gemini-1.5-flash` / `gemini-2.0-flash` | 15 RPM, 1,000,000 TPM, 1,500 RPD | **Yes** (Multimodal audio up to 1 hr) | No (Text & segment only) | Best-take semantic reasoning, context analysis | Cannot provide microsecond word boundaries directly. |
| **Groq Cloud** | `whisper-large-v3-turbo` | 20 RPM, 2,000 RPD, 7,200 audio sec/hr | **Yes** (WAV/MP3 up to 25MB) | **Yes** (via `verbose_json` DTW) | Lightning-fast cloud transcription (~100x RT) | 25MB audio file limit requires chunking long videos. |
| **Groq Cloud** | `llama-3.3-70b-versatile` | 30 RPM, 6,000 TPM, 1,000 RPD | No | N/A | High-speed take ranking & filler classification | Strict TPM ceiling (6k tokens/min on free tier). |
| **Cerebras Cloud** | `llama-3.1-70b` | 30 RPM, 60,000 TPM | No | N/A | Ultra-low-latency take comparison (<0.4s) | Text-only; no audio ingestion. |
| **OpenRouter** | `:free` tagged models (e.g., Llama 3.3 Free) | 20 RPM (dynamic community limits) | No | N/A | Auxiliary fallback for take reasoning | Availability varies; rate limits fluctuate dynamically. |
| **ElevenLabs** | Free Tier TTS | 10,000 chars/month | No | N/A | **Excluded** | Primarily speech synthesis; unsuited for rough-cutting. |

---

## 3. Free-Only Protection System (Hard Budget Guard)

The Free-Only Guard is a mandatory security and cost-prevention layer enforced in the Local Core Daemon:

```
                          [ Incoming Provider Request ]
                                        │
                                        ▼
                  Is Free-Only Protection Enabled? (Default: YES)
                                        │
                    ┌───────────────────┴───────────────────┐
                    │ YES                                   │ NO
                    ▼                                       ▼
    Is the requested model/endpoint           Has user configured an explicit
        on the VERIFIED FREE list?                monthly dollar budget cap?
                    │                                       │
            ┌───────┴───────┐                       ┌───────┴───────┐
            │ YES           │ NO                    │ YES           │ NO
            ▼               ▼                       ▼               ▼
      [ALLOW CALL]    [BLOCK CALL]          Has spend cap   [BLOCK CALL]
                      Return HTTP 403:      been reached?    Prompt user for
                     "Paid endpoint blocked       │          budget limit
                      by Free-Only Guard"    ┌────┴────┐
                                             │ NO      │ YES
                                             ▼         ▼
                                         [ALLOW]  [BLOCK CALL]
```

### Free-Only Guard Invariants:
1. **Zero Silent Fallback to Paid Endpoints**: If Groq's free tier is exhausted, the router will **never** automatically fall back to OpenAI GPT-4o or a paid tier. It falls back to **Local MLX-Whisper**.
2. **Ambiguous Tier Blocking**: If a provider's billing structure cannot be verified via API headers or deterministic model IDs, it is treated as paid and blocked by default.
3. **Explicit Spend Cap**: If a user intentionally disables Free-Only mode (e.g., to use Claude 3.5 Sonnet or Gemini 1.5 Pro), they must configure a hard monthly dollar limit (e.g., `$5.00`). Once reached, all cloud calls are halted immediately.

---

## 4. Secure Credential Storage via macOS Keychain

API keys are sensitive credentials that must never be exposed. Prismex AI Editor follows enterprise security standards:

### Storage Invariants:
- **Never In Plain Text**: API keys are **never** stored in SQLite database tables, local `.env` files, JSON configs, or application logs.
- **Never In Frontend State**: The UXP panel only receives masked key representations (`sk-••••••••abcd`) and never holds raw keys in React memory or local storage.
- **Hardware-Backed Storage**: All credentials are stored directly in the **macOS Keychain** using the macOS native `security` framework.

### Keychain Implementation Architecture
```python
# prismex_core/security/keychain_vault.py
import keyring
import subprocess
from typing import Optional

KEYCHAIN_SERVICE_NAME = "com.prismex.editor.credentials"

class KeychainVault:
    @staticmethod
    def set_api_key(provider_id: str, api_key: str) -> None:
        """Stores API key securely in macOS Keychain."""
        if not api_key or len(api_key.strip()) == 0:
            raise ValueError("API key cannot be empty.")
        keyring.set_password(KEYCHAIN_SERVICE_NAME, provider_id, api_key.strip())

    @staticmethod
    def get_api_key(provider_id: str) -> Optional[str]:
        """Retrieves raw API key from macOS Keychain."""
        return keyring.get_password(KEYCHAIN_SERVICE_NAME, provider_id)

    @staticmethod
    def delete_api_key(provider_id: str) -> None:
        """Deletes credential from macOS Keychain."""
        try:
            keyring.delete_password(KEYCHAIN_SERVICE_NAME, provider_id)
        except keyring.errors.PasswordDeleteError:
            pass  # Key did not exist
```

---

## 5. Provider Usage & Quota Monitoring

Because free-tier providers often do not expose remaining balance endpoints via their REST APIs, Prismex implements an **Empirical Local Quota Tracker**:

1. **Local Usage Ledger**: Every outgoing request logs:
   - Provider & Model ID
   - Timestamp (ISO 8601)
   - Input Tokens / Audio Seconds
   - Output Tokens
   - Response Latency (ms)
   - HTTP Status Code (200, 429, 500)
2. **Rate Limit Windowing**: A sliding 60-second window calculates current RPM and TPM against known provider thresholds. If RPM approaches 90% of the limit (e.g., 18 of 20 RPM for Groq), the router introduces micro-delays or cascades to another free provider.
3. **Transparent UI Reporting**: The Provider Manager displays:
   - Requests today: `142 / 1,500` (Gemini Flash)
   - Estimated audio processed: `18.4 mins` (Groq)
   - Current health status: `Healthy (Latency: 280ms)`
