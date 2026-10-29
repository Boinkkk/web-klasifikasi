FROM python:3.11-slim

WORKDIR /app

# Install build dependencies yang dibutuhkan library C-extensions (gensim/scikit-learn)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install dependensi Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy seluruh source code & model
COPY . .

# Port default: 7860 (Standar Hugging Face Spaces & Cloud Hosting)
ENV PORT=7860
EXPOSE 7860

# Menjalankan aplikasi via run.py yang sudah membaca variabel PORT dinamis
CMD ["python", "run.py"]
