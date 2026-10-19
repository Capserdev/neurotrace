import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  predictEnsemble,
  type DrawingResult,
  type DrawingType,
  type EnsembleResult,
  type RecordingType,
  type VoiceResult,
} from "../lib/api";
import { ACCURACY, BAND_COPY, DISCLAIMER, DRAWINGS, RECORDINGS, SURVEY } from "./content";

const PART_LABEL = { handwriting: "Handwriting", voice: "Voice", survey: "Symptom survey" } as const;

export function ResultStep({
  drawings,
  voice,
  survey,
  onRestart,
}: {
  drawings: Partial<Record<DrawingType, DrawingResult>>;
  voice: Partial<Record<RecordingType, VoiceResult>>;
  survey?: number;
  onRestart: () => void;
}) {
  const [res, setRes] = useState<EnsembleResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const pick = <K extends string>(r: Partial<Record<K, { pd_probability: number }>>) => {
      const out: Partial<Record<K, number>> = {};
      for (const k in r) if (r[k]) out[k] = r[k]!.pd_probability;
      return Object.keys(out).length ? out : undefined;
    };
    predictEnsemble({ drawings: pick(drawings), voice: pick(voice), survey })
      .then(setRes)
      .catch((e) => setErr(e.message));
  }, [drawings, voice, survey]);

  if (err) return <p className="scr-err" role="alert">{err}</p>;
  if (!res) return <p className="lead">Combining your results…</p>;

  const band = BAND_COPY[res.band];
  const totalWeight = Object.values(res.weights_used).reduce((a, b) => a + (b ?? 0), 0);
  const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const rows: { name: string; p: number; thr: number; acc: string }[] = [
    ...DRAWINGS.filter((d) => drawings[d.type]).map((d) => ({
      name: `${d.label} drawing`,
      p: drawings[d.type]!.pd_probability,
      thr: drawings[d.type]!.threshold,
      acc: ACCURACY[d.type],
    })),
    ...RECORDINGS.filter((r) => voice[r.type]).map((r) => ({
      name: `Voice: ${r.label}`,
      p: voice[r.type]!.pd_probability,
      thr: voice[r.type]!.threshold,
      acc: ACCURACY[r.type],
    })),
  ];

  const report = (
      <article className="report">
        <header className="report__head">
          <div>
            <p className="eyebrow">NeuroTrace screening report</p>
            <p className="muted">{date}</p>
          </div>
          <div className={`band band--${res.band}`}>
            <span className="band__label">Parkinson’s-like patterns</span>
            <span className="band__title">{band.title}</span>
            <span className="band__score">Combined score {Math.round(res.pd_score * 100)} / 100</span>
          </div>
        </header>

        <p className="report__body">{band.body}</p>

        <h3 className="report__h">How each part contributed</h3>
        <ul className="report__parts">
          {(Object.keys(res.parts) as (keyof typeof PART_LABEL)[]).map((k) => (
            <li key={k}>
              <span>{PART_LABEL[k]}</span>
              <span>{Math.round(res.parts[k]! * 100)} / 100 · weight {Math.round((res.weights_used[k]! / totalWeight) * 100)}%</span>
            </li>
          ))}
        </ul>

        {rows.length > 0 && (
          <>
            <h3 className="report__h">Individual tests</h3>
            <table className="report__table">
              <thead>
                <tr><th>Test</th><th>Model score</th><th>Flag at</th><th>Result</th><th>Model accuracy*</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>{Math.round(r.p * 100)}%</td>
                    <td>{Math.round(r.thr * 100)}%</td>
                    <td>{r.p >= r.thr ? "Parkinson’s-like" : "Typical"}</td>
                    <td>{r.acc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {survey !== undefined && (
          <p className="muted report__small">
            Symptom survey: {Math.round(survey * SURVEY.length)} of {SURVEY.length} early signs reported.
          </p>
        )}
        <p className="muted report__small">
          *Accuracy on people the models never saw during training: handwriting from the NeuroTrace paper’s
          held-out test sets, voice from subject-wise cross-validation.
        </p>
        <p className="disclaimer report__disclaimer">{DISCLAIMER}</p>
      </article>
  );

  return (
    <div className="scr-stack">
      {report}
      {/* Print copy lives directly under <body> so page layout can't offset it. */}
      {createPortal(<div className="print-root">{report}</div>, document.body)}

      <div className="scr-actions no-print">
        <button className="btn" onClick={() => window.print()}>Download report (PDF)</button>
        <button className="btn btn--ghost" onClick={onRestart}>Start over</button>
      </div>
      <p className="muted no-print report__small">
        In the print dialog, choose “Save as PDF” as the destination.
      </p>
    </div>
  );
}
