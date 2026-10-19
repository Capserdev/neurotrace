"""
NeuroTrace — FastAPI Backend (Hugging Face Spaces)
"""

import os
import io
import tempfile
import numpy as np
import joblib

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from PIL import Image

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
import tensorflow as tf

from feature_extraction import MIN_SECONDS, extract_features_from_sound, load_sound, split_chunks
from inference import (
    DRAWING_THRESHOLDS, VOICE_THRESHOLD, ensemble_score, pd_from_output, tta_views,
)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="NeuroTrace API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Model loading (graceful) ──────────────────────────────────────────────────
MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")

def _load_joblib(filename):
    path = os.path.join(MODELS_DIR, filename)
    if not os.path.exists(path):
        print(f"  [SKIP] {filename} not found.")
        return None
    print(f"  [OK]   {filename}")
    return joblib.load(path)

def _load_keras(filename):
    path = os.path.join(MODELS_DIR, filename)
    if not os.path.exists(path):
        print(f"  [SKIP] {filename} not found.")
        return None
    print(f"  [OK]   {filename}")
    return tf.keras.models.load_model(path)

print("Loading models...")
# Voice SVMs were retrained (training/train_voice.py) on feature_extraction.py,
# the same code this server runs, so inputs match what the models learned.
VOICE_MODELS = {
    "ahh":  _load_joblib("PD_vs_HC_AHH.joblib"),
    "text": _load_joblib("PD_vs_HC_text.joblib"),
}
# Spiral is the paper's 2-seed ensemble: P(PD) is averaged across both models.
DRAWING_MODELS = {
    "spiral":  [m for m in (_load_keras("SpiralModel_1_finetune_best.keras"),
                            _load_keras("SpiralModel_2_finetune_best.keras")) if m is not None],
    "wave":    [m for m in (_load_keras("WaveModel_finetune_best.keras"),) if m is not None],
    "meander": [m for m in (_load_keras("MeanderModel_finetune_best.keras"),) if m is not None],
}
MODELS_TOTAL = 6
models_loaded = (sum(m is not None for m in VOICE_MODELS.values())
                 + sum(len(v) for v in DRAWING_MODELS.values()))
print(f"Ready. {models_loaded}/{MODELS_TOTAL} models loaded.")

# Old clients sent "spiral1"; keep accepting it.
DRAWING_ALIASES = {"spiral1": "spiral"}


# ── Helpers ───────────────────────────────────────────────────────────────────
def preprocess_image(file_bytes: bytes) -> np.ndarray:
    """Decode an upload to a raw [0,255] (224,224,3) float32 array.

    The models already contain Rescaling(1/255) + ImageNet Normalization as
    their first layers, so feed RAW [0,255] pixels here. Dividing by 255 double-
    normalizes and makes the CNNs output noise (~50/50). Transparent PNGs are
    flattened onto white first so the background is paper, not black.
    """
    img = Image.open(io.BytesIO(file_bytes))
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
        img = Image.alpha_composite(bg, img)
    img = img.convert("RGB").resize((224, 224), Image.LANCZOS)
    return np.array(img, dtype=np.float32)


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
@app.get("/status")
def health():
    return {
        "status": "ok",
        "models_loaded": models_loaded,
        "models_total": MODELS_TOTAL,
        "models": {
            "voice_ahh":  VOICE_MODELS["ahh"] is not None,
            "voice_text": VOICE_MODELS["text"] is not None,
            "spiral":     len(DRAWING_MODELS["spiral"]),
            "wave":       len(DRAWING_MODELS["wave"]),
            "meander":    len(DRAWING_MODELS["meander"]),
        },
    }


@app.post("/predict/voice")
async def predict_voice(
    file: UploadFile = File(...),
    recording_type: str = Form("ahh"),
):
    if recording_type not in VOICE_MODELS:
        raise HTTPException(status_code=400, detail=f"Unknown recording_type: {recording_type}")
    model = VOICE_MODELS[recording_type]
    if model is None:
        raise HTTPException(status_code=503, detail=f"Voice model '{recording_type}' not loaded.")

    audio_bytes = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    try:
        snd = load_sound(tmp_path)
        duration = snd.get_total_duration()
        if duration < MIN_SECONDS:
            raise HTTPException(status_code=400, detail="Recording is shorter than 1 second. Please record again.")
        # Read text was trained on 10 s chunks; average P(PD) across chunks.
        chunks = split_chunks(snd) if recording_type == "text" else [snd]
        feats = np.array([extract_features_from_sound(c) for c in chunks])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not read audio: {e}")
    finally:
        os.unlink(tmp_path)

    p = float(model.predict_proba(feats)[:, 1].mean())
    return {
        "recording_type": recording_type,
        "pd_probability": p,
        "threshold": VOICE_THRESHOLD,
        "prediction": "PD" if p >= VOICE_THRESHOLD else "HC",
        "duration_s": round(duration, 2),
        "chunks": len(chunks),
    }


@app.post("/predict/drawing")
async def predict_drawing(
    file: UploadFile = File(...),
    drawing_type: str = Form("spiral"),
):
    drawing_type = DRAWING_ALIASES.get(drawing_type, drawing_type)
    if drawing_type not in DRAWING_MODELS:
        raise HTTPException(status_code=400, detail=f"Unknown drawing_type: {drawing_type}")
    models = DRAWING_MODELS[drawing_type]
    if not models:
        raise HTTPException(status_code=503, detail=f"Model '{drawing_type}' not loaded.")

    img_bytes = await file.read()
    try:
        img = preprocess_image(img_bytes)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Image processing failed: {e}")

    # Paper method: average P(PD) over TTA views (and both spiral models),
    # then apply the validation-tuned threshold instead of argmax at 0.5.
    views = tta_views(img)
    probs = [pd_from_output(row) for m in models for row in m.predict(views, verbose=0)]
    p = float(np.mean(probs))
    thr = DRAWING_THRESHOLDS[drawing_type]
    return {
        "drawing_type": drawing_type,
        "pd_probability": p,
        "threshold": thr,
        "prediction": "PD" if p >= thr else "HC",
        "views": len(views),
        "models": len(models),
    }


@app.post("/predict/ensemble")
async def predict_ensemble(payload: dict):
    try:
        return ensemble_score(
            drawings=payload.get("drawings"),
            voice=payload.get("voice"),
            survey=payload.get("survey"),
        )
    except (ValueError, TypeError) as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Serve the React frontend (built into ./web) with SPA fallback ─────────────
# API routes above (/health, /status, /predict/*) are matched first; this GET
# catch-all serves built assets and returns index.html for client-side routes
# (/screening, /method, /code).
WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
_assets_dir = os.path.join(WEB_DIR, "assets")
if os.path.isdir(_assets_dir):
    app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")


@app.get("/{full_path:path}")
def spa(full_path: str):
    web_root = os.path.realpath(WEB_DIR)
    candidate = os.path.realpath(os.path.join(web_root, full_path))
    # Only serve files inside web/ (blocks ../ traversal to app code or models).
    if full_path and candidate.startswith(web_root + os.sep) and os.path.isfile(candidate):
        return FileResponse(candidate)
    index_html = os.path.join(WEB_DIR, "index.html")
    if os.path.isfile(index_html):
        return FileResponse(index_html)
    return {"detail": "frontend not built yet"}
