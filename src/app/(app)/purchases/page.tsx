'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Search, Plus, Download, Loader2, X, ShoppingBag,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { exportPurchaseReport } from '@/lib/excel-export'
import { type PurchaseListRow } from './actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:     { label: 'Draft',     className: 'badge-gray'   },
  confirmed: { label: 'Confirmed', className: 'badge-blue'   },
  partial:   { label: 'Partial',   className: 'badge-yellow' },
  paid:      { label: 'Paid',      className: 'badge-green'  },
  cancelled: { label: 'Cancelled', className: 'badge-red'    },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: 'badge-gray' }
  return <span className={cfg.className}>{cfg.label}</span>
}

function fmtRupee(n: number) {
  if (n === 0) return '—'
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function fmtDate(d: string) {
  try { return format(new Date(d), 'dd MMM yyyy') } catch { return d }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PurchasesPage() {
  const [rows,         setRows]         = useState<PurchaseListRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const load = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: invoices, error } = await supabase
        .from('purchase_invoices')
        .select(`id, invoice_no, invoice_date, supplier_inv_no, subtotal, discount_amount, transport_charge, unloading_charge, other_charges, total_amount, paid_amount, balance_due, status, parties!supplier_id(name)`)
        .order('invoice_date', { ascending: false })
      if (error) throw new Error(error.message)
      const ids = ((invoices ?? []) as any[]).map(i => i.id as string)
      const countMap = new Map<string, number>()
      if (ids.length > 0) {
        const { data: items } = await supabase.from('purchase_invoice_items').select('invoice_id').in('invoice_id', ids)
        for (const item of (items ?? []) as any[]) {
          countMap.set(item.invoice_id, (countMap.get(item.invoice_id) ?? 0) + 1)
        }
      }
      setRows(((invoices ?? []) as any[]).map(inv => ({
        id:               inv.id,
        invoice_no:       inv.invoice_no       ?? '',
        invoice_date:     inv.invoice_date     ?? '',
        supplier_name:    (inv.parties as any)?.name ?? 'Unknown',
        supplier_inv_no:  inv.supplier_inv_no  ?? '',
        items_count:      countMap.get(inv.id) ?? 0,
        subtotal:         Number(inv.subtotal         ?? 0),
        discount_amount:  Number(inv.discount_amount  ?? 0),
        transport_charge: Number(inv.transport_charge ?? 0),
        unloading_charge: Number(inv.unloading_charge ?? 0),
        other_charges:    Number(inv.other_charges    ?? 0),
        total_amount:     Number(inv.total_amount     ?? 0),
        paid_amount:      Number(inv.paid_amount      ?? 0),
        balance_due:      Number(inv.balance_due      ?? 0),
        status:           inv.status ?? 'draft',
      })))
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load purchase invoices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return rows.filter(r => {
      const matchSearch = !q
        || r.invoice_no.toLowerCase().includes(q)
        || r.supplier_name.toLowerCase().includes(q)
        || r.supplier_inv_no.toLowerCase().includes(q)
      const matchStatus = filterStatus === 'all' || r.status === filterStatus
      return matchSearch && matchStatus
    })
  }, [rows, searchQuery, filterStatus])

  const hasFilters = searchQuery || filterStatus !== 'all'

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (filtered.length === 0) return
    exportPurchaseReport(
      filtered.map(r => ({
        invoiceNo:   r.invoice_no,
        date:        r.invoice_date,
        supplier:    r.supplier_name,
        invoiceRef:  r.supplier_inv_no,
        items:       r.items_count,
        subtotal:    r.subtotal,
        transport:   r.transport_charge,
        unloading:   r.unloading_charge,
        totalAmount: r.total_amount,
        paid:        r.paid_amount,
        balance:     r.balance_due,
        status:      r.status,
      })),
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Heading */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Purchase Invoices</h2>
          <p className="page-sub mt-0.5">Goods received from suppliers</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="btn-outline"
          >
            <Download size={15} />
            Export Excel
          </button>
          <Link href="/purchases/new" className="btn-primary">
            <Plus size={16} />
            New Purchase Invoice
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Search invoice no, supplier…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="input w-auto min-w-[150px]"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {hasFilters && (
          <button
            onClick={() => { setSearchQuery(''); setFilterStatus('all') }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={12} /> Clear
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400">
          {filtered.length} of {rows.length}
        </span>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-gray-400 text-sm">
              <Loader2 size={20} className="animate-spin" />
              Loading purchase invoices…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
              <ShoppingBag size={40} />
              <p className="font-medium text-sm">
                {rows.length === 0 ? 'No purchase invoices yet' : 'No invoices match your filters'}
              </p>
              {rows.length === 0 && (
                <Link href="/purchases/new" className="btn-primary text-sm">
                  <Plus size={14} /> Create First Invoice
                </Link>
              )}
            </div>
          ) : (
            <table className="table-auto-ift">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th className="text-center">Items</th>
                  <th className="text-right">Subtotal</th>
                  <th className="text-right">Transport</th>
                  <th className="text-right">Unloading</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Balance</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id}>
                    <td>
                      <div>
                        <p className="font-semibold text-sm" style={{ color: 'var(--ift-navy)' }}>
                          {row.invoice_no}
                        </p>
                        {row.supplier_inv_no && (
                          <p className="text-[11px] text-gray-400">Ref: {row.supplier_inv_no}</p>
                        )}
                      </div>
                    </td>
                    <td className="text-sm text-gray-600 whitespace-nowrap">
                      {fmtDate(row.invoice_date)}
                    </td>
                    <td className="text-sm font-medium text-gray-800">{row.supplier_name}</td>
                    <td className="text-center">
                      <span className="badge-blue">{row.items_count}</span>
                    </td>
                    <td className="text-right text-sm text-gray-600 tabular-nums">
                      {fmtRupee(row.subtotal)}
                    </td>
                    <td className="text-right text-sm text-gray-600 tabular-nums">
                      {fmtRupee(row.transport_charge)}
                    </td>
                    <td className="text-right text-sm text-gray-600 tabular-nums">
                      {fmtRupee(row.unloading_charge)}
                    </td>
                    <td className="text-right">
                      <span className="font-bold text-sm tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                        {fmtRupee(row.total_amount)}
                      </span>
                    </td>
                    <td className="text-right text-sm text-emerald-600 tabular-nums font-medium">
                      {fmtRupee(row.paid_amount)}
                    </td>
                    <td className="text-right">
                      <span
                        className="text-sm font-semibold tabular-nums"
                        style={{ color: row.balance_due > 0 ? '#dc2626' : '#9ca3af' }}
                      >
                        {fmtRupee(row.balance_due)}
                      </span>
                    </td>
                    <td className="text-center">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right text-sm font-semibold text-gray-500">
                    Totals ({filtered.length} invoices)
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                    ₹{filtered.reduce((s, r) => s + r.subtotal, 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                    ₹{filtered.reduce((s, r) => s + r.transport_charge, 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                    ₹{filtered.reduce((s, r) => s + r.unloading_charge, 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                    ₹{filtered.reduce((s, r) => s + r.total_amount, 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-emerald-600 tabular-nums">
                    ₹{filtered.reduce((s, r) => s + r.paid_amount, 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-red-600 tabular-nums">
                    ₹{filtered.reduce((s, r) => s + r.balance_due, 0).toLocaleString('en-IN')}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
