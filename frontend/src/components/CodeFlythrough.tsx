import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Cinematic "fly through the code": real snippets from the backend drift in
// from depth as you scroll, each with a plain-English annotation - the NRG
// journey applied to the source. Reduced motion → static, readable cards.

const SCENES: { file: string; title: string; note: string; code: string }[] = [
  {
    file: "app.py",
    title: "Six models, loaded once",
    note: "Two voice SVMs and four handwriting CNNs load at startup and stay in memory. The spiral uses the paper's two-model ensemble.",
    code: `VOICE_MODELS = {
    "ahh":  _load_joblib("PD_vs_HC_AHH.joblib"),
    "text": _load_joblib("PD_vs_HC_text.joblib"),
}
DRAWING_MODELS = {
    "spiral":  [SpiralModel_1, SpiralModel_2],
    "wave":    [WaveModel],
    "meander": [MeanderModel],
}`,
  },
  {
    file: "inference.py",
    title: "Every drawing, seen four ways",
    note: "Original, rotated ±10°, and zoomed 10%, then averaged. No flips: a mirrored spiral is not clinically equivalent.",
    code: `rot_p = base.rotate(10,  fillcolor=white)
rot_n = base.rotate(-10, fillcolor=white)
zoom  = base.crop((m, m, 224 - m, 224 - m)).resize((224, 224))
views = [img, rot_p, rot_n, zoom]   # raw 0-255 pixels`,
  },
  {
    file: "inference.py",
    title: "Thresholds from the paper",
    note: "Each drawing type has its own cut-off, tuned on validation data, instead of a flat 50%.",
    code: `DRAWING_THRESHOLDS = {"spiral": 0.20, "wave": 0.46, "meander": 0.50}

p = mean(model.predict(views) for model in models)
prediction = "PD" if p >= DRAWING_THRESHOLDS[drawing_type] else "HC"`,
  },
  {
    file: "training/train_voice.py",
    title: "Trained on the code it runs",
    note: "The voice models learn from the same feature extractor the server uses, scored on speakers they never saw.",
    code: `from feature_extraction import extract_features_from_sound

cv = StratifiedGroupKFold(5)          # groups = speaker ID
for train, test in cv.split(X, y, speakers):
    search.fit(X[train], y[train], groups=speakers[train])`,
  },
  {
    file: "inference.py",
    title: "One score out",
    note: "Handwriting, voice, and survey merge with fixed weights, rescaled over whatever you completed.",
    code: `WEIGHTS = {"handwriting": 0.40, "voice": 0.35, "survey": 0.25}

total = sum(WEIGHTS[k] for k in parts)
score = sum(WEIGHTS[k] * v for k, v in parts.items()) / total
band  = "low" if score < 0.35 else "moderate" if score <= 0.60 else "elevated"`,
  },
];

export function CodeFlythrough() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isReduced) return;
    const ctx = gsap.context(() => {
      const scenes = gsap.utils.toArray<HTMLElement>(".cf-scene");
      scenes.forEach((scene) => {
        const card = scene.querySelector(".cf-card");
        gsap.fromTo(
          card,
          { z: -560, rotateX: 14, autoAlpha: 0 },
          {
            z: 0,
            rotateX: 0,
            autoAlpha: 1,
            ease: "none",
            scrollTrigger: { trigger: scene, start: "top 88%", end: "top 42%", scrub: true },
          }
        );
        gsap.to(card, {
          z: 240,
          autoAlpha: 0.1,
          ease: "none",
          scrollTrigger: { trigger: scene, start: "bottom 55%", end: "bottom 8%", scrub: true },
        });
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section className="cf" id="code" ref={root}>
      <div className="container cf-head">
        <p className="eyebrow" style={{ color: "var(--sky)" }}>
          Inside the code
        </p>
        <h2 className="display-lg">The pipeline, in the actual source.</h2>
        <p className="lead" style={{ color: "rgba(244,239,230,0.8)", marginTop: "0.8em" }}>
          Not a diagram - the real{" "}
          <a href="https://github.com/Capserdev/neurotrace/tree/main/backend" target="_blank" rel="noreferrer" style={{ color: "var(--sky)" }}>
            backend/
          </a>
          , flying past.
        </p>
      </div>

      <div className="cf-stage">
        {SCENES.map((s, i) => (
          <div className="cf-scene" key={i}>
            <div className="cf-card">
              <div className="cf-card__bar">
                <span className="cf-dot" />
                <span className="cf-dot" />
                <span className="cf-dot" />
                <span className="cf-file">{s.file}</span>
              </div>
              <pre className="cf-code">
                <code>{s.code}</code>
              </pre>
            </div>
            <div className="cf-note">
              <div className="cf-note__n">{String(i + 1).padStart(2, "0")}</div>
              <h3 className="cf-note__title">{s.title}</h3>
              <p className="cf-note__text">{s.note}</p>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .cf { position:relative; background:#0b0a10; color:var(--cream);
          padding:clamp(72px,12vh,140px) clamp(20px,5vw,72px) 20vh; perspective:1200px; }
        .cf-head { text-align:center; margin-bottom:14vh; }
        .cf-stage { max-width:1000px; margin:0 auto; transform-style:preserve-3d; }
        .cf-scene { min-height:78vh; display:grid; grid-template-columns:1.3fr 1fr; gap:36px;
          align-items:center; }
        .cf-card { transform-style:preserve-3d; border-radius:16px; overflow:hidden;
          background:#16141f; box-shadow:0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(138,92,246,0.25);
          will-change:transform,opacity; }
        .cf-card__bar { display:flex; align-items:center; gap:8px; padding:12px 16px;
          background:#1e1b2b; border-bottom:1px solid rgba(255,255,255,0.06); }
        .cf-dot { width:11px; height:11px; border-radius:999px; background:#3a3550; }
        .cf-dot:nth-child(1){ background:#ee6c34; }
        .cf-dot:nth-child(2){ background:#f4b024; }
        .cf-dot:nth-child(3){ background:#3fa85b; }
        .cf-file { margin-left:10px; font-family:ui-monospace,Menlo,Consolas,monospace;
          font-size:0.78rem; color:rgba(244,239,230,0.5); }
        .cf-code { margin:0; padding:20px 22px; overflow-x:auto;
          font-family:ui-monospace,Menlo,Consolas,monospace; font-size:0.82rem; line-height:1.7;
          color:#d7d3e8; }
        .cf-note__n { font-family:var(--font-display); font-weight:900; font-size:2.4rem;
          color:var(--violet); line-height:1; }
        .cf-note__title { font-size:clamp(1.4rem,2.6vw,2.2rem); margin:0.2em 0 0.4em; }
        .cf-note__text { color:rgba(244,239,230,0.78); }

        @media (max-width:820px) {
          .cf-scene { grid-template-columns:1fr; gap:20px; min-height:auto; padding:8vh 0; }
        }
      `}</style>
    </section>
  );
}
