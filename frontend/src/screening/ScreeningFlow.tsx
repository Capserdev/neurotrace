import { useEffect, useState } from "react";
import {
  checkHealth,
  type DrawingResult,
  type DrawingType,
  type RecordingType,
  type VoiceResult,
} from "../lib/api";
import { SURVEY } from "./content";
import { DrawStep } from "./DrawStep";
import { ResultStep } from "./ResultStep";
import { SurveyStep, surveyScore } from "./SurveyStep";
import { VoiceStep } from "./VoiceStep";
import "./screening.css";

const STEPS = ["Survey", "Drawings", "Voice", "Result"] as const;

export function ScreeningFlow() {
  const [step, setStep] = useState(0);
  const [server, setServer] = useState<"waking" | "ok" | "down">("waking");
  const [answers, setAnswers] = useState<(boolean | null)[]>(SURVEY.map(() => null));
  const [drawings, setDrawings] = useState<Partial<Record<DrawingType, DrawingResult>>>({});
  const [voice, setVoice] = useState<Partial<Record<RecordingType, VoiceResult>>>({});

  // The free Space sleeps when idle; the first request wakes it (~30-60 s).
  useEffect(() => {
    let alive = true;
    const ping = (tries: number) =>
      checkHealth()
        .then(() => alive && setServer("ok"))
        .catch(() => {
          if (!alive) return;
          if (tries > 0) setTimeout(() => ping(tries - 1), 5000);
          else setServer("down");
        });
    ping(18);
    return () => {
      alive = false;
    };
  }, []);

  const survey = surveyScore(answers);
  const testsDone = Object.keys(drawings).length + Object.keys(voice).length + (survey !== undefined ? 1 : 0);

  const go = (n: number) => {
    setStep(n);
    document.getElementById("screen")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const restart = () => {
    setAnswers(SURVEY.map(() => null));
    setDrawings({});
    setVoice({});
    go(0);
  };

  return (
    <section className="section scr" id="screen">
      <div className="container scr__container">
        <ol className="stepper no-print" aria-label="Screening steps">
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? "is-on" : i < step ? "is-done" : ""} aria-current={i === step ? "step" : undefined}>
              <span className="stepper__n">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>

        {server !== "ok" && step < 3 && (
          <p className={`scr-server scr-server--${server} no-print`} role="status">
            {server === "waking"
              ? "Waking up the model server. This can take up to a minute the first time."
              : "The model server is not responding right now. Please reload the page in a minute."}
          </p>
        )}

        {step === 0 && <SurveyStep answers={answers} onChange={setAnswers} />}
        {step === 1 && (
          <DrawStep results={drawings} onResult={(t, r) => setDrawings((d) => {
            const next = { ...d };
            if (r) next[t] = r; else delete next[t];
            return next;
          })} />
        )}
        {step === 2 && (
          <VoiceStep results={voice} onResult={(t, r) => setVoice((v) => {
            const next = { ...v };
            if (r) next[t] = r; else delete next[t];
            return next;
          })} />
        )}
        {step === 3 && <ResultStep drawings={drawings} voice={voice} survey={survey} onRestart={restart} />}

        {step < 3 && (
          <div className="scr-nav no-print">
            {step > 0 && <button className="btn btn--ghost" onClick={() => go(step - 1)}>Back</button>}
            {step < 2 && (
              <button className="btn" onClick={() => go(step + 1)}>
                {step === 0 && survey === undefined ? "Skip survey" : "Continue"}
              </button>
            )}
            {step === 2 && (
              <button className="btn" disabled={testsDone === 0} onClick={() => go(3)}>
                See my result
              </button>
            )}
            {step === 2 && testsDone === 0 && (
              <span className="muted">Complete at least one part to see a result.</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
