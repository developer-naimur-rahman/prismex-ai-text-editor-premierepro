"""
Prismex Film Emulation Engine
Accurately models authentic Hollywood print stocks, Arri Alexa film curves,
and prestigious streaming grades with true color science.
"""

from typing import Dict, Any


STUDIO_PRESETS: Dict[str, Dict[str, Any]] = {
    "kodak_2383": {
        "title": "Kodak 2383 Print Film",
        "description": "Authentic Hollywood motion picture film print with warm highlight rolloff, rich cyan-teal shadows, and radiant amber skin tones.",
        "exposure_ev": 0.05,
        "temperature_k_offset": 350.0,
        "tint_offset": -8.0,
        "contrast": 22.0,
        "highlights": -14.0,
        "shadows": 8.0,
        "saturation": 8.0,
        "vibrance": 12.0,
        "use_split_toning": True,
        "shadow_tint": (-0.015, 0.025, 0.045),     # Cyan-Teal bias
        "highlight_tint": (0.045, 0.025, -0.01),   # Golden warm highlight
        "skin_protection_strength": 0.95
    },
    "arri_alexa": {
        "title": "Arri Alexa Commercial",
        "description": "The gold-standard high-end commercial look. Ultra-wide latitude, velvety smooth black floor, and lifelike organic skin tones.",
        "exposure_ev": 0.0,
        "temperature_k_offset": 100.0,
        "tint_offset": 0.0,
        "contrast": 12.0,
        "highlights": -18.0,
        "shadows": 10.0,
        "saturation": 5.0,
        "vibrance": 15.0,
        "use_split_toning": True,
        "shadow_tint": (0.005, 0.01, 0.02),
        "highlight_tint": (0.02, 0.015, 0.005),
        "skin_protection_strength": 1.0
    },
    "netflix_prestige": {
        "title": "Netflix Prestige Drama",
        "description": "Sophisticated high-budget streaming aesthetic with muted organic tones, cool architectural shadows, and crisp character focus.",
        "exposure_ev": -0.05,
        "temperature_k_offset": -180.0,
        "tint_offset": 5.0,
        "contrast": 18.0,
        "highlights": -15.0,
        "shadows": -5.0,
        "saturation": -10.0,
        "vibrance": 8.0,
        "use_split_toning": True,
        "shadow_tint": (-0.01, 0.015, 0.05),
        "highlight_tint": (0.035, 0.02, -0.005),
        "skin_protection_strength": 0.90
    },
    "nordic_noir": {
        "title": "Nordic Noir & Thriller",
        "description": "David Fincher inspired dark mystery aesthetic. Subdued greens, cold crisp shadows, high dramatic contrast, and isolated warm faces.",
        "exposure_ev": -0.15,
        "temperature_k_offset": -450.0,
        "tint_offset": -12.0,                      # Greenish-cold tint
        "contrast": 28.0,
        "highlights": -22.0,
        "shadows": -12.0,
        "saturation": -20.0,
        "vibrance": -5.0,
        "use_split_toning": True,
        "shadow_tint": (-0.02, 0.03, 0.04),
        "highlight_tint": (0.025, 0.025, -0.01),
        "skin_protection_strength": 0.95
    },
    "teal_orange": {
        "title": "Modern Teal & Orange",
        "description": "The quintessential blockbuster look. High-energy complementary contrast separating the subject from modern cinematic blue shadows.",
        "exposure_ev": 0.0,
        "temperature_k_offset": 200.0,
        "tint_offset": -5.0,
        "contrast": 25.0,
        "highlights": -10.0,
        "shadows": -8.0,
        "saturation": 15.0,
        "vibrance": 18.0,
        "use_split_toning": True,
        "shadow_tint": (-0.03, 0.04, 0.08),       # Deep Teal
        "highlight_tint": (0.06, 0.035, -0.02),   # Punchy Warm Orange
        "skin_protection_strength": 0.98
    },
    "golden_hour": {
        "title": "Golden Hour Sunset",
        "description": "Dreamy warm afternoon glow with lifted soft shadows, rich golden highlights, and romantic sun-kissed skin.",
        "exposure_ev": 0.1,
        "temperature_k_offset": 750.0,
        "tint_offset": 8.0,
        "contrast": 10.0,
        "highlights": -8.0,
        "shadows": 15.0,
        "saturation": 12.0,
        "vibrance": 20.0,
        "use_split_toning": True,
        "shadow_tint": (0.03, 0.015, -0.01),
        "highlight_tint": (0.07, 0.045, -0.02),
        "skin_protection_strength": 0.95
    },
    "clean_documentary": {
        "title": "Clean Documentary Pro",
        "description": "100% true-to-life broadcast grading. Optimal neutral white balance, crisp micro-detail, natural vegetation greens, and perfect skin.",
        "exposure_ev": 0.0,
        "temperature_k_offset": 0.0,
        "tint_offset": 0.0,
        "contrast": 8.0,
        "highlights": -12.0,
        "shadows": 6.0,
        "saturation": 4.0,
        "vibrance": 10.0,
        "use_split_toning": False,
        "skin_protection_strength": 1.0
    }
}


def get_preset_params(preset_id: str, intensity: float = 1.0) -> Dict[str, Any]:
    """
    Returns preset parameters tuned by intensity.
    """
    base = STUDIO_PRESETS.get(preset_id, STUDIO_PRESETS["kodak_2383"])
    params = dict(base)
    params["intensity"] = intensity
    return params
