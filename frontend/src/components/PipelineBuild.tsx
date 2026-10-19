import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// NRG "Build Your Data Center"-inspired scroll narrative: the ML pipeline
// assembles itself as you scroll through five pinned horizontal stages, with a
// phase-progress nav and hotspot pins. Reduced-motion users get a stacked
// static version.
const STAGES = [
  {
    n: "01",
    key: "Record",
    caption: "Say “ahh”, read a passage, or draw a spiral, wave, or meander.",
    hotspots: ["≥ 1s of audio", "224×224 image"],
  },
  {
    n: "02",
    key: "Extract",
    caption: "Voice → 36 acoustic descriptors. Image → resize + 4-pass augmentation.",
    hotspots: ["jitter · shimmer · HNR", "MFCC · F0 · spectral"],
  },
  {
    n: "03",
    key: "Classify",
    caption: "Four RBF-SVMs on the voice, three EfficientNetV2-B0 CNNs on the drawings.",
    hotspots: ["4 voice models", "3 handwriting models"],
  },
  {
    n: "04",
    key: "Ensemble",
    caption: "Per-model probabilities combine with fixed weights.",
    hotspots: ["handwriting 0.40", "voice 0.35 · survey 0.25"],
  },
  {
    n: "05",
    key: "Result",
    caption: "A four-class prediction with a confidence label you can act on.",
    hotspots: ["HC / PD / PSP / MSA", "High · Moderate · Low"],
  },
];

const STAGE_CLS = ["g--cobalt", "g--violet", "g--tangerine", "g--marigold", "g--grass"];

function StageVisual({ index }: { index: number }) {
  if (index === 0)
    return (
      <svg viewBox="0 0 220 120" className="pb-viz" aria-hidden="true">
        <polyline
          points="0,60 20,60 30,20 40,100 50,40 60,80 70,60 90,60 100,30 110,90 120,60 220,60"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
      </svg>
    );
  if (index === 1)
    return (
      <div className="pb-chips" aria-hidden="true">
        {["jitter", "shimmer", "HNR", "MFCC-1", "MFCC-2", "F0", "centroid", "ZCR", "rolloff", "energy", "bandwidth", "+25"].map(
          (c) => (
            <span key={c} className="pb-chip">
              {c}
            </span>
          )
        )}
      </div>
    );
  if (index === 2)
    return (
      <div className="pb-nodes" aria-hidden="true">
        {["AHH", "Vowels", "Text", "4-class", "Meander", "Spiral", "Wave"].map((m, i) => (
          <span key={m} className={`pb-node ${i < 4 ? "pb-node--v" : "pb-node--h"}`}>
            {m}
          </span>
        ))}
      </div>
    );
  if (index === 3)
    return (
      <svg viewBox="0 0 260 140" className="pb-viz" aria-hidden="true">
        <line x1="20" y1="30" x2="150" y2="70" stroke="currentColor" strokeWidth="2" />
        <line x1="20" y1="70" x2="150" y2="70" stroke="currentColor" strokeWidth="2" />
        <line x1="20" y1="110" x2="150" y2="70" stroke="currentColor" strokeWidth="2" />
        <circle cx="20" cy="30" r="10" fill="currentColor" />
        <circle cx="20" cy="70" r="10" fill="currentColor" />
        <circle cx="20" cy="110" r="10" fill="currentColor" />
        <circle cx="160" cy="70" r="18" fill="none" stroke="currentColor" strokeWidth="3" />
        <text x="160" y="75" textAnchor="middle" fontSize="12" fill="currentColor">Σ</text>
      </svg>
    );
  return (
    <div className="pb-bars" aria-hidden="true">
      {[
        ["HC", 18],
        ["PD", 61],
        ["PSP", 13],
        ["MSA", 8],
      ].map(([c, v]) => (
        <div className="pb-bar" key={c as string}>
          <span>{c}</span>
          <div className="pb-bar__track">
            <div className="pb-bar__fill" style={{ width: `${v}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PipelineBuild() {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // On small screens the horizontal scroll-jack is awkward and overflows - use
    // the stacked static layout instead.
    if (isReduced || window.innerWidth < 820) {
      setReduced(true);
      return;
    }
    const ctx = gsap.context(() => {
      const panels = STAGES.length;
      const distance = () =>
        track.current ? track.current.scrollWidth - window.innerWidth : 0;
      gsap.to(track.current, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          pin: true,
          scrub: 1,
          start: "top top",
          end: () => "+=" + distance(),
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const i = Math.min(panels - 1, Math.round(self.progress * (panels - 1)));
            setStage((prev) => (prev !== i ? i : prev));
          },
        },
      });
    }, root);
    return () => ctx.revert();
  }, []);

  if (reduced) {
    return (
      <section className="section" id="how">
        <div className="container">
          <p className="eyebrow">How it works</p>
          <h2 className="display-lg" style={{ marginBottom: "0.6em" }}>
            The pipeline, stage by stage.
          </h2>
          <div className="grid grid--2">
            {STAGES.map((s, i) => (
              <div key={s.key} className={`tile ${STAGE_CLS[i]}`}>
                <div className="stat">{s.n}</div>
                <h3 style={{ margin: "0.2em 0" }}>{s.key}</h3>
                <p style={{ opacity: 0.9 }}>{s.caption}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="how" ref={root} className="pb-root">
      <div className="pb-nav" aria-hidden="true">
        {STAGES.map((s, i) => (
          <div key={s.key} className={`pb-nav__item ${i === stage ? "is-on" : ""}`}>
            <span className="pb-nav__n">{s.n}</span>
            <span className="pb-nav__k">{s.key}</span>
          </div>
        ))}
        <div className="pb-nav__bar">
          <div
            className="pb-nav__fill"
            style={{ width: `${(stage / (STAGES.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      <div className="pb-track" ref={track}>
        {STAGES.map((s, i) => (
          <div className={`pb-panel ${STAGE_CLS[i]}`} key={s.key}>
            <div className="pb-panel__inner">
              <div className="pb-panel__text">
                <div className="pb-panel__n">{s.n}</div>
                <h3 className="pb-panel__title">{s.key}</h3>
                <p className="pb-panel__cap">{s.caption}</p>
                <div className="pb-panel__spots">
                  {s.hotspots.map((h) => (
                    <span key={h} className="pb-spot">
                      <i /> {h}
                    </span>
                  ))}
                </div>
              </div>
              <div className="pb-panel__viz">
                <StageVisual index={i} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .pb-root { position:relative; height:100vh; overflow:hidden; }
        .pb-nav { position:absolute; top:0; left:0; right:0; z-index:5;
          display:flex; gap:8px; padding:20px clamp(20px,5vw,72px);
          align-items:center; flex-wrap:wrap; }
        .pb-nav__item { display:flex; align-items:center; gap:6px; opacity:0.4;
          transition:opacity .3s; font-family:var(--font-body); }
        .pb-nav__item.is-on { opacity:1; }
        .pb-nav__n { font-family:var(--font-display); font-weight:900; font-size:0.9rem; }
        .pb-nav__k { font-weight:600; }
        .pb-nav__bar { position:absolute; left:0; bottom:0; height:3px; width:100%;
          background:rgba(20,17,15,0.12); }
        .pb-nav__fill { height:100%; background:var(--ink); transition:width .4s ease; }

        .pb-track { display:flex; height:100vh; width:500vw; }
        .pb-panel { width:100vw; height:100vh; flex-shrink:0; display:grid; place-items:center;
          padding:0 clamp(20px,6vw,90px); }
        .pb-panel.g--sky, .pb-panel.g--marigold { color:var(--ink); }
        .pb-panel:not(.g--sky):not(.g--marigold) { color:#fff; }
        .pb-panel__inner { width:100%; max-width:var(--maxw); display:grid;
          grid-template-columns:1fr 1fr; gap:40px; align-items:center; }
        .pb-panel__n { font-family:var(--font-display); font-weight:900;
          font-size:clamp(3rem,8vw,7rem); line-height:1; opacity:0.5; }
        .pb-panel__title { font-size:clamp(2.4rem,6vw,5rem); margin:0.1em 0 0.3em; }
        .pb-panel__cap { font-size:clamp(1rem,1.6vw,1.35rem); max-width:34ch; opacity:0.95; }
        .pb-panel__spots { display:flex; flex-direction:column; gap:8px; margin-top:1.4em; }
        .pb-spot { display:inline-flex; align-items:center; gap:8px; font-size:0.9rem;
          font-weight:600; }
        .pb-spot i { width:10px; height:10px; border-radius:999px; background:currentColor;
          box-shadow:0 0 0 4px rgba(255,255,255,0.25); flex-shrink:0; }
        .pb-panel__viz { display:grid; place-items:center; min-height:200px; }
        .pb-viz { width:min(100%,360px); color:currentColor; }

        .pb-chips { display:flex; flex-wrap:wrap; gap:8px; max-width:420px; }
        .pb-chip { background:rgba(255,255,255,0.22); padding:6px 12px; border-radius:999px;
          font-size:0.85rem; font-weight:600; }
        .pb-nodes { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; max-width:360px; }
        .pb-node { background:rgba(255,255,255,0.22); padding:12px 14px; border-radius:14px;
          font-weight:700; text-align:center; }
        .pb-node--h { background:rgba(255,255,255,0.34); }
        .pb-bars { display:flex; flex-direction:column; gap:12px; width:min(100%,380px); }
        .pb-bar { display:grid; grid-template-columns:44px 1fr; align-items:center; gap:12px; }
        .pb-bar span { font-weight:700; }
        .pb-bar__track { height:14px; border-radius:999px; background:rgba(255,255,255,0.25); overflow:hidden; }
        .pb-bar__fill { height:100%; background:#fff; border-radius:999px; }

        @media (max-width:760px) {
          .pb-panel__inner { grid-template-columns:1fr; gap:24px; }
        }
      `}</style>
    </section>
  );
}
