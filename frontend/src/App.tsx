import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Shield, LayoutDashboard, Ban, Settings, Zap, ClipboardList, Search, LogOut, ChevronLeft, ChevronRight, Activity, Users } from 'lucide-react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import BlockedPrompts from './pages/BlockedPrompts'
import RuleConfig from './pages/RuleConfig'
import RedTeam from './pages/RedTeam'
import AuditLog from './pages/AuditLog'
import Inspector from './pages/Inspector'
import UserManagement from './pages/UserManagement'

// ── Splash ────────────────────────────────────────────────────────────
function Splash() {
  return (
    <div className="fixed inset-0 bg-dark-900 flex flex-col items-center justify-center z-50">
      <motion.div initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',stiffness:200,damping:20}}>
        <div className="w-20 h-20 rounded-2xl bg-dark-700 border border-cyan-500/30 flex items-center justify-center mb-6 mx-auto"
          style={{boxShadow:'0 0 30px rgba(0,212,214,0.4)'}}>
          <Shield className="w-10 h-10 text-cyan-400" />
        </div>
      </motion.div>
      <motion.h1 initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.3}} className="text-2xl font-bold mb-2">
        <span className="text-cyan-400">LLM</span>-Guard
      </motion.h1>
      <motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.5}} className="text-slate-500 text-sm mb-8">
        AI Prompt Firewall
      </motion.p>
      <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.6}} className="w-48 h-0.5 bg-dark-700 rounded-full overflow-hidden">
        <motion.div initial={{width:'0%'}} animate={{width:'100%'}} transition={{duration:1.2,delay:0.7}} className="h-full bg-cyan-500 rounded-full" />
      </motion.div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────
const NAV = [
  { to:'/dashboard', icon:LayoutDashboard, label:'Dashboard',       roles:['admin','soc_analyst','employee'] },
  { to:'/blocked',   icon:Ban,             label:'Blocked Prompts', roles:['admin','soc_analyst'] },
  { to:'/rules',     icon:Settings,        label:'Firewall Rules',  roles:['admin','soc_analyst'] },
  { to:'/inspector', icon:Search,          label:'Prompt Inspector',roles:['admin','soc_analyst','employee'] },
  { to:'/redteam',   icon:Zap,             label:'Red Team',        roles:['admin'] },
  { to:'/audit',     icon:ClipboardList,   label:'Audit Log',       roles:['admin'] },
  { to:'/users',     icon:Users,           label:'User Management', roles:['admin'] },
]

function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout, isAdmin, isAnalyst } = useAuth()
  const allowed = NAV.filter(n => isAdmin || (isAnalyst && n.roles.includes('soc_analyst')) || n.roles.includes('employee'))

  return (
    <motion.aside animate={{width: collapsed ? 68 : 220}} transition={{type:'spring',stiffness:300,damping:30}}
      className="flex-shrink-0 h-screen flex flex-col glass border-r border-cyan-500/10 relative">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-dark-700 border border-cyan-500/30 flex items-center justify-center flex-shrink-0"
          style={{boxShadow:'0 0 10px rgba(0,212,214,0.2)'}}>
          <Shield className="w-4 h-4 text-cyan-400" />
        </div>
        {!collapsed && <motion.div initial={{opacity:0}} animate={{opacity:1}} className="min-w-0">
          <p className="font-bold text-sm"><span className="text-cyan-400">LLM</span>-Guard</p>
          <p className="text-xs text-slate-500">AI Firewall</p>
        </motion.div>}
      </div>

      {/* Status */}
      {!collapsed && <div className="mx-2 mt-2 px-3 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs text-emerald-400">Pipeline Active</span>
        <Activity className="w-3 h-3 text-emerald-400 ml-auto" />
      </div>}

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {allowed.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}>
            {({ isActive }) => (
              <motion.div whileHover={{x:2}} whileTap={{scale:0.97}}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                  isActive ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400'
                           : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={isActive?2:1.5} />
                {!collapsed && <span className="text-sm font-medium truncate">{label}</span>}
              </motion.div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-white/5 p-2">
        {!collapsed && <div className="px-2 py-2">
          <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          <span className={`text-xs font-mono mt-0.5 inline-block px-1.5 py-0.5 rounded ${
            user?.role_id==='admin'?'bg-red-500/10 text-red-400':'bg-slate-500/10 text-slate-400'}`}>
            {user?.role_id}
          </span>
        </div>}
        <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all">
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="text-sm">Logout</span>}
        </motion.button>
      </div>

      {/* Toggle */}
      <button onClick={() => setCollapsed(c=>!c)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-dark-700 border border-cyan-500/20 flex items-center justify-center text-slate-500 hover:text-cyan-400 transition-all z-10">
        {collapsed ? <ChevronRight className="w-3 h-3"/> : <ChevronLeft className="w-3 h-3"/>}
      </button>
    </motion.aside>
  )
}

// ── Layout ────────────────────────────────────────────────────────────
const TITLES: Record<string,string> = {
  '/dashboard':'Security Dashboard', '/blocked':'Blocked Prompts',
  '/rules':'Firewall Rules', '/inspector':'Prompt Inspector',
  '/redteam':'Red Team Simulator', '/audit':'Audit Log',
  '/users':'User Management',
}

function Layout() {
  const loc = useLocation()
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 flex-shrink-0 px-6 flex items-center justify-between border-b border-white/5 glass">
          <motion.h1 key={loc.pathname} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} className="text-sm font-semibold text-slate-200">
            {TITLES[loc.pathname] ?? 'LLM-Guard'}
          </motion.h1>
          <span className="text-xs text-slate-600 font-mono">{new Date().toLocaleTimeString()}</span>
        </header>
        <main className="flex-1 overflow-y-auto p-5">
          <motion.div key={loc.pathname} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:0.2}}>
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}

// ── Protected route ───────────────────────────────────────────────────
function Protected({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

// ── App ───────────────────────────────────────────────────────────────
export default function App() {
  const [loading, setLoading] = useState(true)
  useEffect(() => { setTimeout(() => setLoading(false), 1800) }, [])
  if (loading) return <Splash />

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Layout /></Protected>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="blocked"   element={<BlockedPrompts />} />
            <Route path="rules"     element={<RuleConfig />} />
            <Route path="inspector" element={<Inspector />} />
            <Route path="redteam"   element={<RedTeam />} />
            <Route path="audit"     element={<AuditLog />} />
            <Route path="users"     element={<UserManagement />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
