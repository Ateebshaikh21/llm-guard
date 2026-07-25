import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { login, token } = useAuth()
  const [email, setEmail] = useState('admin@llmguard.local')
  const [password, setPassword] = useState('Admin1234!')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (token) return <Navigate to="/dashboard" replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try { await login(email, password) }
    catch (err: any) {
      const detail = err?.response?.data?.detail
      if (typeof detail === 'string') setError(detail)
      else if (Array.isArray(detail)) setError(detail.map((d: any) => d.msg).join(', '))
      else setError('Login failed')
    }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900"
      style={{backgroundImage:'linear-gradient(rgba(0,212,214,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,214,0.03) 1px,transparent 1px)',backgroundSize:'40px 40px'}}>
      <motion.div initial={{opacity:0,y:24,scale:0.96}} animate={{opacity:1,y:0,scale:1}} transition={{type:'spring',stiffness:180,damping:22}}
        className="w-full max-w-sm px-4">
        <div className="glass-card p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <motion.div animate={{boxShadow:['0 0 15px rgba(0,212,214,0.3)','0 0 35px rgba(0,212,214,0.5)','0 0 15px rgba(0,212,214,0.3)']}}
              transition={{duration:2,repeat:Infinity}}
              className="w-14 h-14 rounded-xl bg-dark-700 border border-cyan-500/30 flex items-center justify-center mb-4">
              <Shield className="w-7 h-7 text-cyan-400" />
            </motion.div>
            <h1 className="text-xl font-bold"><span className="text-cyan-400">LLM</span>-Guard</h1>
            <p className="text-slate-500 text-xs mt-1">AI Security Posture Management</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
                className="w-full bg-dark-700/60 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Password</label>
              <div className="relative">
                <input type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required
                  className="w-full bg-dark-700/60 border border-white/10 rounded-lg px-3 py-2.5 pr-9 text-sm text-white focus:outline-none focus:border-cyan-500/40 transition-all" />
                <button type="button" onClick={()=>setShow(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {show?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                </button>
              </div>
            </div>

            {error && <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0"/>{error}
            </div>}

            <motion.button whileHover={{scale:1.01}} whileTap={{scale:0.98}} type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 hover:border-cyan-500/60 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {loading && <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"/>}
              {loading ? 'Signing in…' : 'Sign In to SOC Dashboard'}
            </motion.button>
          </form>

          <p className="text-center text-xs text-slate-700 mt-5">admin@llmguard.local / Admin1234!</p>
        </div>
      </motion.div>
    </div>
  )
}
