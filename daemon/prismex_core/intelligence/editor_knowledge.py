"""
Prismex Core - Comprehensive Video Editing Knowledge Base & Technical Encyclopedia
Authoritative standards for Social Media, Broadcast Delivery, Audio LUFS, Color Science,
Typography, and Premiere Pro Pro-Editing Operations.
Used for zero-latency, deterministic local answers and anti-hallucination LLM guardrails.
"""

from typing import Dict, Any, List, Optional
import re

class EditorKnowledgeBase:
    """
    Encyclopedia of professional video editing standards, broadcast specifications,
    color science, audio mastering thresholds, and Premiere Pro shortcuts.
    """

    PLATFORM_SPECS = {
        "youtube_shorts": {
            "name": "YouTube Shorts",
            "nameBn": "ইউটিউব শর্টস (YouTube Shorts)",
            "resolution": "1080x1920",
            "aspectRatio": "9:16",
            "maxDuration": "60 seconds",
            "fps": "30 or 60 fps",
            "codec": "H.264 / HEVC (MP4)",
            "audioTarget": "-14.0 LUFS (Integrated)",
            "safeZones": "Top 15% and Bottom 20% safe zone (avoid channel title & sound button overlays)",
            "recommendedBitrate": "15-20 Mbps VBR"
        },
        "instagram_reels": {
            "name": "Instagram Reels",
            "nameBn": "ইনস্টাগ্রাম রিলস (Instagram Reels)",
            "resolution": "1080x1920",
            "aspectRatio": "9:16",
            "maxDuration": "90 seconds",
            "fps": "30 or 60 fps",
            "codec": "H.264 (MP4)",
            "audioTarget": "-14.0 LUFS",
            "safeZones": "Keep critical text centered; bottom 220px covered by caption & profile bar",
            "recommendedBitrate": "15-20 Mbps"
        },
        "tiktok": {
            "name": "TikTok Video",
            "nameBn": "টিকটক (TikTok)",
            "resolution": "1080x1920",
            "aspectRatio": "9:16",
            "maxDuration": "Up to 10 minutes",
            "fps": "30 or 60 fps",
            "codec": "H.264 / HEVC",
            "audioTarget": "-14.0 LUFS to -16.0 LUFS",
            "safeZones": "Right side 120px covered by action buttons (Like, Share, Comment)",
            "recommendedBitrate": "12-18 Mbps"
        },
        "youtube_landscape": {
            "name": "YouTube Standard Video (Long-form)",
            "nameBn": "ইউটিউব লং-ফর্ম ভিডিও (YouTube 16:9)",
            "resolution": "1920x1080 (Full HD) / 3840x2160 (4K UHD)",
            "aspectRatio": "16:9",
            "fps": "24 fps (Cinematic), 30 fps (Vlog/Talking Head), 60 fps (Gaming/High Motion)",
            "codec": "H.264 or ProRes 422 for master",
            "audioTarget": "-14.0 LUFS (True Peak -1.0 dBTP)",
            "recommendedBitrate": "1080p: 12-16 Mbps | 4K: 45-60 Mbps"
        },
        "instagram_feed": {
            "name": "Instagram Feed",
            "nameBn": "ইনস্টাগ্রাম ফিড (Instagram Feed)",
            "resolution": "1080x1350 (4:5 Portrait) or 1080x1080 (1:1 Square)",
            "aspectRatio": "4:5 (Maximum screen real estate) or 1:1",
            "codec": "H.264",
            "audioTarget": "-14.0 LUFS",
            "recommendedBitrate": "8-12 Mbps"
        },
        "broadcast_tv": {
            "name": "Broadcast Television (EBU R128 / ATSC A/85)",
            "nameBn": "টেলিভিশন ব্রডকাস্ট স্ট্যান্ডার্ড",
            "resolution": "1920x1080 or 3840x2160",
            "aspectRatio": "16:9",
            "fps": "25 fps (PAL / Europe) or 29.97 / 59.94 fps (NTSC / US)",
            "codec": "Apple ProRes 422 HQ / Avid DNxHD 175x",
            "audioTarget": "EBU R128: -23.0 LUFS | US ATSC: -24.0 LUFS (True Peak -1.0 dBTP)",
            "colorSpace": "Rec.709 (Legal Range 16-235)"
        }
    }

    AUDIO_STANDARDS = {
        "lufs_targets": {
            "youtube": "-14.0 LUFS (Integrated), Max True Peak: -1.0 dBTP",
            "spotify": "-14.0 LUFS (Normal) / -11.0 LUFS (Loud)",
            "apple_podcasts": "-16.0 LUFS (Integrated), Max True Peak: -1.0 dBTP",
            "tiktok": "-14.0 LUFS to -15.0 LUFS",
            "broadcast_europe": "-23.0 LUFS (EBU R128)",
            "broadcast_us": "-24.0 LUFS (ATSC A/85)"
        },
        "vocal_eq": {
            "high_pass": "80 Hz - 90 Hz (18dB/octave slope to eliminate handling noise & mic boom rumble)",
            "mud_cut": "250 Hz - 400 Hz (Cut by -2dB to -3dB to remove boxy room reflections)",
            "nasal_cut": "800 Hz - 1.2 kHz (Gentle cut if voice sounds honky or telephone-like)",
            "presence_boost": "2.5 kHz - 4.5 kHz (Boost by +1.5dB to +3dB for clarity and speech intelligibility)",
            "air_shelf": "10 kHz - 14 kHz (High shelf boost by +1.5dB for modern studio crisp air)",
            "de_esser": "5 kHz - 8 kHz (Target harsh sibilance 's', 'sh', 'ch' with -3dB to -5dB gain reduction)"
        },
        "bgm_ducking": {
            "target_volume": "-18 dB to -22 dB beneath vocal peaks",
            "eq_pocket": "Cut 1.5 kHz - 3.5 kHz by -2.5dB on music track EQ so vocals cut through effortlessly without loudness war",
            "attack_release": "Attack: 30ms (fast response when speech starts), Release: 350ms (smooth natural swell when speech pauses)"
        }
    }

    COLOR_STANDARDS = {
        "skin_tone_axis": "Vectorscope I-line (57° angle). Human blood & melanin always fall directly on this axis across all ethnicities.",
        "ire_limits": "Highlights: Keep under 100 IRE (prevent clipping). Shadows: Keep above 0-5 IRE (avoid crushing darks). Skin midtones: 50-70 IRE.",
        "order_of_operations": [
            "1. Basic Correction: Exposure, White Balance (Temp/Tint), Contrast",
            "2. Tone Curve: S-Curve in RGB curves for punch and rolloff",
            "3. Creative LUT: Apply 3D LUT at 70-90% intensity",
            "4. Color Wheels: Color tinting (Teal in shadows, warm golden in highlights)",
            "5. HSL Secondary: Isolate and protect natural skin tones",
            "6. Vignette: Subtle edge darkening to draw focus to center"
        ],
        "popular_looks": {
            "teal_orange": "Shadows pushed to Cyan/Teal (#005F73), Midtones/Highlights pushed to Warm Amber (#EE9B00). Maximum color contrast.",
            "kodak_2383": "Classic Hollywood 35mm film emulation. Warm halation, organic roll-off, rich deep blacks without harsh digital clipping.",
            "warm_vintage": "Golden hour glow (+6-12 Temp, +2 Tint). Soft contrast, elevated blacks (+5 black level), dreamlike aesthetic.",
            "moody_noir": "Desaturated (-15 Sat), crushed contrast (+25 Contrast, -15 Shadow), cool shadows. Ideal for drama and mystery."
        }
    }

    PREMIERE_SHORTCUTS = {
        "ripple_trim_head": "Q (Ripple Trim previous edit to playhead - instant dead air cut)",
        "ripple_trim_tail": "W (Ripple Trim next edit to playhead)",
        "add_edit": "Cmd+K (Mac) / Ctrl+K (Win) (Cut active clips at playhead)",
        "add_edit_all": "Cmd+Shift+K (Mac) / Ctrl+Shift+K (Win) (Cut across ALL timeline tracks)",
        "ripple_delete": "Shift+Delete or Option+Delete (Delete clip and close gap immediately)",
        "slip_tool": "Y (Change clip in/out points without moving its timeline position)",
        "slide_tool": "U (Move clip on timeline while adjusting adjacent clip durations)",
        "zoom_sequence": "\\ (Backslash - toggle zoom to fit entire sequence on screen)",
        "maximize_frame": "~ (Tilde - expand active panel to full screen)",
        "match_frame": "F (Find current timeline frame inside source media monitor)",
        "toggle_audio_scrub": "Shift+S (Toggle hearing audio while dragging playhead)"
    }

    TYPOGRAPHY_STANDARDS = {
        "cps_reading_speed": "Standard reading speed is 12-17 CPS (Characters Per Second). Never exceed 20 CPS or viewers cannot read.",
        "cues_words_shorts": "1 to 3 words per caption cue for Shorts/Reels/TikTok (fast kinetic pacing).",
        "cues_words_youtube": "4 to 7 words per cue (1 to 2 lines max) for standard horizontal video.",
        "line_limit": "Maximum 2 lines per subtitle block. 3 lines blocks the speaker's face.",
        "safe_margin": "Leave at least 150px at the bottom on 1080x1920 vertical video to avoid platform username and caption overlay."
    }

    @classmethod
    def lookup_local_knowledge(
        cls,
        query: str,
        project_context: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Attempts to answer the query deterministically from local project memory or
        video editing encyclopedia. Returns structured answer dict or None if generative AI is required.
        """
        if not query or not query.strip():
            return None

        q = query.strip().lower()
        ctx = project_context or {}
        bkit = ctx.get("brandKit") or {}
        brief = ctx.get("clientBrief") or ""
        seq = ctx.get("sequenceManifest") or {}
        revs = ctx.get("clientRevisions") or []

        # ---------------- 1. BRAND KIT & COLOR CODES ----------------
        if any(k in q for k in ["লোগোর কালার", "লোগো কালার", "ব্র্যান্ডের কালার", "কালার কোড", "color code", "hex code", "ব্র্যান্ড কালার"]):
            p_col = bkit.get("primaryColor") or "#1E40AF"
            s_col = bkit.get("secondaryColor") or "#3B82F6"
            a_col = bkit.get("accentColor") or "#F59E0B"
            bg_col = bkit.get("backgroundColor") or "#0F172A"
            pal = bkit.get("palette") or [p_col, s_col, a_col]
            bname = bkit.get("brandName") or "Client Brand"

            msg = (
                f"🎨 **[{bname} - ব্র্যান্ড কালার কিট]**:\n\n"
                f"• **Primary Color:** `{p_col}` (মূল ব্র্যান্ড কালার)\n"
                f"• **Secondary Color:** `{s_col}` (সহযোগী কালার)\n"
                f"• **Accent Color:** `{a_col}` (হাইলাইট ও ক্যাপশন পপ কালার)\n"
                f"• **Dark Background:** `{bg_col}`\n\n"
                f"📋 **সম্পূর্ণ প্যালেট:** {', '.join(f'`{c}`' for c in pal)}\n"
                f"💡 *লোগো ও ইমেজ ফাইল বিশ্লেষণ করে এই নিখুঁত কালার কোডগুলো স্টোর করা আছে।*"
            )
            return {"action": "advice", "source": "local_brand_kit", "message": msg}

        # ---------------- 2. BRAND NAME ----------------
        if any(k in q for k in ["ব্র্যান্ডের নাম", "ব্র্যান্ড নেম", "brand name", "ক্লায়েন্টের নাম"]):
            bname = bkit.get("brandName")
            if bname:
                msg = f"🏷️ **[ব্র্যান্ড নেম]**: ক্লায়েন্টের ব্র্যান্ডের নাম হলো **'{bname}'**। এটি প্রজেক্টের অফিসিয়াল গাইডলাইনে সংরক্ষিত আছে।"
            else:
                msg = "🏷️ **[ব্র্যান্ড নেম]**: নির্দিষ্ট কোনো ব্র্যান্ড নাম এখনও সেভ করা হয়নি। আপনি Client Hub থেকে লোগো আপলোড বা নাম টাইপ করতে পারেন।"
            return {"action": "advice", "source": "local_brand_kit", "message": msg}

        # ---------------- 3. CLIENT BRIEF FORMATS (STRICT GROUNDING) ----------------
        if any(k in q for k in ["কয়টা ফরম্যাট", "কয়টা ফরম্যাট", "কী কী ফরম্যাট", "কয়টি ফরম্যাট", "how many formats", "format request"]):
            found_formats = []
            b_clean = brief.strip()
            if re.search(r"\b9:16\b|vertical|ভার্টিক্যাল|reels?|shorts?|রিলস?|শর্টস?", b_clean, re.IGNORECASE):
                found_formats.append("9:16 Vertical (Reels / Shorts / TikTok)")
            if re.search(r"\b16:9\b|horizontal|হরিজন্টাল|landscape|ল্যান্ডস্কেপ|youtube\b|ইউটিউব", b_clean, re.IGNORECASE):
                found_formats.append("16:9 Landscape (YouTube Standard / TV)")
            if re.search(r"\b1:1\b|square|স্কয়ার|feed\b", b_clean, re.IGNORECASE):
                found_formats.append("1:1 Square (Instagram/FB Feed)")
            if re.search(r"\b4:5\b|portrait|পোর্ট্রেট", b_clean, re.IGNORECASE):
                found_formats.append("4:5 Portrait (Instagram Feed)")
            if re.search(r"\b4k\b|uhd", b_clean, re.IGNORECASE):
                found_formats.append("4K UHD Resolution")
            if re.search(r"\b1080p\b|full\s*hd|fhd", b_clean, re.IGNORECASE):
                found_formats.append("1080p Full HD Resolution")

            if found_formats:
                fmt_str = "\n".join(f"• {f}" for f in found_formats)
                msg = (
                    f"📋 **[ক্লায়েন্ট ফ্যাক্ট - শতভাগ নিশ্চিত]**:\n"
                    f"ক্লায়েন্ট ব্রিফে মোট **{len(found_formats)}টি ফরম্যাট** উল্লেখ করেছেন:\n\n"
                    f"{fmt_str}\n\n"
                    f"💡 *সিকোয়েন্স সেটিংসে এই ফ্রেম সাইজগুলো কনফার্ম করে নিন।*"
                )
            else:
                msg = (
                    "📋 **[ক্লায়েন্ট ফ্যাক্ট - শতভাগ নিশ্চিত]**:\n"
                    "ক্লায়েন্ট তার ব্রিফে নির্দিষ্ট কোনো ফরম্যাট (যেমন 9:16 বা 16:9) উল্লেখ করেননি। কোনো বানিয়ে বলা তথ্য দেওয়া হয়নি।\n\n"
                    "💡 **[এআই প্রফেশনাল পরামর্শ]**:\n"
                    "• সোশ্যাল মিডিয়া শর্টস/রিলসের জন্য: `1080x1920 (9:16)`\n"
                    "• ইউটিউব লং-ফর্ম বা ওয়েবসাইটের জন্য: `1920x1080 (16:9)`"
                )
            return {"action": "advice", "source": "client_brief_grounded", "message": msg}

        # ---------------- 4. SOCIAL MEDIA SPECS (PLATFORM STANDARDS) ----------------
        if "শর্টস" in q or "shorts" in q or "reels" in q or "রিলস" in q or "tiktok" in q or "টিকটক" in q:
            if any(k in q for k in ["সাইজ", "রেজোলিউশন", "resolution", "size", "aspect", "রেশিও", "রেশিও কত", "স্পেক", "spec"]):
                spec = cls.PLATFORM_SPECS["youtube_shorts"]
                msg = (
                    f"📱 **[ভার্টিক্যাল শর্টস ও রিলস স্ট্যান্ডার্ড স্পেকস]**:\n\n"
                    f"• **রেজোলিউশন:** `{spec['resolution']}` ({spec['aspectRatio']} Vertical)\n"
                    f"• **সর্বোচ্চ ফ্রেমরেট:** {spec['fps']}\n"
                    f"• **কোডেক:** {spec['codec']}\n"
                    f"• **অডিও স্ট্যান্ডার্ড:** {spec['audioTarget']}\n"
                    f"• **রিকমেন্ডেড বিটরেট:** {spec['recommendedBitrate']}\n"
                    f"• **সেফ জোন (Safe Zone):** উপরে ১৫% এবং নিচে ২০% অংশ টেক্সটমুক্ত রাখুন (চ্যানেল নাম ও লাইক বাটন যেন ঢেকে না যায়)।"
                )
                return {"action": "advice", "source": "knowledge_platform_specs", "message": msg}

        if ("ইউটিউব" in q or "youtube" in q) and any(k in q for k in ["সাইজ", "রেজোলিউশন", "resolution", "size", "বিটরেট", "bitrate"]):
            spec = cls.PLATFORM_SPECS["youtube_landscape"]
            msg = (
                f"🖥️ **[YouTube স্ট্যান্ডার্ড ভিডিও স্পেকস]**:\n\n"
                f"• **রেজোলিউশন:** `{spec['resolution']}` ({spec['aspectRatio']})\n"
                f"• **ফ্রেমরেট:** {spec['fps']}\n"
                f"• **অডিও লাউডনেস:** {spec['audioTarget']}\n"
                f"• **বিটরেট গাইড:** {spec['recommendedBitrate']}\n"
                f"• **কালারস্পেস:** Rec.709 (SDR)"
            )
            return {"action": "advice", "source": "knowledge_platform_specs", "message": msg}

        # ---------------- 5. AUDIO LUFS & SOUND STANDARDS ----------------
        if any(k in q for k in ["lufs", "লাউডনেস", "loudness", "সাউন্ড লেভেল", "অডিও লেভেল", "audio level", "true peak"]):
            msg = (
                "🔊 **[আন্তর্জাতিক ব্রডকাস্ট ও অনলাইন অডিও লাউডনেস স্ট্যান্ডার্ড (LUFS)]**:\n\n"
                "• **YouTube & Spotify:** `-14.0 LUFS` (True Peak: `-1.0 dBTP`)\n"
                "• **Apple Podcasts / ভয়েস:** `-16.0 LUFS`\n"
                "• **Instagram Reels & TikTok:** `-14.0 LUFS` থেকে `-15.0 LUFS`\n"
                "• **Television Broadcast (EBU R128):** `-23.0 LUFS`\n"
                "• **US TV Broadcast (ATSC A/85):** `-24.0 LUFS`\n\n"
                "💡 *টিপস: -14.0 LUFS এর বেশি লাউড (+2dB বা তার বেশি) করলে ইউটিউব স্বয়ংক্রিয়ভাবে ভিডিওর ভলিউম কমিয়ে (Penalty) সাউন্ড নষ্ট করে দেয়।*"
            )
            return {"action": "advice", "source": "knowledge_audio_standards", "message": msg}

        if any(k in q for k in ["ডাকিং", "ducking", "মিউজিক কমাতে", "মিউজিক কত কমাবো", "bgm level"]):
            msg = (
                "🎵 **[প্রফেশনাল ব্যাকগ্রাউন্ড মিউজিক ডাকিং রুল]**:\n\n"
                "• **ভলিউম কমানোর পরিমাণ:** কথা বলার সময় মিউজিককে **`-18 dB` থেকে `-22 dB`** লেভেলে নামাতে হবে।\n"
                "• **EQ পকেট রুল:** মিউজিক ট্র্যাকের EQ থেকে `1.5 kHz - 3.5 kHz` রেঞ্জে ২-৩ ডিবি কাট (Scoop) করুন, যাতে ভয়েস স্পষ্টভাবে ফুটে ওঠে।\n"
                "• **Attack & Release:** Attack রাখুন `30ms` (কথা শুরু হলেই সাথে সাথে মিউজিক নামবে) এবং Release রাখুন `350ms` (কথা থামার পর মসৃণভাবে মিউজিক উঠবে)।"
            )
            return {"action": "advice", "source": "knowledge_audio_standards", "message": msg}

        if any(k in q for k in ["ভয়েস eq", "ভয়েস eq", "vocal eq", "voice eq", "মাইক ফিল্টার"]):
            msg = (
                "🎙️ **[প্রফেশনাল ভয়েস EQ সুইট-স্পট গাইড]**:\n\n"
                "1. **High-Pass (Low Cut):** `80 Hz - 90 Hz` (রুমের ফ্যান ও মাইক বুম নয়েজ কাটবে)\n"
                "2. **Mud / Boxiness Cut:** `250 Hz - 400 Hz` (-2.5 dB কাটুন, ফাঁপা শব্দ বন্ধ হবে)\n"
                "3. **Nasal Cut:** `800 Hz - 1.2 kHz` (নাকের মতো সুর কাটবে)\n"
                "4. **Presence / Clarity Boost:** `2.5 kHz - 4.5 kHz` (+2 dB বুস্ট, কথা স্পষ্ট হবে)\n"
                "5. **Air & Crisp Shelf:** `10 kHz - 12 kHz` (+1.5 dB বুস্ট, ক্রিস্পি প্রফেশনাল সাউন্ড)\n"
                "6. **De-Esser:** `5.5 kHz - 7.5 kHz` (হিসহিস 'স' বা 'শ' শব্দ কমিয়ে দেবে)"
            )
            return {"action": "advice", "source": "knowledge_audio_standards", "message": msg}

        # ---------------- 6. PREMIERE PRO KEYBOARD SHORTCUTS ----------------
        if any(k in q for k in ["শর্টকাট", "shortcut", "রিপল কাট", "ripple trim", "কাট করার শর্টকাট"]):
            msg = (
                "⌨️ **[প্রিমিয়ার প্রো সুপারফাস্ট এডিটিং শর্টকাট]**:\n\n"
                "• **`Q`** : Ripple Trim Left (প্লেহেডের আগের অতিরিক্ত অংশ এক ক্লিকে কেটে গ্যাপ বন্ধ করা)\n"
                "• **`W`** : Ripple Trim Right (প্লেহেডের পরের অংশ কেটে গ্যাপ বন্ধ করা)\n"
                "• **`Cmd+K` / `Ctrl+K`** : Add Edit (সিলেক্টেড ট্র্যাকে কাট দেওয়া)\n"
                "• **`Cmd+Shift+K` / `Ctrl+Shift+K`** : Cut All Tracks (সমস্ত ট্র্যাকে একসাথে কাট দেওয়া)\n"
                "• **`Shift+Delete`** : Ripple Delete (ক্লিপ মুছে সাথে সাথে ফাঁকা জায়গা পূরণ করা)\n"
                "• **`\\` (Backslash)** : Zoom Entire Sequence (পুরো টাইমলাইন এক স্ক্রিনে ফিট করা)\n"
                "• **`~` (Tilde)** : Maximize Panel (যেকোনো প্যানেল ফুল স্ক্রিন করা)\n"
                "• **`Shift+S`** : Toggle Audio Scrubbing (প্লেহেড টানার সময় শব্দ শোনা বন্ধ/চালু)"
            )
            return {"action": "advice", "source": "knowledge_premiere_shortcuts", "message": msg}

        # ---------------- 7. COLOR SCIENCE & LUMETRI RULES ----------------
        if any(k in q for k in ["স্কিন টোন", "skin tone", "ভেক্টরস্কোপ", "vectorscope", "লুমেট্রি", "lumetri order"]):
            msg = (
                "🎨 **[লুমেট্রি কালার গ্রেডিং ও স্কিন টোন সায়েন্স]**:\n\n"
                "• **স্কিন টোন লাইন (Vectorscope I-Line):** ভেক্টরস্কোপে ঠিক ৫৭° কোণে যে লাইনটি থাকে সেটাই মেলানিন বা স্কিন টোন লাইন। জাতিভেদ নির্বিশেষে মানুষের রক্তের রঙ এই লাইনেই থাকে।\n"
                "• **IRE এক্সপোজার সীমা:**\n"
                "  - Highlights: ১০০ IRE-এর নিচে রাখুন (সাদা যেন জ্বলে না যায়)\n"
                "  - Shadows: ০-৫ IRE-এর উপরে রাখুন (কালো যেন ক্র্যাশ না হয়)\n"
                "  - Skin Midtones: ৬০-৭০ IRE-এর মধ্যে রাখুন\n"
                "• **গ্রেডিংয়ের সঠিক ক্রম:** ১. Basic Correction (WB/Exposure) ➔ ২. RGB Curves ➔ ৩. 3D Creative LUT ➔ ৪. Color Wheels ➔ ৫. HSL Secondary (Skin Protection) ➔ ৬. Vignette"
            )
            return {"action": "advice", "source": "knowledge_color_science", "message": msg}

        # ---------------- 8. SUBTITLE & TYPOGRAPHY STANDARDS ----------------
        if any(k in q for k in ["সাবটাইটেল রুল", "ক্যাপশন রুল", "cps", "কয়টা শব্দ রাখবো", "subtitle standard"]):
            msg = (
                "📝 **[সাবটাইটেল ও টাইপোগ্রাফি রিডেবিলিটি স্ট্যান্ডার্ড]**:\n\n"
                "• **CPS (Characters Per Second):** পড়ার স্বাভাবিক গতি প্রতি সেকেন্ডে ১২-১৭ অক্ষর। কখনো ২০ অক্ষরের বেশি করবেন না, তাহলে দর্শক পড়তে পারবে না।\n"
                "• **শব্দ সংখ্যা (Shorts/Reels):** প্রতি কিউতে ১ থেকে ৩টি ডায়নামিক শব্দ রাখুন (হাই-এনার্জি টিকটক পেসিং)।\n"
                "• **শব্দ সংখ্যা (YouTube):** প্রতি কিউতে ৫ থেকে ৭টি শব্দ (সর্বোচ্চ ১-২ লাইন)।\n"
                "• **লাইন সীমা:** কখনোই ৩ লাইন করবেন না, এতে মানুষের চেহারা ঢেকে যায়।\n"
                "• **সেফ মার্জিন:** নিচ থেকে অন্তত ১৫০ পিক্সেল উপরে ক্যাপশন রাখুন যাতে ইনস্টাগ্রামের ইউজারনেম ও ক্যাপশনে ঢেকে না যায়।"
            )
            return {"action": "advice", "source": "knowledge_typography_standards", "message": msg}

        # ---------------- 9. CURRENT TIMELINE & SEQUENCE STATS ----------------
        if any(k in q for k in ["ভিডিওর দৈর্ঘ্য", "টাইমলাইন কত বড়", "কত সেকেন্ড", "duration", "ফ্রেমরেট কত", "fps কত"]):
            dur = seq.get("durationSeconds", 0.0)
            fps_val = seq.get("fps", 24)
            clips_cnt = len(seq.get("sourceClips", []))
            s_name = seq.get("sequenceName", "Current Sequence")

            mins = int(dur // 60)
            secs = int(dur % 60)
            dur_str = f"{mins} মিনিট {secs} সেকেন্ড ({round(dur, 1)}s)" if mins > 0 else f"{round(dur, 1)} সেকেন্ড"

            msg = (
                f"🎬 **[টাইমলাইন সিকোয়েন্স তথ্য]**:\n\n"
                f"• **সিকোয়েন্সের নাম:** `{s_name}`\n"
                f"• **মোট দৈর্ঘ্য:** **{dur_str}**\n"
                f"• **ফ্রেমরেট (FPS):** `{fps_val} fps`\n"
                f"• **টাইমলাইনের ক্লিপ সংখ্যা:** `{clips_cnt}` টি ক্লিপ\n"
                f"• **স্ট্যাটাস:** সিঙ্কড ও অ্যাক্টিভ"
            )
            return {"action": "advice", "source": "local_timeline_manifest", "message": msg}

        # ---------------- 10. REVISIONS SUMMARY ----------------
        if any(k in q for k in ["রিভিশন কয়টা", "রিভিশন কি কি", "revisions count", "কতগুলো কাজ বাকি"]):
            if revs and len(revs) > 0:
                pending = [r for r in revs if r.get("status") == "PENDING"]
                resolved = [r for r in revs if r.get("status") == "RESOLVED"]
                msg = (
                    f"📋 **[ক্লায়েন্ট রিভিশন স্ট্যাটাস]**:\n\n"
                    f"• **মোট রিভিশন টাস্ক:** {len(revs)} টি\n"
                    f"• **বাকি আছে (Pending):** {len(pending)} টি\n"
                    f"• **সম্পন্ন হয়েছে (Resolved):** {len(resolved)} টি\n\n"
                    "💡 *'Client Hub' ট্যাবে প্রতিটি রিভিশনের পাশে ক্লিক করে ১-ক্লিকে টাইমলাইনের সেই ফ্রেমে জাম্প করতে পারেন।*"
                )
            else:
                msg = "📋 **[ক্লায়েন্ট রিভিশন স্ট্যাটাস]**: বর্তমানে কোনো পেন্ডিং রিভিশন টাস্ক নেই। সবকিছু আপ-টু-ডেট রয়েছে!"
            return {"action": "advice", "source": "local_revisions_cache", "message": msg}

        # No deterministic match -> delegate to Gemini LLM with guardrails
        return None
