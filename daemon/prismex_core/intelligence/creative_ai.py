"""
Creative AI Subsystem - Viral Shorts, Timeline Markers, Spell Check, Script Alignment,
and After Effects Kinetic Typography.
"""

import json
import re
import time
from typing import Any, Dict, List, Optional
from ..security.keychain_vault import KeychainVault


class CreativeAI:
    @staticmethod
    def _call_gemini_json(prompt: str) -> Optional[Any]:
        api_key = KeychainVault.get_api_key("google-gemini")
        if not api_key:
            return None
        try:
            import requests
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
            resp = requests.post(
                url,
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
                },
                timeout=25,
            )
            if resp.status_code == 200:
                raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(raw)
        except Exception as e:
            print(f"[CreativeAI] Gemini failed: {e}")
        return None

    @classmethod
    def spell_check(cls, words: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detects typos or speech-to-text misspellings and returns corrected words with preserved timestamps."""
        if not words:
            return {"words": [], "corrections": 0, "engine": "none"}

        full_text = " ".join(str(w.get("word", "")).strip() for w in words)
        prompt = (
            "You are an expert video transcript proofreader. Review this transcript for typos, phonetic transcription errors, "
            "or grammatical glitches. Return a JSON array of corrected words of the EXACT same length as the input words array. "
            f"Input words array length: {len(words)}.\n"
            f"Words: {json.dumps([w.get('word', '') for w in words[:200]])}\n"
            "Return JSON: [\"word1\", \"word2\", ...]"
        )

        res = cls._call_gemini_json(prompt)
        corrected_words = [dict(w) for w in words]
        corrections = 0

        if isinstance(res, list) and len(res) <= len(words):
            for i, fixed in enumerate(res):
                if isinstance(fixed, str) and fixed.strip() and fixed.strip() != corrected_words[i].get("word"):
                    corrected_words[i]["word"] = fixed.strip()
                    corrections += 1
            return {"words": corrected_words, "corrections": corrections, "engine": "Google Gemini 2.0 Flash"}

        # Offline Local Spell Check (common capitalization & contraction fixes)
        for w in corrected_words:
            orig = str(w.get("word", ""))
            # Capitalize lonely 'i' or contractions
            if orig == "i":
                w["word"] = "I"
                corrections += 1
            elif orig == "im":
                w["word"] = "I'm"
                corrections += 1
            elif orig == "dont":
                w["word"] = "don't"
                corrections += 1
            elif orig == "cant":
                w["word"] = "can't"
                corrections += 1

        return {"words": corrected_words, "corrections": corrections, "engine": "Prismex Local Dictionary (Offline)"}

    @classmethod
    def detect_viral_shorts(
        cls,
        words: List[Dict[str, Any]],
        sentences: List[Dict[str, Any]],
        target_count: int = 5,
        fps: float = 24.0,
        custom_prompt: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Extracts highly structured, educational, 3-part viral Shorts (Hook -> Body -> CTA)
        from across the transcript with non-linear multi-segment splicing.
        """
        if not words:
            return []

        full_text = " ".join(str(s.get("text", "")).strip() for s in sentences) if sentences else " ".join(str(w.get("word", "")) for w in words)
        total_dur = float(words[-1].get("end_seconds", 0.0)) if words else 0.0

        user_guidance = f"\nUser Custom Editorial Goal: {custom_prompt}\n" if custom_prompt else ""

        prompt = (
            "You are an elite YouTube Shorts, TikTok, and Instagram Reels video editor and strategist.\n"
            "You DO NOT just pick random time intervals. You plan and construct purposeful, educational, "
            "and high-retention viral vertical short videos from this long video transcript.\n\n"
            f"{user_guidance}\n"
            "MANDATORY 3-PART VIRAL STRUCTURE FOR EVERY SHORT:\n"
            "1. 🎯 HOOK (0-5s): A bold question, counter-intuitive insight, or shocking statement that stops the scroll.\n"
            "2. 📖 BODY / STORY / VALUE (20-45s): An educational, structured story or explanation that delivers real value and teaches the viewer something meaningful.\n"
            "3. 📢 CTA / TAKEAWAY (3-8s): A clear concluding lesson, actionable advice, or engagement call.\n\n"
            "CRITICAL RULES:\n"
            "- You CAN pull the Hook, Body, and CTA from DIFFERENT parts of the long video if needed to make the story complete and powerful!\n"
            "- Never cut off mid-thought or mid-sentence. Keep complete semantic phrases.\n"
            f"- Transcript ({round(total_dur, 1)}s total duration):\n{full_text[:9000]}\n\n"
            f"Generate up to {target_count} distinct viral shorts. Return ONLY a JSON array of objects with keys:\n"
            "[\n"
            "  {\n"
            '    "id": "short_1",\n'
            '    "title": "Punchy Short Title",\n'
            '    "educationalLesson": "What viewers learn from this video",\n'
            '    "viralityScore": 96,\n'
            '    "reason": "Why this video will hold high viewer retention",\n'
            '    "hook": {"text": "Hook sentence text", "startSeconds": 140.0, "endSeconds": 145.0},\n'
            '    "body": {"text": "Main story and explanation", "startSeconds": 30.0, "endSeconds": 68.0},\n'
            '    "cta": {"text": "Ending takeaway and CTA", "startSeconds": 210.0, "endSeconds": 216.0},\n'
            '    "brollSuggestions": ["Show moving truck", "Display cost chart"],\n'
            '    "loopIdea": "How ending seamlessly loops back into the hook"\n'
            "  }\n"
            "]"
        )

        def _get_words_in_range(s_sec: float, e_sec: float) -> str:
            chunk = [str(w.get("word", "")) for w in words if float(w.get("start_seconds", 0.0)) >= s_sec - 0.2 and float(w.get("end_seconds", 0.0)) <= e_sec + 0.2]
            return " ".join(chunk) if chunk else ""

        def _build_segments(h: Dict[str, Any], b: Dict[str, Any], c: Dict[str, Any]) -> List[Dict[str, Any]]:
            segs = []
            if h.get("startSeconds") is not None and h.get("endSeconds") is not None:
                h_dur = max(0.5, float(h["endSeconds"]) - float(h["startSeconds"]))
                segs.append({
                    "role": "HOOK",
                    "text": h.get("text", ""),
                    "startSeconds": round(float(h["startSeconds"]), 2),
                    "endSeconds": round(float(h["endSeconds"]), 2),
                    "durationSeconds": round(h_dur, 2)
                })
            if b.get("startSeconds") is not None and b.get("endSeconds") is not None:
                b_dur = max(1.0, float(b["endSeconds"]) - float(b["startSeconds"]))
                segs.append({
                    "role": "BODY",
                    "text": b.get("text", ""),
                    "startSeconds": round(float(b["startSeconds"]), 2),
                    "endSeconds": round(float(b["endSeconds"]), 2),
                    "durationSeconds": round(b_dur, 2)
                })
            if c.get("startSeconds") is not None and c.get("endSeconds") is not None:
                c_dur = max(0.5, float(c["endSeconds"]) - float(c["startSeconds"]))
                segs.append({
                    "role": "CTA",
                    "text": c.get("text", ""),
                    "startSeconds": round(float(c["startSeconds"]), 2),
                    "endSeconds": round(float(c["endSeconds"]), 2),
                    "durationSeconds": round(c_dur, 2)
                })
            return segs

        ai_res = cls._call_gemini_json(prompt)
        if isinstance(ai_res, list) and len(ai_res) > 0:
            shorts = []
            for idx, item in enumerate(ai_res):
                h = item.get("hook", {})
                b = item.get("body", {})
                c = item.get("cta", {})

                # Ensure texts are filled
                if not h.get("text") and "startSeconds" in h:
                    h["text"] = _get_words_in_range(float(h["startSeconds"]), float(h["endSeconds"]))
                if not b.get("text") and "startSeconds" in b:
                    b["text"] = _get_words_in_range(float(b["startSeconds"]), float(b["endSeconds"]))
                if not c.get("text") and "startSeconds" in c:
                    c["text"] = _get_words_in_range(float(c["startSeconds"]), float(c["endSeconds"]))

                segs = _build_segments(h, b, c)
                total_duration = sum(s["durationSeconds"] for s in segs)

                # Formatted full script
                formatted_script = (
                    f"🎯 HOOK:\n\"{h.get('text', '')}\"\n\n"
                    f"📖 BODY / STORY:\n\"{b.get('text', '')}\"\n\n"
                    f"📢 CTA / TAKEAWAY:\n\"{c.get('text', '')}\""
                )

                # Visual Markers relative to timeline
                markers = []
                cur_marker_t = 0.0
                for s in segs:
                    m_type = "EMPHASIS" if s["role"] == "HOOK" else ("BROLL" if s["role"] == "BODY" else "SFX")
                    markers.append({
                        "seconds": round(cur_marker_t, 2),
                        "type": m_type,
                        "name": f"Short {s['role']}",
                        "comment": s["text"][:40]
                    })
                    cur_marker_t += s["durationSeconds"]

                s_start = segs[0]["startSeconds"] if segs else 0.0
                s_end = segs[-1]["endSeconds"] if segs else total_dur

                shorts.append({
                    "id": f"short_{idx + 1}_{int(s_start)}",
                    "title": str(item.get("title", f"Viral Short #{idx + 1}")),
                    "educationalLesson": str(item.get("educationalLesson", "Educational value")),
                    "viralityScore": int(item.get("viralityScore", 95 - idx * 2)),
                    "reason": str(item.get("reason", "Structured narrative retention")),
                    "hook": h,
                    "body": b,
                    "cta": c,
                    "segments": segs,
                    "totalDurationSeconds": round(total_duration, 2),
                    "startSeconds": round(s_start, 2),
                    "endSeconds": round(s_end, 2),
                    "durationSeconds": round(total_duration, 2),
                    "startFrame": int(round(s_start * fps)),
                    "endFrame": int(round(s_end * fps)),
                    "brollSuggestions": item.get("brollSuggestions", ["Overlay relevant B-Roll", "Display on-screen graphics"]),
                    "loopIdea": item.get("loopIdea", "Ending connects smoothly back into the opening hook"),
                    "aspectRatio": "9:16 (1080x1920)",
                    "scriptText": formatted_script,
                    "markers": markers
                })
            return shorts

        # Offline Local Heuristic Planner: Group sentences into structured Hook -> Body -> CTA
        shorts = []
        sent_list = sentences if sentences else []
        n_sent = len(sent_list)

        if n_sent == 0:
            return []

        # Divide sentences into logical chunks of 4-7 sentences
        chunk_size = max(3, min(7, n_sent // max(1, target_count)))
        curr_idx = 0
        idx = 1

        while curr_idx < n_sent and len(shorts) < target_count:
            end_idx = min(n_sent, curr_idx + chunk_size)
            sub_sents = sent_list[curr_idx:end_idx]
            if len(sub_sents) == 0:
                break

            # S1 = Hook, S2..Sn-1 = Body, Sn = CTA
            h_sent = sub_sents[0]
            c_sent = sub_sents[-1] if len(sub_sents) > 1 else sub_sents[0]
            b_sents = sub_sents[1:-1] if len(sub_sents) > 2 else [sub_sents[0]]

            h = {
                "text": str(h_sent.get("text", "")).strip(),
                "startSeconds": round(float(h_sent.get("start_seconds", 0.0)), 2),
                "endSeconds": round(float(h_sent.get("end_seconds", 0.0)), 2)
            }
            b = {
                "text": " ".join(str(s.get("text", "")).strip() for s in b_sents),
                "startSeconds": round(float(b_sents[0].get("start_seconds", 0.0)), 2),
                "endSeconds": round(float(b_sents[-1].get("end_seconds", 0.0)), 2)
            }
            c = {
                "text": str(c_sent.get("text", "")).strip(),
                "startSeconds": round(float(c_sent.get("start_seconds", 0.0)), 2),
                "endSeconds": round(float(c_sent.get("end_seconds", 0.0)), 2)
            }

            segs = _build_segments(h, b, c)
            total_duration = sum(s["durationSeconds"] for s in segs)

            formatted_script = (
                f"🎯 HOOK:\n\"{h['text']}\"\n\n"
                f"📖 BODY / STORY:\n\"{b['text']}\"\n\n"
                f"📢 CTA / TAKEAWAY:\n\"{c['text']}\""
            )

            markers = [
                {"seconds": 0.0, "type": "EMPHASIS", "name": "Hook", "comment": h['text'][:30]},
                {"seconds": round(segs[0]["durationSeconds"], 2), "type": "BROLL", "name": "Story Body", "comment": "B-roll cutaway"},
                {"seconds": round(total_duration - 4.0, 2), "type": "SFX", "name": "CTA Outro", "comment": "Closing takeaway"}
            ]

            shorts.append({
                "id": f"short_{idx}_{int(h['startSeconds'])}",
                "title": f"Short #{idx} - Key Lesson",
                "educationalLesson": "Key story takeaway from conversation",
                "viralityScore": max(78, 95 - (idx * 3)),
                "reason": "Structured 3-part narrative with clear hook and lesson",
                "hook": h,
                "body": b,
                "cta": c,
                "segments": segs,
                "totalDurationSeconds": round(total_duration, 2),
                "startSeconds": h["startSeconds"],
                "endSeconds": c["endSeconds"],
                "durationSeconds": round(total_duration, 2),
                "startFrame": int(round(h["startSeconds"] * fps)),
                "endFrame": int(round(c["endSeconds"] * fps)),
                "brollSuggestions": ["Insert B-roll overlay on topic", "Add dynamic zoom punch on hook"],
                "loopIdea": "Closing takeaway loops back into opening question",
                "aspectRatio": "9:16 (1080x1920)",
                "scriptText": formatted_script,
                "markers": markers
            })

            curr_idx = end_idx
            idx += 1

        return shorts

    @classmethod
    def refine_short(
        cls,
        short_data: Dict[str, Any],
        instruction: str,
        words: List[Dict[str, Any]],
        fps: float = 24.0,
    ) -> Dict[str, Any]:
        """Interactive AI Refinement: adjusts timecodes, hook, body, CTA or trims short based on user request."""
        total_dur = float(words[-1].get("end_seconds", 0.0)) if words else 100.0

        prompt = (
            "You are an expert video editor. The user wants to adjust a 3-part vertical short video candidate.\n"
            f"Current Short: Title='{short_data.get('title')}', EducationalLesson='{short_data.get('educationalLesson')}'\n"
            f"Current Hook: {short_data.get('hook')}\n"
            f"Current Body: {short_data.get('body')}\n"
            f"Current CTA: {short_data.get('cta')}\n"
            f"Current Script:\n{short_data.get('scriptText', '')}\n\n"
            f"User Adjustment Request: \"{instruction}\"\n\n"
            "Return a refined JSON object with keys:\n"
            "{\n"
            '  "title": "Updated Title",\n'
            '  "educationalLesson": "Updated educational lesson",\n'
            '  "reason": "Explanation of changes",\n'
            '  "hook": {"text": "Updated hook text", "startSeconds": 0.0, "endSeconds": 5.0},\n'
            '  "body": {"text": "Updated body text", "startSeconds": 5.0, "endSeconds": 40.0},\n'
            '  "cta": {"text": "Updated CTA text", "startSeconds": 40.0, "endSeconds": 45.0},\n'
            '  "brollSuggestions": ["..."]\n'
            "}"
        )

        ai_res = cls._call_gemini_json(prompt)
        if isinstance(ai_res, dict):
            h = ai_res.get("hook", short_data.get("hook"))
            b = ai_res.get("body", short_data.get("body"))
            c = ai_res.get("cta", short_data.get("cta"))

            # Normalize if dicts
            def _norm_blk(blk: Any, def_start: float, def_end: float) -> Dict[str, Any]:
                if isinstance(blk, dict):
                    s_sec = max(0.0, float(blk.get("startSeconds", def_start)))
                    e_sec = min(total_dur, max(s_sec + 1.0, float(blk.get("endSeconds", def_end))))
                    return {
                        "text": str(blk.get("text", "")).strip(),
                        "startSeconds": round(s_sec, 2),
                        "endSeconds": round(e_sec, 2),
                        "durationSeconds": round(e_sec - s_sec, 2)
                    }
                return {
                    "text": str(blk or "").strip(),
                    "startSeconds": round(def_start, 2),
                    "endSeconds": round(def_end, 2),
                    "durationSeconds": round(def_end - def_start, 2)
                }

            h_norm = _norm_blk(h, short_data.get("startSeconds", 0.0), short_data.get("startSeconds", 0.0) + 5.0)
            b_norm = _norm_blk(b, h_norm["endSeconds"], max(h_norm["endSeconds"] + 15.0, short_data.get("endSeconds", 45.0) - 5.0))
            c_norm = _norm_blk(c, b_norm["endSeconds"], b_norm["endSeconds"] + 5.0)

            segs = [
                {"role": "HOOK", "startSeconds": h_norm["startSeconds"], "endSeconds": h_norm["endSeconds"], "durationSeconds": h_norm["durationSeconds"], "text": h_norm["text"]},
                {"role": "BODY", "startSeconds": b_norm["startSeconds"], "endSeconds": b_norm["endSeconds"], "durationSeconds": b_norm["durationSeconds"], "text": b_norm["text"]},
                {"role": "CTA", "startSeconds": c_norm["startSeconds"], "endSeconds": c_norm["endSeconds"], "durationSeconds": c_norm["durationSeconds"], "text": c_norm["text"]},
            ]
            total_duration = sum(s["durationSeconds"] for s in segs)

            formatted_script = (
                f"🎯 HOOK:\n\"{h_norm['text']}\"\n\n"
                f"📖 BODY / STORY:\n\"{b_norm['text']}\"\n\n"
                f"📢 CTA / TAKEAWAY:\n\"{c_norm['text']}\""
            )

            return {
                **short_data,
                "title": str(ai_res.get("title", short_data.get("title"))),
                "educationalLesson": str(ai_res.get("educationalLesson", short_data.get("educationalLesson", ""))),
                "reason": str(ai_res.get("reason", "Refined per user instruction")),
                "hook": h_norm,
                "body": b_norm,
                "cta": c_norm,
                "segments": segs,
                "totalDurationSeconds": round(total_duration, 2),
                "durationSeconds": round(total_duration, 2),
                "startSeconds": h_norm["startSeconds"],
                "endSeconds": c_norm["endSeconds"],
                "startFrame": int(round(h_norm["startSeconds"] * fps)),
                "endFrame": int(round(c_norm["endSeconds"] * fps)),
                "brollSuggestions": ai_res.get("brollSuggestions", short_data.get("brollSuggestions", [])),
                "scriptText": formatted_script
            }

        # Offline fallback: simple duration trim if requested
        return short_data

    @classmethod
    def analyze_markers(cls, words: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Classifies timeline moments into 3 distinct color-coded marker types:
        - RED: Emphasis & high-impact punch words
        - GREEN: B-Roll overlay visual opportunities
        - BLUE: Icons, PNG graphics & UI callouts
        """
        if not words:
            return {"markers": []}

        markers: List[Dict[str, Any]] = []

        # Local linguistic heuristics for visual keywords
        broll_triggers = {
            "see", "look", "watch", "show", "screen", "video", "footage", "outside", "car", "money",
            "building", "travel", "phone", "computer", "design", "city", "people", "road", "scene",
            "দেখুন", "দেখেন", "ভিডিও", "স্ক্রিন", "মানুষ", "টাকা", "গাড়ি", "শহর"
        }
        icon_triggers = {
            "click", "button", "link", "subscribe", "download", "percent", "dollar", "arrow", "chart",
            "number", "app", "website", "api", "key", "settings", "file", "folder",
            "ক্লিক", "ডাউনলোড", "বাটন", "লিংক", "সাবস্ক্রাইব", "পার্সেন্ট", "টাকা", "অ্যাপ"
        }
        emphasis_triggers = {
            "never", "always", "huge", "insane", "massive", "secret", "best", "worst", "important",
            "crazy", "shocking", "game-changer", "revolutionary", "stop", "guaranteed", "truth",
            "কখনোই", "সবসময়", "সবচেয়ে", "সেরা", "গুরুত্বপূর্ণ", "বিশাল", "আসল", "রহস্য"
        }

        for w in words:
            token = re.sub(r"[^\w\u0980-\u09FF']+", "", str(w.get("word", "")).lower())
            start = float(w.get("start_seconds", 0.0))
            dur = max(0.3, float(w.get("end_seconds", start + 0.3)) - start)

            if token in emphasis_triggers:
                markers.append({
                    "type": "EMPHASIS",
                    "color": "RED",
                    "name": f"Emphasis: {w.get('word')}",
                    "comment": "Punch word - Add scale pop or text highlight",
                    "startSeconds": start,
                    "durationSeconds": dur
                })
            elif token in broll_triggers:
                markers.append({
                    "type": "BROLL",
                    "color": "GREEN",
                    "name": f"B-Roll: {w.get('word')}",
                    "comment": f"Overlay relevant visual footage for '{w.get('word')}'",
                    "startSeconds": start,
                    "durationSeconds": 2.5
                })
            elif token in icon_triggers:
                markers.append({
                    "type": "ICON",
                    "color": "BLUE",
                    "name": f"Icon/PNG: {w.get('word')}",
                    "comment": f"Drop PNG icon or motion graphic for '{w.get('word')}'",
                    "startSeconds": start,
                    "durationSeconds": 1.5
                })

        return {"markers": markers[:50], "total": len(markers)}

    @classmethod
    def format_after_effects_typography(cls, text: str) -> Dict[str, Any]:
        """Formats text into kinetic typography layout with visual hierarchy and ready-to-paste AE script/lines."""
        raw_words = text.strip().split()
        if not raw_words:
            return {"formattedText": "", "lines": [], "aeSnippet": ""}

        # Divide into 2-3 lines with visual hierarchy: First/Key word large, others balanced
        if len(raw_words) <= 3:
            lines = [text.upper()]
        elif len(raw_words) <= 6:
            half = len(raw_words) // 2
            lines = [" ".join(raw_words[:half]).upper(), " ".join(raw_words[half:]).upper()]
        else:
            third = len(raw_words) // 3
            lines = [
                " ".join(raw_words[:third]).upper(),
                " ".join(raw_words[third:2 * third]).upper(),
                " ".join(raw_words[2 * third:]).upper()
            ]

        formatted_text = "\n".join(lines)

        # Generate a 1-click After Effects ExtendScript snippet that creates text layers with animation
        escaped_lines = json.dumps(lines)
        ae_snippet = f"""// Adobe After Effects Kinetic Typography Script (Run in AE File -> Scripts)
(function() {{
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {{ alert("Please select a composition in After Effects."); return; }}
    app.beginUndoGroup("Prismex Kinetic Typography");
    var lines = {escaped_lines};
    for (var i = 0; i < lines.length; i++) {{
        var textLayer = comp.layers.addText(lines[i]);
        var textProp = textLayer.property("Source Text");
        var textDoc = textProp.value;
        textDoc.fontSize = (i === 0) ? 96 : 72;
        textDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
        textProp.setValue(textDoc);
        textLayer.property("Position").setValue([comp.width / 2, (comp.height / 2) + ((i - (lines.length - 1) / 2) * 110)]);
    }}
    app.endUndoGroup();
}})();"""

        return {
            "formattedText": formatted_text,
            "lines": lines,
            "aeSnippet": ae_snippet
        }

    @classmethod
    def generate_sfx_assets(cls) -> Dict[str, str]:
        """
        Generates pristine 48kHz 16-bit stereo WAV sound effects (Whoosh & Pop)
        using standard library wave & math (100% zero-dependency).
        """
        import wave
        import struct
        import math
        from pathlib import Path

        sfx_dir = Path.home() / ".prismex" / "sfx"
        sfx_dir.mkdir(parents=True, exist_ok=True)

        whoosh_path = sfx_dir / "whoosh.wav"
        pop_path = sfx_dir / "pop.wav"
        sample_rate = 48000

        if not whoosh_path.exists():
            duration = 0.35
            num_samples = int(duration * sample_rate)
            with wave.open(str(whoosh_path), "w") as wav_file:
                wav_file.setnchannels(2)
                wav_file.setsampwidth(2)
                wav_file.setframerate(sample_rate)
                frames = bytearray()
                for i in range(num_samples):
                    t = i / sample_rate
                    env = math.sin(math.pi * (i / num_samples)) ** 2
                    freq = 180 + 550 * math.sin(math.pi * (i / num_samples))
                    val = int(env * 0.45 * 32767.0 * math.sin(2 * math.pi * freq * t))
                    val = max(-32768, min(32767, val))
                    frames.extend(struct.pack("<hh", val, val))
                wav_file.writeframes(frames)

        if not pop_path.exists():
            duration = 0.12
            num_samples = int(duration * sample_rate)
            with wave.open(str(pop_path), "w") as wav_file:
                wav_file.setnchannels(2)
                wav_file.setsampwidth(2)
                wav_file.setframerate(sample_rate)
                frames = bytearray()
                for i in range(num_samples):
                    t = i / sample_rate
                    env = math.exp(-32 * t)
                    freq = 420 + 350 * math.exp(-40 * t)
                    val = int(env * 0.55 * 32767.0 * math.sin(2 * math.pi * freq * t))
                    val = max(-32768, min(32767, val))
                    frames.extend(struct.pack("<hh", val, val))
                wav_file.writeframes(frames)

        return {
            "whoosh": str(whoosh_path),
            "pop": str(pop_path)
        }

    @classmethod
    def generate_youtube_chapters(
        cls,
        words: List[Dict[str, Any]],
        sentences: List[Dict[str, Any]],
        video_title: str = "Video"
    ) -> Dict[str, Any]:
        """
        Generates formatted YouTube Description Timestamps / Chapters and Key Highlights.
        """
        sent_list = sentences if sentences else []
        n_sent = len(sent_list)
        if n_sent == 0:
            return {"chaptersText": "00:00 - Introduction", "chapters": [{"timecode": "00:00", "seconds": 0.0, "title": "Introduction"}]}

        target_chaps = min(10, max(4, n_sent // 6))
        chunk_size = max(1, n_sent // target_chaps)

        chapters = []
        lines = ["📌 TIMESTAMPS / CHAPTERS:"]

        for i in range(target_chaps):
            s_idx = i * chunk_size
            if s_idx >= n_sent:
                break
            s = sent_list[s_idx]
            sec = round(float(s.get("start_seconds", 0.0)), 0)
            if i == 0:
                sec = 0.0
            mins = int(sec // 60)
            secs = int(sec % 60)
            tc_str = f"{mins:02d}:{secs:02d}"

            raw_text = str(s.get("text", "")).strip()
            title_words = raw_text.split()[:6]
            chap_title = " ".join(title_words) if title_words else f"Chapter {i+1}"
            if i == 0:
                chap_title = "Introduction / Opening"

            chapters.append({
                "timecode": tc_str,
                "seconds": sec,
                "title": chap_title
            })
            lines.append(f"{tc_str} - {chap_title}")

        return {
            "chaptersText": "\n".join(lines),
            "chapters": chapters
        }

    @classmethod
    def search_broll_stock(cls, query: str) -> List[Dict[str, Any]]:
        """
        Searches or suggests high quality B-Roll stock videos matching the semantic query.
        """
        clean_q = re.sub(r'[^a-zA-Z0-9_\u0980-\u09FF ]', '', query).strip() or "cinematic"
        return [
            {
                "id": "stock_1",
                "title": f"Cinematic {clean_q.capitalize()} B-Roll",
                "durationSeconds": 5.0,
                "thumbnail": "https://images.pexels.com/videos/3195394/free-video-3195394.jpg?auto=compress&cs=tinysrgb&fit=crop&h=300&w=500",
                "searchKeywords": [clean_q, f"{clean_q} 4k", f"{clean_q} cinematic footage"],
                "source": "Stock Footage Cue",
                "directSearchUrl": f"https://www.pexels.com/search/videos/{clean_q}/"
            },
            {
                "id": "stock_2",
                "title": f"Aerial Drone Shot - {clean_q.capitalize()}",
                "durationSeconds": 6.0,
                "thumbnail": "https://images.pexels.com/videos/854132/free-video-854132.jpg?auto=compress&cs=tinysrgb&fit=crop&h=300&w=500",
                "searchKeywords": [f"aerial {clean_q}", f"drone {clean_q}"],
                "source": "Stock Footage Cue",
                "directSearchUrl": f"https://www.pexels.com/search/videos/aerial%20{clean_q}/"
            },
            {
                "id": "stock_3",
                "title": f"Slow Motion Action - {clean_q.capitalize()}",
                "durationSeconds": 4.5,
                "thumbnail": "https://images.pexels.com/videos/3045163/free-video-3045163.jpg?auto=compress&cs=tinysrgb&fit=crop&h=300&w=500",
                "searchKeywords": [f"slow motion {clean_q}", f"macro {clean_q}"],
                "source": "Stock Footage Cue",
                "directSearchUrl": f"https://www.pexels.com/search/videos/slow%20motion%20{clean_q}/"
            }
        ]

    @classmethod
    def discover_short_topics(
        cls,
        words: List[Dict[str, Any]],
        sentences: List[Dict[str, Any]],
        target_count: int = 6,
        custom_prompt: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Analyzes the full video transcript and discovers distinct potential Short topics
        with Bengali summaries, key takeaways, virality potential, and time ranges.
        """
        if not words:
            return []

        full_text = " ".join(str(s.get("text", "")).strip() for s in sentences) if sentences else " ".join(str(w.get("word", "")) for w in words)
        total_dur = float(words[-1].get("end_seconds", 0.0)) if words else 0.0

        user_guidance = f"\nUser Focus Direction: {custom_prompt}\n" if custom_prompt else ""

        prompt = (
            "You are an expert video content strategist for YouTube Shorts, Reels, and TikTok.\n"
            "Analyze the transcript of this long video and identify "
            f"up to {target_count} distinct high-interest topics or stories that would make viral 30-60s vertical shorts.\n\n"
            f"{user_guidance}\n"
            "For each topic you MUST provide:\n"
            "- A punchy title in Bengali or English\n"
            "- A detailed summary in Bengali (সারমর্ম) explaining what is discussed and the core value\n"
            "- 3-4 bullet key points in Bengali (কী-পয়েন্ট)\n"
            "- An estimated duration in seconds (25 to 60s)\n"
            "- A virality score (80 to 98)\n"
            "- Approximate start and end seconds in the video where this story takes place\n\n"
            f"Transcript ({round(total_dur, 1)}s total):\n{full_text[:9000]}\n\n"
            "Return ONLY a JSON array of objects with keys:\n"
            "[\n"
            "  {\n"
            '    "id": "topic_1",\n'
            '    "topicTitle": "Topic Title",\n'
            '    "topicSummaryBn": "বাংলায় এই টপিকের বিশদ সারমর্ম",\n'
            '    "keyPoints": ["মূল পয়েন্ট ১", "মূল পয়েন্ট ২", "মূল পয়েন্ট ৩"],\n'
            '    "viralityScore": 95,\n'
            '    "estimatedDurationSeconds": 45,\n'
            '    "startSeconds": 15.0,\n'
            '    "endSeconds": 60.0\n'
            "  }\n"
            "]"
        )

        ai_res = cls._call_gemini_json(prompt)
        if isinstance(ai_res, list) and len(ai_res) > 0:
            return ai_res

        # Local Offline Fallback: Extract semantic clusters of sentences
        sent_list = sentences if sentences else []
        n_sent = len(sent_list)
        if n_sent == 0:
            return []

        chunk_size = max(3, min(8, n_sent // max(1, target_count)))
        topics = []
        curr_idx = 0
        t_idx = 1
        while curr_idx < n_sent and len(topics) < target_count:
            end_idx = min(n_sent, curr_idx + chunk_size)
            chunk = sent_list[curr_idx:end_idx]
            if not chunk:
                break

            s_sec = round(float(chunk[0].get("start_seconds", 0.0)), 2)
            e_sec = round(float(chunk[-1].get("end_seconds", 0.0)), 2)
            c_texts = [str(s.get("text", "")).strip() for s in chunk if s.get("text")]
            snippet = " ".join(c_texts)

            first_words = snippet.split()[:6]
            title = " ".join(first_words) if first_words else f"টপিক #{t_idx}"

            topics.append({
                "id": f"topic_{t_idx}_{int(s_sec)}",
                "topicTitle": f"টপিক #{t_idx}: {title}",
                "topicSummaryBn": f"এই অংশের সারমর্ম: {snippet[:140]}... এটি দর্শকদের জন্য একটি অর্থপূর্ণ শর্টস হিসেবে প্রযোজ্য।",
                "keyPoints": [
                    c_texts[0][:50] if len(c_texts) > 0 else "মূল আকর্ষণ ও সূচনা",
                    c_texts[1][:50] if len(c_texts) > 1 else "ব্যাখ্যা ও ঘটনা",
                    c_texts[-1][:50] if len(c_texts) > 2 else "উপসংহার ও শিক্ষা"
                ],
                "viralityScore": max(75, 96 - (t_idx * 3)),
                "estimatedDurationSeconds": min(60, max(25, int(e_sec - s_sec))),
                "startSeconds": s_sec,
                "endSeconds": e_sec
            })
            curr_idx = end_idx
            t_idx += 1

        return topics

    @classmethod
    def generate_alternative_hooks(
        cls,
        short_data: Dict[str, Any],
        words: List[Dict[str, Any]],
        sentences: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Generates 5 distinct alternative hooks from the video dialogue
        specifically tailored to match the story body of the short.
        """
        body_text = ""
        if isinstance(short_data.get("body"), dict):
            body_text = short_data["body"].get("text", "")
        elif isinstance(short_data.get("body"), str):
            body_text = short_data.get("body", "")

        prompt = (
            "You are an elite viral video hook specialist for YouTube Shorts and TikTok.\n"
            f"The short's main story / body is:\n\"{body_text}\"\n\n"
            "From the long video transcript, extract 5 DISTINCT alternative viral opening hooks (0-5 seconds each).\n"
            "Hook Types:\n"
            "1. CURIOSITY / QUESTION (প্রশ্নবোধক ও কৌতুহল উদ্দীপক)\n"
            "2. SHOCK / CONTRARIAN (চমকপ্রদ ও অপ্রত্যাশিত সত্য)\n"
            "3. STORY TEASER (গল্পের রহস্যময় সূচনা)\n"
            "4. EMOTIONAL PUNCH (অনুভূতিপূর্ণ ও গভীর উপলব্ধি)\n"
            "5. HIGH-ENERGY STAT (সরাসরি ও প্রভাবশালী বক্তব্য)\n\n"
            "Return ONLY a JSON array of 5 objects with keys:\n"
            "[\n"
            '  {"type": "CURIOSITY", "label": "কৌতুহল উদ্দীপক প্রশ্ন", "text": "Hook text", "startSeconds": 10.0, "endSeconds": 14.5},\n'
            '  {"type": "SHOCK", "label": "চমকপ্রদ ও অপ্রত্যাশিত", "text": "Hook text", "startSeconds": 45.0, "endSeconds": 49.0},\n'
            '  {"type": "STORY", "label": "রহস্যময় গল্প সূচনা", "text": "Hook text", "startSeconds": 120.0, "endSeconds": 124.5},\n'
            '  {"type": "EMOTIONAL", "label": "গভীর উপলব্ধি", "text": "Hook text", "startSeconds": 180.0, "endSeconds": 184.0},\n'
            '  {"type": "PUNCH", "label": "হাই-এনার্জি পাঞ্চ", "text": "Hook text", "startSeconds": 210.0, "endSeconds": 214.5}\n'
            "]"
        )

        ai_res = cls._call_gemini_json(prompt)
        if isinstance(ai_res, list) and len(ai_res) > 0:
            return ai_res

        # Heuristic fallback: pick 5 punchy sentences from sentences list
        sent_list = sentences if sentences else []
        candidates = []
        labels = [
            ("CURIOSITY", "কৌতুহল উদ্দীপক প্রশ্ন"),
            ("SHOCK", "চমকপ্রদ ও অপ্রত্যাশিত"),
            ("STORY", "রহস্যময় গল্প সূচনা"),
            ("EMOTIONAL", "গভীর উপলব্ধি"),
            ("PUNCH", "হাই-এনার্জি পাঞ্চ")
        ]
        step = max(1, len(sent_list) // 6)
        for i, (htype, hlabel) in enumerate(labels):
            idx = min(len(sent_list) - 1, (i + 1) * step)
            if idx < len(sent_list):
                s = sent_list[idx]
                candidates.append({
                    "type": htype,
                    "label": hlabel,
                    "text": str(s.get("text", "")).strip(),
                    "startSeconds": round(float(s.get("start_seconds", 0.0)), 2),
                    "endSeconds": round(float(s.get("end_seconds", 0.0)), 2),
                    "durationSeconds": round(max(1.0, float(s.get("end_seconds", 0.0)) - float(s.get("start_seconds", 0.0))), 2)
                })
        return candidates

    @classmethod
    def generate_alternative_ctas(
        cls,
        short_data: Dict[str, Any],
        words: List[Dict[str, Any]],
        sentences: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Generates 3-5 alternative closing CTAs matching the story body."""
        body_text = short_data.get("body", {}).get("text", "") if isinstance(short_data.get("body"), dict) else str(short_data.get("body", ""))

        prompt = (
            "You are an elite video editor.\n"
            f"The short's main story / body is:\n\"{body_text}\"\n\n"
            "From the video transcript, extract 3 to 4 distinct closing CTA / Takeaways (3-8 seconds each).\n"
            "CTA Types:\n"
            "1. ENGAGEMENT QUESTION (দর্শকের মতামত জিজ্ঞাসা)\n"
            "2. ACTIONABLE ADVICE (উপদেশ বা সিদ্ধান্তমূলক বার্তা)\n"
            "3. INSPIRING TAKEAWAY (অনুপ্রেরণামূলক সমাপ্তি)\n"
            "4. LOOP / TEASER (পরবর্তী অংশের কৌতূহল)\n\n"
            "Return ONLY a JSON array of objects with keys:\n"
            "[\n"
            '  {"type": "ENGAGEMENT", "label": "দর্শকের মতামত", "text": "...", "startSeconds": 0.0, "endSeconds": 5.0},\n'
            '  {"type": "ADVICE", "label": "সিদ্ধান্তমূলক বার্তা", "text": "...", "startSeconds": 0.0, "endSeconds": 5.0},\n'
            '  {"type": "INSPIRING", "label": "অনুপ্রেরণামূলক সমাপ্তি", "text": "...", "startSeconds": 0.0, "endSeconds": 5.0}\n'
            "]"
        )

        ai_res = cls._call_gemini_json(prompt)
        if isinstance(ai_res, list) and len(ai_res) > 0:
            return ai_res

        # Heuristic fallback: pick sentences from the latter half of the video
        sent_list = sentences if sentences else []
        candidates = []
        labels = [
            ("ENGAGEMENT", "দর্শকের মতামত"),
            ("ADVICE", "সিদ্ধান্তমূলক বার্তা"),
            ("INSPIRING", "অনুপ্রেরণামূলক সমাপ্তি")
        ]
        total_sents = len(sent_list)
        for i, (ctype, clabel) in enumerate(labels):
            idx = max(0, total_sents - (i + 1) * 2)
            if idx < total_sents:
                s = sent_list[idx]
                candidates.append({
                    "type": ctype,
                    "label": clabel,
                    "text": str(s.get("text", "")).strip(),
                    "startSeconds": round(float(s.get("start_seconds", 0.0)), 2),
                    "endSeconds": round(float(s.get("end_seconds", 0.0)), 2),
                    "durationSeconds": round(max(1.0, float(s.get("end_seconds", 0.0)) - float(s.get("start_seconds", 0.0))), 2)
                })
        return candidates

    @classmethod
    def match_client_script_to_sequence(
        cls,
        client_script: str,
        words: List[Dict[str, Any]],
        sentences: List[Dict[str, Any]],
        fps: float = 24.0,
    ) -> Dict[str, Any]:
        """
        Takes a client-provided script or dialogue paragraphs, searches the long video
        transcript for the exact or closest spoken phrases, and outputs a complete
        structured Short with multi-segment cuts ready for 1-click sequence creation!
        """
        if not client_script or not client_script.strip():
            return {}

        total_dur = float(words[-1].get("end_seconds", 0.0)) if words else 100.0

        # Ask Gemini to match client script phrases to timeline timestamps
        prompt = (
            "You are an expert video conform and dialogue matching specialist.\n"
            "A client has provided a custom script for a Short/Reel.\n"
            f"Client Script:\n\"\"\"{client_script.strip()}\"\"\"\n\n"
            "Match the client's script phrases to the spoken dialogue in the long video transcript.\n"
            "Break the matched parts into ordered segments: HOOK (first part), BODY (middle parts), CTA (closing part).\n"
            "Find the closest startSeconds and endSeconds in the transcript for each segment.\n\n"
            f"Transcript snippet:\n{' '.join(str(s.get('text', '')) for s in sentences)[:8000]}\n\n"
            "Return ONLY a JSON object with keys:\n"
            "{\n"
            '  "title": "Client Script Short",\n'
            '  "educationalLesson": "Takeaway from client script",\n'
            '  "viralityScore": 92,\n'
            '  "hook": {"text": "Opening hook line", "startSeconds": 0.0, "endSeconds": 5.0},\n'
            '  "body": {"text": "Middle body explanation", "startSeconds": 5.0, "endSeconds": 40.0},\n'
            '  "cta": {"text": "Closing takeaway line", "startSeconds": 40.0, "endSeconds": 45.0},\n'
            '  "segments": [\n'
            '    {"role": "HOOK", "startSeconds": 0.0, "endSeconds": 5.0, "text": "..."},\n'
            '    {"role": "BODY", "startSeconds": 5.0, "endSeconds": 40.0, "text": "..."},\n'
            '    {"role": "CTA", "startSeconds": 40.0, "endSeconds": 45.0, "text": "..."}\n'
            '  ],\n'
            '  "brollSuggestions": ["Overlay graphics", "Add zoom punch"]\n'
            "}"
        )

        ai_res = cls._call_gemini_json(prompt)
        if isinstance(ai_res, dict) and "segments" in ai_res:
            segs = ai_res.get("segments", [])
            h = ai_res.get("hook", segs[0] if segs else {})
            b = ai_res.get("body", segs[1] if len(segs) > 1 else {})
            c = ai_res.get("cta", segs[-1] if len(segs) > 2 else {})

            total_dur_calc = sum(max(0.5, float(s.get("endSeconds", 0)) - float(s.get("startSeconds", 0))) for s in segs)
            formatted_script = (
                f"🎯 HOOK:\n\"{h.get('text', '')}\"\n\n"
                f"📖 BODY / STORY:\n\"{b.get('text', '')}\"\n\n"
                f"📢 CTA / TAKEAWAY:\n\"{c.get('text', '')}\""
            )

            return {
                "id": f"client_short_{int(time.time())}",
                "title": ai_res.get("title", "Client Custom Script Short"),
                "educationalLesson": ai_res.get("educationalLesson", "Matched from client script"),
                "viralityScore": ai_res.get("viralityScore", 92),
                "reason": "Matched 1:1 with client provided script",
                "hook": h,
                "body": b,
                "cta": c,
                "segments": segs,
                "totalDurationSeconds": round(total_dur_calc, 2),
                "durationSeconds": round(total_dur_calc, 2),
                "startSeconds": segs[0].get("startSeconds", 0.0) if segs else 0.0,
                "endSeconds": segs[-1].get("endSeconds", 45.0) if segs else 45.0,
                "startFrame": int(round((segs[0].get("startSeconds", 0.0) if segs else 0.0) * fps)),
                "endFrame": int(round((segs[-1].get("endSeconds", 45.0) if segs else 45.0) * fps)),
                "brollSuggestions": ai_res.get("brollSuggestions", ["Match client B-roll", "Add text titles"]),
                "scriptText": formatted_script,
                "markers": [
                    {"seconds": 0.0, "type": "EMPHASIS", "name": "Client Hook", "comment": "Hook start"},
                    {"seconds": 5.0, "type": "BROLL", "name": "Story Body", "comment": "Main body"},
                    {"seconds": max(0.0, total_dur_calc - 4.0), "type": "SFX", "name": "CTA Outro", "comment": "Closing"}
                ]
            }

        # Offline Lexical Matcher Fallback
        script_tokens = set(re.findall(r'\w+', client_script.lower()))
        matched_sentences = []
        for s in sentences:
            s_text = str(s.get("text", "")).lower()
            s_tokens = set(re.findall(r'\w+', s_text))
            overlap = len(script_tokens.intersection(s_tokens))
            if overlap > 0:
                matched_sentences.append((overlap, s))

        matched_sentences.sort(key=lambda x: x[0], reverse=True)
        top_sents = [s for _, s in matched_sentences[:5]]
        top_sents.sort(key=lambda s: float(s.get("start_seconds", 0.0)))

        if not top_sents:
            top_sents = sentences[:3] if sentences else []

        h_sent = top_sents[0] if top_sents else {"text": client_script[:50], "start_seconds": 0.0, "end_seconds": 5.0}
        c_sent = top_sents[-1] if len(top_sents) > 1 else h_sent
        b_sents = top_sents[1:-1] if len(top_sents) > 2 else [h_sent]

        h = {"text": str(h_sent.get("text", "")).strip(), "startSeconds": round(float(h_sent.get("start_seconds", 0.0)), 2), "endSeconds": round(float(h_sent.get("end_seconds", 5.0)), 2)}
        b = {"text": " ".join(str(s.get("text", "")).strip() for s in b_sents), "startSeconds": round(float(b_sents[0].get("start_seconds", 5.0)), 2), "endSeconds": round(float(b_sents[-1].get("end_seconds", 35.0)), 2)}
        c = {"text": str(c_sent.get("text", "")).strip(), "startSeconds": round(float(c_sent.get("start_seconds", 35.0)), 2), "endSeconds": round(float(c_sent.get("end_seconds", 40.0)), 2)}

        segs = [
            {"role": "HOOK", "startSeconds": h["startSeconds"], "endSeconds": h["endSeconds"], "text": h["text"]},
            {"role": "BODY", "startSeconds": b["startSeconds"], "endSeconds": b["endSeconds"], "text": b["text"]},
            {"role": "CTA", "startSeconds": c["startSeconds"], "endSeconds": c["endSeconds"], "text": c["text"]}
        ]
        total_d = sum(s["endSeconds"] - s["startSeconds"] for s in segs)

        return {
            "id": f"client_short_{int(time.time())}",
            "title": "Client Script Short",
            "educationalLesson": "Custom story from client script",
            "viralityScore": 90,
            "reason": "Lexical alignment with client script",
            "hook": h,
            "body": b,
            "cta": c,
            "segments": segs,
            "totalDurationSeconds": round(total_d, 2),
            "durationSeconds": round(total_d, 2),
            "startSeconds": h["startSeconds"],
            "endSeconds": c["endSeconds"],
            "scriptText": f"🎯 HOOK:\n\"{h['text']}\"\n\n📖 BODY:\n\"{b['text']}\"\n\n📢 CTA:\n\"{c['text']}\"",
            "markers": [
                {"seconds": 0.0, "type": "EMPHASIS", "name": "Hook", "comment": "Hook"},
                {"seconds": h["endSeconds"] - h["startSeconds"], "type": "BROLL", "name": "Body", "comment": "Body"},
                {"seconds": max(0.0, total_d - 4.0), "type": "SFX", "name": "CTA", "comment": "CTA"}
            ]
        }
