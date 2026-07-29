import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserProfile, UserRole } from '../lib/types';

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role: UserRole) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; // seeded Acme org

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(session: Session | null) {
    if (!session?.user) {
      setUser(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    if (error || !data) {
      // First login: create profile row for this auth user.
      const meta = session.user.user_metadata ?? {};
      const { data: created, error: insErr } = await supabase
        .from('users')
        .insert({
          id: session.user.id,
          email: session.user.email ?? '',
          full_name: (meta.full_name as string) ?? session.user.email ?? '',
          role: (meta.role as UserRole) ?? 'soc_analyst',
          organization_id: ORG_ID,
          last_login_at: new Date().toISOString(),
        })
        .select('*')
        .maybeSingle();
      if (insErr) {
        setUser(null);
      } else {
        setUser(created as UserProfile);
        // audit login
        void supabase.from('audit_logs').insert({
          event_id: crypto.randomUUID(),
          actor_id: created.id,
          actor_role: created.role,
          action: 'login',
          organization_id: ORG_ID,
          ip_address: null,
          details: { email: created.email },
        });
      }
      setLoading(false);
      return;
    }
    setUser(data as UserProfile);
    await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', data.id);
    void supabase.from('audit_logs').insert({
      event_id: crypto.randomUUID(),
      actor_id: data.id,
      actor_role: (data as UserProfile).role,
      action: 'login',
      organization_id: (data as UserProfile).organization_id,
      details: { email: (data as UserProfile).email },
    });
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      void loadProfile(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadProfile(session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, fullName: string, role: UserRole) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    if (user) {
      void supabase.from('audit_logs').insert({
        event_id: crypto.randomUUID(),
        actor_id: user.id,
        actor_role: user.role,
        action: 'logout',
        organization_id: user.organization_id,
        details: { email: user.email },
      });
    }
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
