import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE, checkHealth, predictDrawing, type DrawingResult, type DrawingType } from "../lib/api";
import { Reveal } from "../components/Reveal";
import { ResultChip } from "../screening/ResultChip";
import "../screening/screening.css";

// Quick single-drawing demo on the home page. The full screening (survey,
// drawings, voice, combined result) lives at /screening.
export function Demo() {
  const [health, setHealth] = useState<"loading" | "ok" | "down">("loading");

  const [drawType, setDrawType] = useState<DrawingType>("spiral");
  const [drawResult, setDrawResult] = useState<DrawingResult | null>(null);
  const [drawBusy, setDrawBusy] = useState(false);
  const [drawErr, setDrawErr] = useState<string | null>(null);

  useEffect(() => {
    checkHealth()
      .then(() => setHealth("ok"))
      .catch(() => setHealth("down"));
  }, []);

  const onDraw = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDrawBusy(true);
    setDrawErr(null);
    try {
      const res = await predictDrawing(file, drawType);
      setDrawResult(res);
    } catch (err: any) {
      setDrawErr(err.message || "Failed");
    } finally {
      setDrawBusy(false);
    }
  };

  return (
    <section className="section" id="demo">
      <div className="container">
        <Reveal as="p" className="eyebrow">Try it live</Reveal>
        <Reveal as="h2" className="display-lg" delay={60} style={{ marginBottom: "0.5em" }}>
          Upload a drawing.
        </Reveal>
        <Reveal as="p" className="lead" delay={90} style={{ maxWidth: "60ch", marginBottom: "0.6em" }}>
          Draw a spiral, wave, or meander, photograph it, and the handwriting model
          scores it in real time. For the full screening with voice, survey, and a
          printable report, use the guided screening.
        </Reveal>

        <Reveal className={`health health--${health}`}>
          <span className="health__dot" />
          {health === "loading" && "Checking model server…"}
          {health === "ok" && "Model server online — models ready"}
          {health === "down" && (
            <>
              Model server not reachable at <code>{API_BASE || "same origin"}</code>. It may be
              waking up (free tier sleeps after inactivity) — reload in ~30s.
            </>
          )}
        </Reveal>

        <div className="demo-single" style={{ marginTop: "28px" }}>
          <Reveal className="tile tile--marigold demo-card">
            <h3>Handwriting</h3>
            <label className="demo-label" htmlFor="draw-type">Drawing type</label>
            <select
              id="draw-type"
              value={drawType}
              onChange={(e) => setDrawType(e.target.value as any)}
              className="demo-select"
            >
              <option value="spiral">Spiral</option>
              <option value="meander">Meander</option>
              <option value="wave">Wave</option>
            </select>
            <label className="demo-file">
              <input type="file" accept="image/*" onChange={onDraw} />
              <span>{drawBusy ? "Analyzing…" : "Choose a drawing image"}</span>
            </label>
            {drawErr && <p className="demo-err">{drawErr}</p>}
            {drawResult && (
              <div className="demo-result">
                <div className="demo-result__name">{drawResult.drawing_type}</div>
                <ResultChip p={drawResult.pd_probability} threshold={drawResult.threshold} />
              </div>
            )}
          </Reveal>
        </div>

        <Reveal style={{ marginTop: "24px" }}>
          <Link className="btn" to="/screening">Start the full screening</Link>
        </Reveal>

        <p className="disclaimer" style={{ marginTop: "28px" }}>
          Files are processed in memory and discarded immediately after inference -
          never stored, logged, or shared. Research prototype; do not upload real
          patient data. Not a medical diagnosis.
        </p>
      </div>

      <style>{`
        .health {
          display:flex;align-items:flex-start;gap:10px;margin-top:6px;
          padding:12px 18px;border-radius:14px;font-size:0.9rem;line-height:1.5;
          background:rgba(20,17,15,0.06);max-width:640px;
        }
        .health code{background:rgba(0,0,0,0.12);padding:1px 6px;border-radius:6px;font-size:0.85em}
        .health__dot{width:10px;height:10px;border-radius:999px;background:var(--marigold);margin-top:6px;flex-shrink:0}
        .health--ok .health__dot{background:var(--grass)}
        .health--down .health__dot{background:var(--tangerine)}
        .demo-single{max-width:520px}
        .demo-card h3{margin-bottom:0.4em}
        .demo-label{display:block;font-size:0.8rem;text-transform:uppercase;
          letter-spacing:0.12em;opacity:0.85;margin:0.6em 0 0.3em}
        .demo-select{
          width:100%;padding:0.7em 0.9em;border-radius:12px;border:none;
          font-family:var(--font-body);font-size:1rem;background:rgba(255,255,255,0.92);
          color:var(--ink);
        }
        .demo-file{
          display:flex;align-items:center;justify-content:center;margin-top:14px;
          padding:1.1em;border-radius:14px;border:2px dashed rgba(255,255,255,0.6);
          cursor:pointer;text-align:center;font-weight:600;
        }
        .demo-file input{display:none}
        .demo-err{margin-top:12px;background:rgba(238,108,52,0.18);
          padding:10px 14px;border-radius:10px;font-size:0.85rem}
        .demo-result{margin-top:16px;background:rgba(255,255,255,0.16);
          padding:14px;border-radius:14px}
        .demo-result__name{font-weight:700;margin-bottom:8px;font-size:0.9rem}
        .probs{display:flex;flex-direction:column;gap:8px}
        .prob__head{display:flex;justify-content:space-between;font-size:0.82rem;
          margin-bottom:3px;font-variant-numeric:tabular-nums}
        .prob__track{height:8px;border-radius:999px;background:rgba(0,0,0,0.18);overflow:hidden}
        .prob__fill{height:100%;border-radius:999px;transition:width .6s cubic-bezier(.16,1,.3,1)}
      `}</style>
    </section>
  );
}
