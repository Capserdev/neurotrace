import { PageHeader } from "../components/PageHeader";
import { Reveal } from "../components/Reveal";
import { CodeFlythrough } from "../components/CodeFlythrough";

const REPO = "https://github.com/Capserdev/neurotrace";

// The exact 36 features from backend/feature_extraction.py (FEATURE_NAMES).
const FEATURES = [
  "PPE", "DFA", "RPDE", "numPulses", "numPeriodsPulses", "meanPeriodPulses", "stdDevPeriodPulses",
  "locPctJitter", "locAbsJitter", "rapJitter", "ppq5Jitter", "ddpJitter",
  "locShimmer", "locDbShimmer", "apq3Shimmer", "apq5Shimmer", "apq11Shimmer", "ddaShimmer",
  "meanAutoCorrHNR", "meanNoiseToHarm", "meanHarmToNoise",
  "minIntensity", "maxIntensity", "meanIntensity",
  "f1", "f2", "f3", "f4", "b1", "b2", "b3", "b4",
  "GQ_prc5_95", "GQ_std_open", "GQ_std_closed", "GNE_mean",
];

const ENDPOINTS = [
  { m: "GET", p: "/health", d: "Reports which of the six live models loaded.", cls: "tile--sky" },
  { m: "POST", p: "/predict/voice", d: "WAV file + recording type (ahh or text). Extracts the 36 features (per 10 s chunk for text) and returns P(Parkinson's).", cls: "tile--cobalt" },
  { m: "POST", p: "/predict/drawing", d: "Image + drawing type. Runs the CNN(s) with 4-view test-time augmentation and the paper's tuned threshold.", cls: "tile--violet" },
  { m: "POST", p: "/predict/ensemble", d: "Combines drawing, voice, and survey scores into one weighted score and a low / moderate / elevated band.", cls: "tile--grass" },
];

const STACK = [
  ["FastAPI", "the API layer"], ["TensorFlow / Keras", "the 4 handwriting CNNs"],
  ["scikit-learn + joblib", "the 2 voice SVMs"], ["parselmouth (Praat)", "36-feature extraction"],
  ["Pillow + NumPy", "image + array handling"], ["Docker", "Hugging Face Space deploy"],
];

const FILES = [
  { label: "backend/app.py", href: `${REPO}/blob/main/backend/app.py` },
  { label: "backend/inference.py", href: `${REPO}/blob/main/backend/inference.py` },
  { label: "backend/feature_extraction.py", href: `${REPO}/blob/main/backend/feature_extraction.py` },
  { label: "backend/training/train_voice.py", href: `${REPO}/blob/main/backend/training/train_voice.py` },
  { label: "backend/tests/", href: `${REPO}/tree/main/backend/tests` },
  { label: "frontend/", href: `${REPO}/tree/main/frontend` },
  { label: "repository root", href: REPO },
];

export function CodePage() {
  return (
    <>
      <PageHeader
        tone="dark"
        eyebrow="Inside the code"
        title="Open source, end to end."
        intro="A static frontend talks to a FastAPI backend that loads six models and combines them. Nothing is hidden. Below is the architecture, the real feature set, the endpoints, and the actual source flying past."
      />

      {/* Architecture */}
      <section className="section" style={{ background: "#0b0a10", color: "var(--cream)", paddingTop: 0 }}>
        <div className="container">
          <div className="grid grid--4">
            {[
              ["Frontend", "React + Vite + R3F. Sends files to the API.", "tile--cobalt"],
              ["FastAPI", "Validates uploads, routes to the models.", "tile--sky"],
              ["6 models", "2 SVMs (voice) + 4 EfficientNetV2-B0 (handwriting).", "tile--violet"],
              ["Ensemble", "Weighted merge into one score and a risk band.", "tile--grass"],
            ].map(([t, d, c], i) => (
              <Reveal key={t} className={`tile ${c}`} delay={i * 60}>
                <div className="stat" style={{ fontSize: "1.4rem" }}>{`0${i + 1}`}</div>
                <h3 style={{ fontSize: "1.2rem", margin: "0.3em 0 0.2em" }}>{t}</h3>
                <p style={{ fontSize: "0.9rem", opacity: 0.92 }}>{d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Endpoints */}
      <section className="section">
        <div className="container">
          <Reveal as="p" className="eyebrow">The API</Reveal>
          <Reveal as="h2" className="display-lg" delay={60} style={{ marginBottom: "0.6em" }}>Four endpoints.</Reveal>
          <div className="grid grid--2">
            {ENDPOINTS.map((e, i) => (
              <Reveal key={e.p} className={`tile ${e.cls}`} delay={i * 60}>
                <code className="ep">
                  <span className="ep__m">{e.m}</span> {e.p}
                </code>
                <p style={{ marginTop: "0.6em", opacity: 0.94 }}>{e.d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* The real 36 features */}
      <section className="section" style={{ background: "#0b0a10", color: "var(--cream)" }}>
        <div className="container">
          <Reveal as="p" className="eyebrow" style={{ color: "var(--sky)" }}>feature_extraction.py</Reveal>
          <Reveal as="h2" className="display-lg" delay={60} style={{ marginBottom: "0.3em" }}>The 36 features, exactly.</Reveal>
          <Reveal as="p" className="lead" delay={100} style={{ color: "rgba(244,239,230,0.8)", maxWidth: "60ch", marginBottom: "1.4em" }}>
            These are the real names from <code>FEATURE_NAMES</code>, computed with parselmouth (Praat)
            in the exact order the models were trained on. The voice models were trained with this same
            file, so the app measures exactly what the models learned from. PPE, DFA, RPDE, GQ, and GNE
            are pitch- and HNR-based approximations of the clinical measures.
          </Reveal>
          <Reveal className="feat-chips">
            {FEATURES.map((f) => (
              <span key={f} className="feat-chip">{f}</span>
            ))}
          </Reveal>
        </div>
      </section>

      {/* The code fly-through (reused) */}
      <CodeFlythrough />

      {/* Stack + links */}
      <section className="section" style={{ background: "#0b0a10", color: "var(--cream)" }}>
        <div className="container">
          <Reveal as="p" className="eyebrow" style={{ color: "var(--sky)" }}>What it runs on</Reveal>
          <Reveal as="h2" className="display-lg" delay={60} style={{ marginBottom: "0.6em" }}>The stack.</Reveal>
          <div className="grid grid--3">
            {STACK.map(([t, d], i) => (
              <Reveal key={t} className="tile tile--ink" delay={i * 50}
                style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)" }}>
                <h3 style={{ fontSize: "1.15rem" }}>{t}</h3>
                <p style={{ color: "rgba(244,239,230,0.75)", marginTop: "0.3em" }}>{d}</p>
              </Reveal>
            ))}
          </div>
          <Reveal className="code-links" style={{ marginTop: "2em" }}>
            {FILES.map((l) => (
              <a key={l.href} className="btn btn--ghost" href={l.href} target="_blank" rel="noreferrer"
                style={{ color: "var(--cream)", boxShadow: "inset 0 0 0 2px var(--cream)" }}>
                {l.label} ↗
              </a>
            ))}
          </Reveal>
        </div>
      </section>

      <style>{`
        .ep { font-family:ui-monospace,Menlo,Consolas,monospace; font-size:1.05rem; }
        .ep__m { font-weight:700; opacity:0.85; }
        .feat-chips { display:flex; flex-wrap:wrap; gap:8px; }
        .feat-chip { font-family:ui-monospace,Menlo,Consolas,monospace; font-size:0.82rem;
          background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12);
          padding:6px 11px; border-radius:8px; color:var(--cream); }
        .code-links { display:flex; flex-wrap:wrap; gap:12px; }
      `}</style>
    </>
  );
}
