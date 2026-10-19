// One test's outcome: a bar of P(PD) with the model's decision threshold
// marked, plus a plain-language label.
export function ResultChip({ p, threshold }: { p: number; threshold: number }) {
  const flagged = p >= threshold;
  return (
    <div className={`chip ${flagged ? "chip--flag" : "chip--ok"}`}>
      <div className="chip__label">
        {flagged ? "Parkinson’s-like pattern" : "Typical pattern"}
        <span>{Math.round(p * 100)}%</span>
      </div>
      <div className="chip__track" aria-hidden="true">
        <div className="chip__fill" style={{ width: `${p * 100}%` }} />
        <div className="chip__thr" style={{ left: `${threshold * 100}%` }} title={`Threshold ${threshold}`} />
      </div>
    </div>
  );
}
