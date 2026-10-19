"""
Retrain the two live PD-vs-HC voice SVMs on the SAME feature extractor the
server uses (feature_extraction.py), so training and inference cannot drift.

    python -I training/train_voice.py <data_dir>

<data_dir> holds the Kaggle `anonymous6623/927-found-datasets` folders:
    HC_AH/HC_AH/*.wav, PD_AH/PD_AH/*.wav            -> "ahh" model
    .../ReadText/HC/*.wav, .../ReadText/PD/*.wav    -> "text" model

Evaluation is subject-wise: no speaker appears in both train and test, and a
speaker's chunk probabilities are averaged before scoring (as the server does).
"""

import glob
import json
import os
import sys

import joblib
import numpy as np
from sklearn.metrics import accuracy_score, recall_score, roc_auc_score
from sklearn.model_selection import GridSearchCV, StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
from feature_extraction import (  # noqa: E402
    MIN_SECONDS, extract_features_from_sound, load_sound, split_chunks,
)

PARAM_GRID = {
    "svc__C": [0.1, 1, 10, 100],
    "svc__gamma": ["scale", 0.001, 0.01, 0.1],
}
OUTER_SEEDS = [0, 1, 2]


def find_files(data_dir, task):
    """Return [(path, label, speaker_id)] for one task. label 1 = PD."""
    rows = []
    if task == "ahh":
        for label, cls in ((0, "HC"), (1, "PD")):
            for p in glob.glob(os.path.join(data_dir, f"{cls}_AH", "**", "*.wav"), recursive=True):
                # AH_064F_<uuid>.wav -> speaker "064F"
                rows.append((p, label, os.path.basename(p).split("_")[1]))
    else:
        for label, cls in ((0, "HC"), (1, "PD")):
            pat = os.path.join(data_dir, "**", "ReadText", cls, "*.wav")
            for p in glob.glob(pat, recursive=True):
                # ID02_pd_2_0_0.wav -> speaker "ID02"
                rows.append((p, label, os.path.basename(p).split("_")[0]))
    return sorted(rows)


def build_features(data_dir, task):
    cache = os.path.join(HERE, f"features_{task}.npz")
    if os.path.exists(cache):
        d = np.load(cache, allow_pickle=True)
        return d["X"], d["y"], d["g"]
    X, y, g = [], [], []
    rows = find_files(data_dir, task)
    for i, (path, label, spk) in enumerate(rows):
        snd = load_sound(path)
        if snd.get_total_duration() < MIN_SECONDS:
            print(f"  skip <1s: {path}")
            continue
        chunks = split_chunks(snd) if task == "text" else [snd]
        for c in chunks:
            X.append(extract_features_from_sound(c))
            y.append(label)
            g.append(spk)
        print(f"  [{task}] {i + 1}/{len(rows)} {spk} label={label} chunks={len(chunks)}", flush=True)
    X, y, g = np.array(X), np.array(y), np.array(g)
    np.savez(cache, X=X, y=y, g=g)
    return X, y, g


def make_search():
    pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("svc", SVC(kernel="rbf", probability=True, class_weight="balanced", random_state=0)),
    ])
    # Inner folds must each contain both classes, or roc_auc is NaN for every
    # setting and the search silently picks the first grid point. Unshuffled
    # StratifiedGroupKFold(4) keeps both classes in every fold for these cohorts;
    # error_score="raise" makes any regression loud instead of silent.
    return GridSearchCV(pipe, PARAM_GRID, cv=StratifiedGroupKFold(4),
                        scoring="roc_auc", n_jobs=-1, error_score="raise")


def subject_scores(probs, y, g):
    """Average chunk P(PD) per speaker; return (y_true, p_mean) per speaker."""
    spk = np.unique(g)
    yt = np.array([y[g == s][0] for s in spk])
    pm = np.array([probs[g == s].mean() for s in spk])
    return yt, pm


def evaluate(X, y, g):
    """Nested, subject-wise CV repeated over OUTER_SEEDS."""
    accs, recs, aucs = [], [], []
    for seed in OUTER_SEEDS:
        outer = StratifiedGroupKFold(5, shuffle=True, random_state=100 + seed)
        probs = np.zeros(len(y))
        for tr, te in outer.split(X, y, g):
            gs = make_search()
            gs.fit(X[tr], y[tr], groups=g[tr])
            probs[te] = gs.predict_proba(X[te])[:, 1]
        yt, pm = subject_scores(probs, y, g)
        pred = (pm >= 0.5).astype(int)
        accs.append(accuracy_score(yt, pred))
        recs.append(recall_score(yt, pred))
        aucs.append(roc_auc_score(yt, pm))
    return {
        "subject_accuracy": float(np.mean(accs)),
        "subject_accuracy_std": float(np.std(accs)),
        "pd_recall": float(np.mean(recs)),
        "auc": float(np.mean(aucs)),
        "outer_repeats": len(OUTER_SEEDS),
    }


def main():
    data_dir = sys.argv[1]
    out_names = {"ahh": "PD_vs_HC_AHH.joblib", "text": "PD_vs_HC_text.joblib"}
    metrics = {}
    for task in ("ahh", "text"):
        X, y, g = build_features(data_dir, task)
        n_spk = len(np.unique(g))
        n_pd = len(np.unique(g[y == 1]))
        print(f"{task}: {len(y)} samples, {n_spk} speakers ({n_pd} PD)")
        m = evaluate(X, y, g)
        final = make_search().fit(X, y, groups=g)
        m.update({
            "samples": int(len(y)), "speakers": int(n_spk),
            "pd_speakers": int(n_pd), "hc_speakers": int(n_spk - n_pd),
            "best_params": {k: (v if isinstance(v, str) else float(v)) for k, v in final.best_params_.items()},
        })
        metrics[task] = m
        joblib.dump(final.best_estimator_, os.path.join(ROOT, "models", out_names[task]))
        print(json.dumps(m, indent=2))
    with open(os.path.join(HERE, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)


if __name__ == "__main__":
    main()
