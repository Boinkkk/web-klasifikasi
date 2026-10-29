from Sastrawi.StopWordRemover.StopWordRemoverFactory import StopWordRemoverFactory
from Sastrawi.Stemmer.StemmerFactory import StemmerFactory
from pathlib import Path
import re


def bersihkan_noise_teks(text):
    # 1. Hapus tag [Gambas:...] dan widget video
    text = re.sub(r"\[Gambas:.*?\]", " ", text)
    # 2. Hapus baris rekomendasi redaksi
    text = re.sub(r"(Lihat juga Video:|Baca juga:).*?(\n|$)", " ", text)
    # 3. Hapus prefix kota berita seperti "Jakarta - " atau "Bandung -"
    text = re.sub(r"^[A-Z\s]+-\s*", " ", text)
    # 4. Hapus watermark redaksi Detik
    text = re.sub(r"detikcom|detikSport|detikFinance", " ", text, flags=re.IGNORECASE)
    # 5. Case folding ke lowercase
    text = text.lower()
    # 6. Hapus karakter non-alfabet (angka & tanda baca)
    text = re.sub(r"[^a-z\s]", " ", text)
    # 7. Normalisasi spasi ganda
    text = re.sub(r"\s+", " ", text).strip()
    return text

# Inisialisasi Stopword Remover dan Stemmer Sastrawi
stop_factory = StopWordRemoverFactory()
stopword_remover = stop_factory.create_stop_word_remover()

stem_factory = StemmerFactory()
stemmer = stem_factory.create_stemmer()

def stopword_dan_stemming(text):
    text = stopword_remover.remove(text)
    text = stemmer.stem(text)
    return text