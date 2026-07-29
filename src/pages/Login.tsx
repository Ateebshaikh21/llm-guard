import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Shield, Mail, Lock, User, AlertCircle } from 'lucide-react';
import type { UserRole } from '../lib/types';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('soc_analyst');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password, fullName, role);
    setBusy(false);
    if (res.error) setError(res.error);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-cyber-primary/10 border border-cyber-primary/40 flex items-center justify-center animate-pulseGlow mb-4">
            <Shield className="w-8 h-8 text-cyber-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">LLM-Guard</h1>
          <p className="text-cyber-muted text-sm mt-1 font-mono uppercase tracking-widest">SOC Telemetry Console</p>
        </div>

        <div className="glass p-7">
          <div className="flex gap-1 p-1 bg-cyber-surface/60 rounded-xl mb-6">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${mode === m ? 'bg-cyber-primary text-cyber-bg' : 'text-cyber-muted hover:text-cyber-text'}`}
              >
                {m === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4">
            {mode === 'signup' && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted" />
                <input className="input w-full pl-10" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted" />
              <input className="input w-full pl-10" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted" />
              <input className="input w-full pl-10" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            {mode === 'signup' && (
              <div>
                <label className="block text-xs text-cyber-muted mb-1.5 font-mono uppercase tracking-wider">Role</label>
                <select className="input w-full" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                  <option value="admin">Administrator</option>
                  <option value="soc_analyst">SOC Analyst</option>
                  <option value="employee">Employee</option>
                </select>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-cyber-danger bg-cyber-danger/10 border border-cyber-danger/30 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? 'Authenticating…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-xs text-cyber-muted mt-5">
            Protected by Firebase Authentication · RBAC enforced
          </p>
        </div>
      </div>
    </div>
  );
}
