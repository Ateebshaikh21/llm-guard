import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, UserPlus, Trash2, ShieldCheck, User, Briefcase, X, Eye, EyeOff, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react'
import { userApi } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

const ROLE_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  admin:       { label: 'Admin',      color: 'bg-red-500/10 text-red-400 border-red-500/20',         icon: <ShieldCheck className="w-3 h-3" /> },
  soc_analyst: { label: 'SOC Analyst',color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',       icon: <Briefcase className="w-3 h-3" /> },
  employee:    { label: 'Employee',   color: 'bg-slate-500/10 text-slate-400 border-slate-500/20',    icon: <User className="w-3 h-3" /> },
}

function RoleBadge({ role }: { role: string }) {
  const m = ROLE_META[role] ?? ROLE_META.employee
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${m.color}`}>
      {m.icon}{m.label}
    </span>
  )
}

// ── Create User Modal ────────────────────────────────────────────────
function CreateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('employee')
  const [showPw, setShowPw] = useState(false)
  const [err, setErr] = useState('')

  const create = useMutation({
    mutationFn: () => userApi.create({ email, password, role_id: role, org_id: ORG_ID }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onClose() },
    onError: (e: any) => {
      const d = e?.response?.data?.detail
      setErr(typeof d === 'string' ? d : Array.isArray(d) ? d.map((x: any) => x.msg).join(', ') : 'Failed to create user')
    },
  })

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass-card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-base flex items-center gap-2"><UserPlus className="w-4 h-4 text-cyan-400" />New User</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="user@company.com"
              className="w-full bg-dark-700/60 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full bg-dark-700/60 border border-white/10 rounded-lg px-3 py-2.5 pr-9 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(ROLE_META).map(([key, meta]) => (
                <button key={key} onClick={() => setRole(key)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all ${
                    role === key ? `${meta.color} border-current` : 'border-white/10 text-slate-500 hover:border-white/20'}`}>
                  <span className="scale-125">{meta.icon}</span>
                  {meta.label}
                </button>
              ))}
            </div>
          </div>

          {err && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{err}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-white/10 text-slate-400 text-sm hover:border-white/20 transition-all">Cancel</button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => create.mutate()}
              disabled={!email || !password || create.isPending}
              className="flex-1 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {create.isPending && <span className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />}
              Create User
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Delete Confirmation ──────────────────────────────────────────────
function DeleteModal({ user, onClose }: { user: any; onClose: () => void }) {
  const qc = useQueryClient()
  const del = useMutation({
    mutationFn: () => userApi.delete(user.user_id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onClose() },
  })
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Delete User</h3>
            <p className="text-xs text-slate-500">This action cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-slate-300 mb-5">
          Delete <span className="text-white font-medium">{user.email}</span>?
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-white/10 text-slate-400 text-sm hover:border-white/20 transition-all">Cancel</button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => del.mutate()}
            disabled={del.isPending}
            className="flex-1 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all disabled:opacity-50">
            {del.isPending ? 'Deleting…' : 'Delete'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────
export default function UserManagement() {
  const { user: me } = useAuth()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)

  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: userApi.list })

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => userApi.update(id, { is_active: active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const statCards = [
    { label: 'Total Users',   value: data?.total ?? 0,                          color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/20' },
    { label: 'Admins',        value: data?.role_counts?.admin ?? 0,              color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
    { label: 'SOC Analysts',  value: data?.role_counts?.soc_analyst ?? 0,        color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/20' },
    { label: 'Employees',     value: data?.role_counts?.employee ?? 0,           color: 'text-slate-400',   bg: 'bg-slate-500/10 border-slate-500/20' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Users className="w-5 h-5 text-cyan-400" />User Management</h2>
          <p className="text-slate-500 text-xs mt-0.5">Manage org members and access roles</p>
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 transition-all">
          <UserPlus className="w-4 h-4" />New User
        </motion.button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="glass-card p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">{s.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${s.color}`}>
              {isLoading ? <span className="skeleton h-6 w-10 inline-block" /> : s.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Users table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              {['User', 'Role', 'Status', 'Created', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? [...Array(4)].map((_, i) => (
              <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="skeleton h-4 w-full" /></td></tr>
            )) : (data?.users ?? []).map((u: any) => (
              <motion.tr key={u.user_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="hover:bg-white/2 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-dark-700 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-400">
                      {u.email[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">{u.email}</p>
                      <p className="text-xs text-slate-600 font-mono">{u.user_id.slice(0, 12)}…</p>
                    </div>
                    {u.user_id === me?.user_id && (
                      <span className="text-xs px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded">you</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3"><RoleBadge role={u.role_id} /></td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${u.is_active
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                    {u.is_active ? '● Active' : '○ Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  {u.user_id !== me?.user_id ? (
                    <div className="flex items-center gap-2">
                      <motion.button whileTap={{ scale: 0.9 }}
                        onClick={() => toggle.mutate({ id: u.user_id, active: !u.is_active })}
                        title={u.is_active ? 'Deactivate' : 'Activate'}
                        className={`transition-colors ${u.is_active ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-500 hover:text-emerald-400'}`}>
                        {u.is_active
                          ? <ToggleRight className="w-5 h-5" />
                          : <ToggleLeft className="w-5 h-5" />}
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.9 }}
                        onClick={() => setDeleteTarget(u)}
                        className="text-slate-600 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-700">—</span>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {!isLoading && !data?.users?.length && (
          <p className="text-center text-slate-600 py-10">No users found</p>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
        {deleteTarget && <DeleteModal user={deleteTarget} onClose={() => setDeleteTarget(null)} />}
      </AnimatePresence>
    </div>
  )
}
