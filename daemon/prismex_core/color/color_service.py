"""
Prismex Color Studio Service - Master Pipeline Orchestrator
Coordinates Frame Ingestion, AI Multimodal Analysis, 3D LUT Synthesis,
Skin Tone Protection, and Adobe Premiere Pro Deployment.
"""

import os
import shutil
import base64
import cv2
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional

from .lut_generator import (
    create_identity_lut_grid,
    transform_grid,
    export_cube_file
)
from .film_emulation import STUDIO_PRESETS, get_preset_params
from .skin_protector import blend_with_skin_protection
from .reference_matcher import generate_reference_match_lut
from .gemini_colorist import analyze_frame_with_gemini, local_auto_balance_analysis
from ..config import HOME_DIR


ADOBE_CREATIVE_LUTS_DIR = HOME_DIR / "Library" / "Application Support" / "Adobe" / "Common" / "LUTs" / "Creative"
PRISMEX_LUTS_CACHE_DIR = HOME_DIR / ".prismex" / "luts"


class ColorStudioService:
    @staticmethod
    def ensure_directories():
        ADOBE_CREATIVE_LUTS_DIR.mkdir(parents=True, exist_ok=True)
        PRISMEX_LUTS_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    @classmethod
    async def grade_frame(
        cls,
        frame_base64: Optional[str] = None,
        frame_path: Optional[str] = None,
        reference_base64: Optional[str] = None,
        style_preset: str = "auto_balance",
        user_prompt: Optional[str] = None,
        intensity: float = 1.0,
        lock_skin_tones: bool = True,
        gemini_api_key: Optional[str] = None,
        custom_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Main entry point for studio color grading.
        """
        cls.ensure_directories()

        # 1. Ingest input frame
        bgr_frame: Optional[np.ndarray] = None
        if frame_path and os.path.exists(frame_path):
            bgr_frame = cv2.imread(frame_path)
        elif frame_base64:
            # Strip data url prefix if present
            clean_b64 = frame_base64.split(",")[-1]
            img_bytes = base64.b64decode(clean_b64)
            nparr = np.frombuffer(img_bytes, np.uint8)
            bgr_frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if bgr_frame is None or bgr_frame.size == 0:
            raise ValueError("Invalid frame input: could not read or decode image")

        # Sanitize name
        lut_title = (custom_name or f"Prismex_{style_preset}").replace(" ", "_")
        lut_filename = f"{lut_title}.cube"
        dest_lut_cache = PRISMEX_LUTS_CACHE_DIR / lut_filename
        dest_lut_adobe = ADOBE_CREATIVE_LUTS_DIR / lut_filename

        colorist_notes = ""
        creative_rationale = ""
        params_used = {}
        graded_bgr: Optional[np.ndarray] = None

        # 2. Reference Match Mode
        if style_preset == "reference_match" and reference_base64:
            clean_ref_b64 = reference_base64.split(",")[-1]
            ref_bytes = base64.b64decode(clean_ref_b64)
            ref_arr = np.frombuffer(ref_bytes, np.uint8)
            ref_bgr = cv2.imdecode(ref_arr, cv2.IMREAD_COLOR)

            if ref_bgr is not None:
                match_res = generate_reference_match_lut(
                    source_bgr=bgr_frame,
                    reference_bgr=ref_bgr,
                    output_lut_path=dest_lut_cache,
                    intensity=intensity,
                    protect_skin=lock_skin_tones
                )
                graded_bgr = match_res["graded_frame_bgr"]
                colorist_notes = "Color transfer and luminance curve harmonized with reference movie shot."
                creative_rationale = "Reinhard chromatic adaptation with vectorscope skin tone protection."
            else:
                style_preset = "auto_balance"

        # 3. Hollywood Film Emulation Preset Mode
        if style_preset in STUDIO_PRESETS:
            preset_dict = get_preset_params(style_preset, intensity=intensity)
            params_used = preset_dict
            colorist_notes = preset_dict.get("description", "")
            creative_rationale = f"Authentic {preset_dict.get('title')} studio emulation."

            # Build 3D LUT
            grid = create_identity_lut_grid(lut_size=33)
            transformed = transform_grid(grid, preset_dict)
            export_cube_file(transformed, dest_lut_cache, title=lut_title)

            # Apply to frame for preview
            # Fast direct application
            h, w = bgr_frame.shape[:2]
            scale = min(1.0, 960.0 / max(h, w))
            preview_src = cv2.resize(bgr_frame, (int(w * scale), int(h * scale))) if scale < 1.0 else bgr_frame.copy()
            
            rgb_preview = cv2.cvtColor(preview_src, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
            graded_rgb = transform_grid(rgb_preview, preset_dict)
            graded_bgr_raw = cv2.cvtColor((graded_rgb * 255.0).astype(np.uint8), cv2.COLOR_RGB2BGR)

            if lock_skin_tones:
                graded_bgr = blend_with_skin_protection(preview_src, graded_bgr_raw, protection_strength=preset_dict.get("skin_protection_strength", 0.95))
            else:
                graded_bgr = graded_bgr_raw

        # 4. AI Auto-Balance / Custom Prompt Mode
        elif style_preset in ("auto_balance", "prompt_custom"):
            ai_params = await analyze_frame_with_gemini(
                bgr_image=bgr_frame,
                api_key=gemini_api_key,
                user_prompt=user_prompt,
                style_request=user_prompt if style_preset == "prompt_custom" else "Balanced Hollywood Studio Master"
            )
            ai_params["intensity"] = intensity
            params_used = ai_params
            colorist_notes = ai_params.get("colorist_critique", "Optimal dynamic range balance")
            creative_rationale = ai_params.get("creative_rationale", "Studio master polish")

            # Build 3D LUT
            grid = create_identity_lut_grid(lut_size=33)
            transformed = transform_grid(grid, ai_params)
            export_cube_file(transformed, dest_lut_cache, title=lut_title)

            # Apply to frame for preview
            h, w = bgr_frame.shape[:2]
            scale = min(1.0, 960.0 / max(h, w))
            preview_src = cv2.resize(bgr_frame, (int(w * scale), int(h * scale))) if scale < 1.0 else bgr_frame.copy()

            rgb_preview = cv2.cvtColor(preview_src, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
            graded_rgb = transform_grid(rgb_preview, ai_params)
            graded_bgr_raw = cv2.cvtColor((graded_rgb * 255.0).astype(np.uint8), cv2.COLOR_RGB2BGR)

            if lock_skin_tones:
                graded_bgr = blend_with_skin_protection(preview_src, graded_bgr_raw, protection_strength=0.95)
            else:
                graded_bgr = graded_bgr_raw

        # 5. Automatically copy to Adobe Premiere Pro Creative LUTs directory
        try:
            shutil.copy2(dest_lut_cache, dest_lut_adobe)
        except Exception as e:
            print(f"[ColorStudioService] Adobe LUT copy notice: {e}")

        # 6. Encode graded preview frame to base64
        _, enc_preview = cv2.imencode(".jpg", graded_bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
        preview_b64 = "data:image/jpeg;base64," + base64.b64encode(enc_preview).decode("utf-8")

        return {
            "success": True,
            "lut_name": lut_title,
            "lut_path": str(dest_lut_adobe if dest_lut_adobe.exists() else dest_lut_cache),
            "adobe_creative_lut_path": str(dest_lut_adobe),
            "preview_image_base64": preview_b64,
            "colorist_critique": colorist_notes,
            "creative_rationale": creative_rationale,
            "params_used": params_used
        }
