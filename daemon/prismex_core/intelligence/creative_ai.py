"""
Creative AI Subsystem - Viral Shorts, Timeline Markers, Spell Check, Script Alignment,
and After Effects Kinetic Typography.
"""

import json
import re
import time
import urllib.parse
from typing import Any, Dict, List, Optional
from ..security.keychain_vault import KeychainVault


class CreativeAI:
    @staticmethod
    def _call_gemini_json(prompt: str) -> Optional[Any]:
        import requests

        # 1. Try OpenRouter API if configured
        openrouter_key = KeychainVault.get_api_key("openrouter")
        if openrouter_key:
            openrouter_models = [
                "google/gemini-2.5-flash",
                "google/gemini-2.0-flash-001",
                "deepseek/deepseek-chat",
                "meta-llama/llama-3.3-70b-instruct",
                "anthropic/claude-3.5-haiku"
            ]
            for om in openrouter_models:
                try:
                    resp = requests.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {openrouter_key}",
                            "HTTP-Referer": "https://prismex.ai",
                            "X-Title": "Prismex AI Editor",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": om,
                            "messages": [
                                {
                                    "role": "system",
                                    "content": "You are Prismex AI video editing assistant. You must respond strictly with valid JSON only. Do not include markdown codeblocks or text outside the JSON."
                                },
                                {
                                    "role": "user",
                                    "content": prompt
                                }
                            ],
                            "response_format": {"type": "json_object"},
                            "temperature": 0.2
                        },
                        timeout=25
                    )
                    if resp.status_code == 200:
                        content = resp.json()["choices"][0]["message"]["content"]
                        cleaned = re.sub(r"^```(?:json)?\s*", "", content.strip())
                        cleaned = re.sub(r"\s*```$", "", cleaned)
                        return json.loads(cleaned)
                    else:
                        print(f"[CreativeAI] OpenRouter model {om} returned status {resp.status_code}")
                except Exception as e:
                    print(f"[CreativeAI] OpenRouter model {om} failed: {e}")

        # 2. Try Google Gemini API
        api_key = KeychainVault.get_api_key("google-gemini") or KeychainVault.get_api_key("gemini-cloud")
        if not api_key:
            return None
        candidate_models = [
            "gemini-flash-lite-latest",
            "gemini-3.5-flash-lite",
            "gemini-3.5-flash",
            "gemini-3.7-flash"
        ]
        for m in candidate_models:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={api_key}"
                resp = requests.post(
                    url,
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
                    },
                    timeout=20,
                )
                if resp.status_code == 200:
                    raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                    return json.loads(raw)
                else:
                    print(f"[CreativeAI] Gemini model {m} returned status {resp.status_code}")
            except Exception as e:
                print(f"[CreativeAI] Gemini model {m} failed: {e}")
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
        Deep-analyzes transcript words and classifies timeline moments into
        4 distinct color-coded visual cue types with rich contextual suggestions:
        - PURPLE: PNG, transparent cutout, logo, product photo & device picture
        - CYAN: B-Roll video footage, cutaways, timelapse & action shots
        - ORANGE: Icons, UI buttons & motion stickers
        - RED: Emphasis, high-impact punch words & typography pop
        Each marker includes: suggestion, context, cleanKeyword, and 1-click external URLs
        (Google Images PNG, Pexels Video, Flaticon).
        """
        if not words:
            return {"markers": []}

        markers: List[Dict[str, Any]] = []

        # 1. PNG Cutouts, Logos, Gadgets & Photo Triggers (পিকচার / পিএনজি / ছবি)
        png_triggers = {
            # Software & Tech Apps
            "photoshop": "Photoshop Logo PNG", "premiere": "Premiere Pro Icon PNG",
            "aftereffects": "After Effects Icon PNG", "ae": "After Effects Logo PNG",
            "figma": "Figma Logo PNG", "chrome": "Google Chrome Logo PNG",
            "chatgpt": "ChatGPT AI Logo PNG", "openai": "OpenAI Logo PNG",
            "gemini": "Google Gemini Icon PNG", "midjourney": "Midjourney Logo PNG",
            "apple": "Apple Logo PNG", "google": "Google Logo PNG",
            "youtube": "YouTube Logo PNG", "facebook": "Facebook Icon PNG",
            "instagram": "Instagram Logo PNG", "tiktok": "TikTok Logo PNG",
            "twitter": "X / Twitter Icon PNG", "x": "X Twitter Logo PNG",
            "linkedin": "LinkedIn Icon PNG", "whatsapp": "WhatsApp Icon PNG",
            "telegram": "Telegram Icon PNG", "discord": "Discord Logo PNG",
            "spotify": "Spotify Logo PNG", "netflix": "Netflix Logo PNG",
            "canva": "Canva Logo PNG", "capcut": "CapCut Logo PNG",
            "vscode": "VS Code Logo PNG", "notion": "Notion Logo PNG",
            # Hardware & Devices
            "iphone": "iPhone Cutout PNG", "android": "Android Logo PNG",
            "samsung": "Samsung Phone PNG", "camera": "Camera Cutout PNG",
            "sony": "Sony Camera PNG", "mic": "Studio Microphone PNG",
            "microphone": "Microphone Cutout PNG", "laptop": "Laptop Cutout PNG",
            "macbook": "MacBook Cutout PNG", "pc": "Desktop PC PNG",
            "computer": "Computer Monitor PNG", "monitor": "Display Monitor PNG",
            "gpu": "NVIDIA GPU Graphic PNG", "nvidia": "NVIDIA Logo PNG",
            "intel": "Intel Logo PNG", "ipad": "iPad Tablet PNG",
            "drone": "Drone Cutout PNG", "airpods": "AirPods PNG",
            "headphone": "Headphones PNG",
            # Assets, Objects & Documents
            "money": "Money / Cash PNG", "dollar": "Dollar Bills PNG",
            "cash": "Cash Money Stack PNG", "crypto": "Cryptocurrency Icon PNG",
            "bitcoin": "Bitcoin Gold Coin PNG", "card": "Credit Card PNG",
            "visa": "Visa Card PNG", "mastercard": "Mastercard Logo PNG",
            "bank": "Bank Building Icon PNG", "passport": "Passport PNG",
            "contract": "Contract Document PNG", "certificate": "Award Certificate PNG",
            "book": "Book Cover PNG", "car": "Car Cutout PNG", "tesla": "Tesla Car PNG",
            "chart": "Financial Growth Chart PNG", "graph": "Analytics Graph PNG",
            "diagram": "Flow Diagram PNG", "screenshot": "App Screenshot PNG",
            "logo": "Brand Logo Transparent PNG", "picture": "Picture / Photo",
            "photo": "Photo Asset", "image": "Image Asset", "png": "Transparent PNG Cutout",
            # Bengali triggers
            "ছবি": "ছবি / ফটো পিএনজি", "পিকচার": "পিকচার কাটআউট", "পিএনজি": "ট্রান্সপারেন্ট পিএনজি",
            "লোগো": "ব্র্যান্ড লোগো পিএনজি", "অ্যাপ": "অ্যাপ আইকন পিএনজি", "মোবাইল": "মোবাইল ফোন কাটআউট",
            "ফোন": "স্মার্টফোন পিএনজি", "টাকা": "টাকা / কারেন্সি পিএনজি", "ডলার": "ডলার ক্যাশ পিএনজি",
            "ব্যাংক": "ব্যাংক আইকন", "গ্রাফ": "এনালিটিক্স গ্রাফ পিএনজি", "চার্ট": "গ্রোথ চার্ট পিএনজি",
            "ল্যাপটপ": "ল্যাপটপ কাটআউট", "ক্যামেরা": "ক্যামেরা কাটআউট পিএনজি", "ইউটিউব": "ইউটিউব লোগো পিএনজি",
            "ফেসবুক": "ফেসবুক লোগো", "গুগল": "গুগল লোগো পিএনজি", "সফটওয়্যার": "সফটওয়্যার লোগো",
            "কম্পিউটার": "কম্পিউটার কাটআউট", "মাইক্রোফোন": "মাইক কাটআউট পিএনজি", "স্ক্রিনশট": "স্ক্রিনশট ইমেজ"
        }

        # 2. B-Roll Video Footage Triggers (ভিডিও ফুটেজ)
        broll_triggers = {
            "look": "Close-up Visual", "footage": "Stock Footage", "broll": "B-Roll Cutaway", "timelapse": "Timelapse",
            "cinematic": "Cinematic B-Roll", "drone": "Drone Aerial", "landscape": "Landscape Shot",
            "background": "Background Plate", "montage": "Visual Montage",
            "city": "City Skyline Footage", "traffic": "Traffic Timelapse", "nature": "Nature Scenery",
            "ocean": "Ocean Waves B-Roll", "office": "Office Working B-Roll", "coding": "Typing / Coding Screen",
            "walking": "Walking Street B-Roll", "travel": "Travel Scenery", "night": "Night City Lights",
            "sunset": "Sunset Golden Hour", "studio": "Studio Lighting",
            "ফুটেজ": "ফুটেজ", "সিনেমাটিক": "সিনেমাটিক শট", "ড্রোন": "ড্রোন শট", "টাইমলাপ্স": "টাইমলাপ্স",
            "ভিডিও": "ভিডিও ফুটেজ", "শট": "কাটঅ্যাওয়ে শট", "দৃশ্য": "সিনারি ভিডিও", "অফিস": "অফিস ফুটেজ",
            "শহর": "শহরের দৃশ্য", "প্রকৃতি": "প্রাকৃতিক দৃশ্য", "রাস্তা": "রাস্তার ট্রাফিক"
        }

        # 3. Icon Triggers (আইকন / ইন্টারঅ্যাকশন)
        icon_triggers = {
            "click": "Mouse Click Icon", "button": "Button Icon",
            "subscribe": "Subscribe Bell Icon", "download": "Download Icon",
            "notification": "Notification Bell", "website": "Website / URL Badge",
            "link": "Link Icon", "checklist": "Checklist Icon", "bell": "Notification Bell",
            "like": "Thumbs Up Like Icon", "share": "Share Arrow Icon", "comment": "Chat Comment Icon",
            "সাবস্ক্রাইব": "সাবস্ক্রাইব বেল", "ডাউনলোড": "ডাউনলোড তীর", "লিংক": "লিংক আইকন",
            "আইকন": "ভেক্টর আইকন", "লাইক": "লাইক আইকন", "শেয়ার": "শেয়ার আইকন"
        }

        # 4. Emphasis & Punch Triggers (পাঞ্চ জুম / টাইপোগ্রাফি)
        emphasis_triggers = {
            "insane": "Shock Factor", "never": "Strong Negation", "always": "Absolute Emphasis", "secret": "Secret / Reveal",
            "best": "Superlative", "important": "Crucial Point", "game-changer": "Paradigm Shift",
            "revolutionary": "Innovation", "guaranteed": "Certainty",
            "সবচেয়ে": "সর্বোচ্চ", "সেরা": "শ্রেষ্ঠ", "গুরুত্বপূর্ণ": "জরুরি পয়েন্ট",
            "আসল": "আসল কথা", "রহস্য": "রহস্য", "বিশাল": "বিশাল ব্যাপার",
        }

        # Build context fragments
        word_texts = [str(w.get("word", "")) for w in words]

        for i, w in enumerate(words):
            raw_w = str(w.get("word", ""))
            token = re.sub(r"[^\w\u0980-\u09FF']+", "", raw_w.lower())
            start = float(w.get("start_seconds", 0.0))
            dur = max(0.3, float(w.get("end_seconds", start + 0.3)) - start)
            ctx_start = max(0, i - 4)
            ctx_end = min(len(word_texts), i + 5)
            context = " ".join(word_texts[ctx_start:ctx_end])

            if token in png_triggers:
                png_desc = png_triggers[token]
                search_q = f"{raw_w} transparent png"
                quoted = urllib.parse.quote_plus(search_q)
                markers.append({
                    "type": "PNG",
                    "color": "PURPLE",
                    "name": f"PNG: {raw_w}",
                    "comment": f"Overlay PNG cutout / picture for '{raw_w}'",
                    "suggestion": f"🖼️ PNG / ছবি: {png_desc}",
                    "pngQuery": search_q,
                    "cleanKeyword": raw_w,
                    "googleImagesUrl": f"https://www.google.com/search?tbm=isch&q={quoted}",
                    "context": context,
                    "startSeconds": start,
                    "durationSeconds": 2.0
                })
            elif token in broll_triggers:
                broll_desc = broll_triggers[token]
                search_q = f"{raw_w} footage"
                quoted = urllib.parse.quote_plus(raw_w)
                markers.append({
                    "type": "BROLL",
                    "color": "GREEN",
                    "name": f"B-Roll: {raw_w}",
                    "comment": f"Overlay relevant visual footage for '{raw_w}'",
                    "suggestion": f"🎥 B-Roll: {broll_desc}",
                    "brollQuery": search_q,
                    "cleanKeyword": raw_w,
                    "pexelsUrl": f"https://www.pexels.com/search/videos/{quoted}/",
                    "context": context,
                    "startSeconds": start,
                    "durationSeconds": 2.5
                })
            elif token in icon_triggers:
                icon_desc = icon_triggers[token]
                search_q = f"{raw_w} icon png"
                quoted = urllib.parse.quote_plus(raw_w)
                markers.append({
                    "type": "ICON",
                    "color": "BLUE",
                    "name": f"Icon: {raw_w}",
                    "comment": f"Drop PNG icon or motion graphic for '{raw_w}'",
                    "suggestion": f"🎨 আইকন: {icon_desc}",
                    "iconQuery": search_q,
                    "cleanKeyword": raw_w,
                    "flaticonUrl": f"https://www.flaticon.com/search?word={quoted}",
                    "googleImagesUrl": f"https://www.google.com/search?tbm=isch&q={urllib.parse.quote_plus(raw_w + ' icon png')}",
                    "context": context,
                    "startSeconds": start,
                    "durationSeconds": 1.5
                })
            elif token in emphasis_triggers:
                effect_hint = emphasis_triggers[token]
                markers.append({
                    "type": "EMPHASIS",
                    "color": "RED",
                    "name": f"Emphasis: {raw_w}",
                    "comment": "Punch word - Add scale pop or text highlight",
                    "suggestion": f"⚡ পাঞ্চ জুম (১১৪% স্কেল) — {effect_hint}",
                    "emphasisEffect": effect_hint,
                    "cleanKeyword": raw_w,
                    "context": context,
                    "startSeconds": start,
                    "durationSeconds": dur
                })

        return {"markers": markers[:120], "total": len(markers)}

    @classmethod
    def extract_typography_keywords(cls, sentence: str) -> Dict[str, Any]:
        """
        Extracts only the most important 2-4 high-impact keywords from a sentence
        for on-screen motion typography / text overlay.
        """
        if not sentence or not sentence.strip():
            return {"original": sentence, "typography": "", "keywords": []}

        raw_words = sentence.strip().split()

        stop_words = {
            "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
            "have", "has", "had", "do", "does", "did", "will", "would", "could",
            "should", "may", "might", "shall", "can", "need", "to", "of", "in",
            "for", "on", "with", "at", "by", "from", "as", "into", "through",
            "during", "before", "after", "above", "below", "between", "out", "off",
            "over", "under", "again", "further", "then", "once", "here", "there",
            "when", "where", "why", "how", "all", "each", "every", "both", "few",
            "more", "most", "other", "some", "such", "no", "nor", "not", "only",
            "own", "same", "so", "than", "too", "very", "just", "now", "and",
            "but", "or", "if", "while", "because", "until", "that", "this",
            "these", "those", "i", "me", "my", "we", "our", "you", "your",
            "he", "him", "his", "she", "her", "it", "its", "they", "them",
            "their", "what", "which", "who", "whom", "am", "about", "up", "down",
            "get", "got", "go", "going", "like", "really", "actually", "basically",
            "literally", "um", "uh", "ah", "okay", "ok", "right", "well", "thing",
            "things", "something", "don't",
            "\u098f\u099f\u09be", "\u0993\u099f\u09be", "\u09b8\u09c7\u099f\u09be", "\u09af\u09c7\u099f\u09be", "\u098f\u0995\u099f\u09be",
            "\u0986\u09ae\u09bf", "\u0986\u09ae\u09be\u09b0", "\u0986\u09ae\u09b0\u09be", "\u09a4\u09c1\u09ae\u09bf", "\u09a4\u09cb\u09ae\u09be\u09b0",
            "\u09b8\u09c7", "\u09a4\u09be\u09b0", "\u09a4\u09be\u09b0\u09be", "\u09a4\u09be\u09a6\u09c7\u09b0", "\u098f\u0987", "\u0993\u0987",
            "\u09b8\u09c7\u0987", "\u09af\u09c7", "\u0995\u09bf", "\u0995\u09c7\u09a8", "\u098f\u09ac\u0982", "\u0986\u09b0", "\u0995\u09bf\u09a8\u09cd\u09a4\u09c1",
            "\u0985\u09a5\u09ac\u09be", "\u09a4\u09be\u09b9\u09b2\u09c7", "\u09af\u09a6\u09bf", "\u09a4\u09ac\u09c7", "\u09af\u0996\u09a8",
            "\u09a4\u0996\u09a8", "\u098f\u0996\u09a8", "\u09aa\u09b0\u09c7", "\u0986\u0997\u09c7", "\u09ae\u09a7\u09cd\u09af\u09c7",
            "\u099c\u09a8\u09cd\u09af", "\u09a5\u09c7\u0995\u09c7", "\u09a6\u09bf\u09af\u09bc\u09c7", "\u09a8\u09bf\u09af\u09bc\u09c7",
            "\u0995\u09b0\u09c7", "\u09b9\u09af\u09bc", "\u09b9\u09b2\u09cb", "\u099b\u09bf\u09b2", "\u0986\u099b\u09c7",
            "\u09a8\u09be\u0987", "\u09a8\u09be", "\u09b9\u09cd\u09af\u09be\u0981", "\u09ae\u09be\u09a8\u09c7", "\u09a7\u09b0\u09cb",
            "\u09ac\u09b2\u099b\u09bf", "\u0995\u09b0\u09ac\u09cb", "\u09af\u09be\u09ac\u09c7", "\u09a6\u09b0\u0995\u09be\u09b0",
            "\u098f\u0995\u099f\u09c1", "\u0985\u09a8\u09c7\u0995", "\u0996\u09c1\u09ac", "\u09ac\u09c7\u09b6\u09bf", "\u0995\u09ae",
            "\u09ad\u09be\u09b2\u09cb", "\u09ae\u09a4\u09cb", "\u09b0\u0995\u09ae", "\u09ad\u09be\u09ac\u09c7",
        }

        scored = []
        for w in raw_words:
            clean = re.sub(r"[^\w\u0980-\u09FF']+", "", w.lower())
            if clean in stop_words or len(clean) < 2:
                continue
            score = len(clean)
            if w[0].isupper() and not w.isupper():
                score += 3
            if w.isupper() and len(w) > 1:
                score += 5
            scored.append((w, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        max_keywords = min(4, max(2, len(scored) // 2))
        top_words = scored[:max_keywords]

        original_order = []
        used = set()
        for w in raw_words:
            for tw, sc in top_words:
                if tw == w and tw not in used:
                    original_order.append((tw, sc))
                    used.add(tw)
                    break

        keywords = [w for w, _ in original_order]
        typography_text = " ".join(keywords).upper() if keywords else sentence.strip().upper()

        return {
            "original": sentence,
            "typography": typography_text,
            "keywords": keywords
        }

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

        # Local Offline Fallback: Extract meaningful story clusters from words & sentences
        if not words:
            return []

        total_word_count = len(words)
        chunk_word_size = max(20, min(80, total_word_count // max(1, target_count)))
        topics = []

        for t_idx in range(1, target_count + 1):
            w_start_idx = (t_idx - 1) * chunk_word_size
            w_end_idx = min(total_word_count, t_idx * chunk_word_size)
            if w_start_idx >= total_word_count:
                break

            chunk_w = words[w_start_idx:w_end_idx]
            if not chunk_w:
                break

            s_sec = round(float(chunk_w[0].get("start_seconds", chunk_w[0].get("start", 0.0))), 2)
            e_sec = round(float(chunk_w[-1].get("end_seconds", chunk_w[-1].get("end", 0.0))), 2)
            snippet = " ".join(str(w.get("word", "")).strip() for w in chunk_w if w.get("word"))

            words_in_snippet = snippet.split()
            title = " ".join(words_in_snippet[:6]) if words_in_snippet else f"টপিক #{t_idx}"
            summary = snippet[:180] + ("..." if len(snippet) > 180 else "")

            p1 = " ".join(words_in_snippet[:6]) if len(words_in_snippet) >= 6 else "সূচনা ও মূল কথা"
            mid = len(words_in_snippet) // 2
            p2 = " ".join(words_in_snippet[mid : mid + 6]) if len(words_in_snippet) >= 12 else "মূল বর্ণনা ও ঘটনা"
            p3 = " ".join(words_in_snippet[-6:]) if len(words_in_snippet) >= 6 else "উপসংহার ও শেষ কথা"

            topics.append({
                "id": f"topic_{t_idx}_{int(s_sec)}",
                "topicTitle": title,
                "topicSummaryBn": summary,
                "keyPoints": [p1, p2, p3],
                "viralityScore": max(75, 96 - (t_idx * 3)),
                "estimatedDurationSeconds": min(60, max(25, int(e_sec - s_sec))),
                "startSeconds": s_sec,
                "endSeconds": e_sec
            })

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

    @classmethod
    def analyze_script_visual_directives(
        cls,
        words: List[Dict[str, Any]],
        sentences: List[Dict[str, Any]],
        language: str = "bn",
        user_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Deep contextual AI script analysis for modern high-retention video editing.
        Generates engaging directives every 2-3 sentences:
        - BROLL: Cinematic footage query & Pexels URL
        - PNG: Transparent picture, cutout, gadget, logo & Google Images PNG URL
        - TEXT_ANIMATION: Kinetic typography keywords & phrases for on-screen impact
        - PUNCH: Camera punch zoom
        And for EVERY sentence:
        - bangla_explanation: Clear Bengali explanation of what is being spoken
        - editing_suggestion: Specific, actionable director's advice for the editor
        """
        # 1. Normalize sentences
        norm_sentences: List[Dict[str, Any]] = []
        if sentences and len(sentences) > 0:
            for idx, s in enumerate(sentences):
                norm_sentences.append({
                    "sentenceIndex": idx,
                    "text": str(s.get("text", "")).strip(),
                    "startSeconds": round(float(s.get("start_seconds", s.get("startSeconds", 0.0))), 2),
                    "endSeconds": round(float(s.get("end_seconds", s.get("endSeconds", 0.0))), 2)
                })
        elif words and len(words) > 0:
            # Chunk words into pseudo-sentences by punctuation or 12-word boundaries
            curr_chunk: List[str] = []
            chunk_start = float(words[0].get("start_seconds", 0.0))
            chunk_end = chunk_start
            s_idx = 0
            for i, w in enumerate(words):
                raw = str(w.get("word", "")).strip()
                curr_chunk.append(raw)
                chunk_end = float(w.get("end_seconds", chunk_end))
                is_terminal = bool(re.search(r'[.!?।\n]$', raw)) or len(curr_chunk) >= 12 or i == len(words) - 1
                if is_terminal and curr_chunk:
                    norm_sentences.append({
                        "sentenceIndex": s_idx,
                        "text": " ".join(curr_chunk),
                        "startSeconds": round(chunk_start, 2),
                        "endSeconds": round(chunk_end, 2)
                    })
                    curr_chunk = []
                    s_idx += 1
                    if i + 1 < len(words):
                        chunk_start = float(words[i + 1].get("start_seconds", chunk_end))

        if not norm_sentences:
            return {"directives": [], "totalDirectives": 0, "engine": "none"}

        # 2. Try LLM Call (Gemini / OpenRouter / OpenAI)
        script_snippet = "\n".join(
            f"[{s['sentenceIndex']}] ({s['startSeconds']}s-{s['endSeconds']}s): {s['text']}"
            for s in norm_sentences[:40]
        )

        prompt = (
            "You are an Elite Video Director and YouTube Editor analyzing a video transcript.\n"
            "Goal: Maximize viewer retention by suggesting frequent visual elements (every 2-3 sentences)!\n"
            "Visual Cue Types:\n"
            "- 'BROLL': Cinematic footage, action, scenery, environment, or real-world example.\n"
            "- 'PNG': Transparent image, gadget, logo, brand, app, dollar/cash, chart, or cutout picture.\n"
            "- 'TEXT_ANIMATION': Kinetic typography, statistics, numbers, or powerful memorable punchlines.\n"
            "- 'PUNCH': 114% camera snap zoom for dramatic emphasis.\n"
            "- 'NONE': Keep focus on speaker without overlay.\n\n"
            f"User Instruction (if any): {user_prompt or 'Analyze for high engagement'}\n\n"
            f"Transcript Sentences:\n{script_snippet}\n\n"
            "Return a strictly valid JSON array of objects with keys:\n"
            "[\n"
            "  {\n"
            '    "sentenceIndex": 0,\n'
            '    "visualType": "BROLL" | "PNG" | "TEXT_ANIMATION" | "PUNCH" | "NONE",\n'
            '    "query": "concise search query in English for stock or PNG",\n'
            '    "keyWords": ["2-3", "impactful", "words"],\n'
            '    "banglaExplanation": "এই লাইনের সহজ বাংলা অর্থ ও প্রেক্ষাপট",\n'
            '    "editingSuggestion": "এডিটর হিসেবে এখানে কী ভিজ্যুয়াল বা অ্যানিমেশন ব্যবহার করবেন তার বাংলা পরামর্শ"\n'
            "  }\n"
            "]"
        )

        ai_res = cls._call_gemini_json(prompt)
        llm_map: Dict[int, Dict[str, Any]] = {}
        if isinstance(ai_res, list) and len(ai_res) > 0:
            for item in ai_res:
                if isinstance(item, dict) and "sentenceIndex" in item:
                    try:
                        idx = int(item["sentenceIndex"])
                        llm_map[idx] = item
                    except Exception:
                        pass

        # 3. Build Final Directives with Comprehensive Heuristic Support
        directives: List[Dict[str, Any]] = []
        timeline_markers: List[Dict[str, Any]] = []

        # Common entity dictionaries for smart detection
        png_keywords = set([
            "apple", "google", "youtube", "facebook", "instagram", "tiktok", "twitter", "x",
            "iphone", "android", "macbook", "laptop", "pc", "computer", "camera", "sony", "mic",
            "money", "dollar", "cash", "crypto", "bitcoin", "card", "bank", "tax", "taxes", "cost",
            "price", "chart", "graph", "house", "car", "tesla", "california", "texas", "florida",
            "টাকা", "ডলার", "ব্যাংক", "গ্রাফ", "চার্ট", "ল্যাপটপ", "ক্যামেরা", "ইউটিউব", "গুগল",
            "ফোন", "মোবাইল", "ছবি", "পিকচার", "লোগো", "অ্যাপ", "বাড়ি", "গাড়ি"
        ])

        broll_keywords = set([
            "look", "see", "moving", "road", "drive", "travel", "city", "street", "traffic", "fly",
            "nature", "ocean", "office", "working", "people", "crowd", "sunset", "night", "building",
            "ফুটেজ", "সিনেমাটিক", "রাস্তা", "শহর", "প্রকৃতি", "অফিস", "মানুষ", "ভিডিও", "দৃশ্য"
        ])

        punch_keywords = set([
            "insane", "never", "always", "secret", "best", "worst", "shocking", "huge", "crazy",
            "সবচেয়ে", "সেরা", "বিশাল", "আসল", "রহস্য", "ভয়ানক", "পাগলামি", "কখনো না"
        ])

        for s in norm_sentences:
            s_idx = s["sentenceIndex"]
            s_text = s["text"]
            s_start = s["startSeconds"]
            s_end = s["endSeconds"]
            dur = max(0.4, s_end - s_start)

            llm_item = llm_map.get(s_idx)
            words_in_sent = [re.sub(r"[^\w\u0980-\u09FF']+", "", w.lower()) for w in s_text.split()]
            clean_text = re.sub(r'["\r\n\t]+', ' ', s_text).strip()

            if llm_item:
                v_type = str(llm_item.get("visualType", "NONE")).upper()
                if v_type not in ["BROLL", "PNG", "TEXT_ANIMATION", "PUNCH", "NONE"]:
                    v_type = "BROLL"
                query = str(llm_item.get("query", "")).strip() or clean_text[:30]
                kw = llm_item.get("keyWords", [])
                if not isinstance(kw, list):
                    kw = [str(kw)]
                b_exp = str(llm_item.get("banglaExplanation", "")).strip()
                e_sug = str(llm_item.get("editingSuggestion", "")).strip()
            else:
                # Heuristic Classifier: Ensure frequent engaging cues (at least every 2 sentences)
                has_png = any(k in words_in_sent for k in png_keywords)
                has_broll = any(k in words_in_sent for k in broll_keywords)
                has_punch = any(k in words_in_sent for k in punch_keywords)
                has_numbers = bool(re.search(r'\d+', s_text))

                if has_png:
                    v_type = "PNG"
                    matched_k = next((k for k in words_in_sent if k in png_keywords), "asset")
                    query = f"{matched_k} logo transparent png"
                    b_exp = f"এই বাক্যে '{matched_k}'-সংক্রান্ত বিষয়ে আলোকপাত করা হচ্ছে।"
                    e_sug = f"স্ক্রিনে {matched_k}-এর একটি স্বচ্ছ পিএনজি কাটআউট বা আইকন ফ্ল্যাশ করুন।"
                    kw = [matched_k.upper()]
                elif has_broll:
                    v_type = "BROLL"
                    matched_k = next((k for k in words_in_sent if k in broll_keywords), "cinematic broll")
                    query = f"{matched_k} cinematic footage"
                    b_exp = f"স্পিকার বাস্তব দৃশ্য বা অভিজ্ঞতার বিবরণ দিচ্ছেন।"
                    e_sug = f"বক্তব্যের সাথে মিলিয়ে প্রাসঙ্গিক সিনেমাটিক বি-রোল ফুটেজ ওভারলে করুন।"
                    kw = [w for w in words_in_sent if len(w) > 4][:3]
                elif has_numbers or (s_idx % 3 == 1):
                    v_type = "TEXT_ANIMATION"
                    query = clean_text[:35]
                    b_exp = "গুরুত্বপূর্ণ তথ্য, সংখ্যা বা প্রধান পয়েন্ট তুলে ধরা হচ্ছে।"
                    e_sug = "মূল মেসেজ বা সংখ্যাটিকে মোশন টাইপোগ্রাফি আকারে স্ক্রিনে অ্যানিমেট করুন।"
                    kw = [w.upper() for w in words_in_sent if len(w) > 3][:3] or ["KEY POINT"]
                elif has_punch or (s_idx % 4 == 0):
                    v_type = "PUNCH"
                    query = "zoom punch"
                    b_exp = "বক্তব্যে বিশেষ জোর বা ইমপ্যাক্ট তৈরি করা হচ্ছে।"
                    e_sug = "দর্শকের মনোযোগ ধরে রাখতে এই বাক্যে ১১৪% ক্যামেরা পাঞ্চ ইন বা স্কেল আপ দিন।"
                    kw = ["PUNCH"]
                else:
                    v_type = "BROLL" if (s_idx % 2 == 0) else "PNG"
                    query = clean_text[:30]
                    b_exp = f"বিষয়বস্তুর ধারাবাহিক আলোচনা: '{clean_text[:50]}...'"
                    e_sug = "ভিডিও গতিশীল রাখতে এই অংশে প্রাসঙ্গিক ব্যাকগ্রাউন্ড বি-রোল বা গ্রাফিক্স যুক্ত করুন।"
                    kw = [w for w in words_in_sent if len(w) > 3][:2]

            # Style metadata
            if v_type == "BROLL":
                badge_label = "🎥 B-Roll"
                color_theme = "cyan"
                accent_color = "#06b6d4"
            elif v_type == "PNG":
                badge_label = "🖼️ PNG"
                color_theme = "purple"
                accent_color = "#a855f7"
            elif v_type == "TEXT_ANIMATION":
                badge_label = "✨ টেক্সট অ্যানিমেশন"
                color_theme = "amber"
                accent_color = "#f59e0b"
            elif v_type == "PUNCH":
                badge_label = "⚡ পাঞ্চ"
                color_theme = "red"
                accent_color = "#ef4444"
            else:
                badge_label = "🎬 স্পিকার"
                color_theme = "neutral"
                accent_color = "#71717a"

            clean_q = re.sub(r"[^\w\s\u0980-\u09FF'-]", "", query).strip()
            g_url = f"https://www.google.com/search?tbm=isch&q={urllib.parse.quote(clean_q + ' transparent png')}"
            p_url = f"https://www.pexels.com/search/videos/{urllib.parse.quote(clean_q)}/"

            directive_obj = {
                "sentenceIndex": s_idx,
                "text": s_text,
                "startSeconds": s_start,
                "endSeconds": s_end,
                "durationSeconds": dur,
                "visualType": v_type,
                "badgeLabel": badge_label,
                "colorTheme": color_theme,
                "accentColor": accent_color,
                "query": clean_q,
                "keyWords": kw,
                "banglaExplanation": b_exp,
                "editingSuggestion": e_sug,
                "googleImagesUrl": g_url,
                "pexelsUrl": p_url
            }
            directives.append(directive_obj)

            if v_type != "NONE":
                timeline_markers.append({
                    "seconds": s_start,
                    "duration": dur,
                    "name": f"{badge_label}: {clean_q[:20]}",
                    "comment": f"{e_sug} | Search: {clean_q}",
                    "type": "BROLL" if v_type == "BROLL" else ("EMPHASIS" if v_type == "PUNCH" else "ICON")
                })

        engine_name = "AI LLM (Gemini / OpenRouter)" if llm_map else "Prismex Smart Director Engine (Contextual)"
        return {
            "directives": directives,
            "totalDirectives": len([d for d in directives if d["visualType"] != "NONE"]),
            "timelineMarkers": timeline_markers,
            "engine": engine_name
        }
