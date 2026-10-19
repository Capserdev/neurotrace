import { Reveal } from "../components/Reveal";

const REPO = "https://github.com/Capserdev/neurotrace";

export function Problem() {
  return (
    <section className="section" id="problem">
      <div className="container">
        <Reveal as="p" className="eyebrow">
          The problem
        </Reveal>
        <Reveal as="h2" className="display-lg" delay={60}>
          Atypical parkinsonism is hard to catch early - and specialist access is
          scarce.
        </Reveal>
        <Reveal as="p" className="lead" delay={120} style={{ marginTop: "1.2em", maxWidth: "60ch" }}>
          Parkinson's disease, PSP, and MSA share overlapping early symptoms, so
          diagnosis often takes years and requires a movement-disorder specialist
          most patients can't easily reach. Yet both speech and handwriting change
          early and measurably - long before a clinical exam would catch it.
          NeuroTrace turns those two signals into a quantitative screen.
        </Reveal>
      </div>
    </section>
  );
}

export function Science() {
  const stats: {
    figure: string;
    label: string;
    cls: string;
    span?: string;
  }[] = [
    {
      figure: "100%",
      label: "subject-level accuracy separating HC / PD / PSP / MSA across 83 subjects (recording-level 85.2%)",
      cls: "tile--cobalt",
      span: "col-span-2",
    },
    { figure: "90.9%", label: "PD vs. healthy from a single sustained “ahh”", cls: "tile--marigold" },
    { figure: "100%", label: "PD recall on the text model - zero missed PD cases", cls: "tile--tangerine" },
    { figure: "92.5%", label: "combined accuracy across 254 handwriting images", cls: "tile--grass" },
    { figure: "+10-20", label: "points over a from-scratch CNN baseline (transfer learning)", cls: "tile--violet" },
    {
      figure: "Subject-level splits",
      label: "no participant leakage · bootstrap 95% confidence intervals - real methodological rigor",
      cls: "tile--ink",
      span: "col-span-2",
    },
  ];
  return (
    <section className="section" id="science">
      <div className="container">
        <Reveal as="p" className="eyebrow">
          The science
        </Reveal>
        <Reveal as="h2" className="display-lg" delay={60} style={{ marginBottom: "0.8em" }}>
          Results from a peer-reviewed study - not a toy demo.
        </Reveal>
        <div className="grid grid--bento">
          {stats.map((s, i) => (
            <Reveal key={i} className={`tile ${s.cls} ${s.span || ""}`} delay={i * 60}>
              <div className="stat">{s.figure}</div>
              <p style={{ marginTop: "0.5em", opacity: 0.92 }}>{s.label}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Models() {
  const models = [
    { name: "AHH", type: "Voice · SVM", metric: "90.9%", cls: "tile--cobalt" },
    { name: "Vowels", type: "Voice · SVM", metric: "79.5%", cls: "tile--sky" },
    { name: "Text", type: "Voice · SVM", metric: "86.7% · 100% recall", cls: "tile--violet" },
    { name: "4-class vowels", type: "Voice · SVM · HC/PD/PSP/MSA", metric: "100% subj.", cls: "tile--ink" },
    { name: "Meander", type: "Handwriting · EfficientNetV2-B0", metric: "94.6%", cls: "tile--marigold" },
    { name: "Spiral", type: "Handwriting · 2-model ensemble + TTA", metric: "90.0%", cls: "tile--tangerine" },
    { name: "Wave", type: "Handwriting · EfficientNetV2-B0", metric: "93.3%", cls: "tile--grass" },
  ];
  return (
    <section className="section" id="models">
      <div className="container">
        <Reveal as="p" className="eyebrow">
          Seven models, one ensemble
        </Reveal>
        <Reveal as="h2" className="display-lg" delay={60} style={{ marginBottom: "0.8em" }}>
          Four voices. Three hands.
        </Reveal>
        <div className="grid grid--3">
          {models.map((m, i) => (
            <Reveal key={i} className={`tile ${m.cls}`} delay={i * 50}>
              <div style={{ fontSize: "0.8rem", opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                {m.type}
              </div>
              <h3 style={{ margin: "0.3em 0" }}>{m.name}</h3>
              <div className="stat" style={{ fontSize: "clamp(1.6rem,3vw,2.4rem)" }}>{m.metric}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    { n: "01", t: "Record or draw", d: "Say “ahh” for a few seconds, read a short passage, or draw a spiral, wave, or meander and photograph it." },
    { n: "02", t: "Extract & classify", d: "Voice → 36 acoustic features → SVM. Image → 224×224 + 4-pass augmentation → EfficientNetV2-B0." },
    { n: "03", t: "Ensemble & explain", d: "Per-model probabilities combine into an HC/PD/PSP/MSA prediction with a confidence label you can act on." },
  ];
  return (
    <section className="section" id="how">
      <div className="container">
        <Reveal as="p" className="eyebrow">How it works</Reveal>
        <Reveal as="h2" className="display-lg" delay={60} style={{ marginBottom: "0.8em" }}>
          Record → Extract → Classify → Ensemble → Result.
        </Reveal>
        <div className="grid grid--3">
          {steps.map((s, i) => (
            <Reveal key={i} className="tile tile--ink" delay={i * 80}>
              <div className="stat" style={{ color: "var(--marigold)" }}>{s.n}</div>
              <h3 style={{ margin: "0.3em 0" }}>{s.t}</h3>
              <p className="muted" style={{ color: "rgba(244,239,230,0.75)" }}>{s.d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CodeSection() {
  const links = [
    { label: "Repository", href: REPO },
    { label: "backend/app.py", href: `${REPO}/blob/main/backend/app.py` },
    { label: "feature_extraction.py", href: `${REPO}/blob/main/backend/feature_extraction.py` },
    { label: "inference.py", href: `${REPO}/blob/main/backend/inference.py` },
  ];
  return (
    <section className="section" id="code">
      <div className="container">
        <Reveal as="p" className="eyebrow">The code</Reveal>
        <Reveal as="h2" className="display-lg" delay={60} style={{ marginBottom: "0.6em" }}>
          Fully open source.
        </Reveal>
        <Reveal as="p" className="lead" delay={100} style={{ maxWidth: "60ch", marginBottom: "1.4em" }}>
          A static frontend talks to a FastAPI backend that loads seven models and
          combines them with fixed weights (handwriting 0.40 · voice 0.35 · survey
          0.25). Every line is public.
        </Reveal>
        <Reveal className="code-links" delay={140}>
          {links.map((l) => (
            <a key={l.href} className="btn btn--ghost" href={l.href} target="_blank" rel="noreferrer">
              {l.label} ↗
            </a>
          ))}
        </Reveal>
      </div>
      <style>{`.code-links{display:flex;flex-wrap:wrap;gap:12px}`}</style>
    </section>
  );
}

export function Confidentiality() {
  return (
    <section className="section" id="privacy">
      <div className="container">
        <Reveal as="p" className="eyebrow">Confidentiality</Reveal>
        <Reveal as="h2" className="display-lg" delay={60} style={{ marginBottom: "0.8em" }}>
          Your file never leaves memory.
        </Reveal>
        <div className="grid grid--2">
          <Reveal className="tile tile--sky">
            <h3>What actually happens</h3>
            <p style={{ marginTop: "0.5em" }}>
              Uploads are processed in memory and discarded immediately after
              inference - voice files are deleted right after feature extraction,
              drawings are read straight from a buffer. No database, no logging of
              file contents, no third-party storage.
            </p>
          </Reveal>
          <Reveal className="tile tile--pink" delay={80}>
            <h3>Please read</h3>
            <p style={{ marginTop: "0.5em" }}>
              This is a research prototype for the Congressional App Challenge,
              built on public de-identified datasets. Do not upload real patient
              information. NeuroTrace does not provide a medical diagnosis and is
              not a substitute for clinical evaluation.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function Limitations() {
  return (
    <section className="section" id="limitations">
      <div className="container">
        <Reveal as="p" className="eyebrow">Limitations</Reveal>
        <Reveal as="h2" className="display-lg" delay={60} style={{ marginBottom: "0.6em" }}>
          We report it the way real research should be.
        </Reveal>
        <Reveal as="p" className="lead" delay={100} style={{ maxWidth: "64ch" }}>
          Cohorts are modest (83 subjects for the 4-class task; PSP and MSA
          especially small), all data comes from public research datasets rather
          than routine clinical populations, and handwriting is evaluated at the
          image level rather than the subject level. These models are a proof of
          concept, not a diagnostic device - real deployment would need larger
          cohorts, external validation, and clinician oversight.
        </Reveal>
      </div>
    </section>
  );
}

export function Team() {
  return (
    <section className="section" id="team">
      <div className="container">
        <Reveal as="p" className="eyebrow">The team</Reveal>
        <Reveal as="h2" className="display-lg" delay={60} style={{ marginBottom: "0.6em" }}>
          Built by two high school students.
        </Reveal>
        <Reveal as="p" className="lead" delay={100} style={{ maxWidth: "60ch" }}>
          Andrew Shih (handwriting models) and Luis Cruz-Mondragon (voice models),
          Atkins Academic &amp; Technology High School, Winston-Salem, NC.
          Submitted to the Congressional App Challenge.
          {" "}
          <span className="muted">[district &amp; demo-video link to add]</span>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="section" style={{ paddingBottom: "48px" }}>
      <div className="container">
        <div className="footer__row">
          <div className="footer__brand">NeuroTrace</div>
          <a className="btn btn--ghost" href={REPO} target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        </div>
        <p className="muted" style={{ marginTop: "1em", maxWidth: "56ch" }}>
          Open-source digital biomarker screening for Parkinsonian disorders.
          Built for the Congressional App Challenge, 2026.
        </p>
      </div>
      <style>{`
        .footer__row{display:flex;align-items:center;justify-content:space-between;
          border-top:2px solid var(--ink);padding-top:24px;gap:20px;flex-wrap:wrap}
        .footer__brand{font-family:var(--font-display);font-weight:900;
          font-size:clamp(2rem,6vw,4rem);letter-spacing:-0.03em}
      `}</style>
    </footer>
  );
}
