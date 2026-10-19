// Backend base URL. Point this at the deployed FastAPI (Hugging Face Space or
// Render) via a .env file: VITE_API_BASE=https://<your-space>.hf.space
// Falls back to localhost for running backend/app.py locally on port 7860.
// In production the site is served from the same origin as the API (one HF
// Space), so VITE_API_BASE is "" and requests go to relative paths like
// /predict/voice. `??` (not `||`) keeps the empty string instead of falling
// back to localhost. Dev with no env set uses the local backend on :7860.
export const API_BASE: string =
  (import.meta as any).env?.VITE_API_BASE ?? "http://localhost:7860";

export type DrawingType = "spiral" | "wave" | "meander";
export type RecordingType = "ahh" | "text";
export type Band = "low" | "moderate" | "elevated";

export interface TestResult {
  pd_probability: number;
  threshold: number;
  prediction: "HC" | "PD";
}

export interface DrawingResult extends TestResult {
  drawing_type: DrawingType;
  views: number;
  models: number;
}

export interface VoiceResult extends TestResult {
  recording_type: RecordingType;
  duration_s: number;
  chunks: number;
}

export interface EnsembleResult {
  pd_score: number;
  band: Band;
  parts: Partial<Record<"handwriting" | "voice" | "survey", number>>;
  weights_used: Partial<Record<"handwriting" | "voice" | "survey", number>>;
}

export interface Health {
  status: string;
  models_loaded: number;
  models_total: number;
  models: Record<string, boolean | number>;
}

async function postForm<T>(path: string, fd: FormData, label: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", body: fd });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).detail ?? "";
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail || `${label} failed (${res.status})`);
  }
  return res.json();
}

export async function checkHealth(): Promise<Health> {
  const res = await fetch(`${API_BASE}/health`, { method: "GET" });
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export function predictVoice(file: File, recordingType: RecordingType): Promise<VoiceResult> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("recording_type", recordingType);
  return postForm<VoiceResult>("/predict/voice", fd, "Voice analysis");
}

export function predictDrawing(file: File, drawingType: DrawingType): Promise<DrawingResult> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("drawing_type", drawingType);
  return postForm<DrawingResult>("/predict/drawing", fd, "Drawing analysis");
}

export async function predictEnsemble(payload: {
  drawings?: Partial<Record<DrawingType, number>>;
  voice?: Partial<Record<RecordingType, number>>;
  survey?: number;
}): Promise<EnsembleResult> {
  const res = await fetch(`${API_BASE}/predict/ensemble`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Combined score failed (${res.status}): ${detail}`);
  }
  return res.json();
}
