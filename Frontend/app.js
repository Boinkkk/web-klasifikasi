/**
 * NewsClassifier Frontend Application Logic
 * Supports Skip-gram (Word2Vec), TF-IDF Modeling, and Side-by-Side Comparison
 */

let currentMode = 'url';
let currentMethod = 'skipgram'; // 'skipgram' | 'tfidf' | 'compare'
let trackerTimer = null;
let currentKeywordsView = 'bar'; // 'bar' | 'chips'

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  checkBackendHealth();
  updateMethodUI();
});

// Select Modeling Method (Skipgram, TF-IDF, or Compare)
function selectModelMethod(method) {
  currentMethod = method;
  updateMethodUI();
}

function updateMethodUI() {
  const optSkip = document.getElementById('optSkipgram');
  const optTfidf = document.getElementById('optTfidf');
  const optCompare = document.getElementById('optCompare');
  const navBadge = document.getElementById('navbarActiveMethodBadge');

  if (optSkip) optSkip.classList.remove('active');
  if (optTfidf) optTfidf.classList.remove('active');
  if (optCompare) optCompare.classList.remove('active');

  if (currentMethod === 'skipgram') {
    if (optSkip) optSkip.classList.add('active');
    if (navBadge) navBadge.textContent = 'Skip-Gram Active';
  } else if (currentMethod === 'tfidf') {
    if (optTfidf) optTfidf.classList.add('active');
    if (navBadge) navBadge.textContent = 'TF-IDF Active';
  } else if (currentMethod === 'compare') {
    if (optCompare) optCompare.classList.add('active');
    if (navBadge) navBadge.textContent = 'Komparasi Aktif';
  }
}

// Check API Health
async function checkBackendHealth() {
  const statusPill = document.getElementById('modelStatusPill');
  const statusText = document.getElementById('modelStatusText');
  
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.status === 'ready') {
      statusPill.className = 'status-pill status-ready';
      statusText.textContent = 'Model Siap (Skip-Gram & TF-IDF)';
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
      body: JSON.stringify({ 
        url: url,
        method: currentMethod
      })
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
      body: JSON.stringify({ 
        text: text,
        method: currentMethod
      })
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

  // Sesuaikan steps berdasarkan metode pemodelan yang dipilih
  let step3Desc, step4Desc, step5Desc;
  if (currentMethod === 'skipgram') {
    step3Desc = {
      title: 'Preprocessing Teks (Skip-gram)...',
      sub: 'Pembersihan noise aktif; Stopword Removal & Stemming dilewati.',
      tracker: '3. Tanpa Stopword & Stemmer'
    };
    step4Desc = {
      title: 'Menghitung Skip-Gram Mean Vector...',
      sub: 'Mengekstrak rata-rata representasi vektor kata dari model Word2Vec',
      tracker: '4. Skip-Gram Embedding'
    };
    step5Desc = '5. Prediksi SVM';
  } else if (currentMethod === 'tfidf') {
    step3Desc = {
      title: 'Preprocessing Teks (TF-IDF)...',
      sub: 'Pembersihan noise, Stopword Removal, dan Stemming Sastrawi lengkap',
      tracker: '3. Preprocessing Sastrawi'
    };
    step4Desc = {
      title: 'Menghitung Pembobotan TF-IDF...',
      sub: 'Mentransformasikan frekuensi kata dokumen menggunakan matriks TF-IDF',
      tracker: '4. TF-IDF Vectorizer'
    };
    step5Desc = '5. Prediksi Klasifikasi';
  } else {
    // Mode Komparasi
    step3Desc = {
      title: 'Preprocessing Dual Pipeline...',
      sub: 'Menjalankan pra-pemrosesan teks untuk Skip-Gram dan TF-IDF sekaligus',
      tracker: '3. Dual Preprocessing'
    };
    step4Desc = {
      title: 'Vektorisasi Skip-Gram & TF-IDF...',
      sub: 'Mengekstrak Word2Vec Mean Vector dan matriks TF-IDF secara paralel',
      tracker: '4. Ekstraksi Dua Fitur'
    };
    step5Desc = '5. Komparasi Hasil Kedua Model';
  }

  // Update label tracker
  const trackStep3 = document.getElementById('track-step-3');
  const trackStep4 = document.getElementById('track-step-4');
  const trackStep5 = document.getElementById('track-step-5');
  if (trackStep3) trackStep3.textContent = step3Desc.tracker;
  if (trackStep4) trackStep4.textContent = step4Desc.tracker;
  if (trackStep5) trackStep5.textContent = step5Desc;

  const steps = [
    { title: 'Mengekstraksi Konten Berita...', sub: 'Mengambil data HTML dan mengekstrak teks utama artikel', id: 'track-step-1' },
    { title: 'Membersihkan Noise Teks...', sub: 'Menghilangkan tag [Gambas], URL, dan karakter non-alfabet', id: 'track-step-2' },
    { title: step3Desc.title, sub: step3Desc.sub, id: 'track-step-3' },
    { title: step4Desc.title, sub: step4Desc.sub, id: 'track-step-4' },
    { title: 'Memprediksi & Mengkomparasi...', sub: 'Model mengklasifikasikan ke kategori target (Sport / Finance)', id: 'track-step-5' }
  ];

  let currentStepIdx = 0;
  updateStepUI(steps[0]);

  trackerTimer = setInterval(() => {
    currentStepIdx = (currentStepIdx + 1) % steps.length;
    updateStepUI(steps[currentStepIdx]);
  }, 850);
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
  const methodUsed = classification.method || 'skipgram';

  const singleCard = document.getElementById('singleResultCard');
  const comparisonCard = document.getElementById('comparisonCard');

  // ==========================================
  // KASUS 1: MODE KOMPARASI (SIDE-BY-SIDE)
  // ==========================================
  if (methodUsed === 'compare') {
    if (singleCard) singleCard.classList.add('hidden');
    if (comparisonCard) comparisonCard.classList.remove('hidden');

    const isAgreed = classification.agreement;
    const consensus = classification.consensus || 'Sport';
    const sg = classification.skipgram || {};
    const tfidf = classification.tfidf || {};

    const banner = document.getElementById('comparisonBanner');
    const badge = document.getElementById('consensusBadge');
    const title = document.getElementById('consensusTitle');
    const desc = document.getElementById('consensusDesc');

    if (isAgreed) {
      banner.className = 'comparison-banner banner-agree';
      badge.textContent = 'KONSENSUS MODEL: SEPAKAT';
      title.textContent = `Kedua Model Sepakat: ${consensus.toUpperCase()}`;
      desc.textContent = `Baik Skip-Gram maupun TF-IDF memprediksi artikel ini sebagai kategori ${consensus} dengan keyakinan konsisten.`;
    } else {
      banner.className = 'comparison-banner banner-diverge';
      badge.textContent = 'HASIL DIVERGEN (BEDA PENDAPAT)';
      title.textContent = 'Model Memberikan Prediksi Berbeda';
      desc.textContent = `Skip-Gram memprediksi ${sg.prediction || '-'}, sedangkan TF-IDF memprediksi ${tfidf.prediction || '-'}.`;
    }

    // Populate Left (Skip-Gram)
    const sgBadge = document.getElementById('compareSgBadge');
    const sgPred = (sg.prediction || 'Sport').toUpperCase();
    sgBadge.textContent = sgPred;
    sgBadge.className = `pred-badge ${sgPred.includes('SPORT') ? 'badge-sport' : 'badge-finance'}`;
    document.getElementById('compareSgTime').textContent = `${sg.execution_time_ms || 0} ms`;

    const sgProbs = sg.probabilities || {};
    const sgSportPct = sgProbs['Sport'] !== undefined ? sgProbs['Sport'] : (sgPred.includes('SPORT') ? 100 : 0);
    const sgFinPct = sgProbs['Finance'] !== undefined ? sgProbs['Finance'] : (sgPred.includes('FINANCE') ? 100 : 0);
    document.getElementById('compareSgProbSportVal').textContent = `${sgSportPct}%`;
    document.getElementById('compareSgProbSportBar').style.width = `${sgSportPct}%`;
    document.getElementById('compareSgProbFinanceVal').textContent = `${sgFinPct}%`;
    document.getElementById('compareSgProbFinanceBar').style.width = `${sgFinPct}%`;

    // Populate Right (TF-IDF)
    const tfidfBadge = document.getElementById('compareTfidfBadge');
    const tfidfPred = (tfidf.prediction || 'Sport').toUpperCase();
    tfidfBadge.textContent = tfidfPred;
    tfidfBadge.className = `pred-badge ${tfidfPred.includes('SPORT') ? 'badge-sport' : 'badge-finance'}`;
    document.getElementById('compareTfidfTime').textContent = `${tfidf.execution_time_ms || 0} ms`;

    const tfidfProbs = tfidf.probabilities || {};
    const tfidfSportPct = tfidfProbs['Sport'] !== undefined ? tfidfProbs['Sport'] : (tfidfPred.includes('SPORT') ? 100 : 0);
    const tfidfFinPct = tfidfProbs['Finance'] !== undefined ? tfidfProbs['Finance'] : (tfidfPred.includes('FINANCE') ? 100 : 0);
    document.getElementById('compareTfidfProbSportVal').textContent = `${tfidfSportPct}%`;
    document.getElementById('compareTfidfProbSportBar').style.width = `${tfidfSportPct}%`;
    document.getElementById('compareTfidfProbFinanceVal').textContent = `${tfidfFinPct}%`;
    document.getElementById('compareTfidfProbFinanceBar').style.width = `${tfidfFinPct}%`;

    // Ambil pipeline details dari TF-IDF sebagai representasi utama kata kunci
    renderPipelineDetails(tfidf.pipeline_details || {}, 'compare', tfidf);

  } else {
    // ==========================================
    // KASUS 2: SINGLE MODEL (SKIP-GRAM ATAU TF-IDF)
    // ==========================================
    if (comparisonCard) comparisonCard.classList.add('hidden');
    if (singleCard) singleCard.classList.remove('hidden');

    const predLabel = classification.prediction || 'Unknown';
    const badge = document.getElementById('predictedBadge');
    badge.textContent = predLabel.toUpperCase();
    badge.className = 'pred-badge';
    if (predLabel.toLowerCase().includes('sport')) {
      badge.classList.add('badge-sport');
    } else {
      badge.classList.add('badge-finance');
    }

    const methodPill = document.getElementById('resultMethodPill');
    if (methodPill) {
      methodPill.textContent = methodUsed === 'tfidf' ? 'TF-IDF' : 'Skip-Gram';
    }

    document.getElementById('execTimeBadge').textContent = `${data.execution_time_ms} ms`;

    const probs = classification.probabilities || {};
    const sportPct = probs['Sport'] !== undefined ? probs['Sport'] : (predLabel.toLowerCase().includes('sport') ? 100 : 0);
    const financePct = probs['Finance'] !== undefined ? probs['Finance'] : (predLabel.toLowerCase().includes('finance') ? 100 : 0);

    document.getElementById('probValSport').textContent = `${sportPct}%`;
    document.getElementById('probBarSport').style.width = `${sportPct}%`;
    document.getElementById('probValFinance').textContent = `${financePct}%`;
    document.getElementById('probBarFinance').style.width = `${financePct}%`;

    document.getElementById('metaMethodFull').textContent = classification.method_label || (methodUsed === 'tfidf' ? 'TF-IDF Vectorizer + Classifier' : 'Skip-Gram + SVM');

    renderPipelineDetails(classification.pipeline_details || {}, methodUsed, classification);
  }

  // Populate Metadata (Umum untuk kedua mode)
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

  document.getElementById('tabWordCount').textContent = scraping.word_count || 0;
  document.getElementById('contentBody').textContent = scraping.content || '(Teks tidak ditemukan)';

  // Scroll smoothly to results
  resultSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Render Pipeline Details & Bar Chart Visualization (Fitur Poin 2)
function renderPipelineDetails(pipeline, methodUsed, classification) {
  // 1. Preprocessing Tab Notice
  const noticeBox = document.getElementById('preprocessNoticeBox');
  const noticeText = document.getElementById('preprocessNoticeText');
  if (noticeBox && noticeText) {
    if (methodUsed === 'skipgram') {
      noticeBox.className = 'preprocessing-notice notice-skipgram';
      noticeText.innerHTML = '<strong>Aturan Skip-Gram:</strong> Pembersihan noise diterapkan, sedangkan <strong>Stopword Removal &amp; Stemming dilewati</strong> sesuai karakteristik embedding.';
    } else if (methodUsed === 'tfidf') {
      noticeBox.className = 'preprocessing-notice';
      noticeText.innerHTML = '<strong>Aturan TF-IDF:</strong> Pembersihan noise, <strong>Stopword Removal, dan Stemming Sastrawi</strong> diterapkan secara lengkap.';
    } else {
      noticeBox.className = 'preprocessing-notice';
      noticeText.innerHTML = '<strong>Mode Komparasi:</strong> Menampilkan hasil pra-pemrosesan teks lengkap dari pipeline TF-IDF Sastrawi.';
    }
  }

  document.getElementById('statTotalTokens').textContent = pipeline.total_tokens || 0;
  
  const matchedLabel = document.getElementById('statMatchedLabel');
  const oovLabel = document.getElementById('statOovLabel');
  if (methodUsed === 'tfidf' || methodUsed === 'compare') {
    if (matchedLabel) matchedLabel.textContent = 'Fitur TF-IDF Aktif';
    if (oovLabel) oovLabel.textContent = 'Fitur Kosong';
  } else {
    if (matchedLabel) matchedLabel.textContent = 'Token Masuk Vocab';
    if (oovLabel) oovLabel.textContent = 'Token OOV';
  }
  document.getElementById('statMatchedTokens').textContent = pipeline.matched_tokens_count || 0;
  document.getElementById('statOovTokens').textContent = pipeline.oov_tokens_count || 0;
  document.getElementById('preprocessedBody').textContent = pipeline.preprocessed_text || '(Kosong)';

  // 2. Feature Details Tab (Dimensi & Metode)
  const embedDimTitle = document.getElementById('embedDimTitle');
  const embedDimVal = document.getElementById('embedDimVal');
  const embedMethodVal = document.getElementById('embedMethodVal');
  const chartTitle = document.getElementById('chartSectionTitle');
  const chartSub = document.getElementById('chartSectionSubtitle');

  if (methodUsed === 'tfidf' || methodUsed === 'compare') {
    if (embedDimTitle) embedDimTitle.textContent = 'Total Dimensi Kosakata TF-IDF';
    if (embedDimVal) embedDimVal.textContent = `${pipeline.vector_dimension || 0} Fitur`;
    if (embedMethodVal) embedMethodVal.textContent = 'TF-IDF Matrix (Term Frequency - Inverse Document Frequency)';
    if (chartTitle) chartTitle.textContent = 'Grafik Bobot Kata Kunci Teratas (TF-IDF)';
    if (chartSub) chartSub.textContent = 'Distribusi kata dengan bobot TF-IDF tertinggi yang menentukan kategori';
  } else {
    if (embedDimTitle) embedDimTitle.textContent = 'Dimensi Vektor Fitur (Skip-Gram)';
    if (embedDimVal) embedDimVal.textContent = `${pipeline.vector_dimension || 100} Dimensi`;
    if (embedMethodVal) embedMethodVal.textContent = 'Mean Word Vector (Rata-rata Vektor Kata)';
    if (chartTitle) chartTitle.textContent = 'Grafik Frekuensi Kata Kunci Vocab (Skip-Gram)';
    if (chartSub) chartSub.textContent = 'Frekuensi kata-kata dalam artikel yang ditemukan pada model Skip-Gram';
  }

  // 3. Render Bar Chart Visualization
  const topKeywords = pipeline.top_keywords || [];
  renderKeywordsBarChart(topKeywords, methodUsed);

  // 4. Render Chips Container
  const vocabContainer = document.getElementById('vocabChips');
  vocabContainer.innerHTML = '';
  if (topKeywords.length > 0) {
    topKeywords.forEach(k => {
      const chip = document.createElement('span');
      chip.className = methodUsed === 'skipgram' ? 'word-chip' : 'tfidf-chip';
      chip.innerHTML = `<strong>${k.word}</strong> <span class="tfidf-score-tag">${k.score_label || k.score}</span>`;
      vocabContainer.appendChild(chip);
    });
  } else {
    vocabContainer.innerHTML = '<span class="text-hint">Tidak ada kata kunci terdeteksi.</span>';
  }

  // 5. Vector preview
  const vecSamples = pipeline.vector_sample || [];
  const vecBox = document.getElementById('vectorSampleBox');
  if (vecSamples.length > 0) {
    vecBox.textContent = `[${vecSamples.join(', ')}, ...]`;
  } else {
    vecBox.textContent = '[0.0, 0.0, ...]';
  }
}

// Render Interactive Bar Chart for Top Keywords (Fitur Poin 2)
function renderKeywordsBarChart(keywords, methodUsed) {
  const chartBox = document.getElementById('keywordsBarChart');
  chartBox.innerHTML = '';

  if (!keywords || keywords.length === 0) {
    chartBox.innerHTML = '<p class="text-hint" style="padding: 1rem; text-align: center;">Tidak ada data kata kunci untuk divisualisasikan.</p>';
    return;
  }

  keywords.forEach(item => {
    const row = document.createElement('div');
    row.className = 'keyword-bar-row';

    const wordLabel = document.createElement('span');
    wordLabel.className = 'kbar-word';
    wordLabel.textContent = item.word;
    wordLabel.title = item.word;

    const track = document.createElement('div');
    track.className = 'kbar-track';

    const fill = document.createElement('div');
    fill.className = `kbar-fill ${methodUsed === 'skipgram' ? '' : 'fill-tfidf'}`;
    fill.style.width = '0%'; // Start at 0 for animation

    track.appendChild(fill);

    const score = document.createElement('span');
    score.className = 'kbar-score';
    score.textContent = item.score_label || item.score;

    row.appendChild(wordLabel);
    row.appendChild(track);
    row.appendChild(score);

    chartBox.appendChild(row);

    // Animate bar width smoothly
    setTimeout(() => {
      fill.style.width = `${item.relative_pct || 10}%`;
    }, 50);
  });
}

// Toggle View between Bar Chart and Chips
function toggleKeywordView(viewType) {
  currentKeywordsView = viewType;
  const btnBar = document.getElementById('btnViewBar');
  const btnChips = document.getElementById('btnViewChips');
  const chartBox = document.getElementById('keywordsBarChart');
  const chipsBox = document.getElementById('vocabChips');

  if (viewType === 'bar') {
    btnBar.classList.add('active');
    btnChips.classList.remove('active');
    chartBox.classList.remove('hidden');
    chipsBox.classList.add('hidden');
  } else {
    btnBar.classList.remove('active');
    btnChips.classList.add('active');
    chartBox.classList.add('hidden');
    chipsBox.classList.remove('hidden');
  }
}

// Tab Switching inside Details Card
function switchDetailTab(tabName) {
  const tabs = document.querySelectorAll('.dtab-btn');
  const panes = document.querySelectorAll('.dtab-pane');

  tabs.forEach(t => t.classList.remove('active'));
  panes.forEach(p => p.classList.remove('active'));

  const activePane = document.getElementById(`dtab-${tabName}`);
  if (activePane) activePane.classList.add('active');

  const tabMap = { 'content': 'tabBtnContent', 'preprocessing': 'tabBtnPreprocess', 'embedding': 'tabBtnFeature' };
  const activeBtn = document.getElementById(tabMap[tabName]);
  if (activeBtn) activeBtn.classList.add('active');
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
