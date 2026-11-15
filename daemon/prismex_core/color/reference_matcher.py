"""
Prismex Reference Shot Color Matcher
Transfers the color atmosphere, lighting ratio, and contrast curve of any reference
movie screenshot onto the editor's sequence clip using CIE LAB / Reinhard color science.
"""

import cv2
import numpy as np
from pathlib import Path
from typing import Tuple, Dict, Any
from .skin_protector import blend_with_skin_protection
from .lut_generator import create_identity_lut_grid, export_cube_file


def reinhard_color_transfer(source_bgr: np.ndarray, target_ref_bgr: np.ndarray, blend: float = 1.0) -> np.ndarray:
    """
    Transfers the color distribution of target_ref onto source in CIE LAB color space.
    """
    # Convert to LAB float32
    src_lab = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    ref_lab = cv2.cvtColor(target_ref_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)

    # Compute mean and std for each channel
    src_mean, src_std = cv2.meanStdDev(src_lab)
    ref_mean, ref_std = cv2.meanStdDev(ref_lab)

    src_mean = src_mean.flatten()
    src_std = np.maximum(src_std.flatten(), 1e-4)
    ref_mean = ref_mean.flatten()
    ref_std = np.maximum(ref_std.flatten(), 1e-4)

    # Scale and shift channels
    res_lab = np.zeros_like(src_lab)
    for c in range(3):
        # Subtract source mean, scale by std ratio, add reference mean
        val = (src_lab[..., c] - src_mean[c]) * (ref_std[c] / src_std[c]) + ref_mean[c]
        res_lab[..., c] = val

    # Blend with original in LAB space
    if blend < 1.0:
        res_lab = (src_lab * (1.0 - blend)) + (res_lab * blend)

    # Clip valid LAB range: L in [0, 255], a and b in [0, 255]
    res_lab = np.clip(res_lab, 0.0, 255.0).astype(np.uint8)
    res_bgr = cv2.cvtColor(res_lab, cv2.COLOR_LAB2BGR)

    return res_bgr


def generate_reference_match_lut(
    source_bgr: np.ndarray,
    reference_bgr: np.ndarray,
    output_lut_path: Path,
    intensity: float = 1.0,
    protect_skin: bool = True
) -> Dict[str, Any]:
    """
    Matches source_bgr to reference_bgr, protects skin, and bakes the transformation into a 33x33x33 3D LUT.
    """
    # 1. Transfer grade to frame
    graded_frame = reinhard_color_transfer(source_bgr, reference_bgr, blend=min(1.0, intensity))

    # 2. Skin tone protection
    if protect_skin:
        graded_frame = blend_with_skin_protection(source_bgr, graded_frame, protection_strength=0.92)

    # 3. Create 3D LUT by applying the transfer function to the identity color grid
    lut_size = 33
    grid = create_identity_lut_grid(lut_size=lut_size)
    # Shape of grid is (33, 33, 33, 3) in RGB [0.0, 1.0]

    # Convert identity grid to flat 2D image in BGR [0, 255]
    flat_rgb = grid.reshape(-1, 3)
    flat_bgr = flat_rgb[:, ::-1] * 255.0  # RGB to BGR
    grid_img_bgr = flat_bgr.reshape(lut_size * lut_size, lut_size, 3).astype(np.uint8)

    # Apply Reinhard transfer to the grid image using source and reference statistics
    transformed_grid_img = reinhard_color_transfer(grid_img_bgr, reference_bgr, blend=min(1.0, intensity))
    transformed_flat_bgr = transformed_grid_img.reshape(-1, 3).astype(np.float32) / 255.0
    transformed_flat_rgb = transformed_flat_bgr[:, ::-1]  # BGR back to RGB

    transformed_grid = transformed_flat_rgb.reshape(lut_size, lut_size, lut_size, 3)

    # Export .cube
    export_cube_file(transformed_grid, output_lut_path, title="Prismex_ReferenceMatch")

    return {
        "lut_path": str(output_lut_path),
        "graded_frame_bgr": graded_frame
    }
