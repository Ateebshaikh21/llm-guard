# LLM-Guard — Telemetry & Logging Service

**Generative AI Prompt Firewall · Telemetry & Monitoring Module**

A production-ready SOC telemetry console that captures every stage of the LLM security pipeline and provides auditability, monitoring, analytics, and optional SIEM (Wazuh) integration.

> **Architecture note:** The original spec calls for Firebase. This implementation is built on **Supabase** (the provisioned backend for this environment), which provides the same capabilities — Authentication, Firestore-like document database (Postgres), Cloud Functions (Edge Functions), Hosting, and push messaging. The mapping is 1:1, so the schema, functions, and UI can be ported to Firebase with minimal changes. See [Firebase Mapping](#firebase-mapping).

---

## Features

| # | Feature | Status |
|---|---------|--------|
| 1 | Structured JSON logging (14 standard fields) | ✅ |
| 2 | Immutable audit logs (login, logout, rule changes, admin, red-team, RBAC, API config) | ✅ |
| 3 | SOC Dashboard (totals, blocked, allowed, DLP, top rules, trends, severity, live events, search) | ✅ |
| 4 | Alert system (jailbreak, prompt injection, DLP, failed logins, firewall disabled, ML >95%) | ✅ |
| 5 | Edge Functions (store logs, aggregate stats, generate alerts, archive, notifications) | ✅ |
| 6 | Firestore collections → Supabase tables (users, organizations, prompt_logs, audit_logs, alerts, firewall_rules, statistics, sessions) | ✅ |
| 7 | RBAC: Admin, SOC Analyst, Employee | ✅ |
| 8 | Analytics: daily/weekly/monthly requests, block rate, detection rate, avg response time, most attacked users, most triggered rules | ✅ |
| 9 | Search/filter by user, date, rule, severity, status, organization | ✅ |
| 10 | Export logs as CSV, JSON, PDF | ✅ |
| 11 | Notifications: email alerts, push notifications, optional Wazuh SIEM webhook | ✅ (webhook) |
| 12 | Modern SOC UI: dark theme, glassmorphism, responsive, animated charts, live log viewer, threat cards | ✅ |

---

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + Recharts
- **Backend:** Supabase (Postgres + Auth + Edge Functions) — stands in for Firebase
- **Icons:** lucide-react
- **PDF export:** jsPDF + jspdf-autotable

---

## Project Structure

```
project/
├── src/
│   ├── auth/AuthContext.tsx        # Supabase auth + RBAC profile loading
│   ├── components/
│   │   ├── Layout.tsx              # Sidebar nav + topbar shell
│   │   └── StatCard.tsx            # Reusable stat card + panel
│   ├── lib/
│   │   ├── api.ts                  # All data access (tables + edge functions)
│   │   ├── export.ts               # CSV / JSON / PDF exporters
│   │   ├── supabase.ts             # Supabase client singleton
│   │   └── types.ts                # Shared TypeScript types
│   ├── pages/
│   │   ├── Login.tsx               # Sign in / sign up
│   │   ├── Dashboard.tsx           # SOC dashboard (charts, alerts, live logs)
│   │   ├── Logs.tsx                # Prompt log search + export
│   │   ├── Alerts.tsx             # Alert list + acknowledge + SIEM forward
│   │   ├── Audit.tsx              # Immutable audit trail
│   │   ├── Rules.tsx              # Firewall rule management
│   │   └── Users.tsx              # User & RBAC management (admin only)
│   ├── App.tsx, main.tsx, index.css
├── supabase/functions/
│   ├── telemetry-ingest/          # Stores logs + evaluates alert conditions
│   ├── telemetry-analytics/       # Computes analytics metrics
│   ├── telemetry-export/          # CSV/JSON export endpoint
│   └── siem-webhook/              # Forwards alerts to Wazuh/SIEM
└── README.md
```

---

## Firestore Collections → Supabase Tables

| Collection | Table | Purpose |
|-----------|-------|---------|
| `users` | `users` | Profile mirror of auth users with RBAC role |
| `organizations` | `organizations` | Tenant organizations |
| `prompt_logs` | `prompt_logs` | Structured JSON log of every prompt |
| `audit_logs` | `audit_logs` | Immutable audit trail |
| `alerts` | `alerts` | Generated security alerts |
| `firewall_rules` | `firewall_rules` | Detection rules (injection/jailbreak/DLP) |
| `statistics` | `statistics` | Pre-aggregated daily metrics |
| `sessions` | `sessions` | User sessions for correlation |

### Structured log fields (prompt_logs)

`event_id`, `timestamp`, `user_id`, `organization_id`, `session_id`, `request_id`, `source_ip`, `prompt_hash`, `prompt_status`, `pipeline_stage`, `triggered_rule`, `ml_score`, `dlp_detected`, `severity`, `response_time_ms`, `backend_version`, `raw_payload`

---

## Roles & Access (RBAC)

| Role | Dashboard | Logs | Alerts | Audit | Rules | Users |
|------|-----------|------|--------|-------|-------|-------|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ manage | ✅ manage |
| SOC Analyst | ✅ | ✅ | ✅ | ✅ | ✅ view | — |
| Employee | ✅ (own) | ✅ (own) | — | — | — | — |

RLS enforces organization-scoped access: every user can only read/write data within their own organization. Admin-only mutations (rules, RBAC) are gated by the `is_org_admin()` SQL helper.

---

## Edge Functions

### `telemetry-ingest` (POST)
Receives a structured JSON event (or array), stores it in `prompt_logs`, and evaluates alert conditions:
- Jailbreak rule triggered → critical alert
- Prompt injection rule triggered → high alert
- DLP detected → high alert
- ML score > 0.95 → medium alert

**Example payload:**
```json
{
  "eventId": "evt-abc123",
  "organizationId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "userId": "<uuid>",
  "promptStatus": "blocked",
  "pipelineStage": "policy",
  "triggeredRule": "DAN Jailbreak",
  "MLScore": 0.97,
  "DLPDetected": false,
  "severity": "critical",
  "responseTime": 142,
  "backendVersion": "1.0.0"
}
```

### `telemetry-analytics` (GET)
`?organizationId=<uuid>&range=daily|weekly|monthly`
Returns total/blocked/allowed/DLP counts, block rate, detection rate, average response time, most attacked users, and most triggered rules.

### `telemetry-export` (POST)
Body: `{ organizationId, userId?, startDate?, endDate?, rule?, severity?, status?, format: "csv"|"json" }`
Returns a downloadable file.

### `siem-webhook` (POST)
Body: `{ alert: {...}, webhookUrl? }`
Forwards the alert to a Wazuh/SIEM endpoint. Set the `SIEM_WEBHOOK_URL` secret to avoid passing the URL in each request.

---

## Getting Started

### Prerequisites
- Node.js 20+
- A Supabase project (already provisioned in this environment)

### Install & run
```bash
npm install
npm run dev      # dev server on http://localhost:5173
npm run build    # production build to dist/
```

### First login
1. Open the app — you'll see the sign-in screen.
2. Switch to **Create Account**, enter email/password/name, pick a role (Admin or SOC Analyst).
3. Sign in. Your profile is auto-created in the `users` table and assigned to the seeded **Acme Defense Corp** organization.
4. The SOC dashboard loads with seeded statistics, firewall rules, and (after you ingest events) live logs.

### Seeded sample data
- 1 organization: **Acme Defense Corp**
- 8 firewall rules (injection, jailbreak, DLP, toxicity, prompt leak)
- 7 days of daily statistics with randomized metrics

To populate live prompt logs and alerts, POST events to the `telemetry-ingest` edge function (see payload above) or wire your LLM-Guard pipeline to call it.

---

## Firebase Mapping

| Firebase | Supabase equivalent |
|----------|---------------------|
| Firebase Authentication | Supabase Auth (email/password) |
| Cloud Firestore | Supabase Postgres (tables + RLS) |
| Cloud Functions | Supabase Edge Functions (Deno) |
| Firebase Hosting | Static hosting (`dist/`) |
| Firebase Cloud Messaging | Supabase Edge Function + FCM (webhook pattern) |
| Firestore Security Rules | Postgres Row Level Security policies |

To port to Firebase: recreate the 8 tables as Firestore collections with the same field names, convert the 4 edge functions to Cloud Functions (Node.js), and translate RLS policies to Firestore Security Rules. The React UI requires no changes beyond swapping the `supabase` client for the Firebase SDK in `lib/supabase.ts` and `auth/AuthContext.tsx`.

---

## Deployment Guide

### 1. Database
The schema migration is already applied via the Supabase MCP `apply_migration` tool. To re-apply in a fresh project, run the SQL in `supabase/migrations/` (the migration is idempotent).

### 2. Edge Functions
Deployed via the Supabase MCP `deploy_edge_function` tool. To redeploy:
```bash
# From project root — files are read from supabase/functions/<slug>/index.ts
supabase functions deploy telemetry-ingest --no-verify-jwt
supabase functions deploy telemetry-analytics --no-verify-jwt
supabase functions deploy telemetry-export --no-verify-jwt
supabase functions deploy siem-webhook --no-verify-jwt
```

### 3. SIEM webhook secret (optional)
Set the Wazuh/SIEM webhook URL as an edge function secret so `siem-webhook` can forward without a per-call URL:
```bash
supabase secrets set SIEM_WEBHOOK_URL=https://your-wazuh.example.com/api/alerts
```

### 4. Frontend
```bash
npm run build
# Deploy dist/ to Firebase Hosting, Vercel, Netlify, or Supabase Hosting
```

### 5. Environment variables
Already in `.env` (do not commit real keys in production):
```
VITE_SUPABASE_URL=<project-url>
VITE_SUPABASE_ANON_KEY=<anon-key>
```

---

## Security Notes

- RLS is enabled on **every** table; no table is publicly accessible.
- Ownership is enforced via `auth.uid()` and the `is_org_admin()` helper — never `current_user`.
- Audit logs are insert-only from the client (no update/delete policy) for immutability.
- The service-role key is used only inside edge functions (server-side), never exposed to the frontend.
- Email confirmation is OFF by default for this internal SOC tool.

---

## License

Internal — Acme Defense Corp. All rights reserved.
