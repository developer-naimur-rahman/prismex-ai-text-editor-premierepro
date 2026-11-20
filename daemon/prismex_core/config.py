"""
Prismex Core Configuration & Environment Constants
Specification: docs/03-SYSTEM-ARCHITECTURE.md & docs/18-PERFORMANCE-OPTIMIZATION.md
"""

import os
import platform
from pathlib import Path

# Server Network Configuration
HOST = "127.0.0.1"
PORT = 48152

# Platform Detection
IS_MACOS = platform.system() == "Darwin"
IS_APPLE_SILICON = IS_MACOS and platform.machine() in ("arm64", "aarch64")

# Hardware Memory Budget (Unified Memory Ceiling)
MAX_MEMORY_BUDGET_MB = 2500  # 2.5 GB Hard Ceiling

# System Storage Directories
HOME_DIR = Path.home()
APP_SUPPORT_DIR = HOME_DIR / "Library" / "Application Support" / "Prismex"
CACHE_DIR = HOME_DIR / "Library" / "Caches" / "com.prismex.editor"
TEMP_AUDIO_DIR = CACHE_DIR / "temp_audio"
PROJECTS_DATA_DIR = APP_SUPPORT_DIR / "projects"

# Ensure directories exist
APP_SUPPORT_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)
TEMP_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
PROJECTS_DATA_DIR.mkdir(parents=True, exist_ok=True)

# Default Global Database Path
DEFAULT_DB_PATH = APP_SUPPORT_DIR / "prismex_global.db"
