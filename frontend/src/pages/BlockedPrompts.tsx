import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Ban, ChevronDown, ChevronUp } from 'lucide-react'
import { logsApi } from '../lib/api'

function Badge({ status }: { status: string }) {
  const cls = status==='blocked'?'bg-red-500/10 text-red-400 border-red-500/20':
              status==='modified'?'bg-amber-500/10 text-amber-400 border-amber-500/20':
              'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>{status}</span>
}

export default function BlockedPrompts() {
  const [statusFilter, setStatusFilter] = useState('blocked')
  const [expanded, setExpanded] = useState<string|null>(null)
  const [page, setPage] = useState(0)
  const limit = 25

  const { data: logs, isLoading } = useQuery({
    queryKey: ['logs', statusFilter, page],
    queryFn: () => logsApi.list({ status: statusFilter, limit, offset: page*limit }),
    refetchInterval: 20000,
  })
  const { data: detail } = useQuery({
    queryKey: ['log-detail', expanded],
    queryFn: () => logsApi.get(expanded!),
    enabled: !!expanded,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2"><Ban className="w-5 h-5 text-red-400"/>Prompt Logs</h2>
        <div className="flex gap-1 p-1 bg-dark-800 rounded-lg border border-white/5">
          {['blocked','allowed','modified'].map(s=>(
            <button key={s} onClick={()=>{setStatusFilter(s);setPage(0)}}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${statusFilter===s?
                s==='blocked'?'bg-red-500/20 text-red-400 border border-red-500/25':
                s==='allowed'?'bg-emerald-500/20 text-emerald-400 border border-emerald-500/25':
                'bg-amber-500/20 text-amber-400 border border-amber-500/25'
                :'text-slate-500 hover:text-slate-300'}`}>{s}</button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              {['Prompt ID','Status','ML Score','Reason','Time',''].map(h=>(
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? [...Array(8)].map((_,i)=>(
              <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="skeleton h-4 w-full"/></td></tr>
            )) : (logs??[]).map((log:any)=>(
              <React.Fragment key={log.prompt_id}>
                <tr className="hover:bg-white/2 cursor-pointer transition-colors" onClick={()=>setExpanded(expanded===log.prompt_id?null:log.prompt_id)}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{log.prompt_id.slice(0,12)}…</td>
                  <td className="px-4 py-3"><Badge status={log.status}/></td>
                  <td className="px-4 py-3">
                    {log.jailbreak_probability!=null ? (
                      <span className={`font-mono text-xs px-2 py-0.5 rounded ${log.jailbreak_probability>=0.75?'bg-red-500/10 text-red-400':'bg-emerald-500/10 text-emerald-400'}`}>
                        {(log.jailbreak_probability*100).toFixed(1)}%
                      </span>
                    ) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate">{log.block_reason??'—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs font-mono whitespace-nowrap">{new Date(log.submitted_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-600">{expanded===log.prompt_id?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}</td>
                </tr>
                <AnimatePresence>
                  {expanded===log.prompt_id&&(
                    <tr><td colSpan={6} className="p-0">
                      <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                        <div className="p-4 bg-dark-700/40 grid grid-cols-3 gap-4 text-xs border-b border-white/5">
                          <div><p className="text-slate-500 mb-1">Prompt Hash</p><p className="font-mono text-slate-400">{detail?.prompt_text_hash?.slice(0,24)}…</p></div>
                          <div><p className="text-slate-500 mb-1">ML Label</p><p className="text-white">{detail?.label??'—'}</p></div>
                          <div><p className="text-slate-500 mb-1">DLP Events</p>
                            <div className="flex flex-wrap gap-1">
                              {detail?.dlp_events?.length>0 ? detail.dlp_events.map((e:any)=>(
                                <span key={e.entity_type} className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">{e.entity_type}×{e.occurrences}</span>
                              )) : <span className="text-slate-600">None</span>}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </td></tr>
                  )}
                </AnimatePresence>
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {!isLoading && !logs?.length && <p className="text-center text-slate-600 py-10">No {statusFilter} prompts found</p>}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/5">
          <span className="text-xs text-slate-600">Page {page+1}</span>
          <div className="flex gap-2">
            <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-30 transition-all">← Prev</button>
            <button onClick={()=>setPage(p=>p+1)} disabled={(logs?.length??0)<limit} className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-30 transition-all">Next →</button>
          </div>
        </div>
      </div>
    </div>
  )
}
