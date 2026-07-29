import { useEffect, useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useAuth } from '../auth/AuthContext';
import { StatCard, Panel } from '../components/StatCard';
import {
  fetchStatistics, fetchPromptLogs, fetchAlerts, fetchRules, acknowledgeAlert,
} from '../lib/api';
import type { Statistics, PromptLog, Alert, FirewallRule } from '../lib/types';
import {
  Shield, ShieldAlert, ShieldCheck, FileWarning, Clock, Zap, Activity,
  Bell, CheckCircle2, Flame,
} from 'lucide-react';

const SEV_COLORS: Record<string, string> = {
  critical: '#ff4d6d', high: '#ff7a66', medium: '#ffb020', low: '#22d3ee', info: '#8a9bbd',
};

export default function Dashboard() {
  const { user } = useAuth();
  const orgId = user!.organization_id!;
  const [stats, setStats] = useState<Statistics[]>([]);
  const [logs, setLogs] = useState<PromptLog[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, l, a, r] = await Promise.all([
          fetchStatistics(orgId, 7),
          fetchPromptLogs(orgId, { limit: 50 }),
          fetchAlerts(orgId, true),
          fetchRules(orgId),
        ]);
        if (!alive) return;
        setStats(s); setLogs(l); setAlerts(a); setRules(r);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [orgId]);

  // live log polling
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const l = await fetchPromptLogs(orgId, { limit: 8 });
        setLogs((prev) => (l[0]?.event_id !== prev[0]?.event_id ? l : prev));
        const a = await fetchAlerts(orgId, true);
        setAlerts(a);
      } catch { /* ignore poll errors */ }
    }, 8000);
    return () => clearInterval(id);
  }, [orgId]);

  const totals = useMemo(() => {
    const total = stats.reduce((s, d) => s + d.total_prompts, 0);
    const blocked = stats.reduce((s, d) => s + d.blocked_prompts, 0);
    const allowed = stats.reduce((s, d) => s + d.allowed_prompts, 0);
    const dlp = stats.reduce((s, d) => s + d.dlp_detections, 0);
    const avgResp = stats.length ? stats.reduce((s, d) => s + d.avg_response_time_ms, 0) / stats.length : 0;
    return { total, blocked, allowed, dlp, blockRate: total ? blocked / total : 0, avgResp };
  }, [stats]);

  const trendData = useMemo(() => stats.map((s) => ({
    date: s.stat_date.slice(5),
    Allowed: s.allowed_prompts,
    Blocked: s.blocked_prompts,
    DLP: s.dlp_detections,
  })), [stats]);

  const severityData = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const l of logs) counts[l.severity] = (counts[l.severity] ?? 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [logs]);

  const topRules = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of stats) {
      for (const [rule, c] of Object.entries(s.rule_triggers ?? {})) {
        counts.set(rule, (counts.get(rule) ?? 0) + c);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([rule, count]) => ({ rule: rule.slice(0, 22), count }));
  }, [stats]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 rounded-full border-2 border-cyber-primary/30 border-t-cyber-primary animate-spin" /></div>;
  }
  if (error) {
    return <div className="glass p-6 text-cyber-danger">Failed to load dashboard: {error}</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Security Operations Center</h1>
        <p className="text-cyber-muted text-sm mt-1">Real-time telemetry across the LLM-Guard prompt firewall pipeline.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Prompts" value={totals.total.toLocaleString()} icon={<Activity className="w-5 h-5" />} sub="last 7 days" />
        <StatCard label="Blocked" value={totals.blocked.toLocaleString()} icon={<ShieldAlert className="w-5 h-5" />} accent="danger" sub={`${(totals.blockRate * 100).toFixed(1)}% block rate`} />
        <StatCard label="Allowed" value={totals.allowed.toLocaleString()} icon={<ShieldCheck className="w-5 h-5" />} accent="success" />
        <StatCard label="DLP Detections" value={totals.dlp.toLocaleString()} icon={<FileWarning className="w-5 h-5" />} accent="warning" />
        <StatCard label="Avg Response" value={`${Math.round(totals.avgResp)}ms`} icon={<Clock className="w-5 h-5" />} accent="accent" />
        <StatCard label="Active Rules" value={rules.filter((r) => r.is_enabled).length} icon={<Shield className="w-5 h-5" />} sub={`${rules.length} total`} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Daily Prompt Trend" >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trendData} margin={{ left: -20, right: 10, top: 5 }}>
              <defs>
                <linearGradient id="gAllowed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d39a" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#22d39a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gBlocked" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff4d6d" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ff4d6d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a44" />
              <XAxis dataKey="date" stroke="#8a9bbd" fontSize={11} />
              <YAxis stroke="#8a9bbd" fontSize={11} />
              <Tooltip contentStyle={{ background: '#0d1424', border: '1px solid #1e2a44', borderRadius: 12, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="Allowed" stroke="#22d39a" fill="url(#gAllowed)" strokeWidth={2} animationDuration={900} />
              <Area type="monotone" dataKey="Blocked" stroke="#ff4d6d" fill="url(#gBlocked)" strokeWidth={2} animationDuration={900} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Threat Severity Distribution">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={severityData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} animationDuration={900}>
                {severityData.map((e) => <Cell key={e.name} fill={SEV_COLORS[e.name]} stroke="#0d1424" />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0d1424', border: '1px solid #1e2a44', borderRadius: 12, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Top Triggered Firewall Rules">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topRules} layout="vertical" margin={{ left: 20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a44" horizontal={false} />
              <XAxis type="number" stroke="#8a9bbd" fontSize={11} />
              <YAxis type="category" dataKey="rule" stroke="#8a9bbd" fontSize={10} width={110} />
              <Tooltip contentStyle={{ background: '#0d1424', border: '1px solid #1e2a44', borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="count" fill="#00e5ff" radius={[0, 6, 6, 0]} animationDuration={900} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Alerts + live logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Active Alerts" action={<Bell className="w-4 h-4 text-cyber-warning" />}>
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-cyber-muted">
              <CheckCircle2 className="w-8 h-8 text-cyber-success mb-2" />
              <p className="text-sm">No unacknowledged alerts. All clear.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-80 overflow-auto">
              {alerts.slice(0, 12).map((a) => (
                <div key={a.id} className={`glass p-3 border-l-2 ${a.severity === 'critical' ? 'border-l-cyber-danger' : a.severity === 'high' ? 'border-l-red-500' : 'border-l-cyber-warning'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Flame className={`w-3.5 h-3.5 ${a.severity === 'critical' ? 'text-cyber-danger' : 'text-cyber-warning'}`} />
                        <span className="text-xs font-mono uppercase tracking-wider text-cyber-muted">{a.type.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="text-sm text-cyber-text mt-1 truncate">{a.message}</p>
                      <p className="text-[10px] text-cyber-muted font-mono mt-1">{new Date(a.timestamp).toLocaleString()}</p>
                    </div>
                    <button onClick={() => acknowledgeAlert(a.id, user!.id).then(() => setAlerts((p) => p.filter((x) => x.id !== a.id)))}
                      className="btn-ghost text-xs px-2 py-1 shrink-0">Ack</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Live Security Events" action={<span className="flex items-center gap-1 text-xs text-cyber-success font-mono"><Zap className="w-3 h-3" />LIVE</span>}>
          <div className="flex flex-col gap-1.5 max-h-80 overflow-auto font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-cyber-muted py-10 text-center">No events yet. Ingest a sample event to see live logs.</p>
            ) : logs.map((l) => (
              <div key={l.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-cyber-surface/40 animate-slideIn">
                <span className={`chip ${l.prompt_status === 'blocked' ? 'status-blocked' : l.prompt_status === 'flagged' ? 'status-flagged' : 'status-allowed'}`}>{l.prompt_status}</span>
                <span className={`chip severity-${l.severity}`}>{l.severity}</span>
                <span className="text-cyber-muted truncate flex-1">{l.triggered_rule ?? 'clean prompt'}</span>
                <span className="text-cyber-muted">{new Date(l.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
