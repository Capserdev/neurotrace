import { useRef, useState } from "react";
import { predictDrawing, type DrawingResult, type DrawingType } from "../lib/api";
import { DRAWINGS, MEANDER_TEMPLATE } from "./content";
import { DrawPad, type DrawPadHandle } from "./DrawPad";
import { ResultChip } from "./ResultChip";

// Small reference sketches so people know what each shape looks like.
function Example({ type }: { type: DrawingType }) {
  let d = "";
  if (type === "spiral") {
    const pts: string[] = [];
    for (let t = 0; t <= Math.PI * 8; t += 0.15) {
      const r = 3 + t * 3.4;
      pts.push(`${(50 + r * Math.cos(t)).toFixed(1)},${(50 + r * Math.sin(t)).toFixed(1)}`);
    }
    d = `M${pts.join(" L")}`;
  } else if (type === "wave") {
    const pts: string[] = [];
    for (let x = 4; x <= 96; x += 1) pts.push(`${x},${(50 + 18 * Math.sin((x / 92) * Math.PI * 6)).toFixed(1)}`);
    d = `M${pts.join(" L")}`;
  } else {
    d = "M" + MEANDER_TEMPLATE.map(([x, y]) => `${x * 100},${y * 100}`).join(" L");
  }
  return (
    <svg viewBox="0 0 100 100" className="draw-example" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DrawCard({
  type,
  label,
  how,
  result,
  onResult,
}: {
  type: DrawingType;
  label: string;
  how: string;
  result?: DrawingResult;
  onResult: (r: DrawingResult | undefined) => void;
}) {
  const pad = useRef<DrawPadHandle>(null);
  const [empty, setEmpty] = useState(true);
  // Meander is traced in blue pen over a printed template, as in its dataset.
  // Stroke widths were tuned so clean vs. tremulous synthetic drawings land on
  // opposite sides of each model's threshold.
  const padProps =
    type === "meander"
      ? { template: MEANDER_TEMPLATE, ink: "#2b3fc8", width: 6 }
      : { width: type === "wave" ? 6 : 8 };
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const analyze = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      onResult(await predictDrawing(file, type));
    } catch (e: any) {
      setErr(e.message || "Analysis failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="scr-card">
      <div className="scr-card__head">
        <div>
          <h3>{label}</h3>
          <p className="muted">{how}</p>
        </div>
        <Example type={type} />
      </div>
      <DrawPad ref={pad} onChange={setEmpty} {...padProps} />
      <div className="scr-actions">
        <button
          className="btn"
          disabled={empty || busy}
          onClick={async () => analyze(await pad.current!.toFile(`${type}.png`))}
        >
          {busy ? "Analyzing…" : "Analyze drawing"}
        </button>
        <button className="btn btn--ghost" disabled={busy} onClick={() => { pad.current!.clear(); onResult(undefined); }}>
          Clear
        </button>
        <label className="scr-upload">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => { analyze(e.target.files?.[0] ?? null); e.target.value = ""; }}
          />
          or upload a photo of a paper drawing (crop it close)
        </label>
      </div>
      {err && <p className="scr-err" role="alert">{err}</p>}
      {result && <ResultChip p={result.pd_probability} threshold={result.threshold} />}
    </div>
  );
}

export function DrawStep({
  results,
  onResult,
}: {
  results: Partial<Record<DrawingType, DrawingResult>>;
  onResult: (type: DrawingType, r: DrawingResult | undefined) => void;
}) {
  return (
    <div className="scr-stack">
      <p className="lead">
        Draw each shape with your finger, a stylus, or a mouse, or draw it on paper and upload a photo.
        Do as many as you can; each one you skip just leaves it out of the result.
      </p>
      {DRAWINGS.map((d) => (
        <DrawCard key={d.type} {...d} result={results[d.type]} onResult={(r) => onResult(d.type, r)} />
      ))}
    </div>
  );
}
