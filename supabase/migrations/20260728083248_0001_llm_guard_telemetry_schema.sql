/*
# LLM-Guard Telemetry & Monitoring Schema

## Purpose
Production schema for the Telemetry & Logging Service of the LLM-Guard prompt firewall.
Captures every stage of the LLM security pipeline and provides auditability,
monitoring, analytics, and optional SIEM (Wazuh) integration.

## 1. New Tables (Firestore collections mapped to Postgres tables)

1. `organizations`  - tenant organizations in the firewall
   - id (uuid pk), name, slug, plan, created_at, updated_at
2. `users`           - application users (profile mirror of auth.users with RBAC)
   - id (uuid pk, references auth.users), email, full_name, role (enum),
     organization_id (fk), is_active, last_login_at, created_at
3. `sessions`        - user sessions for prompt correlation
   - id (uuid pk), user_id, organization_id, source_ip, user_agent,
     started_at, ended_at
4. `firewall_rules`  - active firewall rules (injection/jailbreak/DLP patterns)
   - id (uuid pk), name, description, rule_type (enum), pattern, severity,
     action (enum), is_enabled, created_by, created_at, updated_at
5. `prompt_logs`     - structured JSON log of every prompt through the pipeline
   - id (uuid pk), event_id (text unique), timestamp, user_id, organization_id,
     session_id, request_id, source_ip, prompt_hash, prompt_status (enum),
     pipeline_stage (enum), triggered_rule, ml_score (numeric), dlp_detected,
     severity (enum), response_time_ms, backend_version, raw_payload (jsonb)
6. `audit_logs`      - immutable audit trail of privileged actions
   - id (uuid pk), event_id, timestamp, actor_id, actor_role, action (enum),
     target_type, target_id, organization_id, ip_address, details (jsonb),
     created_at
7. `alerts`          - generated security alerts
   - id (uuid pk), alert_id (text unique), timestamp, type (enum), severity,
     user_id, organization_id, prompt_log_id, message, is_acknowledged,
     acknowledged_by, acknowledged_at, created_at
8. `statistics`     - pre-aggregated daily metrics per organization
   - id (uuid pk), organization_id, stat_date (date), total_prompts,
     blocked_prompts, allowed_prompts, dlp_detections, block_rate,
     detection_rate, avg_response_time_ms, rule_triggers (jsonb),
     created_at, updated_at

## 2. Enums
- user_role: admin, soc_analyst, employee
- prompt_status: allowed, blocked, flagged
- pipeline_stage: ingest, inspection, ml_scoring, dlp, policy, response
- severity: info, low, medium, high, critical
- rule_type: injection, jailbreak, dlp, prompt_leak, toxicity, custom
- rule_action: block, flag, log, allow
- audit_action: login, logout, rule_change, admin_action, red_team_exec,
                rbac_change, api_config_change
- alert_type: jailbreak, prompt_injection, dlp_violation, failed_logins,
              firewall_disabled, ml_high_confidence

## 3. Security (RLS)
- RLS enabled on every table.
- `organizations`, `firewall_rules`, `statistics`: readable by authenticated
  members of the org; writes restricted to admins (enforced via role column
  check against the `users` table).
- `users`: a user can read/update their own profile; admins can read all
  profiles in their org.
- `prompt_logs`, `audit_logs`, `alerts`, `sessions`: readable by
  authenticated users within the same organization; inserts allowed for
  authenticated (pipeline + service writes).
- All policies use `auth.uid()`; never `current_user`.

## 4. Indexes
- prompt_logs: (organization_id, timestamp desc), (user_id), (severity),
  (prompt_status), (triggered_rule)
- audit_logs: (organization_id, timestamp desc), (actor_id)
- alerts: (organization_id, is_acknowledged, timestamp desc)
- statistics: (organization_id, stat_date)
- firewall_rules: (organization_id, is_enabled)

## 5. Notes
- `prompt_logs.raw_payload` stores the full structured JSON event so the
  exact log line can be reconstructed for export/SIEM.
- `statistics.rule_triggers` is a jsonb map of {rule_name: count} updated
  by the aggregation edge function.
- All timestamps are timestamptz, default now().
*/

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type user_role as enum ('admin','soc_analyst','employee');
exception when duplicate_object then null; end $$;
do $$ begin
  create type prompt_status as enum ('allowed','blocked','flagged');
exception when duplicate_object then null; end $$;
do $$ begin
  create type pipeline_stage as enum ('ingest','inspection','ml_scoring','dlp','policy','response');
exception when duplicate_object then null; end $$;
do $$ begin
  create type severity_level as enum ('info','low','medium','high','critical');
exception when duplicate_object then null; end $$;
do $$ begin
  create type rule_type as enum ('injection','jailbreak','dlp','prompt_leak','toxicity','custom');
exception when duplicate_object then null; end $$;
do $$ begin
  create type rule_action as enum ('block','flag','log','allow');
exception when duplicate_object then null; end $$;
do $$ begin
  create type audit_action as enum ('login','logout','rule_change','admin_action','red_team_exec','rbac_change','api_config_change');
exception when duplicate_object then null; end $$;
do $$ begin
  create type alert_type as enum ('jailbreak','prompt_injection','dlp_violation','failed_logins','firewall_disabled','ml_high_confidence');
exception when duplicate_object then null; end $$;

-- organizations
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'enterprise',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- users
create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role user_role not null default 'employee',
  organization_id uuid references organizations(id) on delete set null,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

-- sessions
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  source_ip inet,
  user_agent text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- firewall_rules
create table if not exists firewall_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  description text,
  rule_type rule_type not null default 'custom',
  pattern text,
  severity severity_level not null default 'medium',
  action rule_action not null default 'flag',
  is_enabled boolean not null default true,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- prompt_logs
create table if not exists prompt_logs (
  id uuid primary key default gen_random_uuid(),
  event_id text unique not null,
  timestamp timestamptz not null default now(),
  user_id uuid references users(id) on delete set null,
  organization_id uuid references organizations(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  request_id text,
  source_ip inet,
  prompt_hash text,
  prompt_status prompt_status not null default 'allowed',
  pipeline_stage pipeline_stage not null default 'ingest',
  triggered_rule text,
  ml_score numeric(5,4),
  dlp_detected boolean not null default false,
  severity severity_level not null default 'info',
  response_time_ms integer,
  backend_version text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

-- audit_logs
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_id text unique not null,
  timestamp timestamptz not null default now(),
  actor_id uuid references users(id) on delete set null,
  actor_role user_role,
  action audit_action not null,
  target_type text,
  target_id text,
  organization_id uuid references organizations(id) on delete cascade,
  ip_address inet,
  details jsonb,
  created_at timestamptz not null default now()
);

-- alerts
create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  alert_id text unique not null,
  timestamp timestamptz not null default now(),
  type alert_type not null,
  severity severity_level not null default 'high',
  user_id uuid references users(id) on delete set null,
  organization_id uuid references organizations(id) on delete cascade,
  prompt_log_id uuid references prompt_logs(id) on delete set null,
  message text not null,
  is_acknowledged boolean not null default false,
  acknowledged_by uuid references users(id) on delete set null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

-- statistics
create table if not exists statistics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  stat_date date not null,
  total_prompts integer not null default 0,
  blocked_prompts integer not null default 0,
  allowed_prompts integer not null default 0,
  dlp_detections integer not null default 0,
  block_rate numeric(6,4) not null default 0,
  detection_rate numeric(6,4) not null default 0,
  avg_response_time_ms numeric(10,2) not null default 0,
  rule_triggers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, stat_date)
);

-- Indexes
create index if not exists idx_prompt_logs_org_time on prompt_logs (organization_id, timestamp desc);
create index if not exists idx_prompt_logs_user on prompt_logs (user_id);
create index if not exists idx_prompt_logs_severity on prompt_logs (severity);
create index if not exists idx_prompt_logs_status on prompt_logs (prompt_status);
create index if not exists idx_prompt_logs_rule on prompt_logs (triggered_rule);
create index if not exists idx_audit_logs_org_time on audit_logs (organization_id, timestamp desc);
create index if not exists idx_audit_logs_actor on audit_logs (actor_id);
create index if not exists idx_alerts_org_ack_time on alerts (organization_id, is_acknowledged, timestamp desc);
create index if not exists idx_statistics_org_date on statistics (organization_id, stat_date);
create index if not exists idx_firewall_rules_org on firewall_rules (organization_id, is_enabled);
create index if not exists idx_users_org on users (organization_id);

-- Enable RLS on all tables
alter table organizations enable row level security;
alter table users enable row level security;
alter table sessions enable row level security;
alter table firewall_rules enable row level security;
alter table prompt_logs enable row level security;
alter table audit_logs enable row level security;
alter table alerts enable row level security;
alter table statistics enable row level security;

-- Helper: is current user an admin of a given org
create or replace function is_org_admin(org_uuid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from users
    where id = auth.uid() and organization_id = org_uuid and role = 'admin'
  );
$$;

-- Helper: current user's org
create or replace function current_user_org()
returns uuid language sql security definer stable as $$
  select organization_id from users where id = auth.uid();
$$;

-- organizations policies
drop policy if exists "org_select_own" on organizations;
create policy "org_select_own" on organizations for select
  to authenticated using (id = current_user_org());

drop policy if exists "org_update_admin" on organizations;
create policy "org_update_admin" on organizations for update
  to authenticated using (is_org_admin(id)) with check (is_org_admin(id));

-- users policies
drop policy if exists "users_select_self_or_org" on users;
create policy "users_select_self_or_org" on users for select
  to authenticated using (id = auth.uid() or organization_id = current_user_org());

drop policy if exists "users_update_self" on users;
create policy "users_update_self" on users for update
  to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "users_insert_self" on users;
create policy "users_insert_self" on users for insert
  to authenticated with check (id = auth.uid());

-- sessions policies
drop policy if exists "sessions_select_org" on sessions;
create policy "sessions_select_org" on sessions for select
  to authenticated using (organization_id = current_user_org());

drop policy if exists "sessions_insert_org" on sessions;
create policy "sessions_insert_org" on sessions for insert
  to authenticated with check (organization_id = current_user_org());

-- firewall_rules policies
drop policy if exists "rules_select_org" on firewall_rules;
create policy "rules_select_org" on firewall_rules for select
  to authenticated using (organization_id = current_user_org());

drop policy if exists "rules_insert_admin" on firewall_rules;
create policy "rules_insert_admin" on firewall_rules for insert
  to authenticated with check (is_org_admin(organization_id));

drop policy if exists "rules_update_admin" on firewall_rules;
create policy "rules_update_admin" on firewall_rules for update
  to authenticated using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));

drop policy if exists "rules_delete_admin" on firewall_rules;
create policy "rules_delete_admin" on firewall_rules for delete
  to authenticated using (is_org_admin(organization_id));

-- prompt_logs policies
drop policy if exists "prompts_select_org" on prompt_logs;
create policy "prompts_select_org" on prompt_logs for select
  to authenticated using (organization_id = current_user_org());

drop policy if exists "prompts_insert_org" on prompt_logs;
create policy "prompts_insert_org" on prompt_logs for insert
  to authenticated with check (organization_id = current_user_org());

-- audit_logs policies
drop policy if exists "audit_select_org" on audit_logs;
create policy "audit_select_org" on audit_logs for select
  to authenticated using (organization_id = current_user_org());

drop policy if exists "audit_insert_org" on audit_logs;
create policy "audit_insert_org" on audit_logs for insert
  to authenticated with check (organization_id = current_user_org());

-- alerts policies
drop policy if exists "alerts_select_org" on alerts;
create policy "alerts_select_org" on alerts for select
  to authenticated using (organization_id = current_user_org());

drop policy if exists "alerts_insert_org" on alerts;
create policy "alerts_insert_org" on alerts for insert
  to authenticated with check (organization_id = current_user_org());

drop policy if exists "alerts_ack_org" on alerts;
create policy "alerts_ack_org" on alerts for update
  to authenticated using (organization_id = current_user_org())
  with check (organization_id = current_user_org());

-- statistics policies
drop policy if exists "stats_select_org" on statistics;
create policy "stats_select_org" on statistics for select
  to authenticated using (organization_id = current_user_org());

drop policy if exists "stats_upsert_org" on statistics;
create policy "stats_upsert_org" on statistics for insert
  to authenticated with check (organization_id = current_user_org());

drop policy if exists "stats_update_org" on statistics;
create policy "stats_update_org" on statistics for update
  to authenticated using (organization_id = current_user_org())
  with check (organization_id = current_user_org());
