import os
import sys
import time
from pathlib import Path
from collections import Counter
import numpy as np
import joblib

# Pastikan root proyek berada dalam sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from preprocessing import bersihkan_noise_teks, stopword_dan_stemming

MODEL_DIR = Path(__file__).resolve().parent / "model"

# Model Paths: Skip-gram
SVM_SKIPGRAM_PATH = MODEL_DIR / "model_klasifikasi_terbaik.joblib"
SKIPGRAM_MODEL_PATH = MODEL_DIR / "model_skipgram_terbaik.model"

# Model Paths: TF-IDF
SVM_TFIDF_PATH = MODEL_DIR / "model_klasifikasi_tfidf_terbaik.joblib"
TFIDF_VECTORIZER_PATH = MODEL_DIR / "tfidf_vectorizer.joblib"


class ClassificationPipeline:
    def __init__(self):
        # Skip-gram components
        self.clf_skipgram = None
        self.w2v = None
        self.wv = None
        self.skipgram_vector_size = 100

        # TF-IDF components
        self.clf_tfidf = None
        self.tfidf_vectorizer = None

        self.classes = ["Sport", "Finance"]
        self.is_loaded = False
        self.load_models()

    def load_models(self):
        print(f"[INFO] Memeriksa ketersediaan model di: {MODEL_DIR}")

        # 1. Load Skip-gram Classifier & Word2Vec
        if SVM_SKIPGRAM_PATH.exists():
            print(f"[INFO] Memuat model SVM (Skip-gram) dari: {SVM_SKIPGRAM_PATH.name}")
            self.clf_skipgram = joblib.load(str(SVM_SKIPGRAM_PATH))
            if hasattr(self.clf_skipgram, "classes_"):
                self.classes = [str(c) for c in self.clf_skipgram.classes_]

        if SKIPGRAM_MODEL_PATH.exists():
            print(f"[INFO] Memuat Word2Vec Skip-gram dari: {SKIPGRAM_MODEL_PATH.name}")
            try:
                from gensim.models import Word2Vec
                self.w2v = Word2Vec.load(str(SKIPGRAM_MODEL_PATH))
                self.wv = self.w2v.wv if hasattr(self.w2v, "wv") else self.w2v
            except Exception as e_w2v:
                print(f"[WARN] Word2Vec.load gagal ({e_w2v}), mencoba loader alternatif...")
                try:
                    from gensim.models import KeyedVectors
                    self.wv = KeyedVectors.load(str(SKIPGRAM_MODEL_PATH))
                except Exception:
                    loaded = joblib.load(str(SKIPGRAM_MODEL_PATH))
                    self.wv = loaded.wv if hasattr(loaded, "wv") else loaded

            if self.wv is not None:
                if hasattr(self.wv, "vector_size"):
                    self.skipgram_vector_size = int(self.wv.vector_size)
                elif hasattr(self.wv, "vectors"):
                    self.skipgram_vector_size = int(self.wv.vectors.shape[1])

        # 2. Load TF-IDF Vectorizer & Classifier
        if TFIDF_VECTORIZER_PATH.exists():
            print(f"[INFO] Memuat TF-IDF Vectorizer dari: {TFIDF_VECTORIZER_PATH.name}")
            self.tfidf_vectorizer = joblib.load(str(TFIDF_VECTORIZER_PATH))

        if SVM_TFIDF_PATH.exists():
            print(f"[INFO] Memuat model Klasifikasi (TF-IDF) dari: {SVM_TFIDF_PATH.name}")
            self.clf_tfidf = joblib.load(str(SVM_TFIDF_PATH))

        self.is_loaded = True
        print(f"[INFO] Semua model siap. Kelas: {self.classes}")

    def is_word_in_vocab(self, word: str) -> bool:
        if self.wv is None:
            return False
        if hasattr(self.wv, "key_to_index"):
            return word in self.wv.key_to_index
        return word in self.wv

    def compute_mean_word_vector(self, tokens: list[str]) -> tuple[np.ndarray, list[str], list[str]]:
        matched_tokens = []
        oov_tokens = []
        vectors = []

        for token in tokens:
            if not token:
                continue
            if self.is_word_in_vocab(token):
                matched_tokens.append(token)
                vectors.append(self.wv[token])
            else:
                oov_tokens.append(token)

        if len(vectors) > 0:
            mean_vec = np.mean(vectors, axis=0)
        else:
            mean_vec = np.zeros(self.skipgram_vector_size, dtype=np.float32)

        return mean_vec, matched_tokens, oov_tokens

    def _extract_probabilities(self, clf, vector_input) -> dict:
        label_mapping = {
            "0": "Finance",
            "1": "Sport",
            "finance": "Finance",
            "sport": "Sport",
            "FINANCE": "Finance",
            "SPORT": "Sport"
        }
        probabilities = {}

        if hasattr(clf, "predict_proba"):
            try:
                probs = clf.predict_proba(vector_input)[0]
                classes = getattr(clf, "classes_", [0, 1])
                for idx, c in enumerate(classes):
                    c_name = label_mapping.get(str(c), str(c))
                    probabilities[c_name] = round(float(probs[idx]) * 100, 2)
                return probabilities
            except Exception as e:
                print(f"[WARN] predict_proba error: {e}")

        if hasattr(clf, "decision_function"):
            try:
                dec = clf.decision_function(vector_input)
                dec_val = np.array(dec).flatten()
                if len(dec_val) == 1:
                    val = float(dec_val[0])
                    prob_sport = 1 / (1 + np.exp(-val))
                    probabilities["Sport"] = round(float(prob_sport) * 100, 2)
                    probabilities["Finance"] = round(float(1 - prob_sport) * 100, 2)
                else:
                    exp_dec = np.exp(dec_val - np.max(dec_val))
                    probs = exp_dec / exp_dec.sum()
                    classes = getattr(clf, "classes_", [0, 1])
                    for idx, c in enumerate(classes):
                        c_name = label_mapping.get(str(c), str(c))
                        probabilities[c_name] = round(float(probs[idx]) * 100, 2)
            except Exception as e:
                print(f"[WARN] decision_function error: {e}")

        return probabilities

    def classify_skipgram(self, text: str) -> dict:
        """
        Klasifikasi menggunakan Skip-gram Word2Vec.
        Ketentuan: Pembersihan noise dilakukan, namun STOPWORD REMOVAL dan STEMMING TIDAK DIGUNAKAN.
        """
        if self.clf_skipgram is None or self.wv is None:
            raise RuntimeError("Model Skip-gram belum dimuat.")

        # Step 1: Cleaning Noise saja (tanpa stopword & stemmer)
        cleaned_noise = bersihkan_noise_teks(text)

        # Step 2: Tokenisasi langsung dari teks bersih
        tokens = [t.strip() for t in cleaned_noise.split() if t.strip()]

        # Step 3: Mean Word Vector
        vector, matched_words, oov_words = self.compute_mean_word_vector(tokens)
        vector_2d = vector.reshape(1, -1)

        # Step 4: Prediksi
        raw_pred = self.clf_skipgram.predict(vector_2d)[0]
        label_mapping = {
            "0": "Finance",
            "1": "Sport",
            "finance": "Finance",
            "sport": "Sport",
            "FINANCE": "Finance",
            "SPORT": "Sport"
        }
        pred_label = label_mapping.get(str(raw_pred), str(raw_pred))
        probabilities = self._extract_probabilities(self.clf_skipgram, vector_2d)

        # Frekuensi kata yang cocok di vocabulary (untuk visualisasi bar chart)
        word_counts = Counter(matched_words)
        top_keywords = []
        if word_counts:
            max_count = max(word_counts.values())
            for w, count in word_counts.most_common(10):
                top_keywords.append({
                    "word": w,
                    "score": count,
                    "score_label": f"{count}x",
                    "relative_pct": round((count / max_count) * 100, 1)
                })

        return {
            "method": "skipgram",
            "method_label": "Skip-Gram (Word2Vec) + SVM",
            "preprocessing_applied": "Hanya Pembersihan Noise (Stopword & Stemmer Dilewati)",
            "prediction": pred_label,
            "raw_prediction": str(raw_pred),
            "probabilities": probabilities,
            "pipeline_details": {
                "raw_text_length": len(text),
                "cleaned_text": cleaned_noise,
                "preprocessed_text": cleaned_noise,
                "total_tokens": len(tokens),
                "matched_tokens_count": len(matched_words),
                "oov_tokens_count": len(oov_words),
                "matched_sample": matched_words[:20],
                "vector_dimension": self.skipgram_vector_size,
                "vector_sample": [round(float(v), 5) for v in vector[:10]],
                "top_keywords": top_keywords
            }
        }

    def classify_tfidf(self, text: str) -> dict:
        """
        Klasifikasi menggunakan TF-IDF.
        Ketentuan: Menggunakan pembersihan noise, stopword removal, dan stemming Sastrawi.
        """
        if self.clf_tfidf is None or self.tfidf_vectorizer is None:
            raise RuntimeError("Model TF-IDF atau TF-IDF Vectorizer belum dimuat.")

        # Step 1: Cleaning Noise
        cleaned_noise = bersihkan_noise_teks(text)

        # Step 2: Stopword Removal & Stemming (Sastrawi)
        processed_text = stopword_dan_stemming(cleaned_noise)

        # Step 3: Transformasi Vektor TF-IDF
        vector = self.tfidf_vectorizer.transform([processed_text])

        # Step 4: Prediksi dengan Model TF-IDF
        raw_pred = self.clf_tfidf.predict(vector)[0]
        label_mapping = {
            "0": "Finance",
            "1": "Sport",
            "finance": "Finance",
            "sport": "Sport",
            "FINANCE": "Finance",
            "SPORT": "Sport"
        }
        pred_label = label_mapping.get(str(raw_pred), str(raw_pred))
        probabilities = self._extract_probabilities(self.clf_tfidf, vector)

        # Ambil Top TF-IDF Terms
        top_keywords = []
        try:
            if hasattr(self.tfidf_vectorizer, "get_feature_names_out"):
                feature_names = self.tfidf_vectorizer.get_feature_names_out()
                row_idx, col_idx = vector.nonzero()
                for col in col_idx:
                    val = float(vector[0, col])
                    top_keywords.append({
                        "word": str(feature_names[col]),
                        "score": round(val, 4)
                    })
                top_keywords.sort(key=lambda x: x["score"], reverse=True)
                top_keywords = top_keywords[:10]

                # Hitung relative percentage untuk visualisasi grafik batang
                if top_keywords:
                    max_score = max(k["score"] for k in top_keywords)
                    for k in top_keywords:
                        k["score_label"] = f"{k['score']:.4f}"
                        k["relative_pct"] = round((k["score"] / max_score) * 100, 1) if max_score > 0 else 0
        except Exception as e:
            print(f"[WARN] Gagal mengekstrak top keywords TF-IDF: {e}")

        tokens = [t.strip() for t in processed_text.split() if t.strip()]
        total_vocab = getattr(self.tfidf_vectorizer, "vocabulary_", {})
        total_features = len(total_vocab) if total_vocab else (vector.shape[1] if hasattr(vector, "shape") else 0)

        # Nilai sampel sparse vector
        vector_dense = vector.toarray()[0] if hasattr(vector, "toarray") else []
        non_zero_dense = [round(float(v), 5) for v in vector_dense if v > 0][:10]

        return {
            "method": "tfidf",
            "method_label": "TF-IDF Vectorizer + Model Klasifikasi",
            "preprocessing_applied": "Pembersihan Noise + Stopword Removal + Stemming Sastrawi",
            "prediction": pred_label,
            "raw_prediction": str(raw_pred),
            "probabilities": probabilities,
            "pipeline_details": {
                "raw_text_length": len(text),
                "cleaned_text": cleaned_noise,
                "preprocessed_text": processed_text,
                "total_tokens": len(tokens),
                "matched_tokens_count": len(vector.nonzero()[1]) if hasattr(vector, "nonzero") else len(tokens),
                "oov_tokens_count": 0,
                "matched_sample": [k["word"] for k in top_keywords[:10]],
                "vector_dimension": total_features,
                "vector_sample": non_zero_dense,
                "top_keywords": top_keywords
            }
        }

    def compare_models(self, text: str) -> dict:
        """
        Menjalankan kedua pemodelan (Skip-gram & TF-IDF) secara bersamaan pada teks yang sama
        untuk komparasi langsung (Side-by-Side Comparison).
        """
        t0 = time.time()
        res_skipgram = self.classify_skipgram(text)
        sg_time = round((time.time() - t0) * 1000, 2)
        res_skipgram["execution_time_ms"] = sg_time

        t1 = time.time()
        res_tfidf = self.classify_tfidf(text)
        tfidf_time = round((time.time() - t1) * 1000, 2)
        res_tfidf["execution_time_ms"] = tfidf_time

        is_agreed = (res_skipgram["prediction"].strip().lower() == res_tfidf["prediction"].strip().lower())
        consensus = res_skipgram["prediction"] if is_agreed else "Divergen (Beda Hasil)"

        return {
            "method": "compare",
            "method_label": "Komparasi Langsung: Skip-Gram vs TF-IDF",
            "agreement": is_agreed,
            "consensus": consensus,
            "prediction": consensus,
            "skipgram": res_skipgram,
            "tfidf": res_tfidf
        }

    def classify_text(self, text: str, method: str = "skipgram") -> dict:
        if not self.is_loaded:
            self.load_models()

        method_clean = method.lower().strip()
        if method_clean in ["compare", "comparison", "keduanya", "both"]:
            return self.compare_models(text)
        elif method_clean in ["tfidf", "tf-idf"]:
            return self.classify_tfidf(text)
        else:
            return self.classify_skipgram(text)


# Singleton pipeline instance
pipeline_instance = None

def get_pipeline():
    global pipeline_instance
    if pipeline_instance is None:
        pipeline_instance = ClassificationPipeline()
    return pipeline_instance
