---
title: NeuroTrace API
emoji: 🧠
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# NeuroTrace API

FastAPI backend for NeuroTrace — Parkinson's screening through digital biomarkers.

**Endpoints:**
- `GET /health` — model status
- `POST /predict/voice` — voice analysis
- `POST /predict/drawing` — handwriting analysis
- `POST /predict/ensemble` — combined prediction
