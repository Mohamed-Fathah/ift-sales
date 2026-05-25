'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Loader2, AlertTriangle, RefreshCw,
  Package, IndianRupee, Building2, Calendar, Hash, MapPin, X,
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import {
  getPurchaseDetailAction,
  cancelPurchaseInvoiceAction,
  type PurchaseDetail,
} from './actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:     { label: 'Draft',     className: 'badge-gray'   },
  confirmed: { label: 'Confirmed', className: 'badge-blue'   },
  partial:   { label: 'Partial',   className: 'badge-yellow' },
  paid:      { label: 'Paid',      className: 'badge-green'  },
  cancelled: { label: 'Cancelled', className: 'badge-red'    },
}

function fmtRupee(n: number) {
  if (n === 0) return '—'
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function fmtDate(d: string) {
  try { return format(parseISO(d), 'dd MMM yyyy') } catch { return d }
}

// ─── Meta card ────────────────────────────────────────────────────────────────

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: 'rgba(27,42,107,0.07)', color: 'var(--ift-navy)' }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-gray-800 mt-0.5">{value}</p>
      </div>
    </div>
  )
}

// ─── Cancel confirm dialog ────────────────────────────────────────────────────

function CancelDialog({
  invoiceNo,
  onConfirm,
  onClose,
  cancelling,
}: {
  invoiceNo: string
  onConfirm: () => void
  onClose: () => void
  cancelling: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 shrink-0 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Cancel invoice?</p>
            <p className="text-xs text-gray-500 mt-0.5">{invoiceNo}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          This will mark the invoice as cancelled. Stock levels will not be adjusted automatically.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={cancelling} className="btn-outline">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={cancelling}
            className="btn text-white focus:ring-red-400"
            style={{ background: '#DC2626' }}
          >
            {cancelling
              ? <><Loader2 size={14} className="animate-spin" /> Cancelling…</>
              : 'Cancel Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [invoice,    setInvoice]    = useState<PurchaseDetail | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [loadError,  setLoadError]  = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const load = async () => {
    setLoading(true)
    setLoadError(false)
    const timer = setTimeout(() => { setLoading(false); setLoadError(true) }, 10_000)
    try {
      const data = await getPurchaseDetailAction(id)
      setInvoice(data)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load invoice')
      setLoadError(true)
    } finally {
      clearTimeout(timer)
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = async () => {
    setCancelling(true)
    try {
      await cancelPurchaseInvoiceAction(id)
      toast.success('Invoice cancelled')
      setShowCancel(false)
      setInvoice(prev => prev ? { ...prev, status: 'cancelled' } : prev)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to cancel invoice')
    } finally {
      setCancelling(false)
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
        <Loader2 size={20} className="animate-spin" /> Loading invoice…
      </div>
    )
  }

  if (loadError || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
        <AlertTriangle size={40} className="text-amber-400" />
        <p className="font-medium text-sm">{loadError ? 'Failed to load — connection timed out' : 'Invoice not found'}</p>
        {loadError ? (
          <button onClick={load} className="btn-outline text-sm flex items-center gap-2">
            <RefreshCw size={14} /> Retry
          </button>
        ) : (
          <Link href="/purchases" className="btn-outline text-sm flex items-center gap-2">
            <ArrowLeft size={14} /> Back to Purchases
          </Link>
        )}
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[invoice.status] ?? { label: invoice.status, className: 'badge-gray' }
  const canCancel = invoice.status !== 'cancelled' && invoice.status !== 'paid'
  const isDraft   = invoice.status === 'draft'

  const extraCharges = invoice.transport_charge + invoice.unloading_charge + invoice.other_charges

  return (
    <div className="space-y-5 max-w-4xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/purchases"
            className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="page-title">{invoice.invoice_no}</h2>
              <span className={statusCfg.className}>{statusCfg.label}</span>
            </div>
            <p className="page-sub mt-0.5">Purchase Invoice Detail</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDraft && (
            <Link href="/purchases/new" className="btn-outline">
              Edit
            </Link>
          )}
          {canCancel && (
            <button
              onClick={() => setShowCancel(true)}
              className="btn text-white focus:ring-red-400"
              style={{ background: '#DC2626' }}
            >
              <X size={14} /> Cancel Invoice
            </button>
          )}
        </div>
      </div>

      {/* ── Meta grid ──────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
          <MetaItem icon={<Building2 size={15} />} label="Supplier" value={invoice.supplier_name} />
          {invoice.supplier_phone && (
            <MetaItem icon={<Hash size={15} />} label="Phone" value={invoice.supplier_phone} />
          )}
          <MetaItem icon={<Calendar size={15} />} label="Invoice Date" value={fmtDate(invoice.invoice_date)} />
          {invoice.supplier_inv_no && (
            <MetaItem icon={<Hash size={15} />} label="Supplier Ref" value={invoice.supplier_inv_no} />
          )}
          {invoice.location_name && (
            <MetaItem icon={<MapPin size={15} />} label="Location" value={invoice.location_name} />
          )}
        </div>
        {invoice.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-gray-600">{invoice.notes}</p>
          </div>
        )}
      </div>

      {/* ── Items table ────────────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Package size={16} style={{ color: 'var(--ift-navy)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--ift-navy)' }}>
            Items ({invoice.items.length})
          </p>
        </div>
        {invoice.items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No items on this invoice</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-auto-ift">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th>Title</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Purchase Rate</th>
                  <th className="text-right">MRP</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="text-gray-400 text-xs">{idx + 1}</td>
                    <td>
                      <p className="font-medium text-sm text-gray-800">{item.title}</p>
                      <div className="flex gap-2 mt-0.5">
                        {item.item_code && (
                          <span className="text-[11px] font-mono text-gray-400">{item.item_code}</span>
                        )}
                        {item.isbn && (
                          <span className="text-[11px] text-gray-400">ISBN: {item.isbn}</span>
                        )}
                      </div>
                    </td>
                    <td className="text-right font-bold tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                      {item.qty}
                    </td>
                    <td className="text-right text-sm tabular-nums text-gray-700">
                      {fmtRupee(item.rate)}
                    </td>
                    <td className="text-right text-sm tabular-nums text-gray-500">
                      {fmtRupee(item.mrp)}
                    </td>
                    <td className="text-right font-semibold text-sm tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                      {fmtRupee(item.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Totals ─────────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
          <IndianRupee size={16} style={{ color: 'var(--ift-navy)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--ift-navy)' }}>Payment Summary</p>
        </div>
        <div className="space-y-2 max-w-xs ml-auto">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="tabular-nums font-medium text-gray-700">{fmtRupee(invoice.subtotal)}</span>
          </div>
          {invoice.discount_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Discount</span>
              <span className="tabular-nums text-emerald-600">− {fmtRupee(invoice.discount_amount)}</span>
            </div>
          )}
          {invoice.transport_charge > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Transport</span>
              <span className="tabular-nums text-gray-700">{fmtRupee(invoice.transport_charge)}</span>
            </div>
          )}
          {invoice.unloading_charge > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Unloading</span>
              <span className="tabular-nums text-gray-700">{fmtRupee(invoice.unloading_charge)}</span>
            </div>
          )}
          {invoice.other_charges > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Other Charges</span>
              <span className="tabular-nums text-gray-700">{fmtRupee(invoice.other_charges)}</span>
            </div>
          )}
          <div
            className="flex justify-between text-base font-bold pt-2 border-t border-gray-200"
            style={{ color: 'var(--ift-navy)' }}
          >
            <span>Grand Total</span>
            <span className="tabular-nums">{fmtRupee(invoice.total_amount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-emerald-600 font-medium">Paid</span>
            <span className="tabular-nums text-emerald-600 font-medium">{fmtRupee(invoice.paid_amount)}</span>
          </div>
          {invoice.balance_due > 0 && (
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-red-600">Balance Due</span>
              <span className="tabular-nums text-red-600">{fmtRupee(invoice.balance_due)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Cancel dialog ──────────────────────────────────────────────────── */}
      {showCancel && (
        <CancelDialog
          invoiceNo={invoice.invoice_no}
          onConfirm={handleCancel}
          onClose={() => setShowCancel(false)}
          cancelling={cancelling}
        />
      )}
    </div>
  )
}
