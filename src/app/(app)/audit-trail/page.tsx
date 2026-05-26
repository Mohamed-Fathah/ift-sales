'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { Search, X, Loader2, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

interface AuditRow {
  id: string
  table_name: string
  record_id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  changed_fields: string[]
  user_name: string
  created_at: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
}

const ACTION_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  INSERT: { label: 'Created',  color: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  UPDATE: { label: 'Updated',  color: 'text-blue-700 bg-blue-50 border-blue-200',         dot: 'bg-blue-500'    },
  DELETE: { label: 'Deleted',  color: 'text-red-700 bg-red-50 border-red-200',            dot: 'bg-red-500'     },
}

function fmtDate(d: string) {
  try { return format(parseISO(d), 'dd MMM yyyy') } catch { return d }
}
function fmtTime(d: string) {
  try { return format(parseISO(d), 'hh:mm a') } catch { return '' }
}

function tableLabel(name: string) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function AuditTrailPage() {
  const [rows,         setRows]         = useState<AuditRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [filterTable,  setFilterTable]  = useState('all')
  const [expanded,     setExpanded]     = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('audit_log')
          .select('id, table_name, record_id, action, changed_fields, user_name, created_at, old_data, new_data')
          .order('created_at', { ascending: false })
          .limit(500)
        if (error) throw new Error(error.message)
        setRows(((data ?? []) as any[]).map(r => ({
          id:             r.id,
          table_name:     r.table_name     ?? '',
          record_id:      r.record_id      ?? '',
          action:         r.action         ?? 'UPDATE',
          changed_fields: r.changed_fields ?? [],
          user_name:      r.user_name      ?? '',
          created_at:     r.created_at     ?? '',
          old_data:       r.old_data       ?? null,
          new_data:       r.new_data       ?? null,
        })))
      } catch (err: any) {
        toast.error(err.message ?? 'Failed to load audit log')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const tables = useMemo(() => [...new Set(rows.map(r => r.table_name))].sort(), [rows])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter(r => {
      const matchSearch = !q
        || r.table_name.toLowerCase().includes(q)
        || r.user_name.toLowerCase().includes(q)
        || r.record_id.toLowerCase().includes(q)
      const matchAction = filterAction === 'all' || r.action === filterAction
      const matchTable  = filterTable  === 'all' || r.table_name === filterTable
      return matchSearch && matchAction && matchTable
    })
  }, [rows, search, filterAction, filterTable])

  const grouped = useMemo(() => {
    const map = new Map<string, AuditRow[]>()
    for (const r of filtered) {
      const d = fmtDate(r.created_at)
      const arr = map.get(d) ?? []
      arr.push(r)
      map.set(d, arr)
    }
    return [...map.entries()]
  }, [filtered])

  const hasFilters = search || filterAction !== 'all' || filterTable !== 'all'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-title">Audit Trail</h2>
        <p className="page-sub mt-0.5">Full history of all data changes</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            className="input pl-9 text-sm"
            placeholder="Search user, table, record ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="input w-auto min-w-[130px]" value={filterAction}
          onChange={e => setFilterAction(e.target.value)}>
          <option value="all">All Actions</option>
          <option value="INSERT">Created</option>
          <option value="UPDATE">Updated</option>
          <option value="DELETE">Deleted</option>
        </select>

        <select className="input w-auto min-w-[150px]" value={filterTable}
          onChange={e => setFilterTable(e.target.value)}>
          <option value="all">All Tables</option>
          {tables.map(t => <option key={t} value={t}>{tableLabel(t)}</option>)}
        </select>

        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setFilterAction('all'); setFilterTable('all') }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={12} /> Clear
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} of {rows.length} events</span>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
          <Loader2 size={18} className="animate-spin" /> Loading audit log…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
          <ClipboardList size={36} />
          <p className="text-sm font-medium">No audit records found</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, events]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-semibold text-gray-400 px-2">{date}</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <div className="relative pl-6 space-y-2">
                <div className="absolute left-2 top-2 bottom-2 w-px bg-gray-200" />

                {events.map(r => {
                  const cfg = ACTION_CONFIG[r.action] ?? ACTION_CONFIG.UPDATE
                  const isOpen = expanded === r.id
                  return (
                    <div key={r.id} className="relative">
                      <div className={`absolute -left-[18px] top-3 w-3 h-3 rounded-full border-2 border-white ${cfg.dot}`} />

                      <div className="card py-3 px-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <span className={`px-2 py-0.5 rounded border text-[11px] font-semibold shrink-0 mt-0.5 ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">
                                  {r.table_name}
                                </span>
                                {r.user_name && (
                                  <span className="text-xs text-gray-500">
                                    by <span className="font-medium text-gray-700">{r.user_name}</span>
                                  </span>
                                )}
                              </div>
                              {r.changed_fields.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {r.changed_fields.slice(0, 6).map((f: string) => (
                                    <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                                      {f}
                                    </span>
                                  ))}
                                  {r.changed_fields.length > 6 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                                      +{r.changed_fields.length - 6} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-gray-400 whitespace-nowrap">{fmtTime(r.created_at)}</span>
                            {(r.old_data || r.new_data) && (
                              <button
                                onClick={() => setExpanded(isOpen ? null : r.id)}
                                className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
                              >
                                {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </button>
                            )}
                          </div>
                        </div>

                        {isOpen && (
                          <div className="mt-3 pt-3 border-t border-gray-100 text-xs">
                            {r.action === 'UPDATE' && r.changed_fields.length > 0 ? (
                              <table className="w-full">
                                <thead>
                                  <tr>
                                    <th className="text-left text-[10px] uppercase tracking-wide text-gray-400 pb-1.5 pr-4 w-32">Field</th>
                                    <th className="text-left text-[10px] uppercase tracking-wide text-red-400 pb-1.5 pr-4">Before</th>
                                    <th className="text-left text-[10px] uppercase tracking-wide text-emerald-500 pb-1.5">After</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.changed_fields.map(field => (
                                    <tr key={field} className="border-t border-gray-50">
                                      <td className="py-1 pr-4 font-mono text-gray-500 font-medium align-top">{field}</td>
                                      <td className="py-1 pr-4 align-top">
                                        <span className="inline-block bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-mono break-all">
                                          {r.old_data ? String(r.old_data[field] ?? '—') : '—'}
                                        </span>
                                      </td>
                                      <td className="py-1 align-top">
                                        <span className="inline-block bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono break-all">
                                          {r.new_data ? String(r.new_data[field] ?? '—') : '—'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <div className="grid grid-cols-2 gap-3">
                                {r.old_data && (
                                  <div>
                                    <p className="font-semibold text-gray-400 mb-1 uppercase tracking-wide text-[10px]">Before</p>
                                    <pre className="bg-gray-50 border border-gray-200 rounded-lg p-2 overflow-auto max-h-32 text-gray-600 text-[11px]">
                                      {JSON.stringify(r.old_data, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {r.new_data && (
                                  <div>
                                    <p className="font-semibold text-gray-400 mb-1 uppercase tracking-wide text-[10px]">After</p>
                                    <pre className="bg-blue-50 border border-blue-200 rounded-lg p-2 overflow-auto max-h-32 text-gray-700 text-[11px]">
                                      {JSON.stringify(r.new_data, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
