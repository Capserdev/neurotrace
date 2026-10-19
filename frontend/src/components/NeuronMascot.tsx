import { useEffect, useRef } from "react";

// The scroll "mascot": a synapse spark that travels down a fixed axon rail as
// the page scrolls, pulsing when it passes a section node. Replaces the phoenix
// idea with something on-theme for a neuroscience project. Hidden on reduced
// motion and small screens.
export function NeuronMascot() {
  const spark = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || window.innerWidth < 900) return;

    let raf = 0;
    const update = () => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
      const railEl = rail.current;
      const sparkEl = spark.current;
      if (railEl && sparkEl) {
        const h = railEl.offsetHeight;
        sparkEl.style.transform = `translateY(${progress * h}px)`;
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="mascot" aria-hidden="true">
      <div className="mascot__rail" ref={rail}>
        <div className="mascot__spark" ref={spark}>
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
            <circle cx="17" cy="17" r="7" fill="var(--cobalt)" />
            <circle cx="17" cy="17" r="12" stroke="var(--cobalt)" strokeWidth="1.5" opacity="0.5" />
            <g stroke="var(--violet)" strokeWidth="1.5" strokeLinecap="round">
              <path d="M17 5 L17 0" />
              <path d="M17 29 L17 34" />
              <path d="M5 17 L0 17" />
              <path d="M29 17 L34 17" />
            </g>
          </svg>
        </div>
      </div>
      <style>{`
        .mascot {
          position: fixed; left: 30px; top: 12vh; bottom: 12vh;
          width: 34px; z-index: var(--z-mascot); pointer-events: none;
          display: flex; justify-content: center;
        }
        .mascot__rail {
          position: relative; width: 2px; height: 100%;
          background: linear-gradient(var(--ink), transparent 92%);
          opacity: 0.18; border-radius: 2px;
        }
        .mascot__spark {
          position: absolute; left: 50%; top: 0;
          margin-left: -17px; margin-top: -17px;
          filter: drop-shadow(0 0 10px rgba(62,107,224,0.55));
          animation: sparkPulse 1.8s ease-in-out infinite;
        }
        @keyframes sparkPulse {
          0%,100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
        @media (max-width: 1100px) { .mascot { display: none; } }
      `}</style>
    </div>
  );
}
