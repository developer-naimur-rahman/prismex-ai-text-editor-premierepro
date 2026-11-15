"""
Prismex Studio Grade 3D LUT Generator
Generates industry-standard 33x33x33 or 64x64x64 .cube files for Adobe Premiere Pro,
DaVinci Resolve, Final Cut Pro, and After Effects.
"""

import numpy as np
from typing import Callable, Optional, Dict, Any
from pathlib import Path


def create_identity_lut_grid(lut_size: int = 33) -> np.ndarray:
    """
    Creates a 3D grid representing the unedited identity color space.
    Shape: (lut_size, lut_size, lut_size, 3) with float32 values in [0.0, 1.0].
    Standard .cube ordering: Red changes fastest, then Green, then Blue.
    """
    lin = np.linspace(0.0, 1.0, lut_size, dtype=np.float32)
    # meshgrid with indexing 'ij' gives (R, G, B) coordinates
    r, g, b = np.meshgrid(lin, lin, lin, indexing='ij')
    # Transpose to (B, G, R, 3) to match .cube scan order:
    # Outer loop = Blue, middle = Green, inner = Red
    grid = np.stack([r, g, b], axis=-1)
    return grid


def kelvin_to_rgb_multipliers(temp_k_offset: float, tint_offset: float = 0.0) -> np.ndarray:
    """
    Calculates RGB gain multipliers for color temperature (warm/cool) and green/magenta tint.
    temp_k_offset: positive warms (+200 to +3000), negative cools (-200 to -3000).
    tint_offset: positive adds magenta (+10 to +50), negative adds green (-10 to -50).
    """
    # Normalized offset factor [-1.0, 1.0]
    t_factor = np.clip(temp_k_offset / 3000.0, -1.0, 1.0)
    m_factor = np.clip(tint_offset / 100.0, -1.0, 1.0)

    # Red, Green, Blue multipliers
    r_gain = 1.0 + (0.18 * t_factor)
    b_gain = 1.0 - (0.18 * t_factor)
    g_gain = 1.0 - (0.15 * m_factor)
    # Magenta boost increases R and B slightly
    if m_factor > 0:
        r_gain += 0.05 * m_factor
        b_gain += 0.05 * m_factor

    return np.array([r_gain, g_gain, b_gain], dtype=np.float32)


def apply_film_contrast_curve(rgb: np.ndarray, contrast: float = 0.0, pivot: float = 0.45) -> np.ndarray:
    """
    Applies a smooth S-curve around midtone pivot to simulate film characteristic curves.
    contrast in [-50, 50]. 0 = no change.
    """
    if abs(contrast) < 0.1:
        return rgb

    c_norm = contrast / 100.0  # [-0.5, 0.5]
    gamma = 1.0 + (c_norm * 1.5)

    # Sigmoidal S-Curve
    # x < pivot: (x / pivot)^gamma * pivot
    # x >= pivot: 1 - ((1 - x) / (1 - pivot))^gamma * (1 - pivot)
    eps = 1e-6
    low_mask = rgb < pivot
    high_mask = ~low_mask

    res = np.copy(rgb)
    res[low_mask] = np.power(np.maximum(rgb[low_mask] / (pivot + eps), 0.0), gamma) * pivot
    res[high_mask] = 1.0 - np.power(np.maximum((1.0 - rgb[high_mask]) / (1.0 - pivot + eps), 0.0), gamma) * (1.0 - pivot)

    return np.clip(res, 0.0, 1.0)


def apply_highlights_shadows(rgb: np.ndarray, highlights: float = 0.0, shadows: float = 0.0) -> np.ndarray:
    """
    Highlights and shadows adjustments using soft shoulder and toe shaping.
    highlights in [-100, 100]: negative recovers highlights, positive pushes them.
    shadows in [-100, 100]: positive lifts shadows, negative deepens them.
    """
    if abs(highlights) < 0.1 and abs(shadows) < 0.1:
        return rgb

    luma = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    luma = np.expand_dims(luma, axis=-1)

    # Shadow mask: weights heavily towards blacks (0.0 - 0.4)
    shadow_mask = np.clip(1.0 - (luma / 0.5), 0.0, 1.0) ** 2
    # Highlight mask: weights heavily towards specular whites (0.5 - 1.0)
    highlight_mask = np.clip((luma - 0.5) / 0.5, 0.0, 1.0) ** 2

    delta_shadow = (shadows / 100.0) * 0.25 * shadow_mask
    delta_highlight = (highlights / 100.0) * 0.25 * highlight_mask

    res = rgb + delta_shadow + delta_highlight
    return np.clip(res, 0.0, 1.0)


def apply_saturation_vibrance(rgb: np.ndarray, saturation: float = 0.0, vibrance: float = 0.0) -> np.ndarray:
    """
    Adjusts saturation and smart vibrance (protects skin tones and already saturated colors).
    saturation in [-100, 100]
    vibrance in [-100, 100]
    """
    if abs(saturation) < 0.1 and abs(vibrance) < 0.1:
        return rgb

    luma = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    luma_3d = np.expand_dims(luma, axis=-1)

    # Calculate current pixel saturation: max(RGB) - min(RGB)
    c_max = np.max(rgb, axis=-1, keepdims=True)
    c_min = np.min(rgb, axis=-1, keepdims=True)
    current_sat = c_max - c_min

    # Vibrance boosts muted colors more than saturated ones
    vib_boost = (vibrance / 100.0) * (1.0 - current_sat)
    total_scale = 1.0 + (saturation / 100.0) + vib_boost

    res = luma_3d + (rgb - luma_3d) * total_scale
    return np.clip(res, 0.0, 1.0)


def apply_split_toning(
    rgb: np.ndarray,
    shadow_tint: tuple = (0.0, 0.04, 0.06),      # Teal bias in shadows
    highlight_tint: tuple = (0.05, 0.03, 0.0),    # Warm golden in highlights
    balance: float = 0.0
) -> np.ndarray:
    """
    Cinematic split-toning: applies subtle complementary tones to shadows and highlights.
    """
    luma = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    luma_3d = np.expand_dims(luma, axis=-1)

    pivot = 0.5 + (balance * 0.2)
    shadow_weight = np.clip(1.0 - (luma_3d / max(pivot, 0.01)), 0.0, 1.0)
    highlight_weight = np.clip((luma_3d - pivot) / max(1.0 - pivot, 0.01), 0.0, 1.0)

    s_tint = np.array(shadow_tint, dtype=np.float32)
    h_tint = np.array(highlight_tint, dtype=np.float32)

    res = rgb + (s_tint * shadow_weight) + (h_tint * highlight_weight)
    return np.clip(res, 0.0, 1.0)


def transform_grid(grid: np.ndarray, params: Dict[str, Any]) -> np.ndarray:
    """
    Applies the full color grade pipeline to a 3D color grid.
    """
    res = np.copy(grid)

    # 1. Exposure (EV Stops)
    ev = params.get("exposure_ev", 0.0)
    if abs(ev) > 0.01:
        res = res * (2.0 ** ev)
        res = np.clip(res, 0.0, 1.0)

    # 2. White Balance & Tint
    temp = params.get("temperature_k_offset", 0.0)
    tint = params.get("tint_offset", 0.0)
    if abs(temp) > 1.0 or abs(tint) > 1.0:
        wb_gain = kelvin_to_rgb_multipliers(temp, tint)
        res = res * wb_gain
        res = np.clip(res, 0.0, 1.0)

    # 3. Highlights & Shadows
    hi = params.get("highlights", 0.0)
    sh = params.get("shadows", 0.0)
    if abs(hi) > 0.1 or abs(sh) > 0.1:
        res = apply_highlights_shadows(res, highlights=hi, shadows=sh)

    # 4. S-Curve Contrast
    contrast = params.get("contrast", 0.0)
    if abs(contrast) > 0.1:
        res = apply_film_contrast_curve(res, contrast=contrast)

    # 5. Split Toning
    if params.get("use_split_toning", False):
        s_tint = params.get("shadow_tint", (0.0, 0.03, 0.05))
        h_tint = params.get("highlight_tint", (0.04, 0.02, 0.0))
        res = apply_split_toning(res, shadow_tint=s_tint, highlight_tint=h_tint)

    # 6. Saturation & Vibrance
    sat = params.get("saturation", 0.0)
    vib = params.get("vibrance", 0.0)
    if abs(sat) > 0.1 or abs(vib) > 0.1:
        res = apply_saturation_vibrance(res, saturation=sat, vibrance=vib)

    # 7. Master Intensity Blend
    intensity = float(params.get("intensity", 1.0))
    if intensity != 1.0:
        res = grid + (res - grid) * intensity
        res = np.clip(res, 0.0, 1.0)

    return res


def export_cube_file(grid_transformed: np.ndarray, output_path: Path, title: str = "Prismex_CinemaGrade") -> Path:
    """
    Serializes a transformed 3D RGB grid into standard Adobe .cube format.
    """
    lut_size = grid_transformed.shape[0]
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    lines = [
        f"# Prismex Studio Editor - Studio Grade AI Colorist",
        f"# Generated: True 3D Cube Color Matrix",
        f'TITLE "{title}"',
        f"LUT_3D_SIZE {lut_size}",
        ""
    ]

    # In standard Adobe .cube:
    # Outer loop = Blue (z), Middle loop = Green (y), Inner loop = Red (x)
    # The grid was created as grid[r, g, b, 3].
    # So iterating b from 0..size-1, g from 0..size-1, r from 0..size-1:
    for b_idx in range(lut_size):
        for g_idx in range(lut_size):
            for r_idx in range(lut_size):
                rgb = grid_transformed[r_idx, g_idx, b_idx]
                r_val = f"{max(0.0, min(1.0, float(rgb[0]))):.6f}"
                g_val = f"{max(0.0, min(1.0, float(rgb[1]))):.6f}"
                b_val = f"{max(0.0, min(1.0, float(rgb[2]))):.6f}"
                lines.append(f"{r_val} {g_val} {b_val}")

    content = "\n".join(lines) + "\n"
    output_path.write_text(content, encoding="utf-8")
    return output_path
