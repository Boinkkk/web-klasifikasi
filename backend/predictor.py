import os
import sys
from pathlib import Path
import numpy as np
import joblib

# Pastikan root proyek berada dalam sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from preprocessing import bersihkan_noise_teks, stopword_dan_stemming

MODEL_DIR = Path(__file__).resolve().parent / "model"
SVM_MODEL_PATH = MODEL_DIR / "model_klasifikasi_terbaik.joblib"
SKIPGRAM_MODEL_PATH = MODEL_DIR / "model_skipgram_terbaik.model"


class ClassificationPipeline:
    def __init__(self):
        self.clf = None
        self.w2v = None
        self.wv = None
        self.vector_size = 100
        self.classes = []
        self.is_loaded = False
        self.load_models()

    def load_models(self):
        print(f"[INFO] Memuat model SVM dari: {SVM_MODEL_PATH}")
        if not SVM_MODEL_PATH.exists():
            raise FileNotFoundError(f"File model klasifikasi tidak ditemukan: {SVM_MODEL_PATH}")
        self.clf = joblib.load(str(SVM_MODEL_PATH))

        if hasattr(self.clf, "classes_"):
            self.classes = [str(c) for c in self.clf.classes_]
        else:
            self.classes = ["Sport", "Finance"]

        print(f"[INFO] Kelas model SVM terdeteksi: {self.classes}")

        print(f"[INFO] Memuat model Skip-gram dari: {SKIPGRAM_MODEL_PATH}")
        if not SKIPGRAM_MODEL_PATH.exists():
            raise FileNotFoundError(f"File model Skip-gram tidak ditemukan: {SKIPGRAM_MODEL_PATH}")

        try:
            from gensim.models import Word2Vec
            self.w2v = Word2Vec.load(str(SKIPGRAM_MODEL_PATH))
            if hasattr(self.w2v, "wv"):
                self.wv = self.w2v.wv
            else:
                self.wv = self.w2v
        except Exception as e_gensim:
            print(f"[WARN] Gagal memuat via Word2Vec.load ({e_gensim}), mencoba alternatif loader...")
            try:
                from gensim.models import KeyedVectors
                self.wv = KeyedVectors.load(str(SKIPGRAM_MODEL_PATH))
            except Exception:
                self.wv = joblib.load(str(SKIPGRAM_MODEL_PATH))
                if hasattr(self.wv, "wv"):
                    self.wv = self.wv.wv

        if hasattr(self.wv, "vector_size"):
            self.vector_size = int(self.wv.vector_size)
        elif hasattr(self.wv, "vectors"):
            self.vector_size = int(self.wv.vectors.shape[1])
        else:
            self.vector_size = 100

        print(f"[INFO] Skip-gram Word Embedding siap. Dimensi vektor: {self.vector_size}")
        self.is_loaded = True

    def is_word_in_vocab(self, word: str) -> bool:
        if self.wv is None:
            return False
        if hasattr(self.wv, "key_to_index"):
            return word in self.wv.key_to_index
        return word in self.wv

    def get_word_vector(self, word: str):
        return self.wv[word]

    def compute_mean_word_vector(self, tokens: list[str]) -> tuple[np.ndarray, list[str], list[str]]:
        matched_tokens = []
        oov_tokens = []
        vectors = []

        for token in tokens:
            if not token:
                continue
            if self.is_word_in_vocab(token):
                matched_tokens.append(token)
                vectors.append(self.get_word_vector(token))
            else:
                oov_tokens.append(token)

        if len(vectors) > 0:
            mean_vec = np.mean(vectors, axis=0)
        else:
            mean_vec = np.zeros(self.vector_size, dtype=np.float32)

        return mean_vec, matched_tokens, oov_tokens

    def classify_text(self, text: str) -> dict:
        if not self.is_loaded:
            self.load_models()

        # Step 1: Cleaning Noise
        cleaned_noise = bersihkan_noise_teks(text)

        # Step 2: Stopword Removal & Stemming (Sastrawi)
        processed_text = stopword_dan_stemming(cleaned_noise)

        # Step 3: Tokenization
        tokens = [t.strip() for t in processed_text.split() if t.strip()]

        # Step 4: Word Embedding & Mean Vector
        vector, matched_words, oov_words = self.compute_mean_word_vector(tokens)

        # Step 5: Prediksi dengan SVM
        vector_2d = vector.reshape(1, -1)
        raw_pred = self.clf.predict(vector_2d)[0]
        prediction_label = str(raw_pred)

        # Mapping label jika berupa angka / kode
        label_mapping = {
            "0": "Finance",
            "1": "Sport",
            "finance": "Finance",
            "sport": "Sport",
            "FINANCE": "Finance",
            "SPORT": "Sport"
        }
        formatted_label = label_mapping.get(prediction_label, prediction_label)

        # Probabilitas / Decision Function jika ada
        probabilities = {}
        if hasattr(self.clf, "predict_proba"):
            try:
                probs = self.clf.predict_proba(vector_2d)[0]
                for idx, c in enumerate(self.clf.classes_):
                    c_name = label_mapping.get(str(c), str(c))
                    probabilities[c_name] = round(float(probs[idx]) * 100, 2)
            except Exception as e_prob:
                print(f"[WARN] Tidak dapat menghitung predict_proba: {e_prob}")
        elif hasattr(self.clf, "decision_function"):
            try:
                dec = self.clf.decision_function(vector_2d)
                # Normalisasi softmax untuk estimasi confidence
                dec_val = np.array(dec).flatten()
                if len(dec_val) == 1:
                    # binary classification single score
                    val = float(dec_val[0])
                    # Sigmoid
                    prob_sport = 1 / (1 + np.exp(-val))
                    prob_finance = 1 - prob_sport
                    probabilities["Sport"] = round(float(prob_sport) * 100, 2)
                    probabilities["Finance"] = round(float(prob_finance) * 100, 2)
                else:
                    exp_dec = np.exp(dec_val - np.max(dec_val))
                    probs = exp_dec / exp_dec.sum()
                    for idx, c in enumerate(self.clf.classes_):
                        c_name = label_mapping.get(str(c), str(c))
                        probabilities[c_name] = round(float(probs[idx]) * 100, 2)
            except Exception as e_dec:
                print(f"[WARN] Tidak dapat menghitung decision_function: {e_dec}")

        return {
            "prediction": formatted_label,
            "raw_prediction": str(raw_pred),
            "probabilities": probabilities,
            "pipeline_details": {
                "raw_text_length": len(text),
                "cleaned_text": cleaned_noise,
                "preprocessed_text": processed_text,
                "total_tokens": len(tokens),
                "matched_tokens_count": len(matched_words),
                "oov_tokens_count": len(oov_words),
                "matched_sample": matched_words[:20],
                "vector_dimension": self.vector_size,
                "vector_sample": [round(float(v), 5) for v in vector[:10]],
            }
        }


# Singleton pipeline instance
pipeline_instance = None

def get_pipeline():
    global pipeline_instance
    if pipeline_instance is None:
        pipeline_instance = ClassificationPipeline()
    return pipeline_instance
