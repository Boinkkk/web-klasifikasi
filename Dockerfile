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

# Environment variable port default
ENV PORT=8000
EXPOSE 8000

# Menjalankan aplikasi via run.py yang sudah mendukung dynamic PORT
CMD ["python", "run.py"]
