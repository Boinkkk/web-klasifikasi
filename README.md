# Web Sistem Klasifikasi Berita (FastAPI + Skip-Gram & TF-IDF)

Aplikasi web klasifikasi artikel berita otomatis berdasarkan tautan (URL) dengan fleksibilitas pemilihan metode ekstraksi fitur teks:
1. **Word2Vec Skip-Gram (Mean Word Vector)**:
   - Pembersihan noise aktif.
   - **Stopword removal & stemming dinonaktifkan / dilewati**.
   - Model Word2Vec Skip-gram (`model_skipgram_terbaik.model`) & SVM Classifier (`model_klasifikasi_terbaik.joblib`).
2. **TF-IDF Vectorizer**:
   - Pembersihan noise aktif.
   - **Stopword removal & stemming Sastrawi diterapkan secara penuh**.
   - Model TF-IDF Vectorizer (`tfidf_vectorizer.joblib`) & Classifier TF-IDF (`model_klasifikasi_tfidf_terbaik.joblib`).

Kategori klasifikasi target: **Sport** & **Finance**.

---

## 🚀 Fitur Utama
1. **Pemilihan Pemodelan Interaktif**: Pengguna dapat memilih antara **Skip-Gram** atau **TF-IDF** langsung di antarmuka web.
2. **Ekstraksi Berita Otomatis (Web Scraping)**: Mengambil konten utama, judul, penulis, dan tanggal publikasi dari URL menggunakan library `trafilatura`.
3. **Penyajian Transparan Seluruh Alur NLP**:
   - Konten asli hasil ekstraksi artikel.
   - Teks hasil preprocessing sesuai metode yang dipilih.
   - Rincian vektor fitur (Mean vector untuk Skip-gram, atau daftar kata kunci teratas beserta bobot TF-IDF untuk TF-IDF).
   - Distribusi probabilitas/keyakinan model (*Sport* vs *Finance*).

---

## 📁 Struktur Model (`backend/model/`)
- `model_skipgram_terbaik.model`: Model Word2Vec Skip-gram
- `model_klasifikasi_terbaik.joblib`: Model klasifikasi untuk representasi Skip-gram
- `tfidf_vectorizer.joblib`: Model TF-IDF Vectorizer
- `model_klasifikasi_tfidf_terbaik.joblib`: Model klasifikasi untuk representasi TF-IDF

---

## 🛠️ Cara Menjalankan

```bash
# 1. Install dependensi
pip install -r requirements.txt

# 2. Jalankan server
python run.py
```
Akses web di: [http://127.0.0.1:8000](http://127.0.0.1:8000)
