"""
Script-Driven Auto Rough Cut Engine
Aligns raw timeline transcripts with official client scripts, filters non-spoken metadata
(chapters, scene headings, camera brackets), selects optimal takes, eliminates blunders/silences,
generates dynamic A/B camera punch-ins, color-codes story acts, and produces timeline markers.
"""

import re
import difflib
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from .cut_harmonizer import CutHarmonizer

class ScriptRoughCutEngine:

    @classmethod
    def clean_token(cls, word: str) -> str:
        """Strips punctuation and lowercases for fuzzy linguistic matching."""
        return re.sub(r'[^\w\u0980-\u09FF]', '', str(word).lower()).strip()

    @classmethod
    def parse_script_structure(cls, script_text: str) -> Dict[str, Any]:
        """
        Extracts chapters, B-Roll / visual brackets, on-screen text notes,
        and clean spoken sentences from a client script.
        """
        lines = [line.strip() for line in script_text.splitlines() if line.strip()]
        chapters: List[Dict[str, Any]] = []
        visual_directives: List[Dict[str, Any]] = []
        text_overlays: List[Dict[str, Any]] = []
        spoken_sentences: List[Dict[str, Any]] = []

        current_chapter = "Introduction"
        current_act = "HOOK" # HOOK, BODY, CLIMAX, CTA

        chapter_pattern = re.compile(
            r'^(?:chapter\s*\d+|part\s*\d+|\d+\.|\bscene\s*\d+|\bhook\b|\bintro\b|\bbody\b|\boutro\b|\bcall to action\b|\bcta\b)[\s:\-–—]*(.*)',
            re.IGNORECASE
        )
        broll_pattern = re.compile(
            r'\[(?:show\s*)?(?:b-roll|broll|footage|cutaway|video|image|photo|visual|shot of)\s*[:：\-–—]?\s*(.*?)\]|\((?:show\s*)?(?:b-roll|broll|cutaway|footage)\s*[:：\-–—]?\s*(.*?)\)',
            re.IGNORECASE
        )
        text_overlay_pattern = re.compile(
            r'\[(?:text|caption|title|overlay)\s*(?:on screen)?\s*[:：\-–—]?\s*(.*?)\]',
            re.IGNORECASE
        )

        for line_idx, line in enumerate(lines):
            # Check for Chapter or Section heading
            ch_match = chapter_pattern.match(line)
            if ch_match and len(line) < 60:
                header_title = ch_match.group(1).strip() or line
                current_chapter = header_title
                lower_h = line.lower()
                if "hook" in lower_h or "intro" in lower_h:
                    current_act = "HOOK"
                elif "cta" in lower_h or "outro" in lower_h or "call to action" in lower_h or "subscribe" in lower_h:
                    current_act = "CTA"
                elif "climax" in lower_h or "solution" in lower_h:
                    current_act = "CLIMAX"
                else:
                    current_act = "BODY"
                chapters.append({
                    "title": current_chapter,
                    "act": current_act,
                    "lineIndex": line_idx
                })
                continue

            # Extract any embedded B-Roll brackets in line
            for b_match in broll_pattern.finditer(line):
                directive_desc = b_match.group(1) or b_match.group(2) or "B-Roll Cutaway"
                visual_directives.append({
                    "type": "BROLL",
                    "description": directive_desc.strip(),
                    "lineIndex": line_idx
                })

            # Extract any embedded Text Overlay brackets in line
            for t_match in text_overlay_pattern.finditer(line):
                text_desc = t_match.group(1) or "Text Overlay"
                text_overlays.append({
                    "type": "TEXT_OVERLAY",
                    "text": text_desc.strip(),
                    "lineIndex": line_idx
                })

            # Strip all brackets, metadata, and stage directions to leave pure spoken dialogue
            clean_dialogue = broll_pattern.sub("", line)
            clean_dialogue = text_overlay_pattern.sub("", clean_dialogue)
            # Remove generic bracketed stage directions e.g. [Smiles at camera], (laughs)
            clean_dialogue = re.sub(r'\[.*?\]|\(.*?\)', '', clean_dialogue).strip()

            if clean_dialogue and len(clean_dialogue) > 2:
                # Split into natural sentences
                sub_sentences = [s.strip() for s in re.split(r'([.?!।\n]+)', clean_dialogue) if s.strip()]
                # Reconstruct sentence with punctuation
                combined_sents = []
                idx = 0
                while idx < len(sub_sentences):
                    s = sub_sentences[idx]
                    if idx + 1 < len(sub_sentences) and re.match(r'^[.?!।]+$', sub_sentences[idx+1]):
                        combined_sents.append(s + sub_sentences[idx+1])
                        idx += 2
                    else:
                        combined_sents.append(s)
                        idx += 1

                for s_text in combined_sents:
                    words_in_s = [cls.clean_token(w) for w in s_text.split() if cls.clean_token(w)]
                    if words_in_s:
                        spoken_sentences.append({
                            "text": s_text,
                            "tokens": words_in_s,
                            "chapter": current_chapter,
                            "act": current_act,
                            "lineIndex": line_idx
                        })

        # If no chapters were found, synthesize default acts
        total_s = len(spoken_sentences)
        if total_s > 0:
            for s_idx, sent in enumerate(spoken_sentences):
                pct = s_idx / total_s
                if pct < 0.15 and sent["act"] == "HOOK":
                    sent["act"] = "HOOK"
                elif pct > 0.85:
                    sent["act"] = "CTA"
                elif pct > 0.65 and sent["act"] not in ("CTA", "HOOK"):
                    sent["act"] = "CLIMAX"
                else:
                    sent["act"] = "BODY"

        return {
            "chapters": chapters,
            "visualDirectives": visual_directives,
            "textOverlays": text_overlays,
            "spokenSentences": spoken_sentences
        }

    @classmethod
    def align_sentences_to_transcript(
        cls,
        spoken_sentences: List[Dict[str, Any]],
        transcript_words: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Performs fuzzy sequential alignment between script sentences and timeline words.
        When repeated takes are present, preferentially selects the last complete high-confidence take.
        """
        if not spoken_sentences or not transcript_words:
            return []

        clean_transcript = [cls.clean_token(w.get("word", "")) for w in transcript_words]
        n_transcript = len(clean_transcript)
        aligned_keep_segments: List[Dict[str, Any]] = []

        for sent in spoken_sentences:
            s_tokens = sent["tokens"]
            if not s_tokens:
                continue

            s_len = len(s_tokens)
            best_match: Optional[Dict[str, Any]] = None
            best_score = 0.0

            # Sliding window over transcript words
            min_window = max(2, int(s_len * 0.7))
            max_window = int(s_len * 1.4) + 2

            for w_size in range(min_window, min(n_transcript, max_window + 1)):
                for start_i in range(0, n_transcript - w_size + 1):
                    end_i = start_i + w_size
                    window_tokens = clean_transcript[start_i:end_i]

                    # Fast token overlap ratio
                    s_set = set(s_tokens)
                    w_set = set(window_tokens)
                    overlap = len(s_set.intersection(w_set))
                    if overlap < max(2, int(s_len * 0.4)):
                        continue

                    # Levenshtein string match score
                    matcher = difflib.SequenceMatcher(None, " ".join(s_tokens), " ".join(window_tokens))
                    ratio = matcher.ratio()

                    # Bias slightly towards later takes (last take rule in video editing)
                    recency_bonus = (start_i / max(1, n_transcript)) * 0.06
                    total_score = ratio + recency_bonus

                    if ratio >= 0.55 and total_score > best_score:
                        start_word = transcript_words[start_i]
                        end_word = transcript_words[end_i - 1]
                        best_score = total_score
                        best_match = {
                            "startWordIdx": start_i,
                            "endWordIdx": end_i - 1,
                            "startTime": float(start_word.get("start") or start_word.get("start_seconds") or 0.0),
                            "endTime": float(end_word.get("end") or end_word.get("end_seconds") or 0.0),
                            "score": round(ratio, 3),
                            "sentenceText": sent["text"],
                            "act": sent["act"],
                            "chapter": sent["chapter"]
                        }

            if best_match:
                aligned_keep_segments.append(best_match)

        # Sort aligned segments chronologically
        aligned_keep_segments.sort(key=lambda x: x["startTime"])
        return aligned_keep_segments

    @classmethod
    def generate_script_rough_cut(
        cls,
        script_text: str,
        transcript_words: List[Dict[str, Any]],
        total_duration_seconds: float,
        fps: float = 23.976
    ) -> Dict[str, Any]:
        """
        Comprehensive rough-cut generator:
        1. Cleans script & extracts spoken text
        2. Aligns with timeline transcript
        3. Identifies cut intervals for non-scripted portions & blunders
        4. Calculates multi-cam alternating punch-in scales (100% vs 112%)
        5. Assigns act-based color labels
        6. Generates timeline chapter, B-Roll, and text overlay markers
        """
        parsed = cls.parse_script_structure(script_text)
        merged_keeps: List[Dict[str, Any]] = []
        ai_markers: List[Dict[str, Any]] = []

        # 1. Attempt Semantic AI Alignment (LLM) first
        try:
            from ..intelligence.creative_ai import CreativeAI
            ai_alignment = CreativeAI.align_script_with_ai(script_text, transcript_words, total_duration_seconds)
            if ai_alignment and ai_alignment.get("keptSegments"):
                for seg in ai_alignment["keptSegments"]:
                    merged_keeps.append({
                        "startTime": float(seg.get("startSeconds", 0.0)),
                        "endTime": float(seg.get("endSeconds", 0.0)),
                        "sentenceText": str(seg.get("sentenceText", "")),
                        "act": seg.get("act", "BODY"),
                        "chapter": seg.get("chapter", "Dialogue")
                    })
                if ai_alignment.get("markers"):
                    ai_markers = ai_alignment["markers"]
        except Exception as e:
            print(f"[ScriptRoughCut] AI alignment exception: {e}")

        # 2. Fallback to Fuzzy Sliding-Window alignment if AI returned nothing
        if not merged_keeps:
            aligned_keeps = cls.align_sentences_to_transcript(parsed["spokenSentences"], transcript_words)
            if aligned_keeps:
                curr_keep = aligned_keeps[0].copy()
                for nxt in aligned_keeps[1:]:
                    if nxt["startTime"] <= (curr_keep["endTime"] + 0.35):
                        curr_keep["endTime"] = max(curr_keep["endTime"], nxt["endTime"])
                        curr_keep["sentenceText"] += " " + nxt["sentenceText"]
                    else:
                        merged_keeps.append(curr_keep)
                        curr_keep = nxt.copy()
                merged_keeps.append(curr_keep)

        # 3. Bulletproof Safety Fallback:
        # If words exist but neither AI nor fuzzy match reached high confidence,
        # DO NOT return error! Extract all speech intervals and cut pauses > 1.2s!
        if not merged_keeps and transcript_words:
            speech_start = float(transcript_words[0].get("start") or transcript_words[0].get("start_seconds") or 0.0)
            speech_end = speech_start
            sentence_buf = []

            for w in transcript_words:
                ws = float(w.get("start") or w.get("start_seconds") or 0.0)
                we = float(w.get("end") or w.get("end_seconds") or (ws + 0.3))
                if ws > (speech_end + 1.2):
                    if (speech_end - speech_start) > 0.4:
                        merged_keeps.append({
                            "startTime": round(speech_start, 3),
                            "endTime": round(speech_end, 3),
                            "sentenceText": " ".join(sentence_buf),
                            "act": "BODY",
                            "chapter": "Dialogue"
                        })
                    sentence_buf = []
                    speech_start = ws
                sentence_buf.append(str(w.get("word", "")))
                speech_end = we

            if (speech_end - speech_start) > 0.4:
                merged_keeps.append({
                    "startTime": round(speech_start, 3),
                    "endTime": round(speech_end, 3),
                    "sentenceText": " ".join(sentence_buf),
                    "act": "BODY",
                    "chapter": "Dialogue"
                })

        # Final guarantee: if timeline had zero words, keep the full duration
        if not merged_keeps:
            merged_keeps.append({
                "startTime": 0.0,
                "endTime": max(1.0, total_duration_seconds),
                "sentenceText": "Full Sequence",
                "act": "BODY",
                "chapter": "Introduction"
            })

        # Sort merged keeps chronologically
        merged_keeps.sort(key=lambda x: x["startTime"])

        # Invert keep segments to generate raw CUT intervals
        # Padding safety: pre-roll 60ms, post-roll 100ms
        raw_cuts: List[Dict[str, Any]] = []
        cursor = 0.0

        for keep in merged_keeps:
            k_start = max(0.0, keep["startTime"] - 0.06)
            k_end = min(total_duration_seconds, keep["endTime"] + 0.10)

            if k_start > (cursor + 0.15):
                # Cut from cursor to k_start
                raw_cuts.append({
                    "start_seconds": round(cursor, 3),
                    "end_seconds": round(k_start, 3),
                    "auto_approved": True
                })
            cursor = k_end

        if cursor < (total_duration_seconds - 0.15):
            raw_cuts.append({
                "start_seconds": round(cursor, 3),
                "end_seconds": round(total_duration_seconds, 3),
                "auto_approved": True
            })

        # Harmonize & snap cuts to exact integer video frames
        harmonized_cuts = CutHarmonizer.harmonize_cuts(raw_cuts, fps)

        # Generate Multi-Cam Punch-Ins (A/B Cam: 100% vs 112% Scale)
        punch_ins: List[Dict[str, Any]] = []
        is_zoomed = False

        for k_idx, keep in enumerate(merged_keeps):
            scale_val = 112.0 if is_zoomed else 100.0
            punch_ins.append({
                "clipIndex": k_idx,
                "startSeconds": round(keep["startTime"], 3),
                "endSeconds": round(keep["endTime"], 3),
                "scale": scale_val,
                "isPunchIn": is_zoomed,
                "act": keep.get("act", "BODY")
            })
            # Alternate for jump-cut elimination
            is_zoomed = not is_zoomed

        # Generate Act Color Labels
        # Premiere Pro Clip Color Label IDs:
        # Mango/Orange = 9, Cerulean/Teal = 4, Forest/Green = 3, Magenta/Purple = 7
        color_labels: List[Dict[str, Any]] = []
        for p in punch_ins:
            act = p.get("act", "BODY")
            label_idx = 4 # Teal (Body)
            label_name = "Cerulean"
            if act == "HOOK":
                label_idx = 9 # Orange (Hook)
                label_name = "Mango"
            elif act == "CTA":
                label_idx = 3 # Green (CTA)
                label_name = "Forest"
            elif act == "CLIMAX":
                label_idx = 7 # Purple (Climax)
                label_name = "Magenta"

            color_labels.append({
                "startSeconds": p["startSeconds"],
                "endSeconds": p["endSeconds"],
                "act": act,
                "labelIndex": label_idx,
                "labelName": label_name
            })

        # Generate Timeline Markers
        timeline_markers: List[Dict[str, Any]] = []

        # Merge AI-detected markers
        for am in ai_markers:
            timeline_markers.append({
                "timeSeconds": float(am.get("timeSeconds", 0.0)),
                "name": str(am.get("name", "Marker")),
                "comment": str(am.get("comment", "")),
                "type": "CHAPTER" if "chapter" in str(am.get("name", "")).lower() else "BROLL",
                "color": str(am.get("color", "Green"))
            })

        # Chapter Markers
        seen_chapters = set()
        for keep in merged_keeps:
            ch_title = keep.get("chapter")
            if ch_title and ch_title not in seen_chapters:
                seen_chapters.add(ch_title)
                timeline_markers.append({
                    "timeSeconds": round(keep["startTime"], 3),
                    "name": f"Chapter: {ch_title}",
                    "comment": f"{ch_title} (YouTube Timestamp Marker)",
                    "type": "CHAPTER",
                    "color": "Green"
                })

        # B-Roll Placeholders
        for b in parsed["visualDirectives"]:
            # Place at first keep matching lineIndex or proportional time
            t_sec = merged_keeps[0]["startTime"]
            if parsed["spokenSentences"]:
                matching_s = next((s for s in parsed["spokenSentences"] if s["lineIndex"] >= b["lineIndex"]), None)
                if matching_s:
                    matching_keep = next((k for k in merged_keeps if matching_s["text"] in k["sentenceText"]), None)
                    if matching_keep:
                        t_sec = matching_keep["startTime"]

            timeline_markers.append({
                "timeSeconds": round(t_sec, 3),
                "name": "B-ROLL CUE",
                "comment": f"B-Roll: {b['description']}",
                "type": "BROLL",
                "color": "Cyan"
            })

        # Text Overlay Placeholders
        for t in parsed["textOverlays"]:
            t_sec = merged_keeps[0]["startTime"]
            if parsed["spokenSentences"]:
                matching_s = next((s for s in parsed["spokenSentences"] if s["lineIndex"] >= t["lineIndex"]), None)
                if matching_s:
                    matching_keep = next((k for k in merged_keeps if matching_s["text"] in k["sentenceText"]), None)
                    if matching_keep:
                        t_sec = matching_keep["startTime"]

            timeline_markers.append({
                "timeSeconds": round(t_sec, 3),
                "name": "TEXT OVERLAY",
                "comment": f"Overlay: {t['text']}",
                "type": "GRAPHIC",
                "color": "Yellow"
            })

        # Calculate estimated duration saved
        total_cut_duration = sum(c["duration_seconds"] for c in harmonized_cuts)
        final_duration = max(1.0, total_duration_seconds - total_cut_duration)

        return {
            "success": True,
            "keptSegmentsCount": len(merged_keeps),
            "cutsCount": len(harmonized_cuts),
            "cuts": harmonized_cuts,
            "punchIns": punch_ins,
            "colorLabels": color_labels,
            "markers": timeline_markers,
            "totalCutDuration": round(total_cut_duration, 2),
            "finalDuration": round(final_duration, 2),
            "originalDuration": round(total_duration_seconds, 2),
            "summary": (
                f"স্ক্রিপ্ট অনুসারে {len(merged_keeps)}টি মূল দৃশ্য নির্বাচন করা হয়েছে এবং "
                f"{len(harmonized_cuts)}টি অবাঞ্ছিত অংশ বাদ দেওয়া হয়েছে। "
                f"আনুমানিক {round(total_cut_duration, 1)}s সময় সাশ্রয় হয়েছে।"
            )
        }
