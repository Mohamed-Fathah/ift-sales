'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { Loader2, TrendingDown, TrendingUp, IndianRupee, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { exportOutstandings } from '@/lib/excel-export'

interface PayableRow {
  id: string
  invoice_no: string
  invoice_date: string
  supplier_name: string
  total_amount: number
  paid_amount: number
  balance_due: number
  status: string
}

interface ReceivableRow {
  id: string
  invoice_no: string
  invoice_date: string
  customer_name: string
  customer_phone: string
  total_amount: number
  paid_amount: number
  balance_due: number
  status: string
}

function fmtRupee(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function fmtDate(d: string) {
  try { return format(parseISO(d), 'dd MMM yyyy') } catch { return d }
}

const STATUS_CLASS: Record<string, string> = {
  paid: 'badge-green', confirmed: 'badge-blue',
  draft: 'badge-gray', partial: 'badge-yellow', cancelled: 'badge-red',
}

export default function OutstandingsPage() {
  const [payables,     setPayables]     = useState<PayableRow[]>([])
  const [receivables,  setReceivables]  = useState<ReceivableRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [activeTab,    setActiveTab]    = useState<'payables' | 'receivables'>('payables')

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient()
        const [{ data: purch, error: purchErr }, { data: sales, error: salesErr }] = await Promise.all([
          supabase
            .from('purchase_invoices')
            .select('id, invoice_no, invoice_date, total_amount, paid_amount, balance_due, status, parties!supplier_id(name)')
            .gt('balance_due', 0)
            .order('invoice_date', { ascending: false }),
          supabase
            .from('sales_invoices')
            .select('id, invoice_no, invoice_date, customer_name, customer_phone, total_amount, paid_amount, balance_due, status')
            .gt('balance_due', 0)
            .order('invoice_date', { ascending: false }),
        ])
        if (purchErr) throw new Error(purchErr.message)
        if (salesErr) throw new Error(salesErr.message)

        setPayables(((purch ?? []) as any[]).map(r => ({
          id:            r.id,
          invoice_no:    r.invoice_no    ?? '',
          invoice_date:  r.invoice_date  ?? '',
          supplier_name: (r.parties as any)?.name ?? 'Unknown',
          total_amount:  Number(r.total_amount  ?? 0),
          paid_amount:   Number(r.paid_amount   ?? 0),
          balance_due:   Number(r.balance_due   ?? 0),
          status:        r.status        ?? '',
        })))

        setReceivables(((sales ?? []) as any[]).map(r => ({
          id:             r.id,
          invoice_no:     r.invoice_no    ?? '',
          invoice_date:   r.invoice_date  ?? '',
          customer_name:  r.customer_name  ?? 'Walk-in',
          customer_phone: r.customer_phone ?? '',
          total_amount:   Number(r.total_amount  ?? 0),
          paid_amount:    Number(r.paid_amount   ?? 0),
          balance_due:    Number(r.balance_due   ?? 0),
          status:         r.status         ?? '',
        })))
      } catch (err: any) {
        toast.error(err.message ?? 'Failed to load outstandings')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const totalPayable    = useMemo(() => payables.reduce((s, r)    => s + r.balance_due, 0), [payables])
  const totalReceivable = useMemo(() => receivables.reduce((s, r) => s + r.balance_due, 0), [receivables])

  // Group by supplier for payables export
  const payablesBySupplier = useMemo(() => {
    const map = new Map<string, { invoices: number; outstanding: number }>()
    for (const r of payables) {
      const prev = map.get(r.supplier_name) ?? { invoices: 0, outstanding: 0 }
      map.set(r.supplier_name, { invoices: prev.invoices + 1, outstanding: prev.outstanding + r.balance_due })
    }
    return [...map.entries()].map(([supplier, v]) => ({ supplier, ...v }))
  }, [payables])

  const receivablesByCustomer = useMemo(() => {
    const map = new Map<string, { phone: string; invoices: number; outstanding: number }>()
    for (const r of receivables) {
      const key = r.customer_name
      const prev = map.get(key) ?? { phone: r.customer_phone, invoices: 0, outstanding: 0 }
      map.set(key, { phone: prev.phone, invoices: prev.invoices + 1, outstanding: prev.outstanding + r.balance_due })
    }
    return [...map.entries()].map(([customer, v]) => ({ customer, ...v }))
  }, [receivables])

  const handleExport = () => {
    exportOutstandings(payablesBySupplier, receivablesByCustomer)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Outstandings</h2>
          <p className="page-sub mt-0.5">Pending amounts to pay and to receive</p>
        </div>
        <button
          onClick={handleExport}
          disabled={!payables.length && !receivables.length}
          className="btn-outline"
        >
          <Download size={15} /> Export Excel
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <TrendingDown size={18} className="text-red-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Payable</p>
              <p className="text-xl font-bold text-red-600 tabular-nums">{loading ? '—' : fmtRupee(totalPayable)}</p>
              <p className="text-[11px] text-gray-400">{payables.length} invoice{payables.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <TrendingUp size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Receivable</p>
              <p className="text-xl font-bold text-emerald-600 tabular-nums">{loading ? '—' : fmtRupee(totalReceivable)}</p>
              <p className="text-[11px] text-gray-400">{receivables.length} invoice{receivables.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
        <div className="stat-card col-span-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(27,42,107,0.08)' }}>
              <IndianRupee size={18} style={{ color: 'var(--ift-navy)' }} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Net Position</p>
              <p
                className="text-xl font-bold tabular-nums"
                style={{ color: totalReceivable >= totalPayable ? '#059669' : '#dc2626' }}
              >
                {loading ? '—' : fmtRupee(Math.abs(totalReceivable - totalPayable))}
              </p>
              <p className="text-[11px] text-gray-400">
                {totalReceivable >= totalPayable ? 'Net receivable' : 'Net payable'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {(['payables', 'receivables'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
              activeTab === tab ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
            style={activeTab === tab ? { color: 'var(--ift-navy)' } : {}}
          >
            {tab === 'payables'
              ? `Amount to Give (${payables.length})`
              : `Amount to Receive (${receivables.length})`
            }
          </button>
        ))}
      </div>

      {/* Payables table */}
      {activeTab === 'payables' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
                <Loader2 size={18} className="animate-spin" /> Loading…
              </div>
            ) : payables.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-400">
                <TrendingDown size={36} />
                <p className="text-sm font-medium">No outstanding payables</p>
              </div>
            ) : (
              <table className="table-auto-ift">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th className="text-right">Invoice Total</th>
                    <th className="text-right">Paid</th>
                    <th className="text-right">Balance Due</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payables.map(r => (
                    <tr key={r.id}>
                      <td className="font-semibold text-sm" style={{ color: 'var(--ift-navy)' }}>{r.invoice_no}</td>
                      <td className="text-sm text-gray-600 whitespace-nowrap">{fmtDate(r.invoice_date)}</td>
                      <td className="text-sm font-medium text-gray-800">{r.supplier_name}</td>
                      <td className="text-right text-sm text-gray-600 tabular-nums">{fmtRupee(r.total_amount)}</td>
                      <td className="text-right text-sm text-emerald-600 tabular-nums">{fmtRupee(r.paid_amount)}</td>
                      <td className="text-right font-bold text-sm text-red-600 tabular-nums">{fmtRupee(r.balance_due)}</td>
                      <td className="text-center"><span className={STATUS_CLASS[r.status] ?? 'badge-gray'}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-gray-500">
                      Total Outstanding ({payables.length} invoices)
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-red-600 tabular-nums">{fmtRupee(totalPayable)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Receivables table */}
      {activeTab === 'receivables' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
                <Loader2 size={18} className="animate-spin" /> Loading…
              </div>
            ) : receivables.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-400">
                <TrendingUp size={36} />
                <p className="text-sm font-medium">No outstanding receivables</p>
              </div>
            ) : (
              <table className="table-auto-ift">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th className="text-right">Invoice Total</th>
                    <th className="text-right">Paid</th>
                    <th className="text-right">Balance Due</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {receivables.map(r => (
                    <tr key={r.id}>
                      <td className="font-semibold text-sm" style={{ color: 'var(--ift-navy)' }}>{r.invoice_no}</td>
                      <td className="text-sm text-gray-600 whitespace-nowrap">{fmtDate(r.invoice_date)}</td>
                      <td>
                        <p className="text-sm font-medium text-gray-800">{r.customer_name}</p>
                        {r.customer_phone && <p className="text-[11px] text-gray-400">{r.customer_phone}</p>}
                      </td>
                      <td className="text-right text-sm text-gray-600 tabular-nums">{fmtRupee(r.total_amount)}</td>
                      <td className="text-right text-sm text-emerald-600 tabular-nums">{fmtRupee(r.paid_amount)}</td>
                      <td className="text-right font-bold text-sm text-emerald-700 tabular-nums">{fmtRupee(r.balance_due)}</td>
                      <td className="text-center"><span className={STATUS_CLASS[r.status] ?? 'badge-gray'}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-gray-500">
                      Total Outstanding ({receivables.length} invoices)
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700 tabular-nums">{fmtRupee(totalReceivable)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
