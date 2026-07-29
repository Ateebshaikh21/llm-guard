import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fetchAuditLogs } from '../lib/api';
import type { AuditLog } from '../lib/types';
import { Panel } from '../components/StatCard';
import { ScrollText, LogIn, LogOut, ShieldCheck, UserCog, Terminal, KeyRound, Settings } from 'lucide-react';

const ACTION_META: Record<string, { icon: typeof LogIn; color: string }> = {
  login: { icon: LogIn, color: 'text-cyber-success' },
  logout: { icon: LogOut, color: 'text-cyber-muted' },
  rule_change: { icon: ShieldCheck, color: 'text-cyber-warning' },
  admin_action: { icon: Settings, color: 'text-cyber-primary' },
  red_team_exec: { icon: Terminal, color: 'text-cyber-danger' },
  rbac_change: { icon: KeyRound, color: 'text-cyber-accent' },
  api_config_change: { icon: UserCog, color: 'text-cyber-primary' },
};

export default function Audit() {
  const { user } = useAuth();
  const orgId = user!.organization_id!;
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditLogs(orgId, 200).then(setLogs).catch(() => {}).finally(() => setLoading(false));
  }, [orgId]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">Audit Trail</h1>
        <p className="text-cyber-muted text-sm mt-1">Immutable record of privileged actions: logins, rule changes, RBAC, red-team, and config changes.</p>
      </div>

      <Panel title={`Audit Logs (${logs.length})`} action={<ScrollText className="w-4 h-4 text-cyber-accent" />}>
        {loading ? (
          <div className="py-10 text-center text-cyber-muted">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="py-10 text-center text-cyber-muted">No audit events recorded yet. Sign-in / sign-out actions are logged automatically.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {logs.map((l) => {
              const meta = ACTION_META[l.action] ?? { icon: ScrollText, color: 'text-cyber-muted' };
              return (
                <div key={l.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-cyber-surface/40 border border-cyber-border/50 hover:border-cyber-primary/30 transition animate-slideIn">
                  <meta.icon className={`w-4 h-4 shrink-0 ${meta.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium capitalize">{l.action.replace(/_/g, ' ')}</span>
                      {l.actor_role && <span className="chip severity-info">{l.actor_role.replace('_', ' ')}</span>}
                      {l.target_type && <span className="text-xs text-cyber-muted">→ {l.target_type}{l.target_id ? `:${l.target_id.slice(0, 8)}` : ''}</span>}
                    </div>
                    {l.details && <p className="text-xs text-cyber-muted font-mono mt-0.5 truncate">{JSON.stringify(l.details)}</p>}
                  </div>
                  <span className="text-[10px] text-cyber-muted font-mono shrink-0">{new Date(l.timestamp).toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
