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
    ) -> List[Dict[str, Any]]:
        """Identifies top 3-5 high-engagement viral hook segments (30-60s) for 9:16 Vertical Shorts."""
        if not words:
            return []

        full_text = " ".join(str(s.get("text", "")).strip() for s in sentences) if sentences else " ".join(str(w.get("word", "")) for w in words)
        total_dur = float(words[-1].get("end_seconds", 0.0)) if words else 0.0

        prompt = (
            "You are a viral YouTube Shorts and TikTok video producer. Analyze this transcript and select "
            f"up to {target_count} distinct 30-to-60-second viral moments that have great hooks, strong storytelling, "
            "and standalone value.\n"
            f"Transcript ({round(total_dur, 1)}s total):\n{full_text[:8000]}\n"
            "Return a JSON array of objects with keys: "
            '{"title": "Punchy Short Title", "hook": "The opening hook phrase", "startSeconds": 0.0, "endSeconds": 45.0, "viralityScore": 95, "reason": "Why it will go viral"}'
        )

        ai_res = cls._call_gemini_json(prompt)
        if isinstance(ai_res, list) and len(ai_res) > 0:
            shorts = []
            for item in ai_res:
                s_sec = max(0.0, float(item.get("startSeconds", 0.0)))
                e_sec = min(total_dur, max(s_sec + 15.0, float(item.get("endSeconds", s_sec + 45.0))))
                shorts.append({
                    "title": str(item.get("title", "Viral Short")),
                    "hook": str(item.get("hook", "")),
                    "startSeconds": round(s_sec, 2),
                    "endSeconds": round(e_sec, 2),
                    "durationSeconds": round(e_sec - s_sec, 2),
                    "startFrame": int(round(s_sec * fps)),
                    "endFrame": int(round(e_sec * fps)),
                    "viralityScore": int(item.get("viralityScore", 90)),
                    "reason": str(item.get("reason", "Strong hook")),
                    "aspectRatio": "9:16 (1080x1920)"
                })
            return shorts

        # Offline Local Chunker: Divide into 45s high-energy slices
        shorts = []
        if total_dur <= 15.0:
            shorts.append({
                "title": "Short #1 - Highlight Moment",
                "hook": "Complete video moment",
                "startSeconds": 0.0,
                "endSeconds": round(total_dur, 2),
                "durationSeconds": round(total_dur, 2),
                "startFrame": 0,
                "endFrame": int(round(total_dur * fps)),
                "viralityScore": 92,
                "reason": "Compact high-energy moment",
                "aspectRatio": "9:16 (1080x1920)"
            })
            return shorts

        slice_dur = min(45.0, max(20.0, total_dur / max(1, target_count)))
        curr_t = 0.0
        idx = 1
        while curr_t + 15.0 <= total_dur and len(shorts) < target_count:
            end_t = min(total_dur, curr_t + slice_dur)
            # Find nearest sentence start/end
            shorts.append({
                "title": f"Short #{idx} - Highlight Moment",
                "hook": f"Moment at {round(curr_t, 1)}s",
                "startSeconds": round(curr_t, 2),
                "endSeconds": round(end_t, 2),
                "durationSeconds": round(end_t - curr_t, 2),
                "startFrame": int(round(curr_t * fps)),
                "endFrame": int(round(end_t * fps)),
                "viralityScore": 85 - (idx * 3),
                "reason": "Automated energy & pacing slice",
                "aspectRatio": "9:16 (1080x1920)"
            })
            curr_t = end_t
            idx += 1

        return shorts

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
