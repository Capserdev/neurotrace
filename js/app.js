/**
 * NeuroTrace — Frontend Logic
 * Handles file uploads, API calls, survey integration, and results rendering.
 */

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  voice: {},    // { ahh: {...result}, text: {...}, vowels: {...} }
  drawing: {},  // { meander: {...}, spiral1: {...}, wave: {...} }
  currentStep: 1
};

function getApiUrl() {
  return (document.getElementById('api-url')?.value || 'https://casper-284-neurotrace-api.hf.space').replace(/\/$/, '');
}

// ── Navigation ────────────────────────────────────────────────────────────────
function goToStep(n) {
  [1, 2, 3].forEach(i => {
    document.getElementById(`step-${i}`)?.classList.toggle('active', i === n);
    const tab = document.getElementById(`tab-${['voice','drawing','results'][i-1]}`);
    if (tab) {
      tab.classList.remove('active', 'completed');
      if (i === n) tab.classList.add('active');
      else if (i < n) tab.classList.add('completed');
    }
  });
  state.currentStep = n;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Connection Test ───────────────────────────────────────────────────────────
async function testConnection() {
  const el = document.getElementById('api-status');
  el.textContent = 'Testing…';
  el.className = 'api-status';
  try {
    const r = await fetch(`${getApiUrl()}/health`, { signal: AbortSignal.timeout(5000) });
    const data = await r.json();
    el.textContent = `✓ Connected (${data.models_loaded} models loaded)`;
    el.className = 'api-status ok';
  } catch (e) {
    el.textContent = '✗ Cannot reach backend';
    el.className = 'api-status err';
  }
}

// ── Voice Upload ──────────────────────────────────────────────────────────────
async function handleVoiceUpload(input, type) {
  const file = input.files[0];
  if (!file) return;

  const card     = document.getElementById(`card-${type}`);
  const statusEl = document.getElementById(`status-${type}`);
  const resultEl = document.getElementById(`result-${type}`);

  card.classList.remove('has-file', 'error');
  card.classList.add('loading');
  statusEl.className = 'upload-status loading';
  statusEl.innerHTML = '<span class="spinner"></span> Analyzing…';
  resultEl.innerHTML = '';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('recording_type', type);

  try {
    const res = await fetch(`${getApiUrl()}/predict/voice`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(60000)
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();

    // Store all returned model results
    Object.assign(state.voice, data);

    // Show mini prediction chip — prefer the matching binary model
    const keyMap = { ahh: 'ahh_binary', text: 'text_binary', vowels: 'vowels_binary' };
    const key = keyMap[type];
    const prediction = data[key]?.prediction ?? data.vowels_4class?.prediction ?? '?';

    card.classList.remove('loading');
    card.classList.add('has-file');
    statusEl.className = 'upload-status ok';
    statusEl.textContent = '✓ ' + file.name;
    resultEl.innerHTML = `<span class="mini-result ${prediction}">${prediction}</span>`;

  } catch (e) {
    card.classList.remove('loading');
    card.classList.add('error');
    statusEl.className = 'upload-status err';
    statusEl.textContent = '✗ ' + (e.message || 'Upload failed');
    console.error('Voice upload error:', e);
  }
}

// ── Drawing Upload ────────────────────────────────────────────────────────────
async function handleDrawingUpload(input, type) {
  const file = input.files[0];
  if (!file) return;

  const card     = document.getElementById(`card-${type}`);
  const statusEl = document.getElementById(`status-${type}`);
  const resultEl = document.getElementById(`result-${type}`);

  card.classList.remove('has-file', 'error');
  card.classList.add('loading');
  statusEl.className = 'upload-status loading';
  statusEl.innerHTML = '<span class="spinner"></span> Analyzing…';
  resultEl.innerHTML = '';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('drawing_type', type);

  try {
    const res = await fetch(`${getApiUrl()}/predict/drawing`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(60000)
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();

    state.drawing[type] = data;

    const prediction = data.prediction ?? '?';
    card.classList.remove('loading');
    card.classList.add('has-file');
    statusEl.className = 'upload-status ok';
    statusEl.textContent = '✓ ' + file.name;
    resultEl.innerHTML = `<span class="mini-result ${prediction}">${prediction}</span>`;

  } catch (e) {
    card.classList.remove('loading');
    card.classList.add('error');
    statusEl.className = 'upload-status err';
    statusEl.textContent = '✗ ' + (e.message || 'Upload failed');
    console.error('Drawing upload error:', e);
  }
}

// ── Ensemble & Results ────────────────────────────────────────────────────────
async function computeEnsembleAndShow() {
  goToStep(3);

  const loadingEl = document.getElementById('results-loading');
  const contentEl = document.getElementById('results-content');
  const errorEl   = document.getElementById('results-error');

  loadingEl.style.display  = 'block';
  contentEl.style.display  = 'none';
  errorEl.style.display    = 'none';

  // Build voice payload — only send results that exist
  const voicePayload = {};
  if (state.voice.vowels_4class)  voicePayload.vowels_4class  = state.voice.vowels_4class;
  if (state.voice.ahh_binary)     voicePayload.ahh_binary     = state.voice.ahh_binary;
  if (state.voice.text_binary)    voicePayload.text_binary    = state.voice.text_binary;
  if (state.voice.vowels_binary)  voicePayload.vowels_binary  = state.voice.vowels_binary;

  const drawingPayload = {};
  ['meander','spiral1','wave'].forEach(k => {
    if (state.drawing[k]) drawingPayload[k] = state.drawing[k];
  });

  // Read survey score from localStorage if available
  let surveyPayload = null;
  try {
    const saved = localStorage.getItem('neurotrace_survey');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.completed && typeof parsed.score === 'number') {
        surveyPayload = { score: parsed.score };
      }
    }
  } catch (_) {}

  if (Object.keys(voicePayload).length === 0 && Object.keys(drawingPayload).length === 0 && !surveyPayload) {
    loadingEl.style.display = 'none';
    errorEl.style.display   = 'block';
    return;
  }

  try {
    const body = { voice: voicePayload, drawing: drawingPayload };
    if (surveyPayload) body.survey = surveyPayload;

    const res = await fetch(`${getApiUrl()}/predict/ensemble`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();

    loadingEl.style.display = 'none';
    renderResults(data.ensemble, voicePayload, drawingPayload, surveyPayload);
    contentEl.style.display = 'block';

  } catch (e) {
    console.error('Ensemble error:', e);
    loadingEl.style.display = 'none';
    errorEl.style.display   = 'block';
  }
}

function renderResults(ensemble, voiceData, drawingData, surveyData) {
  const { classes, probabilities, prediction, confidence } = ensemble;

  // Ensemble prediction
  const predEl = document.getElementById('ensemble-prediction');
  predEl.textContent = predictionLabel(prediction);
  predEl.className = `nt-ensemble-pred ${prediction}`;

  // Confidence badge
  const badgeEl = document.getElementById('confidence-badge');
  badgeEl.textContent = confidence + ' Confidence';
  badgeEl.className = `confidence-badge ${confidence}`;

  // Probability bars
  classes.forEach((cls, i) => {
    const pct = Math.round(probabilities[i] * 100);
    const bar = document.getElementById(`bar-${cls}`);
    const pctEl = document.getElementById(`pct-${cls}`);
    if (bar) bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
  });

  // Per-model breakdown table
  const tbody = document.getElementById('breakdown-body');
  tbody.innerHTML = '';

  const modelRows = [
    { key: 'vowels_4class',  label: '4-Class Vowel (Voice)',        src: voiceData },
    { key: 'ahh_binary',     label: 'AHH Vowel — Binary (Voice)',   src: voiceData },
    { key: 'text_binary',    label: 'Text Reading — Binary (Voice)', src: voiceData },
    { key: 'vowels_binary',  label: 'Vowels — Binary (Voice)',       src: voiceData },
    { key: 'meander',        label: 'Meander Drawing',               src: drawingData },
    { key: 'spiral1',        label: 'Spiral Drawing',                src: drawingData },
    { key: 'wave',           label: 'Wave Drawing',                  src: drawingData },
  ];

  let anyRow = false;
  modelRows.forEach(({ key, label, src }) => {
    const result = src[key];
    if (!result) return;
    anyRow = true;

    const probs = result.probabilities || [];
    const cls   = result.classes || [];
    const pred  = result.prediction || '?';

    const cells = ['HC','PD','PSP','MSA'].map(c => {
      const idx = cls.indexOf(c);
      const val = idx >= 0 ? Math.round(probs[idx] * 100) : '—';
      return `<td style="color:var(--text-muted)">${val}${val !== '—' ? '%' : ''}</td>`;
    }).join('');

    tbody.innerHTML += `
      <tr>
        <td style="font-weight:500;color:var(--navy)">${label}</td>
        <td><span class="prediction-chip ${pred}">${pred}</span></td>
        ${cells}
      </tr>`;
  });

  // Survey row
  if (surveyData) {
    anyRow = true;
    const pct = Math.round(surveyData.score * 100);
    tbody.innerHTML += `
      <tr>
        <td style="font-weight:500;color:var(--navy)">Lifestyle Survey</td>
        <td><span class="prediction-chip ${surveyData.score >= 0.5 ? 'PD' : 'HC'}">${surveyData.score >= 0.5 ? 'PD' : 'HC'}</span></td>
        <td style="color:var(--text-muted)">${100 - pct}%</td>
        <td style="color:var(--text-muted)">${pct}%</td>
        <td style="color:var(--text-muted)">—</td>
        <td style="color:var(--text-muted)">—</td>
      </tr>`;
  }

  if (!anyRow) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-light);padding:20px;">No model results available.</td></tr>';
  }

  // Show survey indicator if survey was included
  const surveyNote = document.getElementById('survey-included-note');
  if (surveyNote) {
    surveyNote.style.display = surveyData ? 'flex' : 'none';
  }
}

function predictionLabel(code) {
  const map = {
    PD:  "Parkinson's Disease (PD)",
    HC:  'Healthy Control (HC)',
    PSP: 'Progressive Supranuclear Palsy (PSP)',
    MSA: 'Multiple System Atrophy (MSA)'
  };
  return map[code] || code;
}

function resetAll() {
  state.voice   = {};
  state.drawing = {};
  ['ahh','text','vowels'].forEach(t => {
    document.getElementById(`card-${t}`)?.classList.remove('has-file','error','loading');
    const s = document.getElementById(`status-${t}`);
    if (s) s.textContent = '';
    const r = document.getElementById(`result-${t}`);
    if (r) r.innerHTML = '';
  });
  ['meander','spiral1','wave'].forEach(t => {
    document.getElementById(`card-${t}`)?.classList.remove('has-file','error','loading');
    const s = document.getElementById(`status-${t}`);
    if (s) s.textContent = '';
    const r = document.getElementById(`result-${t}`);
    if (r) r.innerHTML = '';
  });
  goToStep(1);
}

// ── Model readiness gate ──────────────────────────────────────────────────────
let modelsReady = false;

function setUploadsEnabled(enabled) {
  document.querySelectorAll('.upload-card input[type="file"], .upload-btn').forEach(el => {
    el.disabled = !enabled;
    el.style.opacity = enabled ? '' : '0.4';
    el.style.cursor  = enabled ? '' : 'not-allowed';
  });
}

async function waitForModels() {
  const banner   = document.getElementById('model-readiness-banner');
  const icon     = document.getElementById('model-readiness-icon');
  const title    = document.getElementById('model-readiness-title');
  const detail   = document.getElementById('model-readiness-detail');

  if (!banner) return; // not on diagnosis page

  setUploadsEnabled(false);

  const REQUIRED = 7;
  const POLL_MS  = 5000;
  const MAX_WAIT = 120000; // 2 minutes max
  const started  = Date.now();

  while (Date.now() - started < MAX_WAIT) {
    try {
      const res  = await fetch(`${getApiUrl()}/health`, { signal: AbortSignal.timeout(8000) });
      const data = await res.json();
      const loaded = data.models_loaded ?? 0;

      if (loaded >= REQUIRED) {
        // All models ready
        modelsReady = true;
        banner.style.background = '#f0fdf4';
        banner.style.borderColor = '#bbf7d0';
        banner.style.color = '#166534';
        icon.textContent = '✅';
        title.textContent = 'All models ready';
        detail.textContent = `${loaded}/${REQUIRED} models loaded — uploads unlocked.`;
        setUploadsEnabled(true);
        setTimeout(() => { banner.style.display = 'none'; }, 3000);
        return;
      }

      // Partial load
      icon.textContent = '⏳';
      title.textContent = `Loading models… (${loaded}/${REQUIRED})`;
      detail.textContent = 'The backend is starting up. This usually takes under a minute.';

    } catch (_) {
      icon.textContent = '🔴';
      title.textContent = 'Backend unreachable — retrying…';
      detail.textContent = 'Check that the Backend URL above is correct.';
    }

    await new Promise(r => setTimeout(r, POLL_MS));
  }

  // Timed out
  icon.textContent = '⚠️';
  banner.style.background = '#fef2f2';
  banner.style.borderColor = '#fecaca';
  banner.style.color = '#991b1b';
  title.textContent = 'Could not reach models after 2 minutes';
  detail.textContent = 'Check the Backend URL or try refreshing. Uploads remain disabled.';
}

// ── On load ───────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const savedUrl = localStorage.getItem('neurovox_api_url');
  if (savedUrl) {
    const el = document.getElementById('api-url');
    if (el) el.value = savedUrl;
  }
  const urlInput = document.getElementById('api-url');
  if (urlInput) {
    urlInput.addEventListener('change', e => {
      localStorage.setItem('neurovox_api_url', e.target.value);
    });
  }

  // Show survey badge on report step if survey is already done
  try {
    const saved = localStorage.getItem('neurotrace_survey');
    if (saved) {
      const { completed } = JSON.parse(saved);
      if (completed) {
        const badge = document.getElementById('survey-badge');
        if (badge) badge.style.display = 'inline-flex';
      }
    }
  } catch (_) {}

  // Gate uploads until all models are confirmed loaded
  waitForModels();
});
