import React from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList } from 'lucide-react'
import { auditApi } from '../lib/api'

const ACTION_STYLE: Record<string, string> = {
  user_login:   'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  rule_created: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rule_updated: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  rule_deleted: 'bg-red-500/10 text-red-400 border-red-500/20',
  user_created: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
}

export default function AuditLog() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit'],
    queryFn: auditApi.list,
    refetchInterval: 30000,
  })

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-cyan-400" /> Audit Log
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">Append-only record of all admin actions</p>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              {['Timestamp', 'Action', 'User', 'Details'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading
              ? [...Array(8)].map((_, i) => (
                <tr key={i}><td colSpan={4} className="px-4 py-3"><div className="skeleton h-4 w-full" /></td></tr>
              ))
              : (logs ?? []).map((log: any, i: number) => (
                <motion.tr
                  key={log.log_id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.4) }}
                  className="hover:bg-white/2 transition-colors"
                >
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded border font-mono ${ACTION_STYLE[log.action] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                    {log.user_id ? log.user_id.slice(0, 12) + '…' : 'system'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono max-w-xs truncate">
                    {log.details ? JSON.stringify(log.details) : '—'}
                  </td>
                </motion.tr>
              ))}
          </tbody>
        </table>
        {!isLoading && !logs?.length && (
          <p className="text-center text-slate-600 py-10">No audit events yet — actions like logins and rule changes appear here</p>
        )}
      </div>
    </div>
  )
}
