"""
ProviderRegistry - Capability Mapping & Registered AI Engines
Specification: docs/06-AI-PROVIDER-ECOSYSTEM.md & docs/07-AI-ROUTER.md
"""

from typing import List, Dict, Any
from enum import Enum

class TaskCapability(str, Enum):
    SPEECH_TO_TEXT = "SPEECH_TO_TEXT"
    WORD_ALIGNMENT = "WORD_ALIGNMENT"
    VOICE_ACTIVITY_DETECTION = "VOICE_ACTIVITY_DETECTION"
    FLUENCY_REASONING = "FLUENCY_REASONING"
    GRAMMATICAL_EVALUATION = "GRAMMATICAL_EVALUATION"

REGISTERED_PROVIDERS: List[Dict[str, Any]] = [
    {
        "provider_id": "local-mlx",
        "name": "Local Apple Silicon (MLX)",
        "model_id": "mlx-community/whisper-large-v3-turbo-4bit",
        "is_local": True,
        "is_free_tier": True,
        "capabilities": [TaskCapability.SPEECH_TO_TEXT, TaskCapability.WORD_ALIGNMENT],
        "priority": 2,
        "max_rpm": 999999
    },
    {
        "provider_id": "local-silero",
        "name": "Local Silero VAD v5",
        "model_id": "silero-vad-v5",
        "is_local": True,
        "is_free_tier": True,
        "capabilities": [TaskCapability.VOICE_ACTIVITY_DETECTION],
        "priority": 1,
        "max_rpm": 999999
    },
    {
        "provider_id": "groq-cloud",
        "name": "Groq Cloud (Whisper Turbo)",
        "model_id": "whisper-large-v3-turbo",
        "is_local": False,
        "is_free_tier": True,
        "capabilities": [TaskCapability.SPEECH_TO_TEXT, TaskCapability.WORD_ALIGNMENT],
        "priority": 1,
        "max_rpm": 20
    },
    {
        "provider_id": "gemini-cloud",
        "name": "Google Gemini (Flash)",
        "model_id": "gemini-1.5-flash",
        "is_local": False,
        "is_free_tier": True,
        "capabilities": [TaskCapability.FLUENCY_REASONING, TaskCapability.GRAMMATICAL_EVALUATION],
        "priority": 1,
        "max_rpm": 15
    },
    {
        "provider_id": "groq-cloud-llama",
        "name": "Groq Cloud (Llama 3.3 70B)",
        "model_id": "llama-3.3-70b-versatile",
        "is_local": False,
        "is_free_tier": True,
        "capabilities": [TaskCapability.FLUENCY_REASONING, TaskCapability.GRAMMATICAL_EVALUATION],
        "priority": 2,
        "max_rpm": 30
    }
]
