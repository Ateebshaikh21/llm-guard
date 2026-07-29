import type { ReactNode } from 'react';

export function StatCard({
  label, value, icon, accent = 'primary', sub,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  accent?: 'primary' | 'danger' | 'warning' | 'success' | 'accent';
  sub?: string;
}) {
  const accentMap: Record<string, string> = {
    primary: 'text-cyber-primary',
    danger: 'text-cyber-danger',
    warning: 'text-cyber-warning',
    success: 'text-cyber-success',
    accent: 'text-cyber-accent',
  };
  const ringMap: Record<string, string> = {
    primary: 'border-cyber-primary/30',
    danger: 'border-cyber-danger/30',
    warning: 'border-cyber-warning/30',
    success: 'border-cyber-success/30',
    accent: 'border-cyber-accent/30',
  };
  return (
    <div className={`stat-card border ${ringMap[accent]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-cyber-muted font-mono uppercase tracking-wider">{label}</span>
        <span className={accentMap[accent]}>{icon}</span>
      </div>
      <p className={`text-3xl font-bold ${accentMap[accent]}`}>{value}</p>
      {sub && <p className="text-xs text-cyber-muted">{sub}</p>}
    </div>
  );
}

export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-cyber-text uppercase tracking-wider font-mono">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
