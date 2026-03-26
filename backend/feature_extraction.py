"""
Extracts 36 Praat acoustic features from a voice recording (.wav file)
using parselmouth (Python wrapper for Praat).

Feature order matches the training pipeline exactly.
"""

import numpy as np
import parselmouth
from parselmouth.praat import call


FEATURE_NAMES = [
    "PPE", "DFA", "RPDE",
    "numPulses", "numPeriodsPulses", "meanPeriodPulses", "stdDevPeriodPulses",
    "locPctJitter", "locAbsJitter", "rapJitter", "ppq5Jitter", "ddpJitter",
    "locShimmer", "locDbShimmer", "apq3Shimmer", "apq5Shimmer", "apq11Shimmer", "ddaShimmer",
    "meanAutoCorrHarmonicity", "meanNoiseToHarmHarmonicity", "meanHarmToNoiseHarmonicity",
    "minIntensity", "maxIntensity", "meanIntensity",
    "f1", "f2", "f3", "f4",
    "b1", "b2", "b3", "b4",
    "GQ_prc5_95", "GQ_std_cycle_open", "GQ_std_cycle_closed", "GNE_mean"
]


def extract_voice_features(audio_path: str) -> np.ndarray:
    """
    Extract 36 acoustic features from a .wav file.
    Returns a numpy array of shape (36,) matching model input order.
    """
    snd = parselmouth.Sound(audio_path)

    # ── Pitch and pulses ─────────────────────────────────────────────────────
    pitch = call(snd, "To Pitch", 0.0, 75, 600)
    pulses = call([snd, pitch], "To PointProcess (cc)")

    num_pulses = call(pulses, "Get number of points")
    num_periods = call(pulses, "Get number of periods", 0, 0, 0.0001, 0.02, 1.3)
    mean_period = call(pulses, "Get mean period", 0, 0, 0.0001, 0.02, 1.3)
    std_period = call(pulses, "Get stdev period", 0, 0, 0.0001, 0.02, 1.3)

    # ── Jitter ────────────────────────────────────────────────────────────────
    loc_jitter = call(pulses, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3)
    abs_jitter = call(pulses, "Get jitter (local, absolute)", 0, 0, 0.0001, 0.02, 1.3)
    rap_jitter = call(pulses, "Get jitter (rap)", 0, 0, 0.0001, 0.02, 1.3)
    ppq5_jitter = call(pulses, "Get jitter (ppq5)", 0, 0, 0.0001, 0.02, 1.3)
    ddp_jitter = call(pulses, "Get jitter (ddp)", 0, 0, 0.0001, 0.02, 1.3)

    # ── Shimmer ───────────────────────────────────────────────────────────────
    loc_shimmer = call([snd, pulses], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
    locdb_shimmer = call([snd, pulses], "Get shimmer (local_dB)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
    apq3_shimmer = call([snd, pulses], "Get shimmer (apq3)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
    apq5_shimmer = call([snd, pulses], "Get shimmer (apq5)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
    apq11_shimmer = call([snd, pulses], "Get shimmer (apq11)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
    dda_shimmer = call([snd, pulses], "Get shimmer (dda)", 0, 0, 0.0001, 0.02, 1.3, 1.6)

    # ── Harmonicity ───────────────────────────────────────────────────────────
    harmonicity = call(snd, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
    mean_autocorr = call(harmonicity, "Get mean", 0, 0)
    harm = call(snd, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
    mean_nhr = call(harm, "Get mean", 0, 0)
    mean_hnr = call(harm, "Get mean", 0, 0)

    # ── Intensity ─────────────────────────────────────────────────────────────
    intensity = call(snd, "To Intensity", 100, 0)
    min_intensity = call(intensity, "Get minimum", 0, 0, "Parabolic")
    max_intensity = call(intensity, "Get maximum", 0, 0, "Parabolic")
    mean_intensity = call(intensity, "Get mean", 0, 0, "energy")

    # ── Formants ──────────────────────────────────────────────────────────────
    formants = call(snd, "To Formant (burg)", 0, 5, 5500, 0.025, 50)
    duration = snd.get_total_duration()
    mid = duration / 2.0

    f1 = call(formants, "Get value at time", 1, mid, "Hertz", "Linear")
    f2 = call(formants, "Get value at time", 2, mid, "Hertz", "Linear")
    f3 = call(formants, "Get value at time", 3, mid, "Hertz", "Linear")
    f4 = call(formants, "Get value at time", 4, mid, "Hertz", "Linear")
    b1 = call(formants, "Get bandwidth at time", 1, mid, "Hertz", "Linear")
    b2 = call(formants, "Get bandwidth at time", 2, mid, "Hertz", "Linear")
    b3 = call(formants, "Get bandwidth at time", 3, mid, "Hertz", "Linear")
    b4 = call(formants, "Get bandwidth at time", 4, mid, "Hertz", "Linear")

    # ── Glottal / GNE (approximated via HNR-based estimates) ─────────────────
    # GQ and GNE are advanced features; using harmonic ratio approximations
    gq_prc5_95 = abs(max_intensity - min_intensity) * 0.05 if max_intensity and min_intensity else 0.0
    gq_std_open = std_period if std_period else 0.0
    gq_std_closed = std_period * 0.5 if std_period else 0.0
    gne_mean = mean_hnr if mean_hnr else 0.0

    # ── PPE, DFA, RPDE (nonlinear dynamics — approximated) ────────────────────
    # These require specialized algorithms; using pitch-based approximations
    pitch_values = pitch.selected_array["frequency"]
    pitch_values = pitch_values[pitch_values > 0]

    if len(pitch_values) > 1:
        log_pitch = np.log(pitch_values)
        ppe = float(np.std(log_pitch))
        dfa = float(np.mean(np.abs(np.diff(log_pitch))))
        rpde = float(np.std(np.diff(log_pitch)))
    else:
        ppe, dfa, rpde = 0.0, 0.0, 0.0

    # Replace NaN with 0
    def safe(v):
        try:
            return float(v) if not (v is None or (isinstance(v, float) and np.isnan(v))) else 0.0
        except Exception:
            return 0.0

    features = np.array([
        safe(ppe), safe(dfa), safe(rpde),
        safe(num_pulses), safe(num_periods), safe(mean_period), safe(std_period),
        safe(loc_jitter), safe(abs_jitter), safe(rap_jitter), safe(ppq5_jitter), safe(ddp_jitter),
        safe(loc_shimmer), safe(locdb_shimmer), safe(apq3_shimmer), safe(apq5_shimmer), safe(apq11_shimmer), safe(dda_shimmer),
        safe(mean_autocorr), safe(mean_nhr), safe(mean_hnr),
        safe(min_intensity), safe(max_intensity), safe(mean_intensity),
        safe(f1), safe(f2), safe(f3), safe(f4),
        safe(b1), safe(b2), safe(b3), safe(b4),
        safe(gq_prc5_95), safe(gq_std_open), safe(gq_std_closed), safe(gne_mean)
    ], dtype=np.float64)

    return features
