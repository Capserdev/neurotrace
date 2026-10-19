"""
Pure inference helpers (no TensorFlow import) so they can be unit-tested.

Handwriting follows the paper: test-time augmentation averaged over a few
views, then a per-task threshold tuned on validation data. The combined score
is a weighted average of per-modality PD probabilities.
"""

import numpy as np
from PIL import Image

IMG_SIZE = 224

# Paper thresholds (validation-tuned). Meander had no tuned value -> 0.50.
DRAWING_THRESHOLDS = {"spiral": 0.20, "wave": 0.46, "meander": 0.50}
VOICE_THRESHOLD = 0.50

WEIGHTS = {"handwriting": 0.40, "voice": 0.35, "survey": 0.25}
BAND_LOW = 0.35
BAND_HIGH = 0.60


def _from_array(arr: np.ndarray) -> Image.Image:
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def tta_views(img: np.ndarray) -> np.ndarray:
    """Return 4 views of a raw [0,255] (224,224,3) drawing as float32.

    identity, rotate +10 deg, rotate -10 deg, 10% center zoom. No flips: the
    paper excludes them because a mirrored spiral is not clinically equivalent.
    Rotations fill exposed corners with white (paper background).
    """
    base = _from_array(img)
    white = (255, 255, 255)
    rot_p = base.rotate(10, resample=Image.BILINEAR, fillcolor=white)
    rot_n = base.rotate(-10, resample=Image.BILINEAR, fillcolor=white)
    m = int(IMG_SIZE * 0.05)
    zoom = base.crop((m, m, IMG_SIZE - m, IMG_SIZE - m)).resize((IMG_SIZE, IMG_SIZE), Image.BILINEAR)
    views = [img.astype(np.float32)] + [np.asarray(v, dtype=np.float32) for v in (rot_p, rot_n, zoom)]
    return np.stack(views)


def pd_from_output(raw: np.ndarray) -> float:
    """Model output row -> P(PD). Handles sigmoid (1) or softmax (2) heads."""
    raw = np.asarray(raw).ravel()
    return float(raw[1]) if raw.size >= 2 else float(raw[0])


def band_for(score: float) -> str:
    if score < BAND_LOW:
        return "low"
    if score <= BAND_HIGH:
        return "moderate"
    return "elevated"


def ensemble_score(drawings=None, voice=None, survey=None) -> dict:
    """Combine per-test PD probabilities into one score in [0,1].

    drawings: {"spiral"|"wave"|"meander": p}, voice: {"ahh"|"text": p},
    survey: fraction of yes answers. Each modality is the mean of its completed
    tests; weights are renormalized over the modalities present.
    """
    parts = {}
    if drawings:
        parts["handwriting"] = float(np.mean([float(p) for p in drawings.values()]))
    if voice:
        parts["voice"] = float(np.mean([float(p) for p in voice.values()]))
    if survey is not None:
        parts["survey"] = float(min(1.0, max(0.0, float(survey))))
    if not parts:
        raise ValueError("No test results provided.")

    total = sum(WEIGHTS[k] for k in parts)
    score = sum(WEIGHTS[k] * v for k, v in parts.items()) / total
    return {
        "pd_score": score,
        "band": band_for(score),
        "parts": parts,
        "weights_used": {k: WEIGHTS[k] for k in parts},
    }
