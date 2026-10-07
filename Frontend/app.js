/**
 * NewsClassifier Frontend Application Logic
 */

let currentMode = 'url';
let trackerTimer = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  checkBackendHealth();
});

// Check API Health
async function checkBackendHealth() {
  const statusPill = document.getElementById('modelStatusPill');
  const statusText = document.getElementById('modelStatusText');
  
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.status === 'ready') {
      statusPill.className = 'status-pill status-ready';
      statusText.textContent = `Model Ready (${data.vector_dimension}D)`;
    } else {
      statusPill.className = 'status-pill';
      statusPill.style.background = '#fef3c7';
      statusPill.style.color = '#b45309';
      statusText.textContent = 'Model Warning';
    }
  } catch (err) {
    statusPill.className = 'status-pill';
    statusPill.style.background = '#fee2e2';
    statusPill.style.color = '#b91c1c';
    statusText.textContent = 'Server Offline';
  }
}

// Switch between URL Input and Direct Text Input
function switchMode(mode) {
  currentMode = mode;
  const tabUrl = document.getElementById('tabUrlBtn');
  const tabText = document.getElementById('tabTextBtn');
  const formUrl = document.getElementById('urlForm');
  const formText = document.getElementById('textForm');

  hideError();

  if (mode === 'url') {
    tabUrl.classList.add('active');
    tabText.classList.remove('active');
    formUrl.classList.remove('hidden');
    formText.classList.add('hidden');
  } else {
    tabUrl.classList.remove('active');
    tabText.classList.add('active');
    formUrl.classList.add('hidden');
    formText.classList.remove('hidden');
  }
}

// Fill sample URL into input
function fillUrl(url) {
  const input = document.getElementById('urlInput');
  input.value = url;
  input.focus();
}

// URL Submission Handler
async function handleUrlSubmit(e) {
  e.preventDefault();
  const url = document.getElementById('urlInput').value.trim();
  if (!url) return;

  hideError();
  startLoading();

  try {
    const response = await fetch('/api/classify-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || 'Gagal mengekstraksi atau mengklasifikasi URL');
    }

    displayResults(data);
  } catch (err) {
    showError(err.message || 'Terjadi kesalahan sistem saat memproses URL');
  } finally {
    stopLoading();
  }
}

// Direct Text Submission Handler
async function handleTextSubmit(e) {
  e.preventDefault();
  const text = document.getElementById('textInput').value.trim();
  if (!text) return;

  hideError();
  startLoading();

  try {
    const response = await fetch('/api/classify-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || 'Gagal mengklasifikasi teks');
    }

    displayResults(data);
  } catch (err) {
    showError(err.message || 'Terjadi kesalahan sistem saat memproses teks');
  } finally {
    stopLoading();
  }
}

// Loading States & Animated Pipeline Tracker
function startLoading() {
  document.getElementById('processingCard').classList.remove('hidden');
  document.getElementById('resultSection').classList.add('hidden');
  
  const submitUrlBtn = document.getElementById('btnSubmitUrl');
  const submitTextBtn = document.getElementById('btnSubmitText');
  if (submitUrlBtn) submitUrlBtn.disabled = true;
  if (submitTextBtn) submitTextBtn.disabled = true;

  // Pipeline step tracker
  const steps = [
    { title: 'Mengekstraksi Konten Berita...', sub: 'Mengambil data HTML dan mengekstrak teks utama artikel', id: 'track-step-1' },
    { title: 'Membersihkan Noise Teks...', sub: 'Menghilangkan tag [Gambas], rekomendasi redaksi, dan karakter non-alfabet', id: 'track-step-2' },
    { title: 'Preprocessing Teks (Sastrawi)...', sub: 'Menghapus stopword bahasa Indonesia dan melakukan stemming kata', id: 'track-step-3' },
    { title: 'Menghitung Skip-Gram Embedding...', sub: 'Mengekstrak representasi mean word vector dari model Word2Vec', id: 'track-step-4' },
    { title: 'Klasifikasi dengan SVM...', sub: 'Menentukan kategori prediksi (Sport / Finance)', id: 'track-step-5' }
  ];

  let currentStepIdx = 0;
  updateStepUI(steps[0]);

  trackerTimer = setInterval(() => {
    currentStepIdx = (currentStepIdx + 1) % steps.length;
    updateStepUI(steps[currentStepIdx]);
  }, 900);
}

function updateStepUI(step) {
  document.getElementById('stepTitle').textContent = step.title;
  document.getElementById('stepSubtitle').textContent = step.sub;

  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`track-step-${i}`);
    if (el) {
      if (`track-step-${i}` === step.id) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    }
  }
}

function stopLoading() {
  if (trackerTimer) clearInterval(trackerTimer);
  document.getElementById('processingCard').classList.add('hidden');
  
  const submitUrlBtn = document.getElementById('btnSubmitUrl');
  const submitTextBtn = document.getElementById('btnSubmitText');
  if (submitUrlBtn) submitUrlBtn.disabled = false;
  if (submitTextBtn) submitTextBtn.disabled = false;
}

// Display Results
function displayResults(data) {
  const resultSec = document.getElementById('resultSection');
  resultSec.classList.remove('hidden');

  const scraping = data.scraping || {};
  const classification = data.classification || {};
  const pipeline = classification.pipeline_details || {};
  const predLabel = classification.prediction || 'Unknown';

  // 1. Prediction Badge
  const badge = document.getElementById('predictedBadge');
  badge.textContent = predLabel.toUpperCase();
  badge.className = 'pred-badge';
  if (predLabel.toLowerCase().includes('sport')) {
    badge.classList.add('badge-sport');
  } else {
    badge.classList.add('badge-finance');
  }

  // Execution Time
  document.getElementById('execTimeBadge').textContent = `${data.execution_time_ms} ms`;

  // 2. Probabilities
  const probs = classification.probabilities || {};
  const sportPct = probs['Sport'] !== undefined ? probs['Sport'] : (predLabel.toLowerCase().includes('sport') ? 100 : 0);
  const financePct = probs['Finance'] !== undefined ? probs['Finance'] : (predLabel.toLowerCase().includes('finance') ? 100 : 0);

  document.getElementById('probValSport').textContent = `${sportPct}%`;
  document.getElementById('probBarSport').style.width = `${sportPct}%`;
  document.getElementById('probValFinance').textContent = `${financePct}%`;
  document.getElementById('probBarFinance').style.width = `${financePct}%`;

  // 3. Metadata
  document.getElementById('metaTitle').textContent = scraping.title || '-';
  document.getElementById('metaAuthor').textContent = scraping.author || 'Redaksi';
  document.getElementById('metaDate').textContent = scraping.date || 'Tidak tersedia';
  
  const metaUrlEl = document.getElementById('metaUrl');
  if (scraping.url) {
    metaUrlEl.textContent = scraping.url;
    metaUrlEl.href = scraping.url;
    metaUrlEl.style.display = 'inline-block';
  } else {
    metaUrlEl.textContent = 'Input Teks Langsung';
    metaUrlEl.removeAttribute('href');
  }

  // 4. Content Details Tab
  document.getElementById('tabWordCount').textContent = scraping.word_count || 0;
  document.getElementById('contentBody').textContent = scraping.content || '(Teks tidak ditemukan)';

  // 5. Preprocessing Details Tab
  document.getElementById('statTotalTokens').textContent = pipeline.total_tokens || 0;
  document.getElementById('statMatchedTokens').textContent = pipeline.matched_tokens_count || 0;
  document.getElementById('statOovTokens').textContent = pipeline.oov_tokens_count || 0;
  document.getElementById('preprocessedBody').textContent = pipeline.preprocessed_text || '(Kosong)';

  // 6. Embedding Details Tab
  document.getElementById('embedDimVal').textContent = `${pipeline.vector_dimension || 100} Dimensi`;
  
  const vocabContainer = document.getElementById('vocabChips');
  vocabContainer.innerHTML = '';
  const samples = pipeline.matched_sample || [];
  if (samples.length > 0) {
    samples.forEach(w => {
      const chip = document.createElement('span');
      chip.className = 'word-chip';
      chip.textContent = w;
      vocabContainer.appendChild(chip);
    });
  } else {
    vocabContainer.innerHTML = '<span class="text-hint">Tidak ada token yang cocok di kosakata model.</span>';
  }

  // Vector preview
  const vecSamples = pipeline.vector_sample || [];
  const vecBox = document.getElementById('vectorSampleBox');
  if (vecSamples.length > 0) {
    vecBox.textContent = `[${vecSamples.join(', ')}, ...]`;
  } else {
    vecBox.textContent = '[0.0, 0.0, ...]';
  }

  // Scroll to results smoothly
  resultSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Tab Switching inside Details Card
function switchDetailTab(tabName) {
  const tabs = document.querySelectorAll('.dtab-btn');
  const panes = document.querySelectorAll('.dtab-pane');

  tabs.forEach(t => t.classList.remove('active'));
  panes.forEach(p => p.classList.remove('active'));

  const activePane = document.getElementById(`dtab-${tabName}`);
  if (activePane) activePane.classList.add('active');

  // Match active button by text or index
  const tabMap = { 'content': 0, 'preprocessing': 1, 'embedding': 2 };
  if (tabs[tabMap[tabName]]) {
    tabs[tabMap[tabName]].classList.add('active');
  }
}

// Copy Text utility
function copyText(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  navigator.clipboard.writeText(el.innerText || el.textContent)
    .then(() => alert('Teks berhasil disalin ke clipboard!'))
    .catch(() => alert('Gagal menyalin teks.'));
}

// Reset / Test another
function resetApp() {
  document.getElementById('resultSection').classList.add('hidden');
  hideError();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Error Handling
function showError(msg) {
  const box = document.getElementById('errorAlert');
  const msgEl = document.getElementById('errorMessage');
  msgEl.textContent = msg;
  box.classList.remove('hidden');
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideError() {
  const box = document.getElementById('errorAlert');
  box.classList.add('hidden');
}
