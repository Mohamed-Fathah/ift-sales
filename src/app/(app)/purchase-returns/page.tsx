'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { Undo2, Plus, Search, X, Loader2, IndianRupee } from 'lucide-react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { getNextInvoiceNo } from '@/lib/invoice-number'
import { useAuthStore } from '@/store/auth.store'

interface ReturnRow {
  id: string
  return_no: string
  return_date: string
  invoice_no: string
  supplier_name: string
  total_amount: number
  status: string
  notes: string
  items_count: number
}

interface InvoiceOption {
  id: string
  invoice_no: string
  invoice_date: string
  supplier_name: string
  location_id: string
}

interface ReturnLineItem {
  material_id: string
  title: string
  item_code: string
  max_qty: number
  qty: number
  rate: number
}

function fmtRupee(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}
function fmtDate(d: string) {
  try { return format(parseISO(d), 'dd MMM yyyy') } catch { return d }
}

export default function PurchaseReturnsPage() {
  const { user } = useAuthStore()
  const [rows,    setRows]    = useState<ReturnRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving,    setSaving]    = useState(false)

  // Modal state
  const [invoices,          setInvoices]          = useState<InvoiceOption[]>([])
  const [selectedInvoice,   setSelectedInvoice]   = useState<InvoiceOption | null>(null)
  const [returnItems,       setReturnItems]       = useState<ReturnLineItem[]>([])
  const [returnDate,        setReturnDate]        = useState(format(new Date(), 'yyyy-MM-dd'))
  const [notes,             setNotes]             = useState('')
  const [loadingItems,      setLoadingItems]      = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('purchase_returns')
        .select(`id, return_no, return_date, total_amount, status, notes,
          purchase_invoices!purchase_invoice_id(invoice_no, parties!supplier_id(name))`)
        .order('return_date', { ascending: false })
      if (error) throw new Error(error.message)

      const ids = ((data ?? []) as any[]).map(r => r.id as string)
      const cntMap = new Map<string, number>()
      if (ids.length > 0) {
        const { data: items } = await supabase
          .from('purchase_return_items').select('return_id').in('return_id', ids)
        for (const i of (items ?? []) as any[])
          cntMap.set(i.return_id, (cntMap.get(i.return_id) ?? 0) + 1)
      }

      setRows(((data ?? []) as any[]).map(r => ({
        id:            r.id,
        return_no:     r.return_no     ?? '',
        return_date:   r.return_date   ?? '',
        invoice_no:    (r.purchase_invoices as any)?.invoice_no ?? '',
        supplier_name: (r.purchase_invoices as any)?.parties?.name ?? 'Unknown',
        total_amount:  Number(r.total_amount ?? 0),
        status:        r.status        ?? 'confirmed',
        notes:         r.notes         ?? '',
        items_count:   cntMap.get(r.id) ?? 0,
      })))
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load purchase returns')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openModal = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('purchase_invoices')
      .select('id, invoice_no, invoice_date, location_id, parties!supplier_id(name)')
      .in('status', ['confirmed', 'partial', 'paid'])
      .order('invoice_date', { ascending: false })
      .limit(200)
    setInvoices(((data ?? []) as any[]).map(r => ({
      id: r.id,
      invoice_no: r.invoice_no ?? '',
      invoice_date: r.invoice_date ?? '',
      supplier_name: (r.parties as any)?.name ?? 'Unknown',
      location_id: r.location_id ?? '',
    })))
    setSelectedInvoice(null)
    setReturnItems([])
    setReturnDate(format(new Date(), 'yyyy-MM-dd'))
    setNotes('')
    setShowModal(true)
  }

  const handleInvoiceChange = async (invoiceId: string) => {
    const inv = invoices.find(i => i.id === invoiceId) ?? null
    setSelectedInvoice(inv)
    if (!inv) { setReturnItems([]); return }
    setLoadingItems(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('purchase_invoice_items')
        .select('material_id, qty, rate, materials(title, item_code)')
        .eq('invoice_id', invoiceId)
      if (error) throw new Error(error.message)
      setReturnItems(((data ?? []) as any[]).map(r => ({
        material_id: r.material_id,
        title:       (r.materials as any)?.title ?? '—',
        item_code:   (r.materials as any)?.item_code ?? '',
        max_qty:     Number(r.qty ?? 0),
        qty:         0,
        rate:        Number(r.rate ?? 0),
      })))
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load items')
    } finally {
      setLoadingItems(false)
    }
  }

  const setQty = (materialId: string, qty: number) =>
    setReturnItems(prev => prev.map(i =>
      i.material_id === materialId
        ? { ...i, qty: Math.min(Math.max(0, qty), i.max_qty) }
        : i
    ))

  const activeItems = useMemo(() => returnItems.filter(i => i.qty > 0), [returnItems])
  const totalReturn = useMemo(() => activeItems.reduce((s, i) => s + i.qty * i.rate, 0), [activeItems])

  const handleSave = async () => {
    if (!selectedInvoice) return toast.error('Select a purchase invoice')
    if (activeItems.length === 0) return toast.error('Enter return qty for at least one item')
    setSaving(true)
    try {
      const supabase = createClient()
      const returnNo = await getNextInvoiceNo('return_purchase')

      const { data: ret, error: retErr } = await supabase
        .from('purchase_returns')
        .insert({
          return_no:           returnNo,
          return_date:         returnDate,
          purchase_invoice_id: selectedInvoice.id,
          total_amount:        totalReturn,
          notes,
          status:              'confirmed',
          created_by:          user?.full_name ?? 'System',
        })
        .select('id').single()
      if (retErr) throw new Error(retErr.message)

      const { error: itemsErr } = await supabase
        .from('purchase_return_items')
        .insert(activeItems.map(i => ({
          return_id:   ret.id,
          material_id: i.material_id,
          qty:         i.qty,
          rate:        i.rate,
          amount:      i.qty * i.rate,
        })))
      if (itemsErr) throw new Error(itemsErr.message)

      // Decrement stock (items go back to supplier)
      if (selectedInvoice.location_id) {
        for (const item of activeItems) {
          const { data: stockRow } = await supabase
            .from('stock')
            .select('id, qty_in_hand')
            .eq('material_id', item.material_id)
            .eq('location_id', selectedInvoice.location_id)
            .maybeSingle()
          if (stockRow) {
            await supabase.from('stock').update({
              qty_in_hand: Math.max(0, Number((stockRow as any).qty_in_hand) - item.qty),
            }).eq('id', (stockRow as any).id)
          }
          await supabase.from('stock_movements').insert({
            material_id:   item.material_id,
            location_id:   selectedInvoice.location_id,
            movement_type: 'purchase_return',
            qty:           -item.qty,
            reference_id:  ret.id,
            notes:         `Purchase Return ${returnNo}`,
            created_by:    user?.full_name ?? 'System',
          })
        }
      }

      toast.success(`Return ${returnNo} saved`)
      setShowModal(false)
      load()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return q
      ? rows.filter(r =>
          r.return_no.toLowerCase().includes(q) ||
          r.invoice_no.toLowerCase().includes(q) ||
          r.supplier_name.toLowerCase().includes(q)
        )
      : rows
  }, [rows, search])

  const totalValue = useMemo(() => rows.reduce((s, r) => s + r.total_amount, 0), [rows])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Purchase Returns</h2>
          <p className="page-sub mt-0.5">Goods returned to suppliers</p>
        </div>
        <button className="btn-primary" onClick={openModal}>
          <Plus size={15} /> New Return
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(27,42,107,0.08)' }}>
              <Undo2 size={18} style={{ color: 'var(--ift-navy)' }} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Returns</p>
              <p className="text-xl font-bold" style={{ color: 'var(--ift-navy)' }}>
                {loading ? '—' : rows.length}
              </p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <IndianRupee size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Value</p>
              <p className="text-xl font-bold text-amber-600 tabular-nums">
                {loading ? '—' : fmtRupee(totalValue)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            className="input pl-9 text-sm"
            placeholder="Search return no, invoice, supplier…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
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
              <Loader2 size={18} className="animate-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <Undo2 size={36} />
              <p className="text-sm font-medium">No purchase returns yet</p>
              <button className="btn-primary mt-1" onClick={openModal}>
                <Plus size={14} /> Record Return
              </button>
            </div>
          ) : (
            <table className="table-auto-ift">
              <thead>
                <tr>
                  <th>Return No</th>
                  <th>Date</th>
                  <th>Invoice</th>
                  <th>Supplier</th>
                  <th className="text-right">Items</th>
                  <th className="text-right">Amount</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td className="font-semibold text-sm" style={{ color: 'var(--ift-navy)' }}>{r.return_no}</td>
                    <td className="text-sm text-gray-600 whitespace-nowrap">{fmtDate(r.return_date)}</td>
                    <td className="text-sm text-gray-600">{r.invoice_no}</td>
                    <td className="text-sm font-medium text-gray-800">{r.supplier_name}</td>
                    <td className="text-right text-sm text-gray-600">{r.items_count}</td>
                    <td className="text-right font-semibold text-sm tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                      {fmtRupee(r.total_amount)}
                    </td>
                    <td className="text-sm text-gray-500 max-w-[160px] truncate">{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-gray-500">
                    Total ({rows.length} returns)
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                    {fmtRupee(totalValue)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* New Return Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">New Purchase Return</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Invoice selector */}
              <div>
                <label className="label">Purchase Invoice *</label>
                <select
                  className="input"
                  value={selectedInvoice?.id ?? ''}
                  onChange={e => handleInvoiceChange(e.target.value)}
                >
                  <option value="">Select invoice…</option>
                  {invoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_no} — {inv.supplier_name} ({fmtDate(inv.invoice_date)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="label">Return Date *</label>
                <input type="date" className="input" value={returnDate}
                  onChange={e => setReturnDate(e.target.value)} />
              </div>

              {/* Items */}
              {loadingItems ? (
                <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
                  <Loader2 size={16} className="animate-spin" /> Loading items…
                </div>
              ) : returnItems.length > 0 && (
                <div>
                  <label className="label">Return Items — enter qty to return</label>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs font-semibold text-gray-500">
                        <tr>
                          <th className="text-left px-3 py-2">Item</th>
                          <th className="text-right px-3 py-2">Orig Qty</th>
                          <th className="text-right px-3 py-2">Return Qty</th>
                          <th className="text-right px-3 py-2">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnItems.map(item => (
                          <tr key={item.material_id} className="border-t border-gray-100">
                            <td className="px-3 py-2">
                              <p className="font-medium text-gray-800 truncate max-w-[180px]">{item.title}</p>
                              {item.item_code && (
                                <p className="text-[11px] font-mono text-gray-400">{item.item_code}</p>
                              )}
                            </td>
                            <td className="text-right px-3 py-2 text-gray-500">{item.max_qty}</td>
                            <td className="text-right px-3 py-2">
                              <input
                                type="number" min={0} max={item.max_qty}
                                className="w-16 text-right input py-1 px-2 text-sm"
                                value={item.qty || ''}
                                onChange={e => setQty(item.material_id, Number(e.target.value))}
                              />
                            </td>
                            <td className="text-right px-3 py-2 font-semibold tabular-nums"
                              style={{ color: item.qty > 0 ? 'var(--ift-navy)' : '#9ca3af' }}>
                              {fmtRupee(item.qty * item.rate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-right text-sm font-semibold text-gray-500">
                            Total Return
                          </td>
                          <td className="px-3 py-2 text-right font-bold tabular-nums"
                            style={{ color: 'var(--ift-navy)' }}>
                            {fmtRupee(totalReturn)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="label">Notes / Reason</label>
                <textarea
                  className="input resize-none" rows={2}
                  placeholder="Reason for return…"
                  value={notes} onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                {activeItems.length} item(s) — {fmtRupee(totalReturn)}
              </p>
              <div className="flex gap-2">
                <button className="btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={saving || !selectedInvoice || activeItems.length === 0}
                >
                  {saving
                    ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                    : 'Save Return'
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
