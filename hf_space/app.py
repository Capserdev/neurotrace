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
from PIL import Image

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
import tensorflow as tf

from feature_extraction import extract_voice_features

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="NeuroTrace API", version="1.0.0")

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
voice_ahh    = _load_joblib("PD_vs_HC_AHH.joblib")
voice_text   = _load_joblib("PD_vs_HC_text.joblib")
voice_vowels = _load_joblib("PD_vs_HC_vowels.joblib")
voice_4class = _load_joblib("Vowels_4class_HC_PD_PSP_MSA.joblib")

model_meander = _load_keras("MeanderModel_finetune_best.keras")
model_spiral1 = _load_keras("SpiralModel_1_finetune_best.keras")
model_spiral2 = _load_keras("SpiralModel_2_finetune_best.keras")
model_wave    = _load_keras("WaveModel_finetune_best.keras")

models_loaded = sum(1 for m in [
    voice_ahh, voice_text, voice_vowels, voice_4class,
    model_meander, model_spiral1, model_spiral2, model_wave
] if m is not None)
print(f"Ready. {models_loaded}/8 models loaded.")

CLASSES_4 = ["HC", "PD", "PSP", "MSA"]
CLASSES_2 = ["HC", "PD"]


# ── Helpers ───────────────────────────────────────────────────────────────────
def svm_predict_proba(model, features: np.ndarray, n_classes: int) -> np.ndarray:
    if hasattr(model, "predict_proba"):
        return model.predict_proba(features.reshape(1, -1))[0]
    scores = model.decision_function(features.reshape(1, -1))[0]
    if n_classes == 2:
        p = 1.0 / (1.0 + np.exp(-scores if np.isscalar(scores) else -scores[0]))
        return np.array([1 - p, p])
    e = np.exp(scores - scores.max())
    return e / e.sum()


def preprocess_image(file_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(file_bytes)).convert("RGB").resize((224, 224))
    return np.expand_dims(np.array(img, dtype=np.float32) / 255.0, axis=0)


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
@app.get("/status")
def health():
    return {
        "status": "ok",
        "models_loaded": models_loaded,
        "models": {
            "voice_ahh":    voice_ahh    is not None,
            "voice_text":   voice_text   is not None,
            "voice_vowels": voice_vowels is not None,
            "voice_4class": voice_4class is not None,
            "meander":      model_meander is not None,
            "spiral1":      model_spiral1 is not None,
            "spiral2":      model_spiral2 is not None,
            "wave":         model_wave    is not None,
        }
    }


@app.post("/predict/voice")
async def predict_voice(
    file: UploadFile = File(...),
    recording_type: str = Form("ahh")
):
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

    if voice_4class is not None:
        p = svm_predict_proba(voice_4class, features, 4)
        results["vowels_4class"] = {"classes": CLASSES_4, "probabilities": p.tolist(), "prediction": CLASSES_4[int(p.argmax())]}

    if recording_type in ("ahh", "all") and voice_ahh is not None:
        p = svm_predict_proba(voice_ahh, features, 2)
        results["ahh_binary"] = {"classes": CLASSES_2, "probabilities": p.tolist(), "prediction": CLASSES_2[int(p.argmax())]}

    if recording_type in ("text", "all") and voice_text is not None:
        p = svm_predict_proba(voice_text, features, 2)
        results["text_binary"] = {"classes": CLASSES_2, "probabilities": p.tolist(), "prediction": CLASSES_2[int(p.argmax())]}

    if recording_type in ("vowels", "all") and voice_vowels is not None:
        p = svm_predict_proba(voice_vowels, features, 2)
        results["vowels_binary"] = {"classes": CLASSES_2, "probabilities": p.tolist(), "prediction": CLASSES_2[int(p.argmax())]}

    if not results:
        raise HTTPException(status_code=503, detail="No voice models loaded.")

    results["features"] = features.tolist()
    return results


@app.post("/predict/drawing")
async def predict_drawing(
    file: UploadFile = File(...),
    drawing_type: str = Form("spiral1")
):
    model_map = {"meander": model_meander, "spiral1": model_spiral1, "spiral2": model_spiral2, "wave": model_wave}
    if drawing_type not in model_map:
        raise HTTPException(status_code=400, detail=f"Unknown drawing_type: {drawing_type}")
    model = model_map[drawing_type]
    if model is None:
        raise HTTPException(status_code=503, detail=f"Model '{drawing_type}' not loaded.")

    img_bytes = await file.read()
    try:
        img_array = preprocess_image(img_bytes)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Image processing failed: {e}")

    raw = model.predict(img_array, verbose=0)[0]
    if len(raw) == 4:
        probs, classes = raw.tolist(), CLASSES_4
    elif len(raw) == 2:
        probs, classes = raw.tolist(), CLASSES_2
    else:
        p = float(raw[0])
        probs, classes = [1 - p, p], CLASSES_2

    return {"drawing_type": drawing_type, "classes": classes, "probabilities": probs, "prediction": classes[int(np.argmax(probs))]}


@app.post("/predict/ensemble")
async def predict_ensemble(payload: dict):
    voice_results   = payload.get("voice", {})
    drawing_results = payload.get("drawing", {})
    survey_result   = payload.get("survey", None)

    weighted_sum = np.zeros(4)
    total_weight = 0.0

    if "vowels_4class" in voice_results:
        p = np.array(voice_results["vowels_4class"]["probabilities"])
        if len(p) == 4:
            weighted_sum += 0.35 * p; total_weight += 0.35

    per_binary = 0.25 / 3
    for key in ["ahh_binary", "text_binary", "vowels_binary"]:
        if key in voice_results:
            p2 = np.array(voice_results[key]["probabilities"])
            p4 = np.array([p2[0], p2[1], 0.0, 0.0]) if len(p2) == 2 else p2
            weighted_sum += per_binary * p4; total_weight += per_binary

    per_drawing = 0.40 / 4
    for key in ["meander", "spiral1", "spiral2", "wave"]:
        if key in drawing_results:
            p = np.array(drawing_results[key]["probabilities"])
            p4 = p if len(p) == 4 else np.array([p[0], p[1], 0.0, 0.0])
            weighted_sum += per_drawing * p4; total_weight += per_drawing

    if survey_result is not None:
        score = max(0.0, min(1.0, float(survey_result.get("score", 0))))
        weighted_sum += 0.25 * np.array([1.0 - score, score, 0.0, 0.0])
        total_weight += 0.25

    if total_weight == 0:
        raise HTTPException(status_code=400, detail="No model results provided.")

    final_probs = (weighted_sum / total_weight).tolist()
    top = max(final_probs)
    confidence = "High" if top >= 0.70 else "Moderate" if top >= 0.50 else "Low"

    return {"ensemble": {
        "classes": CLASSES_4, "probabilities": final_probs,
        "prediction": CLASSES_4[int(np.argmax(final_probs))],
        "confidence": confidence, "models_used": models_loaded,
        "survey_included": survey_result is not None
    }}
