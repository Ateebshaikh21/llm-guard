import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Shield, AlertTriangle, CheckCircle, Eye, TrendingUp, Zap, Clock } from 'lucide-react'
import { statsApi, logsApi } from '../lib/api'

function Counter({ value }: { value: number }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const start = Date.now(), duration = 900
    const tick = () => {
      const p = Math.min((Date.now()-start)/duration,1)
      setN(Math.round(value*(1-Math.pow(1-p,3))))
      if(p<1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])
  return <>{n.toLocaleString()}</>
}

const TIP = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card px-3 py-2 text-xs border border-cyan-500/20">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p: any) => <p key={p.name} style={{color:p.color}}>{p.name}: <b>{p.value}</b></p>)}
    </div>
  )
}

export default function Dashboard() {
  const [range, setRange] = useState('7d')
  const { data: stats, isLoading } = useQuery({ queryKey:['stats',range], queryFn:()=>statsApi.summary(range), refetchInterval:30000 })
  const { data: logs } = useQuery({ queryKey:['logs-recent'], queryFn:()=>logsApi.list({limit:6}), refetchInterval:15000 })

  const pieData = stats ? [
    { name:'Allowed',  value:stats.allowed_prompts,  color:'#34d399' },
    { name:'Blocked',  value:stats.blocked_prompts,  color:'#f87171' },
    { name:'Modified', value:stats.modified_prompts, color:'#fbbf24' },
  ] : []

  const statCards = [
    { label:'Total Prompts', icon:<Eye className="w-4 h-4"/>, color:'text-cyan-400', bg:'bg-cyan-500/10 border-cyan-500/20', value: stats?.total_prompts ?? 0 },
    { label:'Blocked',       icon:<AlertTriangle className="w-4 h-4"/>, color:'text-red-400', bg:'bg-red-500/10 border-red-500/20', value: stats?.blocked_prompts ?? 0 },
    { label:'Block Rate',    icon:<Shield className="w-4 h-4"/>, color:'text-amber-400', bg:'bg-amber-500/10 border-amber-500/20', value: null, display: `${stats?.block_rate_percent ?? 0}%` },
    { label:'Allowed',       icon:<CheckCircle className="w-4 h-4"/>, color:'text-emerald-400', bg:'bg-emerald-500/10 border-emerald-500/20', value: stats?.allowed_prompts ?? 0 },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-bold">Security Overview</h2><p className="text-slate-500 text-xs mt-0.5">Real-time firewall telemetry</p></div>
        <div className="flex gap-1 p-1 bg-dark-800 rounded-lg border border-white/5">
          {['1d','7d','30d','90d'].map(r=>(
            <button key={r} onClick={()=>setRange(r)}
              className={`px-3 py-1 rounded text-xs font-mono transition-all ${range===r?'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25':'text-slate-500 hover:text-slate-300'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s,i)=>(
          <motion.div key={s.label} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*0.07}}
            whileHover={{y:-2}} className="glass-card p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-slate-400 uppercase tracking-wider">{s.label}</p>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${s.bg} ${s.color}`}>{s.icon}</div>
            </div>
            {isLoading ? <div className="skeleton h-7 w-20"/> :
              <p className="text-2xl font-bold tabular-nums">{s.display ?? <Counter value={s.value!}/>}</p>}
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400"/>Volume Trend
          </h3>
          {isLoading ? <div className="skeleton h-44 w-full"/> : (
            <ResponsiveContainer width="100%" height={176}>
              <AreaChart data={stats?.daily_volume??[]}>
                <defs>
                  <linearGradient id="gT" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4d6" stopOpacity={0.25}/><stop offset="95%" stopColor="#00d4d6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f87171" stopOpacity={0.25}/><stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3"/>
                <XAxis dataKey="date" tick={{fill:'#64748b',fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:'#64748b',fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip content={<TIP/>}/>
                <Area type="monotone" dataKey="total" name="Total" stroke="#00d4d6" strokeWidth={2} fill="url(#gT)"/>
                <Area type="monotone" dataKey="blocked" name="Blocked" stroke="#f87171" strokeWidth={2} fill="url(#gB)"/>
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400"/>Decision Split
          </h3>
          {isLoading ? <div className="skeleton h-44 w-full"/> : (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={55} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {pieData.map((e,i)=><Cell key={i} fill={e.color} opacity={0.85}/>)}
                </Pie><Tooltip content={<TIP/>}/></PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pieData.map(d=>(
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{background:d.color}}/><span className="text-slate-400">{d.name}</span></div>
                    <span className="font-mono text-white">{d.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top rules + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400"/>Top Triggered Rules</h3>
          <div className="space-y-2">
            {(stats?.top_triggered_rules??[]).map((r:any,i:number)=>{
              const max=stats.top_triggered_rules[0]?.count||1
              return <motion.div key={i} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:i*0.05}}>
                <div className="flex justify-between text-xs mb-1"><span className="text-slate-400 truncate max-w-xs">{r.rule}</span><span className="font-mono text-white ml-2">{r.count}</span></div>
                <div className="h-1 bg-dark-700 rounded-full overflow-hidden">
                  <motion.div initial={{width:0}} animate={{width:`${r.count/max*100}%`}} transition={{duration:0.5,delay:i*0.05}} className="h-full bg-red-500 rounded-full"/>
                </div>
              </motion.div>
            })}
            {!stats?.top_triggered_rules?.length && <p className="text-slate-600 text-sm text-center py-4">No blocks in this range</p>}
          </div>
        </div>

        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-cyan-400"/>Recent Activity</h3>
          <div className="space-y-1.5">
            {(logs??[]).map((l:any)=>(
              <div key={l.prompt_id} className="flex items-center justify-between p-2 rounded-lg bg-dark-700/40 hover:bg-dark-700/60 transition-all">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                    l.status==='blocked'?'bg-red-500/10 text-red-400 border-red-500/20':
                    l.status==='modified'?'bg-amber-500/10 text-amber-400 border-amber-500/20':
                    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                    {l.status}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">{l.prompt_id.slice(0,10)}…</span>
                </div>
                <span className="text-xs text-slate-600">{new Date(l.submitted_at).toLocaleTimeString()}</span>
              </div>
            ))}
            {!logs?.length && <p className="text-slate-600 text-sm text-center py-4">No activity yet</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
