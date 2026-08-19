FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for spaCy + aiomysql
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download spaCy model at build time so container is self-contained
RUN python -m spacy download en_core_web_sm

COPY . .

# Pre-populate tldextract cache at build time (avoids SSL network calls at runtime)
RUN python -c "import tldextract; tldextract.TLDExtract(cache_dir=None, suffix_list_urls=[])('warmup@example.com')"

EXPOSE 8000

CMD ["python", "run.py"]
