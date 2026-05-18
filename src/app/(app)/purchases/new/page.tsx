'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Trash2, Plus, Loader2, ChevronLeft,
  Package, AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { getNextInvoiceNo } from '@/lib/invoice-number'
import { useAuthStore } from '@/store/auth.store'
import {
  getSuppliersAction,
  getPurchaseLocationsAction,
  searchPurchaseMaterialsAction,
  savePurchaseInvoiceAction,
  type SupplierOption,
  type PurchaseLocationOption,
  type PurchaseMaterialResult,
} from './actions'

// ─── Local types ──────────────────────────────────────────────────────────────

interface CartItem {
  materialId: string
  title: string
  isbn: string
  qty: number
  rate: number
  mrp: number
  discountPct: number
  total: number
}

// ─── Charge input helper ───────────────────────────────────────────────────────

function ChargeInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-gray-600 shrink-0">{label}</span>
      <div className="relative w-32 shrink-0">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">₹</span>
        <input
          type="number"
          min={0}
          step="0.01"
          className="input pl-6 pr-2 text-right tabular-nums"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewPurchasePage() {
  const router = useRouter()
  const user   = useAuthStore(s => s.user)

  // ── Meta fields ────────────────────────────────────────────────────────────
  const [suppliers,  setSuppliers]  = useState<SupplierOption[]>([])
  const [locations,  setLocations]  = useState<PurchaseLocationOption[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [supplierInvNo, setSupplierInvNo] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  // ── Items ──────────────────────────────────────────────────────────────────
  const [items, setItems] = useState<CartItem[]>([])

  // ── Book search ────────────────────────────────────────────────────────────
  const [searchQuery,  setSearchQuery]  = useState('')
  const [searchResults,setSearchResults]= useState<PurchaseMaterialResult[]>([])
  const [isSearching,  setIsSearching]  = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchWrapRef = useRef<HTMLDivElement>(null)

  // ── Charges (string inputs to avoid leading-zero issues) ───────────────────
  const [discountAmt,   setDiscountAmt]   = useState('0')
  const [transportAmt,  setTransportAmt]  = useState('0')
  const [unloadingAmt,  setUnloadingAmt]  = useState('0')
  const [otherAmt,      setOtherAmt]      = useState('0')
  const [paidAmt,       setPaidAmt]       = useState('0')
  const [notes,         setNotes]         = useState('')

  // ── Save state ─────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState<'draft' | 'confirmed' | null>(null)

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      const [sups, locs] = await Promise.all([
        getSuppliersAction(),
        getPurchaseLocationsAction(),
      ])
      setSuppliers(sups)
      setLocations(locs)
      const def = locs.find(l => l.is_default)
      if (def) setLocationId(def.id)
    })()
  }, [])

  // ── Book search (debounced) ────────────────────────────────────────────────
  useEffect(() => {
    const q = searchQuery.trim()
    if (!q) { setSearchResults([]); setShowDropdown(false); return }
    setIsSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await searchPurchaseMaterialsAction(q)
        setSearchResults(res)
        setShowDropdown(true)
      } finally {
        setIsSearching(false)
      }
    }, 300)
    return () => { clearTimeout(t); setIsSearching(false) }
  }, [searchQuery])

  // click-outside closes dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Add item ───────────────────────────────────────────────────────────────
  const addItem = useCallback((m: PurchaseMaterialResult) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.materialId === m.id)
      if (idx !== -1) {
        return prev.map((i, n) =>
          n === idx
            ? { ...i, qty: i.qty + 1, total: parseFloat(((i.qty + 1) * i.rate).toFixed(2)) }
            : i,
        )
      }
      const rate = m.purchase_rate > 0 ? m.purchase_rate : parseFloat((m.mrp * (1 - m.discount_pct / 100)).toFixed(2))
      return [
        ...prev,
        {
          materialId:  m.id,
          title:       m.title,
          isbn:        m.isbn,
          qty:         1,
          rate,
          mrp:         m.mrp,
          discountPct: m.discount_pct,
          total:       rate,
        },
      ]
    })
    setSearchQuery('')
    setShowDropdown(false)
  }, [])

  // ── Item field updates ─────────────────────────────────────────────────────
  const updateItem = (materialId: string, field: keyof CartItem, raw: string) => {
    setItems(prev =>
      prev.map(i => {
        if (i.materialId !== materialId) return i
        let next = { ...i }

        if (field === 'qty') {
          const qty = Math.max(1, parseInt(raw) || 1)
          next = { ...next, qty, total: parseFloat((qty * next.rate).toFixed(2)) }
        } else if (field === 'rate') {
          const rate = Math.max(0, parseFloat(raw) || 0)
          next = { ...next, rate, total: parseFloat((next.qty * rate).toFixed(2)) }
        } else if (field === 'discountPct') {
          const pct  = Math.max(0, Math.min(100, parseFloat(raw) || 0))
          const rate = parseFloat((next.mrp * (1 - pct / 100)).toFixed(2))
          next = { ...next, discountPct: pct, rate, total: parseFloat((next.qty * rate).toFixed(2)) }
        } else if (field === 'mrp') {
          const mrp  = Math.max(0, parseFloat(raw) || 0)
          const rate = parseFloat((mrp * (1 - next.discountPct / 100)).toFixed(2))
          next = { ...next, mrp, rate, total: parseFloat((next.qty * rate).toFixed(2)) }
        }

        return next
      }),
    )
  }

  const removeItem = (materialId: string) =>
    setItems(prev => prev.filter(i => i.materialId !== materialId))

  // ── Computed totals ────────────────────────────────────────────────────────
  const subtotal   = useMemo(() => items.reduce((s, i) => s + i.total, 0), [items])
  const discAmt    = parseFloat(discountAmt)  || 0
  const transAmt   = parseFloat(transportAmt) || 0
  const unloadAmt  = parseFloat(unloadingAmt) || 0
  const otherTotal = parseFloat(otherAmt)     || 0
  const paidTotal  = parseFloat(paidAmt)      || 0
  const grandTotal = subtotal - discAmt + transAmt + unloadAmt + otherTotal
  const balanceDue = grandTotal - paidTotal

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async (status: 'draft' | 'confirmed') => {
    if (!supplierId) { toast.error('Select a supplier'); return }
    if (!locationId) { toast.error('Select a location'); return }
    if (items.length === 0) { toast.error('Add at least one item'); return }
    if (status === 'confirmed') {
      const invalid = items.some(i => i.qty <= 0 || i.rate <= 0)
      if (invalid) { toast.error('All items must have qty and rate > 0'); return }
    }

    setSaving(status)
    try {
      const invoiceNo = await getNextInvoiceNo('purchase')
      const { invoiceNo: savedNo } = await savePurchaseInvoiceAction({
        invoiceNo,
        supplierId,
        locationId,
        invoiceDate,
        supplierInvNo,
        items: items.map(i => ({
          materialId:  i.materialId,
          title:       i.title,
          isbn:        i.isbn,
          qty:         i.qty,
          rate:        i.rate,
          mrp:         i.mrp,
          discountPct: i.discountPct,
          total:       i.total,
        })),
        subtotal,
        discountAmount:  discAmt,
        transportCharge: transAmt,
        unloadingCharge: unloadAmt,
        otherCharges:    otherTotal,
        totalAmount:     grandTotal,
        paidAmount:      paidTotal,
        notes,
        status,
        createdBy: user?.id ?? null,
      })

      toast.success(
        status === 'confirmed'
          ? `Purchase ${savedNo} confirmed — stock updated`
          : `Draft ${savedNo} saved`,
      )
      router.push('/purchases')
    } catch (err: any) {
      toast.error(err.message ?? 'Save failed')
      setSaving(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/purchases')}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ChevronLeft size={22} />
        </button>
        <div>
          <h2 className="page-title">New Purchase Invoice</h2>
          <p className="page-sub mt-0.5">Record goods received from a supplier</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-5 items-start">

        {/* ── LEFT PANEL ────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Meta card */}
          <div className="card space-y-4">
            <div className="grid grid-cols-2 gap-4">

              {/* Supplier */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Supplier <span className="text-red-400">*</span>
                </label>
                <select
                  className="input"
                  value={supplierId}
                  onChange={e => setSupplierId(e.target.value)}
                >
                  <option value="">— Select Supplier —</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Supplier Invoice No */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Supplier Invoice No
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. INV-2024-001"
                  value={supplierInvNo}
                  onChange={e => setSupplierInvNo(e.target.value)}
                />
              </div>

              {/* Invoice Date */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Invoice Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  className="input"
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Receiving Location <span className="text-red-400">*</span>
                </label>
                <select
                  className="input"
                  value={locationId}
                  onChange={e => setLocationId(e.target.value)}
                >
                  <option value="">— Select Location —</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Book search */}
          <div className="card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
              Add Books
            </p>
            <div className="relative" ref={searchWrapRef}>
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                className="input pl-9"
                placeholder="Search by title, author, ISBN, item code…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              />

              {showDropdown && (
                <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-white rounded-xl border border-gray-100 shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
                  {isSearching ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
                      <Loader2 size={14} className="animate-spin" /> Searching…
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="py-6 text-center text-sm text-gray-400">No books found</div>
                  ) : (
                    searchResults.map(m => (
                      <button
                        key={m.id}
                        onClick={() => addItem(m)}
                        className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0 text-left hover:bg-[#EEF0FA] transition-colors"
                      >
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="font-medium text-sm text-gray-800 leading-snug line-clamp-1">
                            {m.title}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {m.author}
                            {m.isbn ? ` · ${m.isbn}` : ''}
                            {m.item_code ? ` · ${m.item_code}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-gray-400">MRP ₹{m.mrp}</p>
                          <p className="text-xs font-semibold" style={{ color: 'var(--ift-navy)' }}>
                            Rate ₹{m.purchase_rate}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Items table */}
          <div className="card p-0 overflow-hidden">
            {/* Table header */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package size={15} style={{ color: 'var(--ift-navy)' }} />
                <span className="font-semibold text-sm text-gray-700">Items</span>
                {items.length > 0 && (
                  <span className="badge-blue">{items.length}</span>
                )}
              </div>
              {items.length > 0 && (
                <button
                  onClick={() => { if (window.confirm('Remove all items?')) setItems([]) }}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-gray-300">
                <Package size={36} />
                <p className="text-sm">Search and add books above</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-auto-ift">
                  <thead>
                    <tr>
                      <th className="w-8">#</th>
                      <th>Title / ISBN</th>
                      <th className="w-20 text-right">MRP</th>
                      <th className="w-20 text-center">Disc %</th>
                      <th className="w-28 text-right">Purchase Rate</th>
                      <th className="w-20 text-center">Qty</th>
                      <th className="w-24 text-right">Total</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.materialId}>
                        <td className="text-gray-400 text-xs">{idx + 1}</td>
                        <td>
                          <p className="font-medium text-sm text-gray-800 leading-snug line-clamp-2 max-w-[220px]">
                            {item.title}
                          </p>
                          {item.isbn && (
                            <p className="text-[11px] text-gray-400 mt-0.5">{item.isbn}</p>
                          )}
                        </td>

                        {/* MRP */}
                        <td className="text-right">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.mrp}
                            onChange={e => updateItem(item.materialId, 'mrp', e.target.value)}
                            className="w-20 px-2 py-1 text-right text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 tabular-nums"
                          />
                        </td>

                        {/* Disc% */}
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.1"
                              value={item.discountPct}
                              onChange={e => updateItem(item.materialId, 'discountPct', e.target.value)}
                              className="w-14 px-2 py-1 text-center text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 tabular-nums"
                            />
                            <span className="text-gray-400 text-xs">%</span>
                          </div>
                        </td>

                        {/* Purchase Rate */}
                        <td className="text-right">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.rate}
                            onChange={e => updateItem(item.materialId, 'rate', e.target.value)}
                            className="w-24 px-2 py-1 text-right text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 tabular-nums"
                          />
                        </td>

                        {/* Qty */}
                        <td className="text-center">
                          <input
                            type="number"
                            min={1}
                            value={item.qty}
                            onChange={e => updateItem(item.materialId, 'qty', e.target.value)}
                            className="w-16 px-2 py-1 text-center text-sm font-bold rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 tabular-nums"
                            style={{ color: 'var(--ift-navy)' }}
                          />
                        </td>

                        {/* Total */}
                        <td className="text-right font-bold text-sm tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                          ₹{item.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>

                        <td>
                          <button
                            onClick={() => removeItem(item.materialId)}
                            className="text-red-400 hover:text-red-600 transition-colors p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Subtotal row */}
            {items.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 flex justify-end items-center gap-4 text-sm">
                <span className="text-gray-500">
                  {items.reduce((s, i) => s + i.qty, 0)} books · Items subtotal
                </span>
                <span className="font-bold text-base tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                  ₹{subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL (sticky) ───────────────────────────────────────── */}
        <div className="w-80 shrink-0 self-start sticky top-4 space-y-4">

          {/* Charges & totals */}
          <div className="card space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              Invoice Summary
            </p>

            {/* Auto subtotal */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-semibold tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                ₹{subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="h-px bg-gray-100" />

            {/* Editable charges */}
            <div className="space-y-2.5">
              <ChargeInput label="Discount"    value={discountAmt}  onChange={setDiscountAmt}  />
              <ChargeInput label="Transport"   value={transportAmt} onChange={setTransportAmt} />
              <ChargeInput label="Unloading"   value={unloadingAmt} onChange={setUnloadingAmt} />
              <ChargeInput label="Other"       value={otherAmt}     onChange={setOtherAmt}     />
            </div>

            <div className="h-px bg-gray-200" />

            {/* Grand total */}
            <div
              className="flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{ background: 'var(--ift-gold-pale)', border: '1px solid #f0e0b8' }}
            >
              <span className="font-bold text-sm" style={{ color: 'var(--ift-navy)' }}>
                Grand Total
              </span>
              <span className="font-bold text-xl tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                ₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Paid */}
            <ChargeInput label="Paid Amount" value={paidAmt} onChange={setPaidAmt} />

            {/* Balance due */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Balance Due</span>
              <span
                className="font-bold tabular-nums"
                style={{ color: balanceDue > 0 ? '#dc2626' : '#059669' }}
              >
                ₹{Math.abs(balanceDue).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                {balanceDue < 0 ? ' (overpaid)' : ''}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div className="card">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes</label>
            <textarea
              className="input resize-none text-sm"
              rows={3}
              placeholder="Internal notes for this purchase…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Validation hint */}
          {items.length === 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">Add at least one book to save the invoice.</p>
            </div>
          )}

          {/* Action buttons */}
          <button
            onClick={() => handleSave('draft')}
            disabled={saving !== null || items.length === 0 || !supplierId}
            className="btn-outline w-full py-3 font-semibold"
          >
            {saving === 'draft'
              ? <><Loader2 size={15} className="animate-spin" /> Saving Draft…</>
              : 'Save as Draft'
            }
          </button>

          <button
            onClick={() => handleSave('confirmed')}
            disabled={saving !== null || items.length === 0 || !supplierId || !locationId}
            className="btn-primary w-full py-3 text-[15px] font-bold rounded-xl shadow-md"
          >
            {saving === 'confirmed'
              ? <><Loader2 size={16} className="animate-spin" /> Confirming…</>
              : <><Plus size={16} /> Confirm Purchase</>
            }
          </button>

          <p className="text-center text-xs text-gray-400 -mt-1">
            Confirming will update stock quantities
          </p>
        </div>
      </div>
    </div>
  )
}
