import time
import os
import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, HttpUrl

# Root directory
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from link_extraction import extract_news
from backend.predictor import get_pipeline

app = FastAPI(
    title="Sistem Klasifikasi Berita (Skip-Gram & SVM)",
    description="Ekstraksi artikel berita otomatis dan klasifikasi kategori (Sport / Finance)",
    version="1.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Models
class UrlRequest(BaseModel):
    url: str

class TextRequest(BaseModel):
    text: str


@app.on_event("startup")
def startup_event():
    print("[SERVER] Memulai server FastAPI...")
    try:
        pipeline = get_pipeline()
        print(f"[SERVER] Pipeline siap. Kategori: {pipeline.classes}, Dimensi: {pipeline.vector_size}")
    except Exception as e:
        print(f"[SERVER ERROR] Gagal inisialisasi model pada startup: {e}")


@app.get("/api/health")
def health_check():
    try:
        pipeline = get_pipeline()
        return {
            "status": "ready",
            "model_classes": pipeline.classes,
            "vector_dimension": pipeline.vector_size,
            "models_loaded": pipeline.is_loaded
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


@app.post("/api/classify-url")
def classify_url(payload: UrlRequest):
    url = payload.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL harus diawali dengan http:// atau https://")

    start_time = time.time()

    # 1. Scraping & Ekstraksi Berita
    try:
        scraped_data = extract_news(url)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Terjadi kesalahan saat mengekstraksi URL: {str(e)}"
        )

    if not scraped_data or scraped_data.get("error"):
        error_msg = scraped_data.get("error", "Konten tidak dapat diekstraksi dari URL yang diberikan.")
        raise HTTPException(status_code=422, detail=error_msg)

    content = scraped_data.get("content", "").strip()
    if not content:
        raise HTTPException(
            status_code=422,
            detail="Teks artikel tidak ditemukan atau terlalu pendek setelah proses ekstraksi."
        )

    # 2. Klasifikasi menggunakan Word2Vec Skip-Gram & SVM
    try:
        pipeline = get_pipeline()
        classification_result = pipeline.classify_text(content)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Terjadi kesalahan saat memproses klasifikasi: {str(e)}"
        )

    elapsed_ms = round((time.time() - start_time) * 1000, 2)

    return {
        "status": "success",
        "scraping": {
            "url": scraped_data.get("url"),
            "title": scraped_data.get("title") or "Tidak ada judul terdeteksi",
            "author": scraped_data.get("author") or "Redaksi / Tidak disebutkan",
            "date": scraped_data.get("date") or "Tidak tersedia",
            "content": content,
            "word_count": len(content.split())
        },
        "classification": classification_result,
        "execution_time_ms": elapsed_ms
    }


@app.post("/api/classify-text")
def classify_direct_text(payload: TextRequest):
    text = payload.text.strip()
    if len(text) < 10:
        raise HTTPException(status_code=400, detail="Teks minimal harus terdiri dari 10 karakter.")

    start_time = time.time()
    try:
        pipeline = get_pipeline()
        classification_result = pipeline.classify_text(text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memproses teks: {str(e)}")

    elapsed_ms = round((time.time() - start_time) * 1000, 2)

    return {
        "status": "success",
        "scraping": {
            "url": None,
            "title": "Input Teks Langsung",
            "author": "User",
            "date": time.strftime("%Y-%m-%d %H:%M:%S"),
            "content": text,
            "word_count": len(text.split())
        },
        "classification": classification_result,
        "execution_time_ms": elapsed_ms
    }


# Static Frontend Files
FRONTEND_DIR = BASE_DIR / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

@app.get("/")
def serve_frontend():
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {"message": "Sistem Klasifikasi Berita API is running. Frontend belum ditemukan."}
