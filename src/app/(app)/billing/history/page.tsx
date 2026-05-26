'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Search, Download, ArrowLeft, ChevronDown, ChevronRight,
  Printer, MessageCircle, Receipt as ReceiptIcon, Loader2, X,
  IndianRupee, TrendingUp, Eye, Calendar,
} from 'lucide-react'
import { format, isToday, parseISO, subDays } from 'date-fns'
import toast from 'react-hot-toast'
import { generateReceiptPDF } from '@/lib/pdf-receipt'
import { exportSalesReport } from '@/lib/excel-export'
import {
  getInvoicesAction,
  getInvoiceItemsAction,
  getOrgSettingsAction,
  type InvoiceListRow,
  type InvoiceDetailItem,
} from '../actions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReceiptData {
  invoiceNo: string
  date: string
  customerName: string
  customerPhone: string
  paymentMode: string
  location: string
  items: {
    sno: number; title: string; isbn: string
    qty: number; mrp: number; discountPct: number; rate: number; total: number
  }[]
  subtotalMrp: number
  totalDiscount: number
  grandTotal: number
  createdBy: string
  footer: string
}

// ─── Helper: build receipt data ───────────────────────────────────────────────

function buildReceipt(inv: InvoiceListRow, items: InvoiceDetailItem[], footer: string): ReceiptData {
  return {
    invoiceNo:    inv.invoice_no,
    date:         format(parseISO(inv.invoice_date), 'dd/MM/yyyy'),
    customerName: inv.customer_name || 'Walk-in Customer',
    customerPhone: inv.customer_phone || '',
    paymentMode:  inv.payment_mode,
    location:     'IFT',
    items:        items.map((item, idx) => ({
      sno:         idx + 1,
      title:       item.title,
      isbn:        item.isbn || '',
      qty:         item.qty,
      mrp:         item.mrp,
      discountPct: item.discount_pct,
      rate:        item.rate,
      total:       item.total_amount,
    })),
    subtotalMrp:  inv.subtotal_mrp,
    totalDiscount: inv.discount_amount,
    grandTotal:   inv.total_amount,
    createdBy:    'Staff',
    footer,
  }
}

// ─── Payment badge ────────────────────────────────────────────────────────────

function PaymentBadge({ mode }: { mode: string }) {
  const config: Record<string, string> = {
    cash: 'badge-green', upi: 'badge-blue', card: 'badge-blue', cheque: 'badge-gray',
  }
  return <span className={config[mode] ?? 'badge-gray'}>{mode}</span>
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon, bg }: {
  label: string; value: string | number; icon: React.ReactNode; bg: string
}) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

// ─── Receipt modal ────────────────────────────────────────────────────────────

function ReceiptModal({ receipt, onClose }: { receipt: ReceiptData; onClose: () => void }) {
  const openWhatsApp = () => {
    const lines = receipt.items
      .map(i =>
        `  • ${i.title}${i.isbn ? ` (${i.isbn})` : ''}\n    ${i.qty} x ₹${i.rate.toFixed(2)} = ₹${i.total.toFixed(2)}`
      )
      .join('\n')
    const msg = [
      '*IFT Sales Receipt*',
      `Bill No: ${receipt.invoiceNo}  |  Date: ${receipt.date}`,
      `Customer: ${receipt.customerName}`,
      receipt.customerPhone ? `Phone: ${receipt.customerPhone}` : '',
      `Payment: ${receipt.paymentMode.toUpperCase()}`,
      '',
      '*Items Purchased:*',
      lines,
      '',
      `Subtotal MRP : ₹${receipt.subtotalMrp.toFixed(2)}`,
      `Discount      : -₹${receipt.totalDiscount.toFixed(2)}`,
      `*Grand Total  : ₹${receipt.grandTotal.toFixed(2)}*`,
      '',
      `_${receipt.footer}_`,
      '_Islamic Foundation Trust, Chennai — www.iftchennai.in_',
    ].filter(Boolean).join('\n')
    const digits = receipt.customerPhone.replace(/\D/g, '')
    const phone  = digits ? (digits.startsWith('91') ? digits : `91${digits}`) : ''
    const base   = phone ? `https://wa.me/${phone}` : 'https://wa.me/'
    window.open(`${base}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg,#1B2A6B 0%,#2D3F8F 100%)' }}
        >
          <div className="flex items-center gap-3 text-white">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <ReceiptIcon size={20} />
            </div>
            <div>
              <p className="font-bold text-sm">Sales Receipt</p>
              <p className="text-blue-200 text-xs">{receipt.invoiceNo}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {([
              ['Date',    receipt.date],
              ['Payment', receipt.paymentMode],
              ['Customer', receipt.customerName],
              receipt.customerPhone ? ['Phone', receipt.customerPhone] : null,
            ] as (string[] | null)[])
              .filter((x): x is string[] => Boolean(x))
              .map(([label, value]) => (
                <div key={label}>
                  <p className="text-gray-400 text-xs">{label}</p>
                  <p className="font-medium text-gray-800 capitalize">{value}</p>
                </div>
              ))}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Items ({receipt.items.length})
            </p>
            <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
              {receipt.items.map(item => (
                <div key={item.sno} className="flex items-start justify-between px-3 py-2.5 text-sm">
                  <div className="flex-1 pr-3 min-w-0">
                    <p className="font-medium text-gray-800 leading-snug line-clamp-2">{item.title}</p>
                    {item.isbn && <p className="text-gray-400 text-xs mt-0.5">ISBN: {item.isbn}</p>}
                    {item.discountPct > 0 && (
                      <p className="text-emerald-600 text-xs">{item.discountPct}% off · MRP ₹{item.mrp}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <p className="text-gray-400 text-xs">{item.qty} × ₹{item.rate.toFixed(2)}</p>
                    <p className="font-bold text-sm" style={{ color: 'var(--ift-navy)' }}>₹{item.total.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ minWidth: '270px', background: 'var(--ift-gold-pale)', borderRadius: '12px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '40px', padding: '3px 0', fontSize: '13px', color: '#4B5563' }}>
                <span>Subtotal MRP</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>₹{receipt.subtotalMrp.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '40px', padding: '3px 0', fontSize: '13px', color: '#059669' }}>
                <span>Total Discount</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>− ₹{receipt.totalDiscount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '40px', borderTop: '2px solid #1B2A6B', paddingTop: '8px', marginTop: '4px', fontWeight: 'bold', fontSize: '17px', color: 'var(--ift-navy)', fontVariantNumeric: 'tabular-nums' }}>
                <span>Grand Total</span>
                <span>₹{receipt.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', paddingTop: '12px', borderTop: '1px solid #eee', fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic' }}>
            <p>{receipt.footer}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-100 flex gap-3">
          <button onClick={() => generateReceiptPDF(receipt)} className="btn-outline flex-1">
            <Printer size={15} /> Print PDF
          </button>
          <button
            onClick={openWhatsApp}
            className="btn flex-1 text-white font-semibold"
            style={{ background: '#25D366' }}
          >
            <MessageCircle size={15} /> WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BillingHistoryPage() {
  // Data
  const [invoices,     setInvoices]     = useState<InvoiceListRow[]>([])
  const [loading,      setLoading]      = useState(true)
  // Cache stored in ref — updates don't trigger full table re-render
  const itemsCacheRef  = useRef<Map<string, InvoiceDetailItem[]>>(new Map())
  const [fetchedIds,   setFetchedIds]   = useState<Set<string>>(new Set())
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set())
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set())
  const [orgSettings,  setOrgSettings]  = useState({ receipt_footer: 'Thank you for your purchase!' })

  // Receipt modal
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)

  // Filters — raw input vs debounced
  const [searchInput,  setSearchInput]  = useState('')
  const [search,       setSearch]       = useState('')
  const [fromDate,     setFromDate]     = useState('')
  const [toDate,       setToDate]       = useState('')

  useEffect(() => {
    setFromDate(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
    setToDate(format(new Date(), 'yyyy-MM-dd'))
  }, [])
  const [paymentMode,  setPaymentMode]  = useState('all')

  // Debounce search — 300ms max
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Fetch org settings once for receipt footer
  useEffect(() => {
    getOrgSettingsAction().then(s => setOrgSettings(s)).catch(() => {})
  }, [])

  // ── Load invoices ──────────────────────────────────────────────────────────
  const loadInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getInvoicesAction({
        from:        fromDate  || undefined,
        to:          toDate    || undefined,
        search:      search    || undefined,
        paymentMode: paymentMode !== 'all' ? paymentMode : undefined,
      })
      setInvoices(data)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, search, paymentMode])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  // Pre-compute expensive date-fns operations once per invoices change
  const processedInvoices = useMemo(() =>
    invoices.map(inv => ({
      ...inv,
      formattedDate: format(parseISO(inv.invoice_date), 'dd/MM/yyyy'),
      isTodayFlag:   isToday(parseISO(inv.invoice_date)),
    })),
    [invoices]
  )

  // ── Helper: get cached items or fetch from server ──────────────────────────
  const getItems = useCallback(async (invoiceId: string): Promise<InvoiceDetailItem[]> => {
    const cached = itemsCacheRef.current.get(invoiceId)
    if (cached) return cached
    const items = await getInvoiceItemsAction(invoiceId)
    itemsCacheRef.current.set(invoiceId, items)
    setFetchedIds(prev => new Set(prev).add(invoiceId))
    return items
  }, [])

  // ── Expand row ─────────────────────────────────────────────────────────────
  const toggleRow = useCallback(async (invoiceId: string) => {
    if (expanded.has(invoiceId)) {
      setExpanded(prev => { const s = new Set(prev); s.delete(invoiceId); return s })
      return
    }
    setExpanded(prev => new Set(prev).add(invoiceId))
    if (!itemsCacheRef.current.has(invoiceId)) {
      setLoadingItems(prev => new Set(prev).add(invoiceId))
      try {
        const items = await getInvoiceItemsAction(invoiceId)
        itemsCacheRef.current.set(invoiceId, items)
        setFetchedIds(prev => new Set(prev).add(invoiceId))
      } catch {
        toast.error('Failed to load items')
      } finally {
        setLoadingItems(prev => { const s = new Set(prev); s.delete(invoiceId); return s })
      }
    }
  }, [expanded])

  // ── Open receipt ───────────────────────────────────────────────────────────
  const openReceipt = useCallback(async (inv: InvoiceListRow) => {
    const tid = toast.loading('Loading receipt…')
    try {
      const items = await getItems(inv.id)
      toast.dismiss(tid)
      setReceipt(buildReceipt(inv, items, orgSettings.receipt_footer))
    } catch {
      toast.error('Failed to load receipt', { id: tid })
    }
  }, [getItems, orgSettings.receipt_footer])

  // ── Print PDF directly ─────────────────────────────────────────────────────
  const printPDF = useCallback(async (inv: InvoiceListRow) => {
    const tid = toast.loading('Generating PDF…')
    try {
      const items = await getItems(inv.id)
      toast.dismiss(tid)
      generateReceiptPDF(buildReceipt(inv, items, orgSettings.receipt_footer))
    } catch {
      toast.error('Failed', { id: tid })
    }
  }, [getItems, orgSettings.receipt_footer])

  // ── WhatsApp direct ────────────────────────────────────────────────────────
  const sendWhatsApp = useCallback(async (inv: InvoiceListRow) => {
    const tid = toast.loading('Loading…')
    try {
      const items = await getItems(inv.id)
      toast.dismiss(tid)
      const r = buildReceipt(inv, items, orgSettings.receipt_footer)
      const lines = r.items
        .map(i => `  • ${i.title}${i.isbn ? ` (${i.isbn})` : ''}\n    ${i.qty} x ₹${i.rate.toFixed(2)} = ₹${i.total.toFixed(2)}`)
        .join('\n')
      const msg = [
        '*IFT Sales Receipt*',
        `Bill No: ${r.invoiceNo}  |  Date: ${r.date}`,
        `Customer: ${r.customerName}`,
        r.customerPhone ? `Phone: ${r.customerPhone}` : '',
        `Payment: ${r.paymentMode.toUpperCase()}`,
        '',
        '*Items Purchased:*',
        lines,
        '',
        `Subtotal MRP : ₹${r.subtotalMrp.toFixed(2)}`,
        `Discount      : -₹${r.totalDiscount.toFixed(2)}`,
        `*Grand Total  : ₹${r.grandTotal.toFixed(2)}*`,
        '',
        `_${r.footer}_`,
        '_Islamic Foundation Trust, Chennai — www.iftchennai.in_',
      ].filter(Boolean).join('\n')
      const digits = r.customerPhone.replace(/\D/g, '')
      const phone  = digits ? (digits.startsWith('91') ? digits : `91${digits}`) : ''
      const base   = phone ? `https://wa.me/${phone}` : 'https://wa.me/'
      window.open(`${base}?text=${encodeURIComponent(msg)}`, '_blank')
    } catch {
      toast.error('Failed', { id: tid })
    }
  }, [getItems, orgSettings.receipt_footer])

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (invoices.length === 0) { toast.error('No data to export'); return }
    exportSalesReport(invoices.map(inv => ({
      invoiceNo:    inv.invoice_no,
      date:         inv.invoice_date,
      customerName: inv.customer_name || 'Walk-in',
      customerPhone: inv.customer_phone || '',
      items:        inv.items_count,
      grossMrp:     inv.subtotal_mrp,
      discount:     inv.discount_amount,
      netAmount:    inv.total_amount,
      paymentMode:  inv.payment_mode,
      location:     'IFT',
      createdBy:    'Staff',
    })))
    toast.success('Exported!')
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const totalRevenue = useMemo(() => invoices.reduce((s, i) => s + i.total_amount, 0), [invoices])
  const todayCount   = useMemo(() => processedInvoices.filter(i => i.isTodayFlag).length, [processedInvoices])

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Heading */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/billing" className="btn-outline px-2.5 py-2">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h2 className="page-title">Sales History</h2>
            <p className="page-sub mt-0.5">View and manage past invoices</p>
          </div>
        </div>
        <button onClick={handleExport} className="btn-outline">
          <Download size={15} />
          Export Excel
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Total Bills"
          value={loading ? '—' : invoices.length}
          icon={<ReceiptIcon size={22} className="text-white" />}
          bg="bg-[#1B2A6B]"
        />
        <SummaryCard
          label="Total Revenue"
          value={loading ? '—' : `₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
          icon={<IndianRupee size={22} className="text-white" />}
          bg="bg-emerald-500"
        />
        <SummaryCard
          label="Today's Bills"
          value={loading ? '—' : todayCount}
          icon={<TrendingUp size={22} className="text-white" />}
          bg="bg-amber-500"
        />
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-52">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Search by invoice no. or customer…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar size={14} className="text-gray-400 shrink-0" />
            <input
              type="date"
              className="input w-36"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              className="input w-36"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
            />
          </div>
          <select
            className="input w-36"
            value={paymentMode}
            onChange={e => setPaymentMode(e.target.value)}
          >
            <option value="all">All Modes</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Loading invoices…</span>
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-300">
            <ReceiptIcon size={44} />
            <p className="text-sm font-medium text-gray-400">No invoices found</p>
            <p className="text-xs text-gray-400">Try adjusting the date range or filters</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table-auto-ift">
              <thead>
                <tr>
                  <th className="w-8"></th>
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th className="text-center">Items</th>
                  <th className="text-right">Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th className="w-28 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {processedInvoices.map(inv => {
                  const isExpanded    = expanded.has(inv.id)
                  const isLoadingRow  = loadingItems.has(inv.id)
                  // Read directly from ref — no state dependency
                  const items         = itemsCacheRef.current.get(inv.id)
                  const displayCount  = items ? items.length : inv.items_count

                  return (
                    <React.Fragment key={inv.id}>
                      <tr
                        className="cursor-pointer"
                        onClick={() => toggleRow(inv.id)}
                      >
                        <td>
                          <span className="text-gray-400">
                            {isExpanded
                              ? <ChevronDown size={15} />
                              : <ChevronRight size={15} />}
                          </span>
                        </td>
                        <td>
                          <span
                            className="font-mono text-sm font-semibold"
                            style={{ color: 'var(--ift-navy)' }}
                          >
                            {inv.invoice_no}
                          </span>
                        </td>
                        <td className="whitespace-nowrap">
                          <span className="text-gray-700 text-sm">
                            {inv.formattedDate}
                          </span>
                          {inv.isTodayFlag && (
                            <span className="ml-1.5 badge-green" style={{ fontSize: 10 }}>Today</span>
                          )}
                        </td>
                        <td className="text-gray-700">
                          {inv.customer_name || (
                            <span className="text-gray-400 italic text-xs">Walk-in</span>
                          )}
                        </td>
                        <td className="text-gray-500 text-sm">{inv.customer_phone || '—'}</td>
                        <td className="text-center">
                          {isLoadingRow ? (
                            <Loader2 size={12} className="animate-spin mx-auto text-gray-400" />
                          ) : (
                            <span className="badge-blue">{displayCount}</span>
                          )}
                        </td>
                        <td
                          className="text-right font-bold tabular-nums"
                          style={{ color: 'var(--ift-navy)' }}
                        >
                          ₹{inv.total_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td>
                          <PaymentBadge mode={inv.payment_mode} />
                        </td>
                        <td>
                          <span className={`badge ${inv.status === 'paid' ? 'badge-green' : 'badge-yellow'}`}>
                            {inv.status}
                          </span>
                        </td>
                        {/* Action buttons — stop propagation so row click doesn't also expand */}
                        <td onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openReceipt(inv)}
                              className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-[#EEF0FA] hover:border-[#1B2A6B] transition-colors"
                              title="View Receipt"
                            >
                              <Eye size={13} style={{ color: 'var(--ift-navy)' }} />
                            </button>
                            <button
                              onClick={() => printPDF(inv)}
                              className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors"
                              title="Print PDF"
                            >
                              <Printer size={13} className="text-gray-500" />
                            </button>
                            <button
                              onClick={() => sendWhatsApp(inv)}
                              className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-green-50 hover:border-green-300 transition-colors"
                              title="Send via WhatsApp"
                            >
                              <MessageCircle size={13} className="text-green-500" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded items row */}
                      {isExpanded && (
                        <tr className="bg-gray-50/80">
                          <td colSpan={10} className="p-0">
                            {isLoadingRow ? (
                              <div className="flex items-center gap-2 px-10 py-4 text-gray-400 text-sm">
                                <Loader2 size={14} className="animate-spin" /> Loading items…
                              </div>
                            ) : items && items.length > 0 ? (
                              <div className="px-10 py-3">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr>
                                      {['#', 'Title', 'ISBN', 'Qty', 'MRP', 'Disc%', 'Rate', 'Total'].map(h => (
                                        <th
                                          key={h}
                                          className="py-1.5 pr-4 font-semibold text-[11px] uppercase tracking-wide text-gray-400 text-left last:text-right"
                                        >
                                          {h}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {items.map((item, idx) => (
                                      <tr key={idx} className="border-t border-gray-100">
                                        <td className="py-2 pr-4 text-gray-400 text-xs">{idx + 1}</td>
                                        <td className="py-2 pr-4 text-gray-800 font-medium max-w-xs leading-snug">{item.title}</td>
                                        <td className="py-2 pr-4 text-gray-400 text-xs">{item.isbn || '—'}</td>
                                        <td className="py-2 pr-4 text-gray-600">{item.qty}</td>
                                        <td className="py-2 pr-4 text-gray-500">₹{item.mrp}</td>
                                        <td className="py-2 pr-4 text-emerald-600 text-xs">
                                          {item.discount_pct > 0 ? `${item.discount_pct}%` : '—'}
                                        </td>
                                        <td className="py-2 pr-4 text-gray-700 tabular-nums">₹{item.rate.toFixed(2)}</td>
                                        <td
                                          className="py-2 text-right font-bold tabular-nums"
                                          style={{ color: 'var(--ift-navy)' }}
                                        >
                                          ₹{item.total_amount.toFixed(2)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="px-10 py-4 text-gray-400 text-sm">No items found</div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receipt modal */}
      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  )
}
