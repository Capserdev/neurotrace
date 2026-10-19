import { SURVEY } from "./content";

// answers[i]: true = yes, false = no, null = unanswered.
export function SurveyStep({
  answers,
  onChange,
}: {
  answers: (boolean | null)[];
  onChange: (answers: (boolean | null)[]) => void;
}) {
  const set = (i: number, v: boolean) => onChange(answers.map((a, j) => (j === i ? v : a)));
  return (
    <div className="scr-stack">
      <p className="lead">Eight quick questions about common early signs. Answer for the last few months.</p>
      <ol className="survey">
        {SURVEY.map((q, i) => (
          <li key={i} className="survey__item">
            <span>{q}</span>
            <div className="survey__btns" role="radiogroup" aria-label={q}>
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  role="radio"
                  aria-checked={answers[i] === v}
                  className={`pill ${answers[i] === v ? "pill--on" : ""}`}
                  onClick={() => set(i, v)}
                >
                  {v ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function surveyScore(answers: (boolean | null)[]): number | undefined {
  if (answers.some((a) => a === null)) return undefined;
  return answers.filter(Boolean).length / answers.length;
}
