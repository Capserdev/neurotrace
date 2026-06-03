"""
NeuroTrace — FastAPI Backend
Deploy to Hugging Face Spaces (Docker SDK).
Weights match utils/constants.py from the original Streamlit app.
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

# TensorFlow / Keras
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
import tensorflow as tf

from feature_extraction import extract_voice_features

# ── App setup ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="NeuroTrace API",
    description="AI-assisted neurological disorder screening backend",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Paths ─────────────────────────────────────────────────────────────────────
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR    = os.path.dirname(BACKEND_DIR)
MODELS_DIR  = os.path.join(BACKEND_DIR, "models")

# ── Weights (matching utils/constants.py) ────────────────────────────────────
# Within-group weights (must sum ≤ 1; normalised during aggregation)
HANDWRITING_WEIGHTS = {"meander": 0.33, "spiral1": 0.34, "wave": 0.33}
VOICE_BINARY_WEIGHTS = {"ahh_binary": 0.35, "vowels_binary": 0.35, "text_binary": 0.30}
# Cross-modality weights
COMBINED_WEIGHTS = {"handwriting": 0.40, "voice": 0.35, "survey": 0.25}

# Image / TTA constants
IMG_SIZE   = 224
TTA_PASSES = 4

# Class label order
CLASSES_4 = ["HC", "PD", "PSP", "MSA"]
CLASSES_2 = ["HC", "PD"]


# ── Model loaders ─────────────────────────────────────────────────────────────
def _load_joblib(filename):
    path = os.path.join(MODELS_DIR, filename)
    if not os.path.exists(path):
        print(f"  [SKIP] {filename} not found — model unavailable.")
        return None
    print(f"  [OK]   Loading {filename}")
    return joblib.load(path)


def _load_keras(filename):
    path = os.path.join(MODELS_DIR, filename)
    if not os.path.exists(path):
        print(f"  [SKIP] {filename} not found — model unavailable.")
        return None
    print(f"  [OK]   Loading {filename}")
    return tf.keras.models.load_model(path)


print("Loading voice models...")
voice_ahh    = _load_joblib("PD_vs_HC_AHH.joblib")
voice_text   = _load_joblib("PD_vs_HC_text.joblib")
voice_vowels = _load_joblib("PD_vs_HC_vowels.joblib")
voice_4class = _load_joblib("Vowels_4class_HC_PD_PSP_MSA.joblib")

print("Loading drawing models...")
model_meander = _load_keras("MeanderModel_finetune_best.keras")
model_spiral1 = _load_keras("SpiralModel_1_finetune_best.keras")
model_wave    = _load_keras("WaveModel_finetune_best.keras")

ALL_MODELS = [voice_ahh, voice_text, voice_vowels, voice_4class,
              model_meander, model_spiral1, model_wave]
models_loaded = sum(1 for m in ALL_MODELS if m is not None)
print(f"Startup complete. {models_loaded}/7 models loaded.")


def _expects_raw_pixels(model) -> bool:
    """
    True when the saved Keras model already contains a Rescaling/preprocessing layer
    (EfficientNetV2B0 default: include_preprocessing=True).
    In that case the model expects raw [0-255] float input; dividing by 255 first
    would compress all values to [0, 0.004] and produce identical outputs.
    """
    if model is None:
        return False
    for layer in model.layers[:6]:
        name = type(layer).__name__
        if name in ("Rescaling", "Normalization") or "preprocess" in name.lower():
            return True
    return False

# Per-model flag: True → pass raw [0-255], False → normalise to [0-1]
meander_raw = _expects_raw_pixels(model_meander)
spiral1_raw = _expects_raw_pixels(model_spiral1)
wave_raw    = _expects_raw_pixels(model_wave)
print(f"  Preprocessing — meander:{'raw' if meander_raw else '/255'}  "
      f"spiral1:{'raw' if spiral1_raw else '/255'}  "
      f"wave:{'raw' if wave_raw else '/255'}")


# ── Image helpers ─────────────────────────────────────────────────────────────
def preprocess_image_tta(file_bytes: bytes, raw_input: bool = False) -> np.ndarray:
    """
    Resize to 224×224 RGB with LANCZOS, then build 4-pass TTA batch.

    raw_input=True  → pass pixel values as-is in [0-255]; use when the model
                       has a built-in Rescaling layer (EfficientNetV2 default).
    raw_input=False → EfficientNetV2 standard preprocess_input: [0,255] → [-1,1].
    """
    img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE), Image.LANCZOS)
    arr = np.array(img, dtype=np.float32)
    if not raw_input:
        arr = arr / 127.5 - 1.0   # EfficientNetV2 preprocess_input: [0,255] → [-1,1]

    augs = [
        arr,
        arr[:, ::-1, :],        # horizontal flip
        arr[::-1, :, :],        # vertical flip
        np.rot90(arr, k=1),     # 90° counter-clockwise
    ]
    return np.stack(augs[:TTA_PASSES], axis=0)  # (4, 224, 224, 3)


# ── Voice helpers ─────────────────────────────────────────────────────────────
def svm_predict_proba(model, features: np.ndarray, n_classes: int) -> np.ndarray:
    """
    SVM/SVC: use predict_proba if available, else convert decision_function
    via sigmoid (binary) or softmax (multi-class).
    """
    if hasattr(model, "predict_proba"):
        return model.predict_proba(features.reshape(1, -1))[0]
    scores = model.decision_function(features.reshape(1, -1))[0]
    if n_classes == 2:
        p = 1.0 / (1.0 + np.exp(-float(scores if np.isscalar(scores) else scores[0])))
        return np.array([1 - p, p])
    e = np.exp(scores - scores.max())
    return e / e.sum()


# ── Ensemble helpers ──────────────────────────────────────────────────────────
def get_pd_prob(result: dict) -> float:
    """Extract the PD probability from a single model result dict."""
    classes = result.get("classes", [])
    probs   = result.get("probabilities", [])
    if "PD" in classes:
        return float(probs[classes.index("PD")])
    return float(probs[1]) if len(probs) >= 2 else 0.5


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
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
            "wave":         model_wave    is not None,
        },
        "drawing_preprocessing": {
            "meander": "raw[0-255]" if meander_raw else "efficientnet[-1,1]",
            "spiral1": "raw[0-255]" if spiral1_raw else "efficientnet[-1,1]",
            "wave":    "raw[0-255]" if wave_raw    else "efficientnet[-1,1]",
        }
    }

@app.get("/status")
def status():
    return health()


@app.post("/predict/voice")
async def predict_voice(
    file: UploadFile = File(...),
    recording_type: str = Form("ahh")   # ahh | text | vowels | all
):
    """Extract 36 Praat acoustic features and run available voice models."""
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

    # 4-class model (runs on every upload — used for PSP/MSA detection in report)
    if voice_4class is not None:
        probs_4 = svm_predict_proba(voice_4class, features, 4)
        results["vowels_4class"] = {
            "classes": CLASSES_4,
            "probabilities": probs_4.tolist(),
            "prediction": CLASSES_4[int(probs_4.argmax())]
        }

    # Binary models — type-gated
    if recording_type in ("ahh", "all") and voice_ahh is not None:
        p = svm_predict_proba(voice_ahh, features, 2)
        results["ahh_binary"] = {
            "classes": CLASSES_2,
            "probabilities": p.tolist(),
            "prediction": CLASSES_2[int(p.argmax())]
        }

    if recording_type in ("text", "all") and voice_text is not None:
        p = svm_predict_proba(voice_text, features, 2)
        results["text_binary"] = {
            "classes": CLASSES_2,
            "probabilities": p.tolist(),
            "prediction": CLASSES_2[int(p.argmax())]
        }

    if recording_type in ("vowels", "all") and voice_vowels is not None:
        p = svm_predict_proba(voice_vowels, features, 2)
        results["vowels_binary"] = {
            "classes": CLASSES_2,
            "probabilities": p.tolist(),
            "prediction": CLASSES_2[int(p.argmax())]
        }

    if not results:
        raise HTTPException(status_code=503, detail="No voice models loaded.")

    results["features"] = features.tolist()
    return results


@app.post("/predict/drawing")
async def predict_drawing(
    file: UploadFile = File(...),
    drawing_type: str = Form("spiral1")   # meander | spiral1 | wave
):
    """
    Run a Keras drawing model with 4-pass TTA (original + h-flip + v-flip + 90°).
    Preprocessing: LANCZOS resize to 224×224; normalisation determined per-model
    (raw [0-255] if the model has a built-in Rescaling layer, else /255).
    """
    model_map = {
        "meander": model_meander,
        "spiral1": model_spiral1,
        "wave":    model_wave,
    }
    raw_map = {
        "meander": meander_raw,
        "spiral1": spiral1_raw,
        "wave":    wave_raw,
    }

    if drawing_type not in model_map:
        raise HTTPException(status_code=400, detail=f"Unknown drawing_type '{drawing_type}'.")

    model = model_map[drawing_type]
    if model is None:
        raise HTTPException(status_code=503, detail=f"Model '{drawing_type}' is not loaded.")

    img_bytes = await file.read()
    try:
        tta_batch = preprocess_image_tta(img_bytes, raw_input=raw_map[drawing_type])  # (4, 224, 224, 3)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Image processing failed: {e}")

    # Run model on all TTA passes and average
    raw_batch = model.predict(tta_batch, verbose=0)      # (4, output_dim)
    raw = raw_batch.mean(axis=0)                         # average over TTA

    # Interpret output shape
    if len(raw) == 4:
        probs  = raw.tolist()
        classes = CLASSES_4
    elif len(raw) == 2:
        probs  = raw.tolist()
        classes = CLASSES_2
    else:
        # sigmoid single-neuron binary output
        p = float(raw[0])
        probs  = [1.0 - p, p]
        classes = CLASSES_2

    return {
        "drawing_type":  drawing_type,
        "classes":       classes,
        "probabilities": probs,
        "prediction":    classes[int(np.argmax(probs))]
    }


@app.post("/predict/ensemble")
async def predict_ensemble(payload: dict):
    """
    Aggregate individual model results into a final 4-class ensemble.

    Weights match utils/constants.py:
      HANDWRITING_WEIGHTS  = {meander: 0.33, spiral1: 0.34, wave: 0.33}
      VOICE_BINARY_WEIGHTS = {ahh_binary: 0.35, vowels_binary: 0.35, text_binary: 0.30}
      COMBINED_WEIGHTS     = {handwriting: 0.40, voice: 0.35, survey: 0.25}

    Expected payload:
      {
        "voice":   { "vowels_4class": {...}, "ahh_binary": {...}, ... },
        "drawing": { "meander": {...}, "spiral1": {...}, "wave": {...} },
        "survey":  { "score": 0.0–1.0 }   // optional
      }
    """
    voice_results   = payload.get("voice",   {})
    drawing_results = payload.get("drawing", {})
    survey_result   = payload.get("survey",  None)

    # ── Step 1: Handwriting binary score (probability of PD) ─────────────────
    hw_s, hw_w = 0.0, 0.0
    for key, w in HANDWRITING_WEIGHTS.items():
        if key in drawing_results:
            hw_s += w * get_pd_prob(drawing_results[key])
            hw_w += w
    hw_score = hw_s / hw_w if hw_w > 0 else None

    # ── Step 2: Voice binary score ────────────────────────────────────────────
    vb_s, vb_w = 0.0, 0.0
    for key, w in VOICE_BINARY_WEIGHTS.items():
        if key in voice_results:
            vb_s += w * get_pd_prob(voice_results[key])
            vb_w += w
    voice_score = vb_s / vb_w if vb_w > 0 else None

    # ── Step 3: Survey score ──────────────────────────────────────────────────
    survey_score = None
    if survey_result is not None:
        s = float(survey_result.get("score", 0))
        survey_score = max(0.0, min(1.0, s))

    # ── Step 4: Combined HC/PD binary probability ─────────────────────────────
    c_s, c_w = 0.0, 0.0
    if hw_score is not None:
        c_s += COMBINED_WEIGHTS["handwriting"] * hw_score
        c_w += COMBINED_WEIGHTS["handwriting"]
    if voice_score is not None:
        c_s += COMBINED_WEIGHTS["voice"] * voice_score
        c_w += COMBINED_WEIGHTS["voice"]
    if survey_score is not None:
        c_s += COMBINED_WEIGHTS["survey"] * survey_score
        c_w += COMBINED_WEIGHTS["survey"]

    if c_w == 0:
        raise HTTPException(status_code=400, detail="No model results provided.")

    pd_prob = c_s / c_w   # binary PD probability (0–1)

    # ── Step 5: Build 4-class probabilities ───────────────────────────────────
    # Use 4-class voice model for PSP/MSA detection; binary ensemble for HC/PD split
    if "vowels_4class" in voice_results:
        vc4 = voice_results["vowels_4class"]["probabilities"]
        psp = float(vc4[2]) if len(vc4) > 2 else 0.0
        msa = float(vc4[3]) if len(vc4) > 3 else 0.0
        hc_pd_mass = max(0.0, 1.0 - psp - msa)
        hc  = hc_pd_mass * (1.0 - pd_prob)
        pd  = hc_pd_mass * pd_prob
        final_probs = [hc, pd, psp, msa]
    else:
        final_probs = [1.0 - pd_prob, pd_prob, 0.0, 0.0]

    top        = max(final_probs)
    confidence = "High" if top >= 0.70 else "Moderate" if top >= 0.50 else "Low"

    return {
        "ensemble": {
            "classes":         CLASSES_4,
            "probabilities":   final_probs,
            "prediction":      CLASSES_4[int(np.argmax(final_probs))],
            "confidence":      confidence,
            "models_used":     models_loaded,
            "survey_included": survey_result is not None
        }
    }


# ── Serve static frontend ──────────────────────────────────────────────────────
def _mount_if_exists(path: str, name: str):
    d = os.path.join(ROOT_DIR, path)
    if os.path.isdir(d):
        app.mount(f"/{path}", StaticFiles(directory=d), name=name)

_mount_if_exists("css",    "css")
_mount_if_exists("js",     "js")
_mount_if_exists("assets", "assets")


def _page(filename: str):
    path = os.path.join(ROOT_DIR, filename)
    def handler():
        return FileResponse(path)
    handler.__name__ = filename.replace(".", "_")
    return handler


for _route, _file in [
    ("/",               "index.html"),
    ("/index.html",     "index.html"),
    ("/diagnosis",      "diagnosis.html"),
    ("/diagnosis.html", "diagnosis.html"),
    ("/survey",         "survey.html"),
    ("/survey.html",    "survey.html"),
    ("/science",        "science.html"),
    ("/science.html",   "science.html"),
    ("/stack",          "stack.html"),
    ("/stack.html",     "stack.html"),
]:
    app.add_api_route(_route, _page(_file), methods=["GET"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
