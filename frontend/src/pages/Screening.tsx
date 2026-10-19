import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { Reveal } from "../components/Reveal";
import { ScreeningFlow } from "../screening/ScreeningFlow";

const WHY = [
  { t: "Survey", d: "Eight yes/no questions about early signs like resting tremor, smaller handwriting, and loss of smell. It counts for 25% of the combined score.", cls: "tile--pink" },
  { t: "Drawings", d: "Spiral, wave, and meander. Tremor and stiffness show up as wobble and uneven strokes. Each drawing is scored by an EfficientNetV2 network trained on real patient drawings (40%).", cls: "tile--marigold" },
  { t: "Voice", d: "A held “ahh” and a short read passage. Parkinson’s changes pitch stability, breathiness, and loudness, which we measure with 36 Praat acoustic features (35%).", cls: "tile--cobalt" },
];

export function Screening() {
  return (
    <>
      <PageHeader
        eyebrow="Screening"
        title="Five minutes. A microphone and a pen."
        intro="Answer a few questions, draw three shapes, and say a few words. NeuroTrace combines all three into one result you can save as a PDF and bring to a doctor. Every part is optional; do what you can."
      />

      <ScreeningFlow />

      <section className="section" style={{ background: "#0b0a10", color: "var(--cream)" }}>
        <div className="container">
          <Reveal as="p" className="eyebrow" style={{ color: "var(--sky)" }}>What each part measures</Reveal>
          <Reveal as="h2" className="display-lg" delay={60} style={{ marginBottom: "0.6em" }}>Three signals, one score.</Reveal>
          <div className="grid grid--3">
            {WHY.map((x, i) => (
              <Reveal key={x.t} className={`tile ${x.cls}`} delay={i * 70}>
                <h3>{x.t}</h3>
                <p style={{ opacity: 0.94 }}>{x.d}</p>
              </Reveal>
            ))}
          </div>
          <Reveal style={{ marginTop: "2em" }}>
            <Link className="btn btn--ghost" to="/method" style={{ color: "var(--cream)", boxShadow: "inset 0 0 0 2px var(--cream)" }}>
              See the research
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal className="tile tile--pink">
            <h3>Please read</h3>
            <p style={{ marginTop: "0.5em" }}>
              NeuroTrace is a research prototype built for the Congressional App Challenge on public,
              de-identified datasets. It is a screening aid, not a diagnosis, and it does not replace a
              clinical evaluation. Drawings and recordings are analyzed in memory and discarded; nothing is
              stored. A high result means "worth asking a movement-disorder specialist," nothing more.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
