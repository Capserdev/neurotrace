import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from inference import band_for, ensemble_score, tta_views  # noqa: E402


def test_tta_views_shape_and_raw_range():
    img = np.random.default_rng(0).uniform(0, 255, (224, 224, 3)).astype(np.float32)
    views = tta_views(img)
    assert views.shape == (4, 224, 224, 3)
    assert views.dtype == np.float32
    np.testing.assert_array_equal(views[0], img)  # first view is the original
    assert views.max() > 1.5  # still raw [0,255], not rescaled


def test_tta_views_pad_white_not_black():
    img = np.full((224, 224, 3), 255.0, dtype=np.float32)
    views = tta_views(img)
    # Rotating a white page must not introduce black corners.
    assert views.min() > 250


def test_ensemble_all_parts_uses_spec_weights():
    r = ensemble_score(drawings={"spiral": 1.0, "wave": 1.0, "meander": 1.0},
                       voice={"ahh": 0.0, "text": 0.0}, survey=0.0)
    assert r["pd_score"] == pytest.approx(0.40)
    assert r["weights_used"] == pytest.approx({"handwriting": 0.40, "voice": 0.35, "survey": 0.25})


def test_ensemble_renormalizes_over_completed_parts():
    r = ensemble_score(drawings={"spiral": 0.8}, voice=None, survey=0.2)
    # 0.40*0.8 + 0.25*0.2 = 0.37, over 0.65
    assert r["pd_score"] == pytest.approx(0.37 / 0.65)
    assert set(r["parts"]) == {"handwriting", "survey"}


def test_ensemble_averages_within_a_modality():
    r = ensemble_score(drawings={"spiral": 0.2, "wave": 0.6}, voice=None, survey=None)
    assert r["parts"]["handwriting"] == pytest.approx(0.4)
    assert r["pd_score"] == pytest.approx(0.4)


def test_ensemble_empty_raises():
    with pytest.raises(ValueError):
        ensemble_score(drawings={}, voice={}, survey=None)


@pytest.mark.parametrize("score,band", [(0.0, "low"), (0.349, "low"), (0.35, "moderate"),
                                        (0.60, "moderate"), (0.601, "elevated"), (1.0, "elevated")])
def test_bands(score, band):
    assert band_for(score) == band
