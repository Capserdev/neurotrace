import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { GradientPlane } from "../three/GradientPlane";
import { Spiral } from "../three/Spiral";

// Hero: WebGL iridescent gradient + the pipeline spiral behind bold display type.
// The spiral doubles as the entry point to the handwriting demo further down.
export function Hero() {
  return (
    <header className="hero">
      <div className="hero__canvas" aria-hidden="true">
        <Canvas
          camera={{ position: [0, 0, 3], fov: 50 }}
          gl={{ antialias: true, alpha: false }}
          dpr={[1, 1.8]}
        >
          <Suspense fallback={null}>
            <GradientPlane />
            <group position={[1.15, -0.1, 0]}>
              <Spiral color="#2f2a26" tremor={0.035} turns={5} />
            </group>
          </Suspense>
        </Canvas>
      </div>

      <div className="hero__content container">
        <p className="eyebrow reveal is-in">
          Congressional App Challenge · Digital Biomarkers
        </p>
        <h1 className="hero__title display-xl">
          Five minutes of <em>voice</em> and <em>handwriting.</em>
          <br />A window into Parkinsonian disease.
        </h1>
        <p className="lead hero__lead">
          An open-source screening app that looks for early signs of Parkinson's
          disease in how you draw and how you speak, built on our published research.
        </p>
        <div className="hero__cta">
          <a className="btn" href="/screening">
            Start screening
          </a>
          <a className="btn btn--ghost" href="#code">
            View the code
          </a>
        </div>
      </div>

      <style>{`
        .hero {
          position: relative; min-height: 100vh; display: flex;
          align-items: flex-start; overflow: hidden;
        }
        .hero__canvas { position: absolute; inset: 0; z-index: 0; }
        .hero__content { position: relative; z-index: 2;
          padding: clamp(118px, 19vh, 200px) clamp(20px,5vw,72px) 90px; }
        .hero__title { margin: 0.3em 0 0.5em; max-width: 16ch; }
        .hero__title em {
          font-family: var(--font-display); font-style: italic; font-weight: 800;
          letter-spacing: -0.02em;
        }
        .hero__lead { margin-bottom: 2em; }
        .hero__cta { display: flex; gap: 14px; flex-wrap: wrap; }
        .hero__scroll {
          position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%);
          z-index: 2; display: flex; flex-direction: column; align-items: center;
          gap: 8px; font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase;
          color: var(--ink-soft);
        }
        .hero__scroll-line {
          width: 1px; height: 42px;
          background: linear-gradient(var(--ink), transparent);
          animation: scrollpulse 1.8s ease-in-out infinite;
        }
        @keyframes scrollpulse { 0%,100%{opacity:.3} 50%{opacity:1} }
        @media (prefers-reduced-motion: reduce) {
          .hero__scroll-line { animation: none; }
        }
      `}</style>
    </header>
  );
}
