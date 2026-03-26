"""
NeuroVoice DX — FastAPI Backend
Deploy this to Hugging Face Spaces (Docker SDK).
"""

import os
import io
import json
import tempfile
import numpy as np
import joblib

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

# TensorFlow / Keras
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
import tensorflow as tf

from feature_extraction import extract_voice_features

# ── App setup ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="NeuroVoice DX API",
    description="AI-assisted neurological disorder screening backend",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten to your GitHub Pages URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load models at startup ────────────────────────────────────────────────────
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")

print("Loading voice models...")
voice_ahh    = joblib.load(os.path.join(MODELS_DIR, "PD_vs_HC_AHH.joblib"))
voice_text   = joblib.load(os.path.join(MODELS_DIR, "PD_vs_HC_text.joblib"))
voice_vowels = joblib.load(os.path.join(MODELS_DIR, "PD_vs_HC_vowels.joblib"))
voice_4class = joblib.load(os.path.join(MODELS_DIR, "Vowels_4class_HC_PD_PSP_MSA.joblib"))

print("Loading drawing models...")
model_meander  = tf.keras.models.load_model(os.path.join(MODELS_DIR, "MeanderModel_finetune_best.keras"))
model_spiral1  = tf.keras.models.load_model(os.path.join(MODELS_DIR, "SpiralModel_1_finetune_best.keras"))
model_spiral2  = tf.keras.models.load_model(os.path.join(MODELS_DIR, "SpiralModel_2_finetune_best.keras"))
model_wave     = tf.keras.models.load_model(os.path.join(MODELS_DIR, "WaveModel_finetune_best.keras"))

print("All models loaded.")

# Class label order
CLASSES_4 = ["HC", "PD", "PSP", "MSA"]   # 4-class models
CLASSES_2 = ["HC", "PD"]                  # binary models


# ── Helpers ───────────────────────────────────────────────────────────────────
def binary_to_4class(probs_2: list[float]) -> dict:
    """Convert a binary [HC, PD] probability to a 4-class dict (PSP/MSA = 0)."""
    return {"HC": probs_2[0], "PD": probs_2[1], "PSP": 0.0, "MSA": 0.0}


def svm_predict_proba(model, features: np.ndarray, n_classes: int) -> np.ndarray:
    """
    SVM with SVC: use decision_function and convert to soft probabilities via softmax.
    Returns array of shape (n_classes,).
    """
    if hasattr(model, "predict_proba"):
        return model.predict_proba(features.reshape(1, -1))[0]
    scores = model.decision_function(features.reshape(1, -1))[0]
    if n_classes == 2:
        # binary: sigmoid
        p = 1.0 / (1.0 + np.exp(-scores if np.isscalar(scores) else -scores[0]))
        return np.array([1 - p, p])
    # multiclass: softmax
    e = np.exp(scores - scores.max())
    return e / e.sum()


def preprocess_image(file_bytes: bytes) -> np.ndarray:
    """Resize image to 224×224 RGB and normalize to [0,1]."""
    img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    img = img.resize((224, 224))
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)  # (1, 224, 224, 3)


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": 8}


@app.post("/predict/voice")
async def predict_voice(
    file: UploadFile = File(...),
    recording_type: str = Form("ahh")   # ahh | text | vowels | all
):
    """
    Accept a .wav audio file, extract 36 Praat features, and run voice models.
    recording_type controls which binary models are run.
    """
    audio_bytes = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        features = extract_voice_features(tmp_path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Feature extraction failed: {e}")
    finally:
        os.unlink(tmp_path)

    results = {}

    # 4-class model always runs
    probs_4 = svm_predict_proba(voice_4class, features, 4)
    results["vowels_4class"] = {
        "classes": CLASSES_4,
        "probabilities": probs_4.tolist(),
        "prediction": CLASSES_4[int(probs_4.argmax())]
    }

    # Binary models based on type
    if recording_type in ("ahh", "all"):
        p = svm_predict_proba(voice_ahh, features, 2)
        results["ahh_binary"] = {
            "classes": CLASSES_2,
            "probabilities": p.tolist(),
            "prediction": CLASSES_2[int(p.argmax())]
        }

    if recording_type in ("text", "all"):
        p = svm_predict_proba(voice_text, features, 2)
        results["text_binary"] = {
            "classes": CLASSES_2,
            "probabilities": p.tolist(),
            "prediction": CLASSES_2[int(p.argmax())]
        }

    if recording_type in ("vowels", "all"):
        p = svm_predict_proba(voice_vowels, features, 2)
        results["vowels_binary"] = {
            "classes": CLASSES_2,
            "probabilities": p.tolist(),
            "prediction": CLASSES_2[int(p.argmax())]
        }

    results["features"] = features.tolist()
    return results


@app.post("/predict/drawing")
async def predict_drawing(
    file: UploadFile = File(...),
    drawing_type: str = Form("spiral1")  # meander | spiral1 | spiral2 | wave
):
    """Accept an image file and run the appropriate Keras drawing model."""
    img_bytes = await file.read()
    try:
        img_array = preprocess_image(img_bytes)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Image processing failed: {e}")

    model_map = {
        "meander": model_meander,
        "spiral1": model_spiral1,
        "spiral2": model_spiral2,
        "wave":    model_wave,
    }

    if drawing_type not in model_map:
        raise HTTPException(status_code=400, detail=f"Unknown drawing_type: {drawing_type}")

    model = model_map[drawing_type]
    raw = model.predict(img_array, verbose=0)[0]

    # Normalize output to probabilities
    if len(raw) == 4:
        probs = raw.tolist()
        classes = CLASSES_4
    elif len(raw) == 2:
        probs = raw.tolist()
        classes = CLASSES_2
    else:
        # sigmoid binary output
        p = float(raw[0])
        probs = [1 - p, p]
        classes = CLASSES_2

    return {
        "drawing_type": drawing_type,
        "classes": classes,
        "probabilities": probs,
        "prediction": classes[int(np.argmax(probs))]
    }


@app.post("/predict/ensemble")
async def predict_ensemble(payload: dict):
    """
    Aggregate individual model results into a final ensemble.

    Expected payload:
    {
      "voice": { "vowels_4class": {...}, "ahh_binary": {...}, ... },
      "drawing": { "meander": {...}, "spiral1": {...}, ... }
    }
    """
    voice_results   = payload.get("voice", {})
    drawing_results = payload.get("drawing", {})

    # Accumulate weighted 4-class probability vectors
    weighted_sum = np.zeros(4)
    total_weight = 0.0

    # 4-class voice model — weight 0.35
    if "vowels_4class" in voice_results:
        p = np.array(voice_results["vowels_4class"]["probabilities"])
        if len(p) == 4:
            weighted_sum += 0.35 * p
            total_weight += 0.35

    # Binary voice models — each contributes weight 0.083 (0.25 / 3)
    binary_voice_keys = ["ahh_binary", "text_binary", "vowels_binary"]
    per_binary = 0.25 / 3
    for key in binary_voice_keys:
        if key in voice_results:
            p2 = np.array(voice_results[key]["probabilities"])
            if len(p2) == 2:
                p4 = np.array([p2[0], p2[1], 0.0, 0.0])
            else:
                p4 = p2
            weighted_sum += per_binary * p4
            total_weight += per_binary

    # Drawing models — each contributes weight 0.10 (0.40 / 4)
    drawing_keys = ["meander", "spiral1", "spiral2", "wave"]
    per_drawing = 0.40 / 4
    for key in drawing_keys:
        if key in drawing_results:
            p = np.array(drawing_results[key]["probabilities"])
            if len(p) == 4:
                p4 = p
            elif len(p) == 2:
                p4 = np.array([p[0], p[1], 0.0, 0.0])
            else:
                p4 = np.array([p[0], p[1], 0.0, 0.0])
            weighted_sum += per_drawing * p4
            total_weight += per_drawing

    if total_weight == 0:
        raise HTTPException(status_code=400, detail="No model results provided.")

    # Normalize
    final_probs = (weighted_sum / total_weight).tolist()

    # Confidence tier
    top = max(final_probs)
    confidence = "High" if top >= 0.70 else "Moderate" if top >= 0.50 else "Low"

    return {
        "ensemble": {
            "classes": CLASSES_4,
            "probabilities": final_probs,
            "prediction": CLASSES_4[int(np.argmax(final_probs))],
            "confidence": confidence,
            "models_used": int(round(total_weight / (0.35 / 1)))
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
