# NeuroTrace

Voice and handwriting screening for Parkinson's disease. Live at
https://anonymous6623-nuerotrace.hf.space (one Hugging Face Space serves both the
site and the API).

This repository holds the source that the live Space runs.

## Layout

| Path | What it is |
| --- | --- |
| `backend/app.py` | FastAPI server: `/health`, `/predict/voice`, `/predict/drawing`, `/predict/ensemble`, and the built site |
| `backend/inference.py` | Pure inference helpers (test-time augmentation, ensemble weights, risk bands) |
| `backend/feature_extraction.py` | The 36 Praat (parselmouth) voice features |
| `backend/training/train_voice.py` | Retrains the two voice SVMs on features from `feature_extraction.py` |
| `backend/training/metrics.json` | Cross-validated metrics from the last training run |
| `backend/tests/` | Unit tests for `inference.py` (`pytest backend/tests`) |
| `backend/Dockerfile` | The Space's container image |
| `frontend/` | React + Vite site (`npm install && npm run build`) |

## Models

The model binaries (`*.keras`, `*.joblib`) are not stored in this repository.
They live in the Hugging Face Space repo under `models/` (git-LFS). To run the
backend locally, put them in `backend/models/` and copy the frontend build
(`frontend/dist/*`) into `backend/web/`.
