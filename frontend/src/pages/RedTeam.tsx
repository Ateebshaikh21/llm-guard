import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import { Zap, Play, CheckCircle, XCircle } from 'lucide-react'
import { redteamApi } from '../lib/api'

export default function RedTeam() {
  const [corpus, setCorpus] = useState('default')
  const [limit, setLimit] = useState('')
  const [result, setResult] = useState<any>(null)
  const run = useMutation({ mutationFn:()=>redteamApi.run({corpus_name:corpus,limit:limit?Number(limit):undefined}), onSuccess:setResult })

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2"><Zap className="w-5 h-5 text-amber-400"/>Red Team Simulator</h2>
        <p className="text-slate-500 text-xs mt-0.5">Fire known adversarial prompts at the live pipeline — gate requires ≥95% block rate</p>
      </div>

      <div className="glass-card p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Corpus</label>
            <select value={corpus} onChange={e=>setCorpus(e.target.value)}
              className="w-full bg-dark-700 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/40 transition-all">
              <option value="default">default (jailbreaks)</option>
              <option value="benign">benign (false-positive check)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Limit (blank = all)</label>
            <input type="number" value={limit} onChange={e=>setLimit(e.target.value)} placeholder="e.g. 50"
              className="w-full bg-dark-700 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 transition-all"/>
          </div>
          <div className="flex items-end">
            <motion.button whileHover={{scale:1.01}} whileTap={{scale:0.98}} onClick={()=>run.mutate()} disabled={run.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-sm hover:bg-amber-500/20 transition-all disabled:opacity-50">
              {run.isPending?<span className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"/>:<Play className="w-3.5 h-3.5"/>}
              {run.isPending?'Running…':'Run Simulation'}
            </motion.button>
          </div>
        </div>
        <p className="text-xs text-slate-600">Admin only. Runs through the full ML + rules pipeline — large corpora may take a minute.</p>
      </div>

      <AnimatePresence>
        {result&&!run.isPending&&(
          <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="space-y-4">
            <div className={`rounded-xl border p-4 flex items-center gap-4 ${result.gate_passed?'bg-emerald-500/5 border-emerald-500/25':'bg-red-500/5 border-red-500/25'}`}>
              {result.gate_passed?<CheckCircle className="w-8 h-8 text-emerald-400 flex-shrink-0"/>:<XCircle className="w-8 h-8 text-red-400 flex-shrink-0"/>}
              <div>
                <p className={`text-lg font-bold ${result.gate_passed?'text-emerald-400':'text-red-400'}`}>Gate {result.gate_passed?'PASSED ✅':'FAILED ❌'}</p>
                <p className="text-sm text-slate-400">Block rate: <span className={`font-mono font-bold ${result.gate_passed?'text-emerald-400':'text-red-400'}`}>{result.block_rate_percent}%</span> (threshold: 95%)</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {[['Total',result.total_attacks,'text-white'],['Blocked',result.blocked_count,'text-red-400'],['Passed',result.passed_count,'text-emerald-400'],['Rate',`${result.block_rate_percent}%`,result.gate_passed?'text-emerald-400':'text-red-400']].map(([l,v,c])=>(
                <div key={l as string} className="glass-card p-3 text-center">
                  <p className={`text-2xl font-bold font-mono ${c}`}>{v}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{l}</p>
                </div>
              ))}
            </div>

            <div className="glass-card overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-dark-800 border-b border-white/5">
                  <tr>{['Result','Score','Prompt'].map(h=><th key={h} className="px-3 py-2 text-left font-medium text-slate-500">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {result.results?.map((r:any,i:number)=>(
                    <tr key={i} className="hover:bg-white/2">
                      <td className="px-3 py-2">{r.blocked?<span className="text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3"/>blocked</span>:<span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3"/>passed</span>}</td>
                      <td className="px-3 py-2 font-mono"><span className={r.jailbreak_probability>=0.75?'text-red-400':'text-emerald-400'}>{r.jailbreak_probability!=null?(r.jailbreak_probability*100).toFixed(1)+'%':'—'}</span></td>
                      <td className="px-3 py-2 text-slate-400 max-w-xs truncate">{r.prompt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
