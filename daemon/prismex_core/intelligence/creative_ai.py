"""
Creative AI Subsystem - Viral Shorts, Timeline Markers, Spell Check, Script Alignment,
and After Effects Kinetic Typography.
"""

import json
import re
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
