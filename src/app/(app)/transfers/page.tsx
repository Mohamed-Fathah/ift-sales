'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { Search, X, Loader2, ArrowLeftRight, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

interface TransferRow {
  id: string
  material_id: string
  from_location_id: string
  to_location_id: string
  title: string
  item_code: string
  from_location: string
  to_location: string
  qty: number
  notes: string
  created_by: string
  created_at: string
}

function fmtDate(d: string) {
  try { return format(parseISO(d), 'dd MMM yyyy, hh:mm a') } catch { return d }
}

export default function TransfersPage() {
  const [rows,    setRows]    = useState<TransferRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient()

        const [
          { data: moves,     error: movErr  },
          { data: materials, error: matErr  },
          { data: locations, error: locErr  },
        ] = await Promise.all([
          supabase
            .from('stock_movements')
            .select('id, material_id, location_id, qty, notes, created_by, created_at, ref_id')
            .eq('movement_type', 'transfer_out')
            .order('created_at', { ascending: false })
            .limit(500),
          supabase.from('materials').select('id, title, item_code'),
          supabase.from('locations').select('id, name'),
        ])

        if (movErr)  throw new Error(movErr.message)
        if (matErr)  throw new Error(matErr.message)
        if (locErr)  throw new Error(locErr.message)

        const matMap = new Map(((materials ?? []) as any[]).map(m => [m.id, { title: m.title ?? '', item_code: m.item_code ?? '' }]))
        const locMap = new Map(((locations  ?? []) as any[]).map(l => [l.id, l.name as string]))

        // Each transfer_out has a paired transfer_in with same reference_id (created_at-based grouping)
        // We approximate "to_location" by finding the matching transfer_in
        const inMoves = await supabase
          .from('stock_movements')
          .select('material_id, location_id, created_at, ref_id')
          .eq('movement_type', 'transfer_in')
          .order('created_at', { ascending: false })
          .limit(500)

        const inMap = new Map<string, string>()
        for (const m of ((inMoves.data ?? []) as any[])) {
          const key = `${m.material_id}_${m.created_at}`
          inMap.set(key, m.location_id as string)
        }

        setRows(((moves ?? []) as any[]).map(m => {
          const mat = matMap.get(m.material_id) ?? { title: '—', item_code: '' }
          const inKey = `${m.material_id}_${m.created_at}`
          const toLoc = inMap.get(inKey) ?? ''
          return {
            id:               m.id,
            material_id:      m.material_id ?? '',
            from_location_id: m.location_id ?? '',
            to_location_id:   toLoc,
            title:            mat.title,
            item_code:        mat.item_code,
            from_location:    locMap.get(m.location_id) ?? '—',
            to_location:      locMap.get(toLoc)          ?? '—',
            qty:              Number(m.qty ?? 0),
            notes:            m.notes      ?? '',
            created_by:       m.created_by ?? '',
            created_at:       m.created_at ?? '',
          }
        }))
      } catch (err: any) {
        toast.error(err.message ?? 'Failed to load transfers')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return q
      ? rows.filter(r =>
          r.title.toLowerCase().includes(q) ||
          r.item_code.toLowerCase().includes(q) ||
          r.from_location.toLowerCase().includes(q) ||
          r.to_location.toLowerCase().includes(q)
        )
      : rows
  }, [rows, search])

  const totalUnits = useMemo(() => rows.reduce((s, r) => s + r.qty, 0), [rows])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-title">Stock Transfers</h2>
        <p className="page-sub mt-0.5">History of stock moved between locations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(27,42,107,0.08)' }}>
              <ArrowLeftRight size={18} style={{ color: 'var(--ift-navy)' }} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Transfers</p>
              <p className="text-xl font-bold" style={{ color: 'var(--ift-navy)' }}>
                {loading ? '—' : rows.length}
              </p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
              <ArrowRight size={18} className="text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Units Transferred</p>
              <p className="text-xl font-bold text-violet-600">
                {loading ? '—' : totalUnits.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            className="input pl-9 text-sm"
            placeholder="Search book, location…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} of {rows.length}</span>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
              <Loader2 size={18} className="animate-spin" /> Loading transfers…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <ArrowLeftRight size={36} />
              <p className="text-sm font-medium">No transfers recorded yet</p>
              <p className="text-xs text-gray-400">Use the Stock page to transfer items between locations</p>
            </div>
          ) : (
            <table className="table-auto-ift">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Book</th>
                  <th>From</th>
                  <th className="text-center">→</th>
                  <th>To</th>
                  <th className="text-right">Qty</th>
                  <th>Notes</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td className="text-xs text-gray-500 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                    <td className="max-w-[180px]">
                      <p className="font-medium text-sm text-gray-800 truncate">{r.title}</p>
                      {r.item_code && <p className="text-[11px] font-mono text-gray-400">{r.item_code}</p>}
                    </td>
                    <td className="text-sm text-gray-600">{r.from_location}</td>
                    <td className="text-center">
                      <ArrowRight size={14} className="text-gray-400 mx-auto" />
                    </td>
                    <td className="text-sm text-gray-600">{r.to_location}</td>
                    <td className="text-right">
                      <span className="font-bold tabular-nums text-sm" style={{ color: 'var(--ift-navy)' }}>{r.qty}</span>
                    </td>
                    <td className="text-sm text-gray-500 max-w-[160px] truncate">{r.notes || '—'}</td>
                    <td className="text-xs text-gray-400">{r.created_by || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
