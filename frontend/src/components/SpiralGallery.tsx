import { useEffect, useRef, useState } from "react";
import { Reveal } from "./Reveal";
import { scrollToId } from "../lib/scroll";

type Model = {
  name: string;
  type: string;
  metric: string;
  blurb: string;
  cls: string;
  target: string; // pipeline section this card links into
};

const MODELS: Model[] = [
  { name: "AHH", type: "Voice · RBF-SVM", metric: "90.9%", blurb: "PD vs. healthy from a single sustained “ahh” phonation.", cls: "g--cobalt", target: "how" },
  { name: "Vowels", type: "Voice · RBF-SVM", metric: "79.5%", blurb: "PD vs. healthy from sustained vowel phonations.", cls: "g--sky", target: "how" },
  { name: "Text", type: "Voice · RBF-SVM", metric: "86.7%", blurb: "Read speech, threshold-tuned to 100% PD recall.", cls: "g--violet", target: "how" },
  { name: "4-class vowels", type: "Voice · SVM · HC/PD/PSP/MSA", metric: "100%", blurb: "Subject-level separation of all four classes.", cls: "g--ink", target: "how" },
  { name: "Meander", type: "Hand · EfficientNetV2-B0", metric: "94.6%", blurb: "Meander drawing, macro-F1 0.91.", cls: "g--marigold", target: "how" },
  { name: "Spiral", type: "Hand · 2-model ensemble + TTA", metric: "90.0%", blurb: "Spiral drawing, tuned threshold 0.20.", cls: "g--tangerine", target: "how" },
  { name: "Wave", type: "Hand · EfficientNetV2-B0", metric: "93.3%", blurb: "Wave drawing, balanced precision/recall.", cls: "g--grass", target: "how" },
];

// A scattered 3D card vortex (noomo-inspired): the seven models float at varied
// heights and depths, warping as the whole set slowly rotates. Drag to spin,
// click a card to bring it to front; the front card links into the pipeline.
// The animation writes transforms directly to the DOM (no per-frame React
// state) so it never triggers a render loop. Reduced motion → the accessible
// list view.
export function SpiralGallery() {
  const [mode, setMode] = useState<"spiral" | "list">("spiral");
  const cardEls = useRef<(HTMLDivElement | null)[]>([]);
  const rot = useRef(0);
  const target = useRef(0);
  const activeIdx = useRef(0);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const reduced = useRef(false);
  const frontLink = useRef<HTMLAnchorElement>(null);

  const n = MODELS.length;
  const step = (Math.PI * 2) / n;
  // fixed per-card vertical band + tilt so the cloud looks scattered, not ringed
  const yBand = MODELS.map((_, i) => ((i % 5) - 2) * 0.17 + (i * 0.05 - 0.15));
  const tilt = MODELS.map((_, i) => (i * 37) % 14 - 7);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) setMode("list");
  }, []);

  useEffect(() => {
    if (mode !== "spiral") return;
    let raf = 0;
    const radiusX = () => Math.min(360, window.innerWidth * 0.34);
    const radiusZ = 240;

    const loop = () => {
      if (!dragging.current && !reduced.current) target.current += 0.0018;
      rot.current += (target.current - rot.current) * 0.08;

      const RX = radiusX();
      const stageH = cardEls.current[0]?.parentElement?.clientHeight || 520;
      let frontIndex = 0;
      let frontZ = -Infinity;
      for (let i = 0; i < n; i++) {
        const el = cardEls.current[i];
        if (!el) continue;
        const theta = i * step + rot.current;
        const x = Math.sin(theta) * RX;
        const z = Math.cos(theta) * radiusZ;
        const depth = (z + radiusZ) / (2 * radiusZ); // 0..1
        const y = yBand[i] * stageH * 0.42 + Math.sin(theta * 1.5) * 18;
        const scale = 0.6 + depth * 0.5;
        el.style.transform =
          `translate(-50%, -50%) translate3d(${x}px, ${y}px, 0) ` +
          `rotateY(${-Math.sin(theta) * 26}deg) rotateZ(${tilt[i] * (0.4 + depth)}deg) scale(${scale})`;
        el.style.opacity = String(0.28 + depth * 0.72);
        el.style.zIndex = String(Math.round(depth * 100));
        el.style.filter = `blur(${(1 - depth) * 2.2}px)`;
        if (z > frontZ) {
          frontZ = z;
          frontIndex = i;
        }
      }
      if (frontIndex !== activeIdx.current) {
        cardEls.current[activeIdx.current]?.classList.remove("is-active");
        cardEls.current[frontIndex]?.classList.add("is-active");
        activeIdx.current = frontIndex;
        if (frontLink.current) {
          frontLink.current.textContent = `Explore “${MODELS[frontIndex].name}” in the pipeline →`;
          frontLink.current.dataset.target = MODELS[frontIndex].target;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mode, n, step]);

  const onDown = (e: React.PointerEvent) => {
    dragging.current = true;
    lastX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastX.current;
    lastX.current = e.clientX;
    target.current -= dx * 0.006;
  };
  const onUp = () => {
    dragging.current = false;
  };

  // Rotate a specific card to the front (shortest angular path).
  const bringToFront = (i: number) => {
    const desired = -i * step;
    const twoPi = Math.PI * 2;
    let delta = (desired - target.current) % twoPi;
    if (delta > Math.PI) delta -= twoPi;
    if (delta < -Math.PI) delta += twoPi;
    target.current += delta;
  };

  return (
    <section className="section" id="models">
      <div className="container">
        <Reveal as="p" className="eyebrow">
          The seven models from our paper
        </Reveal>
        <div className="sg-head">
          <Reveal as="h2" className="display-lg" delay={60}>
            Four voices. Three drawings.
          </Reveal>
          <div className="sg-toggle" role="tablist" aria-label="Gallery view">
            <button
              role="tab"
              aria-selected={mode === "spiral"}
              className={mode === "spiral" ? "is-on" : ""}
              onClick={() => setMode("spiral")}
              disabled={reduced.current}
            >
              spiral
            </button>
            <span className="sg-dot" aria-hidden="true">•</span>
            <button
              role="tab"
              aria-selected={mode === "list"}
              className={mode === "list" ? "is-on" : ""}
              onClick={() => setMode("list")}
            >
              list
            </button>
          </div>
        </div>

        {mode === "spiral" ? (
          <div className="sg-spiral">
            <div
              className="sg-stage"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={onUp}
              role="group"
              aria-label="Floating model gallery - drag to spin, click a card to focus it"
            >
              {MODELS.map((m, i) => {
                // Pre-computed initial scatter (rot = 0) so the layout is correct
                // on first paint even before the animation loop runs.
                const th = i * step;
                const z0 = Math.cos(th) * 240;
                const d0 = (z0 + 240) / 480;
                const x0 = Math.sin(th) * 300;
                const y0 = yBand[i] * 220 + Math.sin(th * 1.5) * 18;
                const s0 = 0.6 + d0 * 0.5;
                const initTransform =
                  `translate(-50%, -50%) translate3d(${x0}px, ${y0}px, 0) ` +
                  `rotateY(${-Math.sin(th) * 26}deg) rotateZ(${tilt[i] * (0.4 + d0)}deg) scale(${s0})`;
                return (
                <div
                  key={m.name}
                  ref={(el) => { cardEls.current[i] = el; }}
                  className={`sg-card ${m.cls} ${i === 0 ? "is-active" : ""}`}
                  onClick={() => bringToFront(i)}
                  style={{ transform: initTransform, opacity: 0.28 + d0 * 0.72, zIndex: Math.round(d0 * 100) }}
                >
                  <div className="sg-card__type">{m.type}</div>
                  <div className="sg-card__name">{m.name}</div>
                  <div className="sg-card__metric">{m.metric}</div>
                  <p className="sg-card__blurb">{m.blurb}</p>
                </div>
                );
              })}
            </div>
            <div className="sg-controls">
              <a
                ref={frontLink}
                className="sg-frontlink"
                href="#how"
                data-target="how"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToId((frontLink.current?.dataset.target as string) || "how");
                }}
              >
                Explore “AHH” in the pipeline →
              </a>
              <span className="sg-hint">drag to spin · click a card to focus</span>
            </div>
          </div>
        ) : (
          <div className="grid grid--3" style={{ marginTop: "28px" }}>
            {MODELS.map((m, i) => (
              <Reveal key={m.name} className={`tile sg-tile ${m.cls}`} delay={i * 50}>
                <div className="sg-card__type">{m.type}</div>
                <h3 style={{ margin: "0.3em 0" }}>{m.name}</h3>
                <div className="stat" style={{ fontSize: "clamp(1.6rem,3vw,2.4rem)" }}>{m.metric}</div>
                <p className="muted" style={{ marginTop: "0.4em" }}>{m.blurb}</p>
                <button className="sg-jump" onClick={() => scrollToId(m.target)}>
                  See the pipeline →
                </button>
              </Reveal>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .sg-head { display:flex; align-items:flex-end; justify-content:space-between;
          gap:20px; flex-wrap:wrap; margin-bottom:8px; }
        .sg-toggle { display:flex; align-items:center; gap:12px; font-family:var(--font-body);
          font-size:1.1rem; }
        .sg-toggle button { background:none; border:none; font:inherit; color:var(--ink-soft);
          padding:4px 2px; opacity:0.55; transition:opacity .2s; cursor:pointer; }
        .sg-toggle button.is-on { opacity:1; font-weight:700; color:var(--ink);
          text-decoration:underline; text-underline-offset:5px; }
        .sg-toggle button:disabled { opacity:0.25; cursor:not-allowed; }
        .sg-dot { color:var(--tangerine); }

        .sg-spiral { margin-top:20px; }
        .sg-stage { position:relative; height:min(66vh,560px); perspective:1500px;
          touch-action:pan-y; cursor:grab; }
        .sg-stage:active { cursor:grabbing; }
        .sg-card {
          position:absolute; left:50%; top:50%; width:min(300px,70vw);
          border-radius:var(--radius-lg); padding:24px; color:#fff;
          box-shadow:0 30px 70px rgba(0,0,0,0.28); will-change:transform,opacity,filter;
          user-select:none; cursor:pointer;
          transition:box-shadow .3s ease;
        }
        .sg-card.is-active { box-shadow:0 36px 90px rgba(0,0,0,0.4), 0 0 0 2px rgba(255,255,255,0.35); }
        .sg-card__type { font-size:0.72rem; text-transform:uppercase; letter-spacing:0.12em; opacity:0.85; }
        .sg-card__name { font-family:var(--font-display); font-weight:900;
          font-size:clamp(1.6rem,3vw,2.2rem); line-height:1; margin:0.35em 0 0.15em; letter-spacing:-0.02em; }
        .sg-card__metric { font-family:var(--font-display); font-weight:900;
          font-size:clamp(1.8rem,3.4vw,2.6rem); letter-spacing:-0.03em; }
        .sg-card__blurb { font-size:0.9rem; opacity:0.92; margin-top:0.5em; }

        .g--cobalt { background:var(--cobalt); }
        .g--sky { background:var(--sky); color:var(--ink); }
        .g--violet { background:var(--violet); }
        .g--ink { background:var(--ink); color:var(--cream); }
        .g--marigold { background:var(--marigold); color:var(--ink); }
        .g--tangerine { background:var(--tangerine); }
        .g--grass { background:var(--grass); }
        .sg-tile.g--sky, .sg-tile.g--marigold { color:var(--ink); }

        .sg-controls { display:flex; align-items:center; justify-content:space-between;
          gap:16px; margin-top:24px; flex-wrap:wrap; }
        .sg-frontlink { font-family:var(--font-body); font-weight:700; font-size:1.05rem;
          color:var(--ink); text-decoration:none; border-bottom:2px solid var(--cobalt);
          padding-bottom:2px; cursor:pointer; }
        .sg-frontlink:hover { color:var(--cobalt); }
        .sg-hint { font-size:0.85rem; color:var(--ink-soft); }
        .sg-jump { display:inline-block; margin-top:0.8em; background:none; border:none;
          font-family:var(--font-body); font-weight:700; font-size:0.9rem; color:inherit;
          border-bottom:2px solid currentColor; padding:0 0 2px; cursor:pointer; opacity:0.85; }
        .sg-jump:hover { opacity:1; }
      `}</style>
    </section>
  );
}
