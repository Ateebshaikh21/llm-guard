import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Shield, LayoutDashboard, FileText, Bell, ScrollText, ShieldCheck, Users, LogOut, Activity } from 'lucide-react';

const roleLabel: Record<string, string> = {
  admin: 'Administrator',
  soc_analyst: 'SOC Analyst',
  employee: 'Employee',
};

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const links = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/logs', label: 'Prompt Logs', icon: FileText },
    { to: '/alerts', label: 'Alerts', icon: Bell },
    { to: '/audit', label: 'Audit Trail', icon: ScrollText },
    { to: '/rules', label: 'Firewall Rules', icon: ShieldCheck },
  ];
  if (user?.role === 'admin') links.push({ to: '/users', label: 'Users & RBAC', icon: Users });

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-cyber-border bg-cyber-panel/40 backdrop-blur-xl flex flex-col">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-cyber-border">
          <div className="w-10 h-10 rounded-xl bg-cyber-primary/10 border border-cyber-primary/40 flex items-center justify-center animate-pulseGlow">
            <Shield className="w-5 h-5 text-cyber-primary" />
          </div>
          <div>
            <p className="font-bold text-cyber-text leading-tight">LLM-Guard</p>
            <p className="text-[10px] text-cyber-muted font-mono uppercase tracking-wider">SOC Console</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              <l.icon className="w-4 h-4" />
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-cyber-border">
          <div className="px-3 py-2 mb-2 rounded-xl bg-cyber-surface/60 border border-cyber-border">
            <p className="text-sm font-medium text-cyber-text truncate">{user?.email}</p>
            <p className="text-[10px] text-cyber-primary font-mono uppercase tracking-wider mt-0.5">
              {roleLabel[user?.role ?? 'employee']}
            </p>
          </div>
          <button
            onClick={async () => { await signOut(); navigate('/'); }}
            className="nav-link w-full text-cyber-danger hover:bg-cyber-danger/10"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-cyber-border bg-cyber-panel/30 backdrop-blur-xl flex items-center justify-between px-6">
          <div className="flex items-center gap-2 text-cyber-muted text-sm font-mono">
            <Activity className="w-4 h-4 text-cyber-success animate-pulse" />
            <span className="text-cyber-success">LIVE</span>
            <span className="text-cyber-border">|</span>
            <span>Telemetry pipeline operational</span>
          </div>
          <div className="text-xs text-cyber-muted font-mono">
            {new Date().toUTCString()}
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
