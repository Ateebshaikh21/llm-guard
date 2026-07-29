import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fetchAlerts, acknowledgeAlert, forwardToSIEM } from '../lib/api';
import type { Alert } from '../lib/types';
import { Panel } from '../components/StatCard';
import { Bell, CheckCircle2, Flame, ShieldX, Webhook, Loader2 } from 'lucide-react';

const TYPE_ICON: Record<string, typeof Flame> = {
  jailbreak: Flame,
  prompt_injection: ShieldX,
  dlp_violation: Bell,
  failed_logins: ShieldX,
  firewall_disabled: ShieldX,
  ml_high_confidence: Flame,
};

export default function Alerts() {
  const { user } = useAuth();
  const orgId = user!.organization_id!;
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [forwarding, setForwarding] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setAlerts(await fetchAlerts(orgId, !showAll)); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [orgId, showAll]);

  async function ack(id: string) {
    await acknowledgeAlert(id, user!.id);
    void load();
  }

  async function siem(a: Alert) {
    setForwarding(a.id);
    try {
      await forwardToSIEM({ alert_id: a.alert_id, type: a.type, severity: a.severity, message: a.message, timestamp: a.timestamp });
      alert('Alert forwarded to SIEM webhook.');
    } catch (e) {
      alert('SIEM forward failed: ' + (e as Error).message);
    } finally {
      setForwarding(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Security Alerts</h1>
          <p className="text-cyber-muted text-sm mt-1">Generated alerts from jailbreak, injection, DLP, and ML-confidence detections.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-cyber-muted cursor-pointer">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="accent-cyber-primary" />
          Show acknowledged
        </label>
      </div>

      <Panel title={`Alerts (${alerts.length})`}>
        {loading ? (
          <div className="py-10 text-center text-cyber-muted">Loading…</div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-cyber-muted">
            <CheckCircle2 className="w-10 h-10 text-cyber-success mb-3" />
            <p className="text-sm">No alerts in this view.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {alerts.map((a) => {
              const Icon = TYPE_ICON[a.type] ?? Flame;
              return (
                <div key={a.id} className={`glass p-4 border-l-2 ${a.severity === 'critical' ? 'border-l-cyber-danger' : a.severity === 'high' ? 'border-l-red-500' : 'border-l-cyber-warning'} ${a.is_acknowledged ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${a.severity === 'critical' ? 'bg-cyber-danger/15 text-cyber-danger' : 'bg-cyber-warning/15 text-cyber-warning'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold capitalize">{a.type.replace(/_/g, ' ')}</span>
                        <span className={`chip severity-${a.severity}`}>{a.severity}</span>
                        {a.is_acknowledged && <span className="chip severity-info">acknowledged</span>}
                      </div>
                      <p className="text-sm text-cyber-text mt-1">{a.message}</p>
                      <p className="text-[10px] text-cyber-muted font-mono mt-1">{new Date(a.timestamp).toLocaleString()} · {a.alert_id}</p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {!a.is_acknowledged && <button onClick={() => ack(a.id)} className="btn-ghost text-xs px-3 py-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Acknowledge</button>}
                      <button onClick={() => siem(a)} disabled={forwarding === a.id} className="btn-ghost text-xs px-3 py-1.5">
                        {forwarding === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Webhook className="w-3.5 h-3.5" />}Forward to SIEM
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
