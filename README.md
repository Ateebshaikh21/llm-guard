# LLM-Guard — AI Prompt Firewall

Enterprise-grade reverse-proxy firewall that intercepts every AI prompt, runs it through Rules → ML → DLP, and shows you everything on a SOC dashboard.

---

## Run Without Docker — 3 Terminals

### Prerequisites (install once)

| Tool | Download |
|---|---|
| Python 3.11+ | https://python.org/downloads |
| Node.js 20+ | https://nodejs.org |
| PostgreSQL 16 | https://postgresql.org/download |
| Redis | https://redis.io/download (Windows: https://github.com/tporadowski/redis/releases) |

---

### Step 1 — Database setup (one-time)

Open **psql** (or pgAdmin) and run:
```sql
CREATE DATABASE llmguard;
CREATE USER llmguard WITH PASSWORD 'llmguard123';
GRANT ALL PRIVILEGES ON DATABASE llmguard TO llmguard;
```

---

### Step 2 — Configure environment

```bash
cp .env.example .env
```

Edit `.env` and at minimum set your OpenAI key:
```
OPENAI_API_KEY=sk-...your key here...
```

---

### Step 3 — Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

---

### Step 4 — Create tables + seed data

```bash
cd backend
python setup_db.py
```

This creates all tables and seeds:
- **admin@llmguard.local** / Admin1234!
- **analyst@llmguard.local** / Admin1234!
- **employee@llmguard.local** / Admin1234!

---

### Step 5 — Install frontend dependencies

```bash
cd frontend
npm install
```

---

## Running (open 3 terminal windows)

### Terminal 1 — Backend API
```bash
cd backend
python run.py
```
✅ API live at **http://localhost:8000**
✅ Swagger UI at **http://localhost:8000/docs**

### Terminal 2 — ML Inference (optional, improves detection)
```bash
cd ai/adversarial_scanner
pip install -r requirements_ml.txt
python inference_service.py
```
✅ ML service at **http://localhost:8001**
*(If not running, the backend falls back to a built-in heuristic detector)*

### Terminal 3 — Frontend Dashboard
```bash
cd frontend
npm run dev
```
✅ Dashboard at **http://localhost:5173**

---

## Login

- **Email:** admin@llmguard.local
- **Password:** Admin1234!

---

## Running Tests

```bash
# From the project root
pip install pytest pytest-asyncio
pytest tests/ -v
```

---

## Architecture

```
Employee browser
      │
      ▼
React Dashboard (port 5173) ──── proxies /api → backend
      │
      ▼
FastAPI Backend (port 8000)
  ├── POST /api/v1/auth/login        → JWT token
  ├── POST /api/v1/proxy/inspect     → Full pipeline
  │     ├── 1. Rules Engine          (keyword/regex/length checks)
  │     ├── 2. ML Scanner            (calls port 8001, falls back to heuristic)
  │     ├── 3. DLP Engine            (Presidio — masks SSN, email, API keys)
  │     ├── 4. LLM Connector         (OpenAI or Ollama)
  │     └── 5. Output Validator      (PII + toxicity check on response)
  ├── GET  /api/v1/logs/prompts      → Prompt history
  ├── GET  /api/v1/stats/summary     → Aggregated metrics
  ├── CRUD /api/v1/rules             → Firewall rule management
  ├── POST /api/v1/redteam/run       → Red team simulation
  └── GET  /api/v1/audit-log         → Admin audit trail

ML Inference (port 8001)
  └── POST /scan                     → Jailbreak probability score
      └── TF-IDF + Logistic Regression (auto-trained on startup)

PostgreSQL  → rules, prompt logs, audit trail
Redis       → session cache, rate limiting (optional)
```

---

## Default Roles

| Role | Can do |
|---|---|
| admin | Everything |
| soc_analyst | View logs, manage rules, inspector |
| employee | Inspector (own prompts only), dashboard |

---

## Environment Variables

See `.env.example` for all options. Key ones:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | local postgres | SQLAlchemy connection string |
| `OPENAI_API_KEY` | — | Required for real LLM responses |
| `ML_BLOCK_THRESHOLD` | 0.75 | Classifier block threshold (0–1) |
| `LLM_BACKEND` | openai | `openai` or `ollama` |
| `REDIS_URL` | local redis | Optional — app works without Redis |

---

## Project Structure

```
llm-guard/
├── backend/
│   ├── app/
│   │   ├── main.py              FastAPI app
│   │   ├── core/                Config, security, JWT
│   │   ├── db/                  SQLAlchemy + Redis clients
│   │   ├── models/              Database models
│   │   ├── schemas/             Pydantic schemas
│   │   ├── services/            Rules, DLP, ML, LLM, telemetry
│   │   └── api/routes.py        All API endpoints
│   ├── setup_db.py              One-time DB setup + seed
│   └── run.py                   Start the server
├── ai/
│   ├── adversarial_scanner/
│   │   └── inference_service.py ML service (port 8001)
│   └── red_team_simulator/
│       └── prompt_corpus/       300+ jailbreak + 100 benign prompts
├── frontend/
│   └── src/
│       ├── pages/               Dashboard, BlockedPrompts, RuleConfig...
│       ├── hooks/useAuth.tsx     Auth context
│       └── lib/api.ts           Axios API client
├── tests/
│   └── test_all.py              Unit + regression tests
└── .env.example                 All config options documented
```
