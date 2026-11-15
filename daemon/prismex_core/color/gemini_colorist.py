"""
Prismex AI Multimodal Colorist Brain
Integrates Google Gemini 1.5/2.0 Flash Vision (100% Free API) with local
computer vision algorithms for instant Hollywood-grade color decisions.
"""

import json
import base64
import cv2
import httpx
import numpy as np
from typing import Dict, Any, Optional
from pathlib import Path


SYSTEM_COLORIST_PROMPT = """You are a Hollywood Senior Colorist and Director of Photography (CSI certified) working inside Premiere Pro.
Your task is to analyze the user's video frame and output precise mathematical color grading parameters to achieve a studio-grade cinematic look.

Rules:
1. NEVER crush blacks (preserve shadow detail above 5 IRE).
2. Protect highlight rolloff (no harsh digital clipping above 95 IRE).
3. Ensure human skin tones fall accurately along the Vectorscope Skin Tone Line (~10:30 o'clock position).
4. Balance color temperature (neutral white balance unless artistic warmth/coolness is explicitly requested).

You MUST respond strictly with valid JSON conforming to this schema (no extra text):
{
  "exposure_ev": float (e.g. 0.15, -0.2),
  "temperature_k_offset": float (e.g. 250.0 for warm, -300.0 for cool),
  "tint_offset": float (e.g. -5.0 for green bias, +5.0 for magenta bias),
  "contrast": float (-50 to 50, e.g. 15.0),
  "highlights": float (-100 to 100, e.g. -15.0),
  "shadows": float (-100 to 100, e.g. 8.0),
  "saturation": float (-50 to 50, e.g. 6.0),
  "vibrance": float (-50 to 50, e.g. 12.0),
  "use_split_toning": boolean,
  "shadow_tint": [float, float, float] (normalized RGB offsets, e.g. [-0.01, 0.02, 0.04] for cyan-teal),
  "highlight_tint": [float, float, float] (normalized RGB offsets, e.g. [0.03, 0.02, -0.01] for warm gold),
  "colorist_critique": "Brief 1-sentence technical analysis of lighting and dynamic range in the shot",
  "creative_rationale": "Why these specific color adjustments make the shot look cinematic"
}
"""


def local_auto_balance_analysis(bgr_image: np.ndarray) -> Dict[str, Any]:
    """
    100% offline, lightning-fast (0.05s) computer vision auto-balance analysis.
    Uses Gray-World White Balance, Histogram Luma percentiles, and dynamic range evaluation.
    """
    if bgr_image is None or bgr_image.size == 0:
        return {
            "exposure_ev": 0.0,
            "temperature_k_offset": 0.0,
            "tint_offset": 0.0,
            "contrast": 10.0,
            "highlights": -10.0,
            "shadows": 5.0,
            "saturation": 5.0,
            "vibrance": 10.0,
            "use_split_toning": True,
            "shadow_tint": (-0.01, 0.01, 0.03),
            "highlight_tint": (0.03, 0.015, -0.005),
            "colorist_critique": "Standard balanced dynamic range",
            "creative_rationale": "Clean cinematic auto-balance with protected skin tones and rich midtone contrast."
        }

    # Convert to float
    img_f = bgr_image.astype(np.float32)

    # 1. Gray World White Balance Estimation
    mean_b = np.mean(img_f[..., 0])
    mean_g = np.mean(img_f[..., 1])
    mean_r = np.mean(img_f[..., 2])
    gray_mean = (mean_b + mean_g + mean_r) / 3.0

    # Calculate tint and temp offsets
    # If red is higher than blue, image is already warm -> offset needed is negative or neutral
    temp_k_offset = float(np.clip((mean_b - mean_r) * 35.0, -1200.0, 1200.0))
    tint_offset = float(np.clip((gray_mean - mean_g) * 2.0, -25.0, 25.0))

    # 2. Exposure & Dynamic Range Evaluation
    gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
    p5 = np.percentile(gray, 5)
    p50 = np.percentile(gray, 50)
    p95 = np.percentile(gray, 95)

    # Ideal target: median luma ~115-125 (in 0-255 scale)
    target_luma = 120.0
    ratio = target_luma / max(p50, 10.0)
    exposure_ev = float(np.clip(np.log2(max(0.2, ratio)), -1.0, 1.0) * 0.6)

    # Highlights recovery: if p95 > 240, highlights need lowering
    highlights = float(np.clip(-1.5 * max(0.0, p95 - 225.0), -40.0, 0.0))

    # Shadows lift: if p5 < 15, lift crushed blacks
    shadows = float(np.clip(1.2 * max(0.0, 20.0 - p5), 0.0, 35.0))

    # Contrast adjustment
    contrast = 14.0 if (p95 - p5) < 160 else 8.0

    return {
        "exposure_ev": round(exposure_ev, 2),
        "temperature_k_offset": round(temp_k_offset, 1),
        "tint_offset": round(tint_offset, 1),
        "contrast": round(contrast, 1),
        "highlights": round(highlights, 1),
        "shadows": round(shadows, 1),
        "saturation": 6.0,
        "vibrance": 12.0,
        "use_split_toning": True,
        "shadow_tint": (-0.015, 0.015, 0.035),
        "highlight_tint": (0.035, 0.02, -0.01),
        "colorist_critique": f"Midtone luma evaluated at {p50:.1f} IRE equivalent. Dynamic range: {p5:.1f} to {p95:.1f}.",
        "creative_rationale": "Studio auto-balance: neutral white balance recovery, lifted shadow floor, and organic highlight rolloff."
    }


async def analyze_frame_with_gemini(
    bgr_image: np.ndarray,
    api_key: Optional[str] = None,
    user_prompt: Optional[str] = None,
    style_request: Optional[str] = None
) -> Dict[str, Any]:
    """
    Sends frame to Google Gemini 1.5/2.0 Flash Vision for Senior Colorist Analysis.
    Falls back gracefully to the local color science engine if offline or no key.
    """
    if not api_key:
        local_res = local_auto_balance_analysis(bgr_image)
        if user_prompt:
            local_res["creative_rationale"] += f" (Prompt: {user_prompt})"
        return local_res

    try:
        # Resize image to 720p for fast transmission and low token consumption
        h, w = bgr_image.shape[:2]
        target_w = min(1280, w)
        target_h = int(h * (target_w / w))
        resized = cv2.resize(bgr_image, (target_w, target_h), interpolation=cv2.INTER_AREA)

        # Encode to JPEG
        _, buffer = cv2.imencode(".jpg", resized, [cv2.IMWRITE_JPEG_QUALITY, 85])
        jpg_base64 = base64.b64encode(buffer).decode("utf-8")

        prompt_text = "Perform professional senior colorist grade analysis on this frame."
        if style_request:
            prompt_text += f"\nTarget Style / Mood: {style_request}"
        if user_prompt:
            prompt_text += f"\nEditor's Direct Creative Note: {user_prompt}"

        # Gemini 1.5 Flash endpoint
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        payload = {
            "system_instruction": {
                "parts": [{"text": SYSTEM_COLORIST_PROMPT}]
            },
            "contents": [
                {
                    "parts": [
                        {"text": prompt_text},
                        {
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": jpg_base64
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.2
            }
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                parsed = json.loads(raw_text)
                return parsed
            else:
                print(f"[GeminiColorist] API error {resp.status_code}: {resp.text}, falling back to local engine.")
                return local_auto_balance_analysis(bgr_image)

    except Exception as e:
        print(f"[GeminiColorist] Exception: {e}, using local color engine fallback.")
        return local_auto_balance_analysis(bgr_image)
