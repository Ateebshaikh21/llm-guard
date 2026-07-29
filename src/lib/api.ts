import { supabase, EDGE_BASE } from './supabase';
import type { Alert, AuditLog, FirewallRule, PromptLog, Statistics, UserProfile } from './types';

const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function edgeHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    apikey: anonKey,
  };
}

async function callEdge(name: string, method: string, body?: unknown) {
  const resp = await fetch(`${EDGE_BASE}/${name}`, {
    method,
    headers: edgeHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Edge ${name} failed (${resp.status}): ${txt}`);
  }
  return resp.json();
}

// ---------- Prompt logs ----------
export interface LogFilters {
  userId?: string;
  startDate?: string;
  endDate?: string;
  rule?: string;
  severity?: string;
  status?: string;
  limit?: number;
}

export async function fetchPromptLogs(orgId: string, filters: LogFilters = {}): Promise<PromptLog[]> {
  let q = supabase
    .from('prompt_logs')
    .select('*')
    .eq('organization_id', orgId)
    .order('timestamp', { ascending: false })
    .limit(filters.limit ?? 200);
  if (filters.userId) q = q.eq('user_id', filters.userId);
  if (filters.startDate) q = q.gte('timestamp', filters.startDate);
  if (filters.endDate) q = q.lte('timestamp', filters.endDate);
  if (filters.rule) q = q.eq('triggered_rule', filters.rule);
  if (filters.severity) q = q.eq('severity', filters.severity);
  if (filters.status) q = q.eq('prompt_status', filters.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PromptLog[];
}

// ---------- Alerts ----------
export async function fetchAlerts(orgId: string, onlyUnack = false): Promise<Alert[]> {
  let q = supabase
    .from('alerts')
    .select('*')
    .eq('organization_id', orgId)
    .order('timestamp', { ascending: false })
    .limit(100);
  if (onlyUnack) q = q.eq('is_acknowledged', false);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Alert[];
}

export async function acknowledgeAlert(alertId: string, userId: string) {
  const { error } = await supabase
    .from('alerts')
    .update({ is_acknowledged: true, acknowledged_by: userId, acknowledged_at: new Date().toISOString() })
    .eq('id', alertId);
  if (error) throw error;
}

// ---------- Audit logs ----------
export async function fetchAuditLogs(orgId: string, limit = 100): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('organization_id', orgId)
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AuditLog[];
}

export async function insertAuditLog(entry: Partial<AuditLog> & { organization_id: string; action: AuditLog['action'] }) {
  const { error } = await supabase.from('audit_logs').insert({
    event_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  });
  if (error) throw error;
}

// ---------- Firewall rules ----------
export async function fetchRules(orgId: string): Promise<FirewallRule[]> {
  const { data, error } = await supabase
    .from('firewall_rules')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FirewallRule[];
}

export async function toggleRule(ruleId: string, enabled: boolean, actor: UserProfile) {
  const { data, error } = await supabase
    .from('firewall_rules')
    .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', ruleId)
    .select('name')
    .single();
  if (error) throw error;
  await insertAuditLog({
    organization_id: actor.organization_id!,
    actor_id: actor.id,
    actor_role: actor.role,
    action: 'rule_change',
    target_type: 'firewall_rule',
    target_id: ruleId,
    details: { name: (data as { name: string }).name, enabled },
  });
}

// ---------- Statistics ----------
export async function fetchStatistics(orgId: string, days = 7): Promise<Statistics[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('statistics')
    .select('*')
    .eq('organization_id', orgId)
    .gte('stat_date', since)
    .order('stat_date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Statistics[];
}

// ---------- Users ----------
export async function fetchOrgUsers(orgId: string): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as UserProfile[];
}

// ---------- Edge function wrappers ----------
export async function fetchAnalytics(orgId: string, range: 'daily' | 'weekly' | 'monthly') {
  const url = `${EDGE_BASE}/telemetry-analytics?organizationId=${encodeURIComponent(orgId)}&range=${range}`;
  const resp = await fetch(url, { headers: edgeHeaders() });
  if (!resp.ok) throw new Error(`Analytics failed (${resp.status})`);
  return resp.json();
}

export async function exportLogs(orgId: string, filters: LogFilters, format: 'csv' | 'json') {
  const resp = await fetch(`${EDGE_BASE}/telemetry-export`, {
    method: 'POST',
    headers: { ...edgeHeaders(), Accept: format === 'csv' ? 'text/csv' : 'application/json' },
    body: JSON.stringify({ ...filters, organizationId: orgId, format }),
  });
  if (!resp.ok) throw new Error(`Export failed (${resp.status})`);
  return resp;
}

export async function forwardToSIEM(alert: Record<string, unknown>, webhookUrl?: string) {
  return callEdge('siem-webhook', 'POST', { alert, webhookUrl });
}

export async function ingestSampleEvent(orgId: string, userId: string, ev: Partial<PromptLog>) {
  return callEdge('telemetry-ingest', 'POST', {
    eventId: crypto.randomUUID(),
    organizationId: orgId,
    userId,
    timestamp: new Date().toISOString(),
    ...ev,
  });
}
