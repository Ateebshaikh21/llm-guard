# LLM-Guard — Start Without Docker

## Prerequisites

Install these once:
- Python 3.11+  →  https://python.org
- Node.js 20+   →  https://nodejs.org
- PostgreSQL 16  →  https://postgresql.org
- Redis          →  https://redis.io  (Windows: https://github.com/tporadowski/redis/releases)

---

## One-Time Setup

### 1. PostgreSQL — create database

```bash
psql -U postgres
```
```sql
CREATE DATABASE llmguard;
CREATE USER llmguard WITH PASSWORD 'llmguard123';
GRANT ALL PRIVILEGES ON DATABASE llmguard TO llmguard;
\q
```

### 2. Copy and fill environment file

```bash
cp .env.example .env
```
Edit `.env` — at minimum set:
```
OPENAI_API_KEY=sk-...your key here...
```
Everything else has safe defaults for local dev.

### 3. Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
python -m spacy download en_core_web_sm
cd ..
```

### 4. Run database migrations

```bash
cd backend
python setup_db.py
cd ..
```

### 5. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

---

## Running the App (3 terminals)

### Terminal 1 — Backend API

```bash
cd backend
python run.py
```
→ API runs at http://localhost:8000
→ Swagger UI at http://localhost:8000/docs

### Terminal 2 — ML Inference (optional but improves detection)

```bash
cd ai/adversarial_scanner
pip install -r requirements_ml.txt
python inference_service.py
```
→ ML service at http://localhost:8001

### Terminal 3 — Frontend Dashboard

```bash
cd frontend
npm run dev
```
→ Dashboard at http://localhost:5173

---

## Default Login

- **Email:** admin@llmguard.local
- **Password:** Admin1234!

---

## Running Tests

```bash
cd backend
pytest ../tests/ -v
```
