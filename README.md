# Web Sistem Klasifikasi Berita (FastAPI + Skip-Gram + SVM)

Aplikasi web klasifikasi artikel berita otomatis berdasarkan tautan (URL) menggunakan metode **Word2Vec Skip-Gram (Mean Word Vector)** untuk ekstraksi fitur teks dan **Support Vector Machine (SVM)** untuk klasifikasi kategori (**Sport** & **Finance**).

## 🚀 Fitur Utama
1. **Ekstraksi Berita Otomatis (Web Scraping)**: Mengambil konten utama, judul, penulis, dan tanggal publikasi dari URL menggunakan library `trafilatura`.
2. **Text Preprocessing Pipeline**:
   - Pembersihan noise & teks non-alfabet (`bersihkan_noise_teks`).
   - Stopword Removal & Stemming Bahasa Indonesia menggunakan library `Sastrawi` (`stopword_dan_stemming`).
3. **Word Embedding (Skip-Gram)**:
   - Representasi dokumen dihitung menggunakan **Mean Word Vector** dari token yang cocok dengan vocabulary model Word2Vec Skip-Gram.
4. **Klasifikasi Kategori**:
   - Model Support Vector Machine (SVM) memprediksi kategori target (**Sport** atau **Finance**) beserta probabilitas / tingkat keyakinan.
5. **Antarmuka Modern & Minimalis**:
   - Desain modern, bersih, profesional, dan responsif.
   - Dilengkapi tombol cepat contoh tautan berita.
   - Menampilkan transparansi seluruh tahapan pemrosesan teks (konten terekstraksi, hasil preprocessing Sastrawi, hingga statistik embedding).

---

## 📁 Struktur Direktori
```text
web-klasifikasi/
├── backend/
│   ├── __init__.py
│   ├── main.py                  # Server FastAPI & endpoint API
│   ├── predictor.py             # Pipeline inference (Word2Vec + SVM)
│   └── model/
│       ├── model_klasifikasi_terbaik.joblib   # Model klasifikasi SVM
│       └── model_skipgram_terbaik.model       # Model Skip-gram Word2Vec
├── frontend/
│   ├── index.html               # Halaman antarmuka pengguna
│   ├── style.css                # Desain visual modern & profesional
│   └── app.js                   # Interaksi frontend & pemanggilan API
├── link_extraction.py           # Ekstraksi konten berita dari URL
├── preprocessing.py             # Fungsi pembersihan teks & Sastrawi
├── run.py                       # Script praktis untuk menjalankan server
└── requirements.txt             # Dependensi Python
```

---

## 🛠️ Cara Menjalankan

### 1. Install Dependensi
Pastikan dependensi telah terpasang:
```bash
pip install -r requirements.txt
```

### 2. Jalankan Server Web
Jalankan file `run.py`:
```bash
python run.py
```
atau menggunakan perintah `uvicorn`:
```bash
uvicorn backend.main:app --reload --port 8000
```

### 3. Buka di Browser
Akses aplikasi web di browser:
- **Web App**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Dokumentasi API Swagger**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
