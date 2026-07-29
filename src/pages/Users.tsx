import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fetchOrgUsers, insertAuditLog } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { UserProfile, UserRole } from '../lib/types';
import { Panel } from '../components/StatCard';
import { Users as UsersIcon, Loader2, UserCog } from 'lucide-react';

const ROLES: UserRole[] = ['admin', 'soc_analyst', 'employee'];
const roleChip: Record<UserRole, string> = {
  admin: 'severity-high', soc_analyst: 'severity-low', employee: 'severity-info',
};

export default function Users() {
  const { user } = useAuth();
  const orgId = user!.organization_id!;
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setUsers(await fetchOrgUsers(orgId)); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [orgId]);

  async function changeRole(u: UserProfile, role: UserRole) {
    setBusy(u.id);
    try {
      const { error } = await supabase.from('users').update({ role }).eq('id', u.id);
      if (error) throw error;
      await insertAuditLog({
        organization_id: orgId, actor_id: user!.id, actor_role: user!.role,
        action: 'rbac_change', target_type: 'user', target_id: u.id,
        details: { email: u.email, from: u.role, to: role },
      });
      void load();
    } finally { setBusy(null); }
  }

  async function toggleActive(u: UserProfile) {
    setBusy(u.id);
    try {
      await supabase.from('users').update({ is_active: !u.is_active }).eq('id', u.id);
      await insertAuditLog({
        organization_id: orgId, actor_id: user!.id, actor_role: user!.role,
        action: 'admin_action', target_type: 'user', target_id: u.id,
        details: { email: u.email, is_active: !u.is_active },
      });
      void load();
    } finally { setBusy(null); }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">Users & RBAC</h1>
        <p className="text-cyber-muted text-sm mt-1">Manage organization members and role-based access. Role changes are audit-logged.</p>
      </div>

      <Panel title={`Members (${users.length})`} action={<UsersIcon className="w-4 h-4 text-cyber-accent" />}>
        {loading ? (
          <div className="py-10 text-center text-cyber-muted">Loading…</div>
        ) : (
          <div className="flex flex-col gap-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-cyber-surface/40 border border-cyber-border">
                <div className="w-9 h-9 rounded-lg bg-cyber-primary/10 border border-cyber-primary/30 flex items-center justify-center text-cyber-primary font-bold text-sm shrink-0">
                  {u.email[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.email}</p>
                  <p className="text-xs text-cyber-muted">{u.full_name ?? '—'} · {u.is_active ? 'Active' : 'Disabled'}</p>
                </div>
                <span className={`chip ${roleChip[u.role]}`}>{u.role.replace('_', ' ')}</span>
                {u.id !== user!.id && (
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      className="input text-xs py-1"
                      value={u.role}
                      disabled={busy === u.id}
                      onChange={(e) => changeRole(u, e.target.value as UserRole)}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                    </select>
                    <button onClick={() => toggleActive(u)} disabled={busy === u.id} className="btn-ghost text-xs px-2 py-1.5">
                      {busy === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCog className="w-3.5 h-3.5" />}
                      {u.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
