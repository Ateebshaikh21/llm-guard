import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { rulesApi } from '../lib/api'

export default function RuleConfig() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ rule_type:'keyword', rule_value:'', description:'' })
  const [err, setErr] = useState('')

  const { data: rules, isLoading } = useQuery({ queryKey:['rules'], queryFn:rulesApi.list })
  const create = useMutation({ mutationFn:rulesApi.create, onSuccess:()=>{qc.invalidateQueries({queryKey:['rules']});setShowForm(false);setForm({rule_type:'keyword',rule_value:'',description:''});setErr('')}, onError:(e:any)=>setErr(e?.response?.data?.detail??'Failed') })
  const toggle = useMutation({ mutationFn:({id,active}:{id:string;active:boolean})=>rulesApi.update(id,{active}), onSuccess:()=>qc.invalidateQueries({queryKey:['rules']}) })
  const remove = useMutation({ mutationFn:rulesApi.delete, onSuccess:()=>qc.invalidateQueries({queryKey:['rules']}) })

  const typeColor: Record<string,string> = {
    keyword:'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    length:'bg-purple-500/10 text-purple-400 border-purple-500/20',
    regex:'bg-amber-500/10 text-amber-400 border-amber-500/20',
    system_prompt_guard:'bg-red-500/10 text-red-400 border-red-500/20',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2"><Settings className="w-5 h-5 text-cyan-400"/>Firewall Rules</h2>
        <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={()=>setShowForm(v=>!v)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 text-sm hover:bg-cyan-500/20 transition-all">
          <Plus className="w-4 h-4"/>Add Rule
        </motion.button>
      </div>

      <AnimatePresence>
        {showForm&&(
          <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="overflow-hidden">
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">New Rule</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Type</label>
                  <select value={form.rule_type} onChange={e=>setForm(f=>({...f,rule_type:e.target.value}))}
                    className="w-full bg-dark-700 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/40 transition-all">
                    {['keyword','length','regex','system_prompt_guard'].map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Value</label>
                  <input value={form.rule_value} onChange={e=>setForm(f=>({...f,rule_value:e.target.value}))}
                    placeholder={form.rule_type==='length'?'4000':'keyword or pattern'}
                    className="w-full bg-dark-700 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 transition-all"/>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Description (optional)</label>
                  <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                    placeholder="What does this rule block?"
                    className="w-full bg-dark-700 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 transition-all"/>
                </div>
                {err&&<p className="md:col-span-2 text-red-400 text-xs">{err}</p>}
                <div className="md:col-span-2 flex gap-2">
                  <motion.button whileHover={{scale:1.01}} whileTap={{scale:0.97}}
                    onClick={()=>{if(!form.rule_value){setErr('Value required');return}create.mutate(form)}}
                    disabled={create.isPending}
                    className="px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 text-sm hover:bg-cyan-500/20 transition-all disabled:opacity-50">
                    {create.isPending?'Saving…':'Save Rule'}
                  </motion.button>
                  <button onClick={()=>setShowForm(false)} className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 text-sm transition-all">Cancel</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/5">
            {['Type','Value','Description','Status','Action'].map(h=>(
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-white/5">
            {isLoading?[...Array(5)].map((_,i)=>(
              <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="skeleton h-4 w-full"/></td></tr>
            )):(rules??[]).map((r:any)=>(
              <motion.tr key={r.rule_id} initial={{opacity:0}} animate={{opacity:1}} className="hover:bg-white/2 transition-colors">
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded border font-mono ${typeColor[r.rule_type]??'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>{r.rule_type}</span></td>
                <td className="px-4 py-3 font-mono text-xs text-slate-300 max-w-xs truncate">{r.rule_value}</td>
                <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate">{r.description??'—'}</td>
                <td className="px-4 py-3">
                  <button onClick={()=>toggle.mutate({id:r.rule_id,active:!r.active})}
                    className={`flex items-center gap-1.5 text-xs transition-all ${r.active?'text-emerald-400':'text-slate-600'}`}>
                    {r.active?<ToggleRight className="w-5 h-5"/>:<ToggleLeft className="w-5 h-5"/>}
                    {r.active?'Active':'Off'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button onClick={()=>{if(confirm('Delete?'))remove.mutate(r.rule_id)}} className="text-slate-600 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {!isLoading&&!rules?.length&&<p className="text-center text-slate-600 py-10">No rules yet. Add one above.</p>}
      </div>
    </div>
  )
}
