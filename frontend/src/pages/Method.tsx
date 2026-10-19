import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { Reveal } from "../components/Reveal";

const VOICE_DATA = [
  ["Four-class vowels", "HC · PD · PSP · MSA", "83 (22/22/18/21)", "539", "135"],
  ["AHH PD vs HC", "HC · PD", "81 (41/40)", "129", "33"],
  ["Vowels PD vs HC", "HC · PD", "44 (22/22)", "289", "73"],
  ["Text PD vs HC", "HC · PD", "37 (21/16)", "~80%", "~20%"],
];

const HAND_DATA = [
  ["Meander", "368 (72 H / 296 PD)", "249", "45", "74"],
  ["Spiral (combined)", "216 real, 288 oversampled", "288", "44", "90"],
  ["Wave (combined)", "216 real, 324 oversampled", "324", "36", "90"],
];

const RESULTS = [
  { v: "90.9%", k: "AHH, PD vs HC", d: "RBF-SVM, C=10, gamma=0.01, recording level.", cls: "tile--cobalt" },
  { v: "79.5%", k: "Vowels, PD vs HC", d: "RBF-SVM, C=10, gamma=0.1, a harder multi-center cohort.", cls: "tile--sky" },
  { v: "86.7%", k: "Text, PD vs HC", d: "Threshold 0.30, tuned to 100% PD recall (precision 0.75).", cls: "tile--violet" },
  { v: "100%", k: "Four-class, subject level", d: "HC / PD / PSP / MSA after averaging per subject (recording level 85.2%).", cls: "tile--ink" },
  { v: "94.6%", k: "Meander drawings", d: "EfficientNetV2-B0, macro-F1 0.91 despite heavy class imbalance.", cls: "tile--marigold" },
  { v: "90.0%", k: "Spiral drawings", d: "Two-model ensemble + TTA, threshold 0.20, macro-F1 0.90.", cls: "tile--tangerine" },
  { v: "93.3%", k: "Wave drawings", d: "Single CNN, threshold 0.46, macro-F1 0.93.", cls: "tile--grass" },
  { v: "92.5%", k: "All handwriting pooled", d: "235 of 254 test images correct across the three drawing tasks.", cls: "tile--pink" },
];

export function Method() {
  return (
    <>
      <PageHeader
        tone="dark"
        eyebrow="The research"
        title="Subject-wise digital biomarkers for parkinsonism."
        intro="A low-cost, remotely deployable screening pipeline built on open, de-identified data: acoustic voice models that separate HC, PD, PSP, and MSA, and handwriting transfer-learning models for PD screening. Everything below is drawn directly from the paper."
      />

      {/* Datasets */}
      <section className="section">
        <div className="container">
          <Reveal as="p" className="eyebrow">The data</Reveal>
          <Reveal as="h2" className="display-lg" delay={60} style={{ marginBottom: "0.3em" }}>
            Open cohorts from Kaggle.
          </Reveal>
          <Reveal as="p" className="lead" delay={100} style={{ maxWidth: "62ch", marginBottom: "1.6em" }}>
            All recordings come from publicly available, de-identified speech corpora on Kaggle
            (speakers with parkinsonism; voice samples for PD patients and healthy controls; the
            927-found-datasets archive). Handwriting images come from public drawing datasets combined
            with an Archive3 subset. Every voice split is made at the subject level so no person
            appears in both training and test.
          </Reveal>

          <Reveal as="h3" style={{ margin: "0 0 0.6em" }}>Voice datasets</Reveal>
          <div className="mtable-wrap">
            <table className="mtable">
              <thead>
                <tr><th>Task</th><th>Classes</th><th>Subjects</th><th>Train rec.</th><th>Test rec.</th></tr>
              </thead>
              <tbody>
                {VOICE_DATA.map((r) => (
                  <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>

          <Reveal as="h3" style={{ margin: "2em 0 0.6em" }}>Handwriting datasets (image level)</Reveal>
          <div className="mtable-wrap">
            <table className="mtable">
              <thead>
                <tr><th>Task</th><th>Images</th><th>Train</th><th>Val</th><th>Test</th></tr>
              </thead>
              <tbody>
                {HAND_DATA.map((r) => (
                  <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="section" style={{ background: "#0b0a10", color: "var(--cream)" }}>
        <div className="container">
          <Reveal as="p" className="eyebrow" style={{ color: "var(--sky)" }}>How it was built</Reveal>
          <Reveal as="h2" className="display-lg" delay={60} style={{ marginBottom: "0.6em" }}>Two pipelines, one protocol.</Reveal>
          <div className="grid grid--2">
            <Reveal className="tile tile--cobalt">
              <h3>Voice</h3>
              <p style={{ marginTop: "0.5em" }}>
                Audio is loaded in mono, resampled to 16 kHz, silence-trimmed with an energy-based
                detector, and peak-normalized. parselmouth (Praat) turns each clip into 36
                hand-crafted features (jitter, shimmer, harmonic-to-noise ratio, pitch and pulse
                stats, four formants and their bandwidths, and nonlinear measures like PPE, DFA, and
                RPDE), z-scored with training-set statistics. An RBF-kernel SVM is trained per task, with C and gamma
                chosen by five-fold cross-validation; the four-class model uses one-vs-one voting and
                Platt-scaled probabilities aggregated per subject.
              </p>
            </Reveal>
            <Reveal className="tile tile--violet" delay={80}>
              <h3>Handwriting</h3>
              <p style={{ marginTop: "0.5em" }}>
                Drawings are converted to 224x224 RGB and fed through EfficientNetV2-B0 with a small
                head (global pooling, a 256-unit dense layer, dropout, sigmoid). Training is two-stage:
                head first at learning rate 0.001, then the whole network fine-tuned near 1e-5, with
                class weights, oversampling, and augmentation. Spiral and wave use test-time
                augmentation and tuned thresholds (0.20 and 0.46); meander keeps 0.5.
              </p>
            </Reveal>
          </div>
          <Reveal className="tile tile--ink" style={{ marginTop: "18px", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.14)" }}>
            <h3>What the live app runs</h3>
            <p style={{ marginTop: "0.5em", color: "rgba(244,239,230,0.85)" }}>
              The handwriting models in the app are the paper’s models, with the same thresholds and
              test-time augmentation. The voice models were retrained for the app on the sustained “ahh”
              (81 speakers) and read-text (37 speakers) recordings, using the exact feature code the server
              runs, so what the app measures matches what the models learned. Scored on people the models
              never saw (subject-wise cross-validation), they reach 73.3% (“ahh”) and 73.9% (read text).
              That is lower than the paper’s recording-level numbers above, because a person-level test is
              stricter. The vowel and four-class models stay research-only: their source dataset is no
              longer available, so they could not be rebuilt for the app.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Results */}
      <section className="section">
        <div className="container">
          <Reveal as="p" className="eyebrow">The results</Reveal>
          <Reveal as="h2" className="display-lg" delay={60} style={{ marginBottom: "0.6em" }}>Held-out accuracy.</Reveal>
          <div className="grid grid--4">
            {RESULTS.map((r, i) => (
              <Reveal key={r.k} className={`tile ${r.cls}`} delay={i * 45}>
                <div className="stat">{r.v}</div>
                <h3 style={{ fontSize: "1.15rem", margin: "0.3em 0 0.2em" }}>{r.k}</h3>
                <p style={{ fontSize: "0.9rem", opacity: 0.9 }}>{r.d}</p>
              </Reveal>
            ))}
          </div>
          <Reveal as="p" className="muted" delay={120} style={{ marginTop: "1.4em", maxWidth: "64ch" }}>
            Transfer learning beat a from-scratch CNN baseline by roughly 10 to 20 points on every
            drawing task (baseline: meander 81.9%, spiral 73.3%, wave 83.3%). Grad-CAM overlays confirm
            the CNNs focus on stroke-level tremor and sharp turns, not background artifacts.
          </Reveal>
        </div>
      </section>

      {/* Rigor + limitations */}
      <section className="section" style={{ background: "#0b0a10", color: "var(--cream)" }}>
        <div className="container">
          <div className="grid grid--2">
            <Reveal className="tile tile--grass">
              <h3>Why the numbers are trustworthy</h3>
              <p style={{ marginTop: "0.5em" }}>
                Subject-strict, group-aware cross-validation keeps recordings from one person out of
                both folds. Preprocessing statistics and thresholds are fit on training data only, and
                the held-out test set is scored once. Uncertainty is reported with 2000-sample
                bootstrap 95% confidence intervals.
              </p>
            </Reveal>
            <Reveal className="tile tile--tangerine" delay={80}>
              <h3>The honest limits</h3>
              <p style={{ marginTop: "0.5em" }}>
                Cohorts are small, especially PSP and MSA. Handwriting is evaluated at the image level
                because subject IDs are not aligned across sources. Thresholds are tuned on small
                validation sets, and nothing is validated on an external clinical population. These are
                proof-of-concept results, not a diagnostic guarantee.
              </p>
            </Reveal>
          </div>
          <Reveal style={{ marginTop: "2em", display: "flex", gap: "14px", flexWrap: "wrap" }}>
            <Link className="btn" to="/code">Read the code</Link>
            <Link className="btn btn--ghost" to="/screening" style={{ color: "var(--cream)", boxShadow: "inset 0 0 0 2px var(--cream)" }}>
              How screening works
            </Link>
          </Reveal>
        </div>
      </section>

      <style>{`
        .mtable-wrap { overflow-x:auto; border-radius:14px; }
        .mtable { width:100%; border-collapse:collapse; font-size:0.95rem; min-width:520px; }
        .mtable th, .mtable td { text-align:left; padding:12px 16px; }
        .mtable thead th { font-family:var(--font-body); font-weight:700; font-size:0.78rem;
          text-transform:uppercase; letter-spacing:0.08em; color:var(--ink-soft);
          border-bottom:2px solid var(--ink); }
        .mtable tbody td { border-bottom:1px solid rgba(20,17,15,0.12); }
        .mtable tbody tr:hover { background:rgba(62,107,224,0.06); }
        .mtable td:first-child { font-weight:700; }
      `}</style>
    </>
  );
}
