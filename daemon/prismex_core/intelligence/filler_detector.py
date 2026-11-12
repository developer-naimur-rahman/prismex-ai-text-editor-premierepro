"""
FillerDetector - Filler Words & Stutter Classification Engine
Specification: docs/12-FILLER-STUTTER-DETECTION.md

Enforces the Core Semantic Invariant:
Never remove a word if doing so changes the grammatical validity or propositional meaning.
"""

import re
import uuid
from typing import List, Dict, Any

DEFAULT_VOCALIC_FILLERS = {"um", "uh", "er", "ah", "erm", "hmm", "uhm"}

class FillerDetector:
    @classmethod
    def detect_disfluencies(
        cls,
        words: List[Dict[str, Any]],
        custom_fillers: List[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Scans word list for vocalic fillers, phonemic stutters, and word duplications.
        Generates editing suggestions.
        """
        if not words:
            return []

        vocalics = DEFAULT_VOCALIC_FILLERS.copy()
        if custom_fillers:
            vocalics.update(f.lower().strip() for f in custom_fillers)

        suggestions: List[Dict[str, Any]] = []

        for i, w in enumerate(words):
            raw_word = w.get("word", "").strip()
            clean_word = re.sub(r'[^\w\s-]', '', raw_word).lower()

            # 1. Vocalic Filler Detection ("um", "uh")
            if clean_word in vocalics:
                w["is_filler"] = True
                suggestions.append({
                    "id": f"sugg_filler_{uuid.uuid4().hex[:8]}",
                    "category": "FILLER_WORD",
                    "status": "ACCEPTED",
                    "start_seconds": w["start_seconds"],
                    "end_seconds": w["end_seconds"],
                    "duration_seconds": round(w["end_seconds"] - w["start_seconds"], 3),
                    "confidence": 0.98,
                    "reason": f"Vocalic filler '{raw_word}'",
                    "transcript_snippet": raw_word
                })
                continue

            # 2. Phonemic Stutters (e.g. "th-the", "w-what", "b-but")
            if re.match(r'^[a-zA-Z]{1,2}-[a-zA-Z]+$', clean_word):
                w["is_stutter"] = True
                suggestions.append({
                    "id": f"sugg_stutter_{uuid.uuid4().hex[:8]}",
                    "category": "STUTTER",
                    "status": "ACCEPTED",
                    "start_seconds": w["start_seconds"],
                    "end_seconds": w["end_seconds"],
                    "duration_seconds": round(w["end_seconds"] - w["start_seconds"], 3),
                    "confidence": 0.92,
                    "reason": f"Phonemic stutter '{raw_word}'",
                    "transcript_snippet": raw_word
                })
                continue

            # 3. Accidental Word Repetition ("the the", "we we")
            if i > 0:
                prev_clean = re.sub(r'[^\w\s-]', '', words[i - 1].get("word", "")).lower()
                if clean_word == prev_clean and len(clean_word) > 1:
                    # Flag the first instance for deletion, keep the second
                    w["is_filler"] = True
                    suggestions.append({
                        "id": f"sugg_repeat_{uuid.uuid4().hex[:8]}",
                        "category": "FILLER_WORD",
                        "status": "ACCEPTED",
                        "start_seconds": words[i - 1]["start_seconds"],
                        "end_seconds": words[i - 1]["end_seconds"],
                        "duration_seconds": round(words[i - 1]["end_seconds"] - words[i - 1]["start_seconds"], 3),
                        "confidence": 0.95,
                        "reason": f"Duplicated word '{prev_clean}'",
                        "transcript_snippet": f"{prev_clean} {clean_word}"
                    })
                    continue

            # 4. Contextual Filler Check for "like" and "so"
            # Rule: Only treat "like" as filler if preceded and followed by commas or surrounded by pauses
            # Never treat "like" as filler if directly following pronouns ("I like", "we like", "they like")
            if clean_word == "like":
                is_verb_context = False
                if i > 0:
                    prev_token = re.sub(r'[^\w\s]', '', words[i - 1].get("word", "")).lower()
                    if prev_token in {"i", "you", "we", "they", "he", "she", "it", "really", "would"}:
                        is_verb_context = True

                if not is_verb_context:
                    # If framed by hesitations or commas
                    has_commas = "," in raw_word or (i > 0 and "," in words[i - 1].get("word", ""))
                    if has_commas:
                        suggestions.append({
                            "id": f"sugg_like_{uuid.uuid4().hex[:8]}",
                            "category": "FILLER_WORD",
                            "status": "PENDING", # Require review for contextual fillers
                            "start_seconds": w["start_seconds"],
                            "end_seconds": w["end_seconds"],
                            "duration_seconds": round(w["end_seconds"] - w["start_seconds"], 3),
                            "confidence": 0.85,
                            "reason": "Contextual filler 'like' (Review recommended)",
                            "transcript_snippet": raw_word
                        })

        return suggestions
