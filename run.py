import uvicorn
import sys
from pathlib import Path

if __name__ == "__main__":
    print("=" * 60)
    print("  Sistem Klasifikasi Berita (FastAPI + Skip-Gram + SVM)  ")
    print("=" * 60)
    print("  Server akan berjalan di: http://127.0.0.1:8000")
    print("  Dokumentasi API Swagger : http://127.0.0.1:8000/docs")
    print("=" * 60)

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
