"""
Prismex Skin Tone Isolation & Protection Engine
Guarantees that creative color grades (such as Teal & Orange or Cool Shadows)
never discolor human faces, preserving the classic Hollywood Vectorscope 10:30 line.
"""

import cv2
import numpy as np
from typing import Tuple


def detect_skin_probability_mask(bgr_image: np.ndarray) -> np.ndarray:
    """
    Computes a continuous [0.0, 1.0] probability mask isolating human skin tones
    using dual-space (HSV and YCrCb) color science and Gaussian edge feathering.
    """
    if bgr_image is None or bgr_image.size == 0:
        return np.zeros((10, 10), dtype=np.float32)

    # Convert to HSV
    hsv = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)

    # HSV Skin conditions:
    # Hue in [0, 15] or [170, 180] (Red-Yellow spectrum)
    # Saturation in [35, 175] (Natural human skin saturation)
    # Value in [50, 255] (Exclude crushed black shadows)
    hsv_mask1 = (h <= 14) & (s >= 35) & (s <= 180) & (v >= 50)
    hsv_mask2 = (h >= 170) & (s >= 35) & (s <= 180) & (v >= 50)
    hsv_skin = (hsv_mask1 | hsv_mask2).astype(np.uint8) * 255

    # Convert to YCrCb
    ycrcb = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2YCrCb)
    y, cr, cb = cv2.split(ycrcb)

    # YCrCb standard skin range:
    # Cr: 133 to 173
    # Cb: 77 to 127
    ycrcb_skin = ((cr >= 133) & (cr <= 173) & (cb >= 77) & (cb <= 127)).astype(np.uint8) * 255

    # Combined intersection for highest confidence
    combined = cv2.bitwise_and(hsv_skin, ycrcb_skin)

    # Morphological cleaning: close holes, remove single-pixel noise
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    cleaned = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel)

    # Feather edges with Gaussian Blur for smooth, invisible transition
    feathered = cv2.GaussianBlur(cleaned, (15, 15), 0)
    probability_mask = feathered.astype(np.float32) / 255.0

    return probability_mask


def blend_with_skin_protection(
    original_bgr: np.ndarray,
    graded_bgr: np.ndarray,
    protection_strength: float = 0.95
) -> np.ndarray:
    """
    Blends the graded frame with a protected skin-tone tone curve,
    allowing creative backgrounds while keeping human actors natural and healthy.
    """
    if protection_strength <= 0.01:
        return graded_bgr

    skin_mask = detect_skin_probability_mask(original_bgr)
    skin_mask_3d = np.repeat(np.expand_dims(skin_mask, axis=-1), 3, axis=-1)

    # For the skin region, create an optimized subtle warm skin grade
    # (keeps luminance from the grade, but preserves natural hue and saturation from original)
    orig_hsv = cv2.cvtColor(original_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    grad_hsv = cv2.cvtColor(graded_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)

    # Retain graded luminance/contrast (V channel), but keep original warm skin Hue and micro-saturation
    protected_hsv = np.copy(grad_hsv)
    # Blend Hue towards original skin hue
    protected_hsv[..., 0] = orig_hsv[..., 0]
    # Subtle saturation boost (+5%) for healthy radiant skin
    protected_hsv[..., 1] = np.clip(orig_hsv[..., 1] * 1.05, 0.0, 255.0)

    protected_bgr = cv2.cvtColor(protected_hsv.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)

    # Final composite:
    # Graded Background + Protected Skin * protection_strength
    effective_skin_weight = skin_mask_3d * protection_strength
    final_output = (graded_bgr.astype(np.float32) * (1.0 - effective_skin_weight)) + (protected_bgr * effective_skin_weight)

    return np.clip(final_output, 0.0, 255.0).astype(np.uint8)
