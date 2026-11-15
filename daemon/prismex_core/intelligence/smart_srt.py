"""
Smart Flexible SRT Segmentation & 0-Frame-Drift Sync Engine.

Splits word-level transcripts into meaningful, frame-fitting subtitle cues
using flexible word & character targets (never rigid cutoffs that break phrases),
via Cloud AI (Gemini / Groq when configured) or an offline linguistic scorer,
and snaps every cue boundary to the exact sequence frame grid with zero overlap.
"""

import json
import re
from typing import Any, Dict, List, Optional, Tuple

from ..security.keychain_vault import KeychainVault

HANGING_END_WORDS = {
    # English articles, prepositions, conjunctions, auxiliaries, pronouns that look awkward dangling at line end
    "a", "an", "the", "to", "of", "in", "on", "at", "by", "for", "with", "from",
    "into", "onto", "about", "as", "and", "but", "or", "nor", "so", "yet", "if",
    "when", "while", "because", "although", "though", "that", "which", "who",
    "whom", "whose", "where", "my", "your", "his", "her", "its", "our", "their",
    "this", "these", "those", "is", "are", "was", "were", "be", "been", "being",
    "am", "have", "has", "had", "do", "does", "did", "will", "would", "can",
    "could", "should", "shall", "may", "might", "must", "i'm", "you're", "we're",
    "they're", "it's", "that's", "there's", "don't", "didn't", "won't", "can't",
    "not", "than", "over", "under", "between", "through", "during", "without",
    # Common Bengali connectors / determiners / postpositions
    "এবং", "ও", "আর", "কিন্তু", "তবে", "যদি", "যে", "যেন", "কারণ", "তাই",
    "এই", "ওই", "সেই", "একটা", "একটি", "একজন", "কোনো", "কিছু", "জন্য", "থেকে",
    "দিয়ে", "দিয়ে", "সাথে", "মধ্যে", "উপর", "নিচে", "কাছে", "দিকে", "দ্বারা",
}

CLAUSE_STARTER_WORDS = {
    # Coordinating conjunctions
    "and", "but", "or", "nor", "so", "yet",
    # Subordinating conjunctions & adverbial clause openers
    "because", "although", "though", "even", "while", "whereas",
    "whenever", "when", "wherever", "where", "if", "unless", "since",
    "as", "after", "before", "until", "whether", "whilst",
    # Relative pronouns & interrogative clause introducers
    "that", "which", "who", "whom", "whose", "why", "how", "what",
    "whatever", "whoever", "whichever",
    # Discourse connectors / transitional adverbs
    "however", "therefore", "meanwhile", "furthermore", "moreover",
    "instead", "otherwise", "besides",
    # Bengali clause openers & connectors
    "এবং", "ও", "আর", "কিন্তু", "তবে", "যদি", "যদিও", "যেহেতু", "কারণ",
    "তাই", "যেন", "যখন", "যেখানে", "যেভাবে", "যাতে", "তাহলে", "নতুবা",
    "অথবা", "নইলে", "বরং", "এমনকি", "ফলে", "সুতরাং", "যে"
}

COMPOUND_WORD_PAIRS = {
    # Geographic & proper compound nouns that must never be split across subtitle cues
    ("washington", "state"),
    ("new", "york"),
    ("united", "states"),
    ("los", "angeles"),
    ("san", "francisco"),
    ("san", "diego"),
    ("san", "jose"),
    ("north", "carolina"),
    ("south", "carolina"),
    ("north", "dakota"),
    ("south", "dakota"),
    ("west", "virginia"),
    ("rhode", "island"),
    ("new", "jersey"),
    ("new", "mexico"),
    ("new", "hampshire"),
    ("great", "britain"),
    ("hong", "kong"),
    ("prime", "minister"),
    ("high", "school"),
    ("social", "media"),
    ("real", "estate"),
    ("artificial", "intelligence"),
    ("machine", "learning"),
    ("credit", "card"),
    ("cell", "phone"),
    ("apple", "silicon"),
    ("premiere", "pro"),
    ("যুক্ত", "রাষ্ট্র"),
    ("উত্তর", "বঙ্গ"),
    ("পশ্চিম", "বঙ্গ"),
}

SUBJECT_PRONOUNS = {
    "i", "you", "he", "she", "we", "they", "it",
    "আমি", "তুমি", "সে", "আমরা", "তারা", "আপনি", "তিনি"
}


def format_srt_timestamp(seconds: float) -> str:
    total_ms = max(0, int(round(seconds * 1000.0)))
    ms = total_ms % 1000
    total_sec = total_ms // 1000
    s = total_sec % 60
    total_min = total_sec // 60
    m = total_min % 60
    h = total_min // 60
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _clean_token(word: str) -> str:
    return re.sub(r"[^\w\u0980-\u09FF']+", "", word.lower())


def _has_strong_punct(word: str) -> bool:
    return word.endswith((".", "?", "!", "।"))


def _has_clause_punct(word: str) -> bool:
    return word.endswith((",", ";", ":", "—", "-"))


class SmartSRTSegmenter:
    """Generates AI-segmented, flexible, frame-exact SRT cues."""

    @staticmethod
    def segment(
        words: List[Dict[str, Any]],
        fps: float = 24.0,
        target_words: int = 3,
        min_words: Optional[int] = None,
        max_words: Optional[int] = None,
        target_chars: int = 20,
        max_chars: int = 28,
        flexible: bool = True,
        use_ai: bool = True,
    ) -> Dict[str, Any]:
        if not words:
            return {"cues": [], "srt": "", "engine": "none", "fps": fps}

        fps = fps if fps > 0 else 24.0
        target_words = max(1, min(12, int(target_words)))
        target_chars = max(8, min(80, int(target_chars)))
        max_chars = max(target_chars, min(100, int(max_chars)))

        if flexible:
            eff_min = max(1, min_words if min_words is not None else max(1, target_words - 1))
            eff_max = max(target_words, max_words if max_words is not None else target_words + 2)
        else:
            eff_min = target_words
            eff_max = target_words

        ranges: Optional[List[Tuple[int, int, str]]] = None
        engine = "Prismex Smart Linguistic Engine (Local)"

        if use_ai and flexible:
            ai_ranges, ai_engine = SmartSRTSegmenter._try_cloud_ai_ranges(
                words=words,
                target_words=target_words,
                min_words=eff_min,
                max_words=eff_max,
                target_chars=target_chars,
                max_chars=max_chars,
            )
            if ai_ranges is not None:
                ranges = ai_ranges
                engine = ai_engine

        if ranges is None:
            ranges = SmartSRTSegmenter._local_semantic_ranges(
                words=words,
                target_words=target_words,
                min_words=eff_min,
                max_words=eff_max,
                target_chars=target_chars,
                max_chars=max_chars,
                flexible=flexible,
            )

        cues = SmartSRTSegmenter._snap_cues_to_frames(words, ranges, fps)
        srt_text = SmartSRTSegmenter.cues_to_srt(cues)

        return {
            "cues": cues,
            "srt": srt_text,
            "engine": engine,
            "fps": fps,
            "totalCues": len(cues),
        }

    @staticmethod
    def _try_cloud_ai_ranges(
        words: List[Dict[str, Any]],
        target_words: int,
        min_words: int,
        max_words: int,
        target_chars: int,
        max_chars: int,
    ) -> Tuple[Optional[List[Tuple[int, int, str]]], str]:
        gemini_key = KeychainVault.get_api_key("google-gemini")
        groq_key = KeychainVault.get_api_key("groq")
        if not gemini_key and not groq_key:
            return None, ""

        # Process in chunks of up to 160 words so LLM output stays fast and exact
        batch_size = 160
        all_ranges: List[Tuple[int, int, str]] = []
        used_engine = ""

        for offset in range(0, len(words), batch_size):
            batch = words[offset : offset + batch_size]
            indexed_lines = []
            for local_i, w in enumerate(batch):
                gap_hint = ""
                if local_i > 0:
                    gap = float(w.get("start_seconds", 0.0)) - float(batch[local_i - 1].get("end_seconds", 0.0))
                    if gap >= 0.35:
                        gap_hint = f" [pause:{gap:.2f}s]"
                indexed_lines.append(f"{local_i}:{w.get('word', '')}{gap_hint}")

            prompt = (
                "You are an expert video subtitle editor and linguistic phrasing specialist. "
                "Split these numbered words into meaningful, natural syntactic subtitle cues that fit cleanly inside a video frame.\n\n"
                f"- Soft target pacing: ~{target_words} words per cue (flexible range: {min_words} to {max_words} words).\n"
                f"- Maximum line length: ~{target_chars} chars (strict ceiling: {max_chars} chars).\n\n"
                "MANDATORY SYNTACTIC & CLAUSE PHRASING RULES:\n"
                "1. Break strictly at NATURAL CLAUSE BOUNDARIES. Never split a tight subject-verb-object phrase if it fits in one cue.\n"
                "   CORRECT: ['Why we left California'] -> complete clause!\n"
                "   INCORRECT: ['Why we left'] + ['California and moved'] -> TERRIBLE: breaks the object from its verb!\n"
                "2. Coordinated clauses starting with conjunctions ('and', 'but', 'so', 'because', 'whenever', 'if', 'when', 'or') MUST START on a new cue:\n"
                "   CORRECT: ['and moved back to Washington state'] or ['and moved back'] + ['to Washington state']\n"
                "   CORRECT: ['Whenever you tell someone'] + ['you love California']\n"
                "3. Never break compound proper nouns or geographic entities across lines (e.g., 'Washington state', 'New York', 'San Francisco').\n"
                "4. NEVER leave hanging articles, prepositions, or conjunctions ('a', 'an', 'the', 'to', 'of', 'in', 'on', 'with', 'for', 'and', 'but', 'that') at the end of a cue.\n"
                "5. Prefer breaking where punctuation (. , ? ! :) or [pause:...] markers occur.\n"
                f"6. Contiguous coverage: Every word index from 0 to {len(batch) - 1} must be covered contiguously with no gaps or overlaps.\n\n"
                "Return ONLY valid JSON: an array of cue range objects with reason 'r':\n"
                '[{"s": 0, "e": 3, "r": "Clause End"}, {"s": 4, "e": 9, "r": "Coordinated Clause"}].'
            )
            payload_text = prompt + "\n\nWords:\n" + " ".join(indexed_lines)

            openrouter_key = KeychainVault.get_api_key("openrouter")
            parsed = None
            if openrouter_key:
                parsed = SmartSRTSegmenter._call_openrouter_json(openrouter_key, payload_text)
                if parsed is not None:
                    used_engine = "OpenRouter (AI Smart SRT)"
            if parsed is None and gemini_key:
                parsed = SmartSRTSegmenter._call_gemini_json(gemini_key, payload_text)
                if parsed is not None:
                    used_engine = "Google Gemini 2.0 Flash (AI Smart SRT)"
            if parsed is None and groq_key:
                parsed = SmartSRTSegmenter._call_groq_json(groq_key, payload_text)
                if parsed is not None:
                    used_engine = "Groq Llama 3.3 (AI Smart SRT)"

            if not SmartSRTSegmenter._validate_batch_ranges(parsed, len(batch)):
                return None, ""

            for item in parsed:  # type: ignore[union-attr]
                all_ranges.append((offset + int(item["s"]), offset + int(item["e"]), str(item.get("r", "AI Phrase"))))

        return all_ranges, used_engine

    @staticmethod
    def _call_openrouter_json(api_key: str, prompt_text: str) -> Optional[List[Dict[str, Any]]]:
        import requests
        candidate_models = ["google/gemini-2.5-flash", "google/gemini-2.0-flash-001", "deepseek/deepseek-chat"]
        for om in candidate_models:
            try:
                resp = requests.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "HTTP-Referer": "https://prismex.ai",
                        "X-Title": "Prismex AI Editor",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": om,
                        "messages": [
                            {"role": "system", "content": "You are a professional subtitle segmenter. Return JSON only."},
                            {"role": "user", "content": prompt_text}
                        ],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.1
                    },
                    timeout=25
                )
                if resp.status_code == 200:
                    raw = resp.json()["choices"][0]["message"]["content"]
                    cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip())
                    cleaned = re.sub(r"\s*```$", "", cleaned)
                    data = json.loads(cleaned)
                    if isinstance(data, list):
                        return data
                    if isinstance(data, dict):
                        for k in ["cues", "segments", "ranges", "result"]:
                            if k in data and isinstance(data[k], list):
                                return data[k]
            except Exception as e:
                print(f"[SmartSRT] OpenRouter model {om} failed: {e}")
        return None

    @staticmethod
    def _call_gemini_json(api_key: str, prompt_text: str) -> Optional[List[Dict[str, Any]]]:
        import requests
        candidate_models = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.5-flash", "gemini-1.5-flash"]
        for m in candidate_models:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={api_key}"
                resp = requests.post(
                    url,
                    json={
                        "contents": [{"parts": [{"text": prompt_text}]}],
                        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.1},
                    },
                    timeout=20,
                )
                if resp.status_code == 200:
                    raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                    return json.loads(raw)
            except Exception:
                continue
        return None

    @staticmethod
    def _call_groq_json(api_key: str, prompt_text: str) -> Optional[List[Dict[str, Any]]]:
        try:
            import requests
            resp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt_text}],
                    "temperature": 0.1,
                },
                timeout=20,
            )
            if resp.status_code != 200:
                return None
            raw = resp.json()["choices"][0]["message"]["content"]
            match = re.search(r"\[.*\]", raw, re.DOTALL)
            return json.loads(match.group(0) if match else raw)
        except Exception:
            return None

    @staticmethod
    def _validate_batch_ranges(parsed: Any, n: int) -> bool:
        if not isinstance(parsed, list) or len(parsed) == 0:
            return False
        expected = 0
        for item in parsed:
            if not isinstance(item, dict) or "s" not in item or "e" not in item:
                return False
            s, e = int(item["s"]), int(item["e"])
            if s != expected or e < s or e >= n:
                return False
            expected = e + 1
        return expected == n

    @staticmethod
    def _local_semantic_ranges(
        words: List[Dict[str, Any]],
        target_words: int,
        min_words: int,
        max_words: int,
        target_chars: int,
        max_chars: int,
        flexible: bool,
    ) -> List[Tuple[int, int, str]]:
        n = len(words)
        ranges: List[Tuple[int, int, str]] = []
        i = 0

        while i < n:
            if not flexible:
                end = min(n - 1, i + target_words - 1)
                ranges.append((i, end, "Fixed Count"))
                i = end + 1
                continue

            best_end = min(n - 1, i + target_words - 1)
            best_score = -1e9
            best_reason = "Balanced Phrase"

            max_candidate = min(n - 1, i + max_words + (1 if flexible else 0))
            min_candidate = min(n - 1, i + min_words - 1)

            # Allow breaking at 1 word if it's sentence-ending or followed by a long pause
            first_word_str = str(words[i].get("word", ""))
            first_gap = (
                float(words[i + 1].get("start_seconds", 0.0)) - float(words[i].get("end_seconds", 0.0))
                if i + 1 < n
                else 0.0
            )
            start_cand = i if (_has_strong_punct(first_word_str) or first_gap >= 0.5) else min_candidate

            for end in range(start_cand, max_candidate + 1):
                chunk_words = words[i : end + 1]
                word_count = len(chunk_words)
                text = " ".join(str(w.get("word", "")).strip() for w in chunk_words)
                char_count = len(text)

                # Hard frame-fit guardrail: avoid overflowing max_chars unless single word already exceeds it
                if char_count > max_chars and word_count > 1:
                    # Still allow a tiny 2-char flex only if it finishes a sentence
                    last_str = str(chunk_words[-1].get("word", ""))
                    if not (_has_strong_punct(last_str) and char_count <= max_chars + 3):
                        continue

                score = 0.0
                reason = "Balanced Phrase"

                # Closeness to target_words and target_chars (soft guidance, never rigid)
                score -= abs(word_count - target_words) * 1.8
                score -= abs(char_count - target_chars) * 0.20

                last_word_raw = str(chunk_words[-1].get("word", "")).strip()
                last_word_clean = _clean_token(last_word_raw)
                first_word_clean = _clean_token(str(chunk_words[0].get("word", "")))

                # Strong bonus for ending on punctuation
                if _has_strong_punct(last_word_raw):
                    score += 10.0
                    reason = "Sentence End"
                elif _has_clause_punct(last_word_raw):
                    score += 6.5
                    reason = "Clause Break"

                # Check relationship with next word if not at sequence end
                if end + 1 < n:
                    next_word_raw = str(words[end + 1].get("word", "")).strip()
                    next_word_clean = _clean_token(next_word_raw)

                    # 1. CLAUSE STARTER BONUS:
                    # Breaking right before a conjunction or clause opener word
                    # (e.g. "Why we left California" | "and moved back...")
                    if next_word_clean in CLAUSE_STARTER_WORDS:
                        score += 9.5
                        reason = "Clause Boundary"

                    # 2. COMPOUND WORD PAIR PROTECTION:
                    # Never split compound nouns across cues (e.g. "Washington" + "state")
                    if (last_word_clean, next_word_clean) in COMPOUND_WORD_PAIRS:
                        score -= 16.0

                    # 3. EMBEDDED SUBJECT-VERB CLAUSE BREAK:
                    # Breaking before a subject pronoun that starts a fresh predicate clause
                    # (e.g. "Whenever you tell someone" | "you love California")
                    if next_word_clean in SUBJECT_PRONOUNS and word_count >= 2:
                        if end + 2 < n:
                            following_clean = _clean_token(str(words[end + 2].get("word", "")))
                            if following_clean in {"love", "like", "know", "think", "said", "say", "want", "went", "is", "are", "was", "were", "can", "will", "did", "have"}:
                                score += 7.0
                                reason = "Subordinate Clause"

                    # 4. ACOUSTIC MICRO-PAUSE BONUS
                    gap = float(words[end + 1].get("start_seconds", 0.0)) - float(chunk_words[-1].get("end_seconds", 0.0))
                    if gap >= 0.40:
                        score += 8.5
                        reason = "Natural Pause"
                    elif gap >= 0.18:
                        score += 4.5
                        reason = "Micro Pause"

                    # Penalize breaking right BEFORE an enclitic contraction
                    if next_word_clean in {"n't", "'s", "'re", "'ve", "'ll"}:
                        score -= 10.0

                # If candidate chunk started with a clause starter, bonus for reaching a non-hanging termination
                if first_word_clean in CLAUSE_STARTER_WORDS and word_count >= 3:
                    if last_word_clean not in HANGING_END_WORDS:
                        score += 2.0

                # Strict penalty for leaving a hanging connector/article/preposition at the end of a cue
                if last_word_clean in HANGING_END_WORDS and end < n - 1:
                    score -= 9.0

                # Slight penalty if approaching max_chars tightly
                if char_count > target_chars:
                    score -= (char_count - target_chars) * 0.35

                if score > best_score:
                    best_score = score
                    best_end = end
                    best_reason = reason

            # Safety check: if even min_candidate exceeded max_chars (no candidate entered loop), take up to max_chars or 1 word
            if best_score == -1e9:
                char_acc = 0
                best_end = i
                for k in range(i, min(n, i + max_words)):
                    w_len = len(str(words[k].get("word", "")).strip())
                    added = w_len if k == i else w_len + 1
                    if char_acc + added > max_chars and k > i:
                        break
                    char_acc += added
                    best_end = k
                best_reason = "Frame Fit"

            ranges.append((i, best_end, best_reason))
            i = best_end + 1

        return ranges

    @staticmethod
    def _snap_cues_to_frames(
        words: List[Dict[str, Any]],
        ranges: List[Tuple[int, int, str]],
        fps: float,
    ) -> List[Dict[str, Any]]:
        cues: List[Dict[str, Any]] = []
        prev_end_frame = 0

        for idx, (s_idx, e_idx, reason) in enumerate(ranges, start=1):
            chunk = words[s_idx : e_idx + 1]
            if not chunk:
                continue

            raw_start = max(0.0, float(chunk[0].get("start_seconds", 0.0)))
            raw_end = max(raw_start, float(chunk[-1].get("end_seconds", raw_start)))

            start_frame = int(round(raw_start * fps))
            if start_frame < prev_end_frame:
                start_frame = prev_end_frame

            end_frame = int(round(raw_end * fps))
            if end_frame <= start_frame:
                end_frame = start_frame + 1

            prev_end_frame = end_frame

            aligned_start = start_frame / fps
            aligned_end = end_frame / fps
            text = " ".join(str(w.get("word", "")).strip() for w in chunk).strip()

            cues.append(
                {
                    "index": idx,
                    "startWordIdx": s_idx,
                    "endWordIdx": e_idx,
                    "wordCount": len(chunk),
                    "charCount": len(text),
                    "startFrame": start_frame,
                    "endFrame": end_frame,
                    "startSeconds": round(aligned_start, 6),
                    "endSeconds": round(aligned_end, 6),
                    "startSrt": format_srt_timestamp(aligned_start),
                    "endSrt": format_srt_timestamp(aligned_end),
                    "text": text,
                    "reason": reason,
                }
            )

        return cues

    @staticmethod
    def cues_to_srt(cues: List[Dict[str, Any]]) -> str:
        blocks = []
        for cue in cues:
            blocks.append(f"{cue['index']}\n{cue['startSrt']} --> {cue['endSrt']}\n{cue['text']}\n")
        return "\n".join(blocks)
