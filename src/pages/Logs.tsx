import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fetchPromptLogs, fetchRules, fetchOrgUsers, type LogFilters } from '../lib/api';
import { exportCSV, exportJSON, exportPDF } from '../lib/export';
import type { PromptLog, FirewallRule, UserProfile } from '../lib/types';
import { Panel } from '../components/StatCard';
import { Search, Download, FileText, FileJson, FileType, Filter, X } from 'lucide-react';

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
const STATUSES = ['blocked', 'flagged', 'allowed'];

export default function Logs() {
  const { user } = useAuth();
  const orgId = user!.organization_id!;
  const [logs, setLogs] = useState<PromptLog[]>([]);
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [fUser, setFUser] = useState('');
  const [fRule, setFRule] = useState('');
  const [fSeverity, setFSeverity] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fStart, setFStart] = useState('');
  const [fEnd, setFEnd] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const filters: LogFilters = {
        userId: fUser || undefined,
        rule: fRule || undefined,
        severity: fSeverity || undefined,
        status: fStatus || undefined,
        startDate: fStart ? new Date(fStart).toISOString() : undefined,
        endDate: fEnd ? new Date(fEnd + 'T23:59:59').toISOString() : undefined,
        limit: 500,
      };
      const [l, r, u] = await Promise.all([
        fetchPromptLogs(orgId, filters),
        fetchRules(orgId),
        fetchOrgUsers(orgId),
      ]);
      setLogs(l); setRules(r); setUsers(u);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [orgId]);

  const filtered = useMemo(() => {
    if (!search) return logs;
    const s = search.toLowerCase();
    return logs.filter((l) =>
      l.event_id.toLowerCase().includes(s) ||
      (l.triggered_rule ?? '').toLowerCase().includes(s) ||
      (l.source_ip ?? '').toLowerCase().includes(s) ||
      (l.prompt_hash ?? '').toLowerCase().includes(s)
    );
  }, [logs, search]);

  const hasFilters = fUser || fRule || fSeverity || fStatus || fStart || fEnd;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prompt Logs</h1>
          <p className="text-cyber-muted text-sm mt-1">Structured JSON telemetry for every prompt through the firewall.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportJSON(filtered)} className="btn-ghost" disabled={!filtered.length}><FileJson className="w-4 h-4" />JSON</button>
          <button onClick={() => exportCSV(filtered)} className="btn-ghost" disabled={!filtered.length}><FileText className="w-4 h-4" />CSV</button>
          <button onClick={() => exportPDF(filtered)} className="btn-ghost" disabled={!filtered.length}><FileType className="w-4 h-4" />PDF</button>
        </div>
      </div>

      {/* Filters */}
      <Panel title="Search & Filters" action={<Filter className="w-4 h-4 text-cyber-primary" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="relative md:col-span-2 lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted" />
            <input className="input w-full pl-10" placeholder="Search event ID, rule, IP, hash…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input" value={fUser} onChange={(e) => setFUser(e.target.value)}>
            <option value="">All users</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
          </select>
          <select className="input" value={fRule} onChange={(e) => setFRule(e.target.value)}>
            <option value="">All rules</option>
            {rules.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
          </select>
          <select className="input" value={fSeverity} onChange={(e) => setFSeverity(e.target.value)}>
            <option value="">All severity</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">All status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="date" className="input" value={fStart} onChange={(e) => setFStart(e.target.value)} />
          <input type="date" className="input" value={fEnd} onChange={(e) => setFEnd(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={load} className="btn-primary flex-1"><Download className="w-4 h-4" />Apply</button>
            {hasFilters && (
              <button onClick={() => { setFUser(''); setFRule(''); setFSeverity(''); setFStatus(''); setFStart(''); setFEnd(''); }} className="btn-ghost"><X className="w-4 h-4" /></button>
            )}
          </div>
        </div>
      </Panel>

      {error && <div className="glass p-4 text-cyber-danger text-sm">{error}</div>}

      {/* Table */}
      <Panel title={`Results (${filtered.length})`}>
        {loading ? (
          <div className="py-10 text-center text-cyber-muted">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-cyber-muted">No logs match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-cyber-muted font-mono text-xs uppercase tracking-wider border-b border-cyber-border">
                  <th className="px-3 py-2">Event ID</th>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Severity</th>
                  <th className="px-3 py-2">Stage</th>
                  <th className="px-3 py-2">Triggered Rule</th>
                  <th className="px-3 py-2">ML Score</th>
                  <th className="px-3 py-2">DLP</th>
                  <th className="px-3 py-2">Source IP</th>
                  <th className="px-3 py-2">Resp ms</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {filtered.map((l) => (
                  <tr key={l.id} className="border-b border-cyber-border/50 hover:bg-cyber-surface/30 transition">
                    <td className="px-3 py-2 text-cyber-muted">{l.event_id.slice(0, 12)}…</td>
                    <td className="px-3 py-2 text-cyber-muted">{new Date(l.timestamp).toLocaleString()}</td>
                    <td className="px-3 py-2"><span className={`chip status-${l.prompt_status}`}>{l.prompt_status}</span></td>
                    <td className="px-3 py-2"><span className={`chip severity-${l.severity}`}>{l.severity}</span></td>
                    <td className="px-3 py-2 text-cyber-muted">{l.pipeline_stage}</td>
                    <td className="px-3 py-2 text-cyber-text max-w-[160px] truncate">{l.triggered_rule ?? '—'}</td>
                    <td className="px-3 py-2 text-cyber-muted">{l.ml_score != null ? l.ml_score.toFixed(3) : '—'}</td>
                    <td className="px-3 py-2">{l.dlp_detected ? <span className="text-cyber-danger">Yes</span> : <span className="text-cyber-muted">No</span>}</td>
                    <td className="px-3 py-2 text-cyber-muted">{l.source_ip ?? '—'}</td>
                    <td className="px-3 py-2 text-cyber-muted">{l.response_time_ms ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
