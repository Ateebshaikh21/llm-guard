import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fetchRules, toggleRule, insertAuditLog } from '../lib/api';
import type { FirewallRule } from '../lib/types';
import { Panel } from '../components/StatCard';
import { ShieldCheck, ShieldOff, Plus, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Rules() {
  const { user } = useAuth();
  const orgId = user!.organization_id!;
  const isAdmin = user!.role === 'admin';
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newRule, setNewRule] = useState({ name: '', pattern: '', rule_type: 'injection', severity: 'medium', action: 'block' });

  async function load() {
    setLoading(true);
    try { setRules(await fetchRules(orgId)); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [orgId]);

  async function onToggle(r: FirewallRule) {
    if (!isAdmin) return;
    setBusy(r.id);
    try {
      await toggleRule(r.id, !r.is_enabled, user!);
      void load();
    } finally { setBusy(null); }
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy('new');
    try {
      const { data, error } = await supabase.from('firewall_rules').insert({
        organization_id: orgId,
        name: newRule.name,
        pattern: newRule.pattern,
        rule_type: newRule.rule_type,
        severity: newRule.severity,
        action: newRule.action,
        is_enabled: true,
        created_by: user!.id,
      }).select('id').single();
      if (error) throw error;
      await insertAuditLog({
        organization_id: orgId, actor_id: user!.id, actor_role: user!.role,
        action: 'rule_change', target_type: 'firewall_rule', target_id: (data as { id: string }).id,
        details: { name: newRule.name, action: 'created' },
      });
      setNewRule({ name: '', pattern: '', rule_type: 'injection', severity: 'medium', action: 'block' });
      setShowAdd(false);
      void load();
    } finally { setBusy(null); }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Firewall Rules</h1>
          <p className="text-cyber-muted text-sm mt-1">Injection, jailbreak, DLP, and toxicity detection rules. Changes are audit-logged.</p>
        </div>
        {isAdmin && <button onClick={() => setShowAdd((s) => !s)} className="btn-primary"><Plus className="w-4 h-4" />New Rule</button>}
      </div>

      {showAdd && (
        <Panel title="Create Firewall Rule">
          <form onSubmit={onAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <input className="input" placeholder="Rule name" value={newRule.name} onChange={(e) => setNewRule({ ...newRule, name: e.target.value })} required />
            <input className="input" placeholder="Regex pattern" value={newRule.pattern} onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })} required />
            <select className="input" value={newRule.rule_type} onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value })}>
              {['injection','jailbreak','dlp','prompt_leak','toxicity','custom'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="input" value={newRule.severity} onChange={(e) => setNewRule({ ...newRule, severity: e.target.value })}>
              {['critical','high','medium','low','info'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="input" value={newRule.action} onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}>
              {['block','flag','log','allow'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="md:col-span-2 lg:col-span-5 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAdd(false)} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={busy === 'new'} className="btn-primary">{busy === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Create Rule</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel title={`Rules (${rules.length})`}>
        {loading ? (
          <div className="py-10 text-center text-cyber-muted">Loading…</div>
        ) : (
          <div className="flex flex-col gap-2">
            {rules.map((r) => (
              <div key={r.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition ${r.is_enabled ? 'bg-cyber-surface/40 border-cyber-border' : 'bg-cyber-surface/20 border-cyber-border opacity-60'}`}>
                {r.is_enabled ? <ShieldCheck className="w-4 h-4 text-cyber-success shrink-0" /> : <ShieldOff className="w-4 h-4 text-cyber-muted shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{r.name}</span>
                    <span className="chip severity-info">{r.rule_type}</span>
                    <span className={`chip severity-${r.severity}`}>{r.severity}</span>
                    <span className="chip severity-info">{r.action}</span>
                  </div>
                  {r.description && <p className="text-xs text-cyber-muted mt-0.5">{r.description}</p>}
                  {r.pattern && <p className="text-[10px] text-cyber-muted font-mono mt-0.5 truncate">/{r.pattern}/</p>}
                </div>
                {isAdmin && (
                  <button onClick={() => onToggle(r)} disabled={busy === r.id} className="btn-ghost text-xs px-3 py-1.5 shrink-0">
                    {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : r.is_enabled ? 'Disable' : 'Enable'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
