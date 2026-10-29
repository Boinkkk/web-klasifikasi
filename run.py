import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    host = os.environ.get("HOST", "0.0.0.0")
    
    print("=" * 60)
    print("  Sistem Klasifikasi Berita (FastAPI + Skip-Gram + SVM)  ")
    print("=" * 60)
    print(f"  Server berjalan di: http://{host}:{port}")
    print(f"  Dokumentasi API   : http://{host}:{port}/docs")
    print("=" * 60)

    uvicorn.run("backend.main:app", host=host, port=port, reload=False)
