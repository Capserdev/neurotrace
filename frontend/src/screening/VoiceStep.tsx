import { useEffect, useRef, useState } from "react";
import { predictVoice, type RecordingType, type VoiceResult } from "../lib/api";
import { blobToWav } from "../lib/wav";
import { PASSAGE, RECORDINGS } from "./content";
import { ResultChip } from "./ResultChip";

type RecState = "idle" | "recording" | "analyzing";

function Recorder({
  type,
  label,
  how,
  minSec,
  maxSec,
  result,
  onResult,
}: {
  type: RecordingType;
  label: string;
  how: string;
  minSec: number;
  maxSec: number;
  result?: VoiceResult;
  onResult: (r: VoiceResult | undefined) => void;
}) {
  const [state, setState] = useState<RecState>("idle");
  const [secs, setSecs] = useState(0);
  const [level, setLevel] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const raf = useRef(0);
  const started = useRef(0);

  const teardown = () => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    ctx.current?.close();
    stream.current = null;
    ctx.current = null;
    setLevel(0);
  };

  useEffect(() => teardown, []);

  const analyze = async (file: File) => {
    setState("analyzing");
    setErr(null);
    try {
      onResult(await predictVoice(file, type));
    } catch (e: any) {
      setErr(e.message || "Analysis failed");
    } finally {
      setState("idle");
    }
  };

  const start = async () => {
    setErr(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        // Raw signal: browser noise suppression and AGC distort jitter/shimmer.
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch {
      setErr("Microphone access was blocked. Allow the microphone in your browser, or skip the voice step.");
      return;
    }
    // Live input level meter.
    ctx.current = new AudioContext();
    const analyser = ctx.current.createAnalyser();
    analyser.fftSize = 1024;
    ctx.current.createMediaStreamSource(stream.current).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 6));
      const s = (performance.now() - started.current) / 1000;
      setSecs(s);
      if (s >= maxSec) stop();
      else raf.current = requestAnimationFrame(tick);
    };

    const chunks: Blob[] = [];
    const mr = new MediaRecorder(stream.current);
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = async () => {
      teardown();
      const dur = (performance.now() - started.current) / 1000;
      if (dur < minSec) {
        setState("idle");
        setErr(`That was only ${dur.toFixed(1)} s. Please record at least ${minSec} seconds.`);
        return;
      }
      try {
        analyze(await blobToWav(new Blob(chunks, { type: mr.mimeType }), `${type}.wav`));
      } catch {
        setState("idle");
        setErr("Could not process the recording. Please try again.");
      }
    };
    rec.current = mr;
    started.current = performance.now();
    mr.start();
    setState("recording");
    raf.current = requestAnimationFrame(tick);
  };

  const stop = () => {
    if (rec.current?.state === "recording") rec.current.stop();
  };

  return (
    <div className="scr-card">
      <h3>{label}</h3>
      <p className="muted">{how}</p>
      {type === "text" && <blockquote className="passage">{PASSAGE}</blockquote>}
      <div className="scr-actions">
        {state !== "recording" ? (
          <button className="btn" disabled={state === "analyzing"} onClick={start}>
            {state === "analyzing" ? "Analyzing…" : result ? "Record again" : "Start recording"}
          </button>
        ) : (
          <button className="btn btn--rec" onClick={stop}>
            Stop · {secs.toFixed(1)} s
          </button>
        )}
        <label className="scr-upload">
          <input
            type="file"
            accept="audio/wav,.wav"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) analyze(f); e.target.value = ""; }}
          />
          or upload a .wav recording
        </label>
      </div>
      {state === "recording" && (
        <div className="meter" aria-hidden="true"><div className="meter__fill" style={{ width: `${level * 100}%` }} /></div>
      )}
      {err && <p className="scr-err" role="alert">{err}</p>}
      {result && <ResultChip p={result.pd_probability} threshold={result.threshold} />}
    </div>
  );
}

export function VoiceStep({
  results,
  onResult,
}: {
  results: Partial<Record<RecordingType, VoiceResult>>;
  onResult: (type: RecordingType, r: VoiceResult | undefined) => void;
}) {
  return (
    <div className="scr-stack">
      <p className="lead">
        Find a quiet room and hold your device about 20–30 cm (8–12 in) from your mouth. Recordings are analyzed and then
        discarded; nothing is saved.
      </p>
      {RECORDINGS.map((r) => (
        <Recorder key={r.type} {...r} result={results[r.type]} onResult={(v) => onResult(r.type, v)} />
      ))}
    </div>
  );
}
