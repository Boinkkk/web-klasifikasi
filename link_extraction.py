import re
import trafilatura


def clean_content(raw_text: str) -> str:
    if not raw_text:
        return ""

    lines = raw_text.split("\n")
    cleaned_paragraphs = []

    date_pattern = re.compile(
        r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{2}:\d{2}\s*(WIB|WITA|WIT)\b",
        re.IGNORECASE,
    )
    dateline_pattern = re.compile(
        r"^[A-Z\s,./()\-]+--?\s*|^[A-Z\s,./()\-]+\s*-\s*"
    )

    for line in lines:
        text = line.strip()

        if not text:
            continue

        words = text.split()

        if len(words) < 6:
            continue

        if date_pattern.search(text) and len(words) < 10:
            continue

        if not text.endswith((".", '"', "'", "!", "?", "”")):
            continue

        text = dateline_pattern.sub("", text)
        cleaned_paragraphs.append(text)

    full_text = "\n\n".join(cleaned_paragraphs)
    full_text = re.sub(r"https?://\S+|www\.\S+", "", full_text)
    return full_text


def extract_news(url: str) -> dict:
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        return {"error": "Gagal mengunduh halaman web"}

    text = trafilatura.extract(
        downloaded,
        include_comments=False,
        include_tables=False,
        no_fallback=True,
        deduplicate=True,
    )

    metadata = trafilatura.extract_metadata(downloaded)

    return {
        "url": url,
        "title": metadata.title if metadata and metadata.title else None,
        "author": metadata.author if metadata and metadata.author else None,
        "date": metadata.date if metadata and metadata.date else None,
        "content": clean_content(text),
    }


if __name__ == "__main__":
    url_target = "https://www.cnnindonesia.com/nasional/20261006232332-12-1412459/kubu-denny-gibran-tak-bisa-maju-lagi-di-pilpres-kecuali-ikut-paket-c"
    result = extract_news(url_target)

    print(f"Url : {result.get('url')} \n")
    print(f"Title : {result.get('title')}\n")
    print(f"Author : {result.get('author')}\n")
    print(f"Date : {result.get('date')}\n")
    print(f"content : {result.get('content')}")