'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import {
  Search, Download, Package, AlertTriangle,
  TrendingDown, RefreshCw, ArrowLeftRight, X,
  Loader2, IndianRupee, BookOpen,
  ArrowUp, ArrowDown, RotateCcw, Plus,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/auth.store'
import { exportStockReport } from '@/lib/excel-export'
import { createClient } from '@/lib/supabase/client'
import {
  updateStockAction,
  transferStockAction,
  addStockEntryAction,
  getActiveMaterialsAction,
  type StockRow,
  type LocationOption,
  type MaterialOption,
} from './actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatus(qty: number): 'in_stock' | 'low' | 'out' {
  if (qty <= 0) return 'out'
  if (qty <= 10) return 'low'
  return 'in_stock'
}

function StatusBadge({ qty }: { qty: number }) {
  const s = getStatus(qty)
  if (s === 'out') return <span className="badge-red">Out of Stock</span>
  if (s === 'low') return <span className="badge-yellow">Low Stock</span>
  return <span className="badge-green">In Stock</span>
}

function fmtRupee(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

// ─── Movement type options ────────────────────────────────────────────────────

type MovementKind = 'add' | 'reduce' | 'return'

const MOVEMENT_TYPES: { value: string; label: string; kind: MovementKind }[] = [
  { value: 'purchase',    label: 'Stock Replenishment',              kind: 'add'    },
  { value: 'opening',     label: 'Opening Stock / Initial Count',    kind: 'add'    },
  { value: 'adjustment',  label: 'Stock Correction (Count Mismatch)', kind: 'add'   },
  { value: 'damage',      label: 'Damage / Spoilage',                kind: 'reduce' },
  { value: 'loss',        label: 'Lost / Missing',                   kind: 'reduce' },
  { value: 'sale_return', label: 'Returned by Customer',             kind: 'return' },
]

const KIND_STYLES: Record<MovementKind, { bg: string; icon: React.ReactNode }> = {
  add:    { bg: 'bg-emerald-100', icon: <ArrowUp    size={13} className="text-emerald-600" /> },
  reduce: { bg: 'bg-red-100',     icon: <ArrowDown  size={13} className="text-red-500"     /> },
  return: { bg: 'bg-blue-100',    icon: <RotateCcw  size={13} className="text-blue-500"    /> },
}

function MovementTypePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      {MOVEMENT_TYPES.map(t => {
        const active = value === t.value
        const { bg, icon } = KIND_STYLES[t.kind]
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
              active
                ? 'border-[#1B2A6B] bg-[#EEF0FA]'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
              {icon}
            </div>
            <span className={`text-sm font-medium flex-1 ${active ? 'text-[#1B2A6B]' : 'text-gray-700'}`}>
              {t.label}
            </span>
            {active && (
              <div className="w-4 h-4 rounded-full border-2 border-[#1B2A6B] flex items-center justify-center shrink-0">
                <div className="w-2 h-2 rounded-full bg-[#1B2A6B]" />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Add Stock Entry Modal ────────────────────────────────────────────────────

function AddStockEntryModal({
  locations,
  userId,
  onClose,
  onSaved,
}: {
  locations: LocationOption[]
  userId: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [materials,    setMaterials]    = useState<MaterialOption[]>([])
  const [loadingMats,  setLoadingMats]  = useState(true)
  const [search,       setSearch]       = useState('')
  const [materialId,   setMaterialId]   = useState('')
  const [locationId,   setLocationId]   = useState(locations[0]?.id ?? '')
  const [qty,          setQty]          = useState('')
  const [notes,        setNotes]        = useState('')
  const [saving,       setSaving]       = useState(false)

  useEffect(() => {
    getActiveMaterialsAction()
      .then(setMaterials)
      .catch(err => toast.error(err.message))
      .finally(() => setLoadingMats(false))
  }, [])

  const filteredMats = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return materials
    return materials.filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.item_code.toLowerCase().includes(q) ||
      m.isbn.toLowerCase().includes(q)
    )
  }, [materials, search])

  const selected  = materials.find(m => m.id === materialId)
  const parsedQty = parseInt(qty, 10)
  const valid     = !!materialId && !!locationId && !isNaN(parsedQty) && parsedQty > 0

  const handleSave = async () => {
    if (!valid) { toast.error('Select a book and enter a valid quantity'); return }
    setSaving(true)
    try {
      await addStockEntryAction({ materialId, locationId, qty: parsedQty, notes, createdBy: userId })
      toast.success('Stock entry added')
      onSaved()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to add stock')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden">
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ background: 'linear-gradient(135deg,#1B2A6B 0%,#2D3F8F 100%)' }}
        >
          <p className="font-bold text-white text-sm">Add Stock Entry</p>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Book select */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Book *</label>
            {selected ? (
              <div className="flex items-center justify-between px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-sm font-medium text-blue-800 line-clamp-1 flex-1">{selected.title}</span>
                <button
                  onClick={() => { setMaterialId(''); setSearch('') }}
                  className="text-blue-400 hover:text-blue-600 ml-2 shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  className="input mb-2"
                  placeholder="Search title, item code, ISBN…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {loadingMats ? (
                    <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-400">
                      <Loader2 size={14} className="animate-spin" /> Loading…
                    </div>
                  ) : filteredMats.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-4">No books found</p>
                  ) : (
                    filteredMats.slice(0, 60).map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { setMaterialId(m.id); setSearch(m.title) }}
                        className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{m.title}</p>
                          <p className="text-xs text-gray-400 truncate">
                            {m.item_code}{m.isbn ? ` · ${m.isbn}` : ''}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Location *</label>
            <select className="input" value={locationId} onChange={e => setLocationId(e.target.value)}>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          {/* Qty */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">+ Add Quantity *</label>
            <input
              type="number"
              min={1}
              className="input"
              value={qty}
              onChange={e => setQty(e.target.value)}
              placeholder="Enter quantity"
            />
            <p className="text-xs text-gray-400 mt-1">If a stock entry already exists, this qty will be added to the current quantity.</p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Reason for adding stock…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="px-5 pb-5 pt-3 flex gap-3 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !valid}
            className="btn-primary flex-1"
          >
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Add Stock'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Update Stock Modal ───────────────────────────────────────────────────────

function UpdateStockModal({
  row,
  userId,
  onClose,
  onSaved,
}: {
  row: StockRow
  userId: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [addQty,       setAddQty]       = useState('')
  const [movementType, setMovementType] = useState('purchase')
  const [notes,        setNotes]        = useState('')
  const [saving,       setSaving]       = useState(false)

  const selectedKind = MOVEMENT_TYPES.find(t => t.value === movementType)?.kind ?? 'add'
  const isReduce     = selectedKind === 'reduce'
  const parsedAdd    = parseInt(addQty, 10)
  const newTotal     = isNaN(parsedAdd) || parsedAdd <= 0
    ? null
    : isReduce
      ? row.qty_available - parsedAdd
      : row.qty_available + parsedAdd

  const handleSave = async () => {
    if (isNaN(parsedAdd) || parsedAdd <= 0) { toast.error('Enter a valid quantity'); return }
    if (isReduce && parsedAdd > row.qty_available) {
      toast.error(`Cannot remove more than current stock (${row.qty_available})`); return
    }
    setSaving(true)
    try {
      await updateStockAction({
        materialId:   row.material_id,
        locationId:   row.location_id,
        currentQty:   row.qty_available,
        newQty:       newTotal!,
        movementType,
        notes,
        createdBy:    userId,
        itemCode:     row.item_code,
        title:        row.title,
      })
      toast.success('Stock updated successfully')
      onSaved()
    } catch (err: any) {
      toast.error(err.message ?? 'Update failed')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden">
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ background: 'linear-gradient(135deg,#1B2A6B 0%,#2D3F8F 100%)' }}
        >
          <div className="text-white">
            <p className="font-bold text-sm">Update Stock</p>
            <p className="text-blue-200 text-xs mt-0.5 line-clamp-1">{row.title}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Current qty display */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400">Item Code</p>
              <p className="font-medium text-gray-800 font-mono">{row.item_code || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Location</p>
              <p className="font-medium text-gray-800">{row.location}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Current Qty</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--ift-navy)' }}>
                {row.qty_available}
              </p>
            </div>
          </div>

          {/* Add Qty input */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {isReduce ? '− Remove Quantity' : '+ Add Quantity'}
            </label>
            <input
              type="number"
              min={1}
              max={isReduce ? row.qty_available : undefined}
              className="input"
              value={addQty}
              onChange={e => setAddQty(e.target.value)}
              placeholder={isReduce ? `Max: ${row.qty_available}` : 'Enter qty to add'}
              autoFocus
            />
          </div>

          {/* New total preview */}
          {newTotal !== null && (
            <div
              className="flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'var(--ift-gold-pale)' }}
            >
              <span className="text-gray-500">{row.qty_available}</span>
              <span className={isReduce ? 'text-red-500 font-bold' : 'text-emerald-600 font-bold'}>
                {isReduce ? `− ${parsedAdd}` : `+ ${parsedAdd}`}
              </span>
              <span className="text-gray-400">=</span>
              <span className="text-lg font-bold" style={{ color: 'var(--ift-navy)' }}>
                {newTotal}
              </span>
              {newTotal < 0 && (
                <span className="text-red-500 text-xs">Cannot go below 0</span>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Reason for Change</label>
            <MovementTypePicker value={movementType} onChange={setMovementType} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Reason for adjustment…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="px-5 pb-5 pt-3 flex gap-3 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || newTotal === null || newTotal < 0}
            className="btn-primary flex-1"
          >
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Transfer Stock Modal ─────────────────────────────────────────────────────

function TransferStockModal({
  row,
  locations,
  userId,
  onClose,
  onSaved,
}: {
  row: StockRow
  locations: LocationOption[]
  userId: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const others = locations.filter(l => l.id !== row.location_id)
  const [toLocationId, setToLocationId] = useState(others[0]?.id ?? '')
  const [qty,          setQty]          = useState('')
  const [notes,        setNotes]        = useState('')
  const [saving,       setSaving]       = useState(false)

  const handleSave = async () => {
    const n = parseInt(qty, 10)
    if (isNaN(n) || n <= 0) { toast.error('Enter a valid qty to transfer'); return }
    if (!toLocationId)       { toast.error('Select a destination location'); return }
    setSaving(true)
    try {
      await transferStockAction({
        materialId:     row.material_id,
        fromLocationId: row.location_id,
        toLocationId,
        qty:            n,
        notes,
        createdBy:      userId,
      })
      toast.success(`Transferred ${n} unit${n > 1 ? 's' : ''}`)
      onSaved()
    } catch (err: any) {
      toast.error(err.message ?? 'Transfer failed')
      setSaving(false)
    }
  }

  if (others.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
          <AlertTriangle size={36} className="mx-auto text-amber-500" />
          <p className="font-semibold text-gray-800">Only one location configured</p>
          <p className="text-sm text-gray-500">Add more locations to enable stock transfers.</p>
          <button onClick={onClose} className="btn-primary w-full">Close</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ background: 'linear-gradient(135deg,#C8922A 0%,#E8A832 100%)' }}
        >
          <div className="text-white">
            <p className="font-bold text-sm">Transfer Stock</p>
            <p className="text-amber-100 text-xs mt-0.5 line-clamp-1">{row.title}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400">From Location</p>
              <p className="font-medium text-gray-800">{row.location}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Available Qty</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--ift-navy)' }}>
                {row.qty_available}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To Location</label>
            <select
              className="input"
              value={toLocationId}
              onChange={e => setToLocationId(e.target.value)}
            >
              {others.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Qty to Transfer</label>
            <input
              type="number"
              min={1}
              max={row.qty_available}
              className="input"
              value={qty}
              onChange={e => setQty(e.target.value)}
              placeholder={`Max: ${row.qty_available}`}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Reason for transfer…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-gold flex-1">
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Transferring…</>
              : <><ArrowLeftRight size={14} /> Transfer</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StockPage() {
  const user = useAuthStore(s => s.user)

  const [rows,         setRows]         = useState<StockRow[]>([])
  const [locations,    setLocations]    = useState<LocationOption[]>([])
  const [loading,      setLoading]      = useState(true)
  const [loadError,    setLoadError]    = useState(false)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [filterLoc,    setFilterLoc]    = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [updateRow,    setUpdateRow]    = useState<StockRow | null>(null)
  const [transferRow,  setTransferRow]  = useState<StockRow | null>(null)
  const [showAddStock, setShowAddStock] = useState(false)

  const load = async () => {
    setLoading(true)
    setLoadError(false)
    const timer = setTimeout(() => { setLoading(false); setLoadError(true) }, 10_000)
    try {
      const supabase = createClient()
      const [{ data: stockData, error: stockErr }, { data: locs, error: locsErr }] = await Promise.all([
        supabase.from('v_stock_summary').select('*').order('title'),
        supabase.from('locations').select('id, name').order('name'),
      ])
      if (stockErr) throw new Error(stockErr.message)
      if (locsErr) throw new Error(locsErr.message)
      setRows(((stockData ?? []) as any[]).map(r => ({
        material_id:   r.material_id   ?? '',
        location_id:   r.location_id   ?? '',
        item_code:     r.item_code     ?? '',
        isbn:          r.isbn          ?? '',
        title:         r.title         ?? '',
        author:        r.author        ?? '',
        category:      r.category      ?? '',
        location:      r.location      ?? '',
        qty_available: Number(r.qty_available ?? r.qty_in_hand ?? 0),
        mrp:           Number(r.mrp           ?? 0),
        purchase_rate: Number(r.purchase_rate  ?? 0),
        stock_value:   Number(r.stock_value   ?? 0),
      })))
      setLocations(((locs ?? []) as any[]).map(l => ({ id: l.id as string, name: l.name as string })))
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load stock data')
    } finally {
      clearTimeout(timer)
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stats (all rows, unfiltered) ─────────────────────────────────────────
  const totalTitles     = useMemo(() => new Set(rows.map(r => r.material_id)).size, [rows])
  const totalUnits      = useMemo(() => rows.reduce((s, r) => s + r.qty_available, 0), [rows])
  const lowStockCount   = useMemo(() => rows.filter(r => r.qty_available > 0 && r.qty_available <= 10).length, [rows])
  const outOfStockCount = useMemo(() => rows.filter(r => r.qty_available === 0).length, [rows])
  const totalValue      = useMemo(() => rows.reduce((s, r) => s + r.stock_value, 0), [rows])

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return rows.filter(r => {
      const matchSearch = !q
        || r.title.toLowerCase().includes(q)
        || r.isbn.toLowerCase().includes(q)
        || r.item_code.toLowerCase().includes(q)
      const matchLoc    = filterLoc === 'all' || r.location_id === filterLoc
      const status      = getStatus(r.qty_available)
      const matchStatus = filterStatus === 'all' || filterStatus === status
      return matchSearch && matchLoc && matchStatus
    })
  }, [rows, searchQuery, filterLoc, filterStatus])

  const filteredValue = useMemo(() => filtered.reduce((s, r) => s + r.stock_value, 0), [filtered])

  const hasFilters = searchQuery || filterLoc !== 'all' || filterStatus !== 'all'

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (filtered.length === 0) return
    exportStockReport(filtered.map(r => ({
      itemCode:     r.item_code,
      isbn:         r.isbn,
      title:        r.title,
      author:       r.author,
      category:     r.category,
      mrp:          r.mrp,
      purchaseRate: r.purchase_rate,
      openingStock: 0,
      qtyIn:        0,
      qtySold:      0,
      currentStock: r.qty_available,
      stockValue:   r.stock_value,
      location:     r.location,
    })))
  }

  const handleSaved = async () => {
    setUpdateRow(null)
    setTransferRow(null)
    await load()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Page heading */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-title">Stock Management</h2>
          <p className="page-sub mt-0.5">Real-time stock levels across all locations</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="btn-outline"
          >
            <Download size={15} />
            Export Excel
          </button>
          <button
            onClick={() => setShowAddStock(true)}
            className="btn-primary"
          >
            <Plus size={15} />
            Add Stock
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <BookOpen size={18} className="text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Total Titles</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--ift-navy)' }}>
                {loading ? '—' : totalTitles.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
              <Package size={18} className="text-violet-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Total Units</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--ift-navy)' }}>
                {loading ? '—' : totalUnits.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-amber-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Low Stock</p>
              <p className="text-2xl font-bold text-amber-600">
                {loading ? '—' : lowStockCount}
              </p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <TrendingDown size={18} className="text-red-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600">
                {loading ? '—' : outOfStockCount}
              </p>
            </div>
          </div>
        </div>

        <div className="stat-card col-span-2 sm:col-span-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <IndianRupee size={18} className="text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Stock Value</p>
              <p className="text-xl font-bold text-emerald-700">
                {loading ? '—' : fmtRupee(totalValue)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Low stock alert banner */}
      {!loading && lowStockCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
          <AlertTriangle size={18} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 flex-1">
            <span className="font-semibold">{lowStockCount} title{lowStockCount > 1 ? 's' : ''}</span>
            {' '}{lowStockCount > 1 ? 'are' : 'is'} running low (≤ 10 units). Consider restocking soon.
          </p>
          <button
            onClick={() => setFilterStatus('low')}
            className="shrink-0 text-xs font-semibold text-amber-700 underline hover:no-underline"
          >
            View
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Search title, ISBN, item code…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="input w-auto min-w-[160px]"
          value={filterLoc}
          onChange={e => setFilterLoc(e.target.value)}
        >
          <option value="all">All Locations</option>
          {locations.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>

        <select
          className="input w-auto min-w-[140px]"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="in_stock">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>

        {hasFilters && (
          <button
            onClick={() => { setSearchQuery(''); setFilterLoc('all'); setFilterStatus('all') }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={12} /> Clear
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400">
          {filtered.length} of {rows.length} items
        </span>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-gray-400 text-sm">
              <Loader2 size={20} className="animate-spin" />
              Loading stock data…
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
              <AlertTriangle size={40} className="text-amber-400" />
              <p className="font-medium text-sm">Failed to load — connection timed out</p>
              <button onClick={load} className="btn-outline text-sm flex items-center gap-2">
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
              <Package size={40} />
              <p className="font-medium text-sm">No stock records found</p>
              {rows.length > 0 && (
                <p className="text-xs">Try adjusting your search or filters</p>
              )}
            </div>
          ) : (
            <table className="table-auto-ift">
              <thead>
                <tr>
                  <th className="mobile-hide">Item Code</th>
                  <th>Title</th>
                  <th className="mobile-hide">Author</th>
                  <th className="mobile-hide">Category</th>
                  <th className="mobile-hide">Location</th>
                  <th className="text-right">Qty Available</th>
                  <th className="text-right mobile-hide">MRP</th>
                  <th className="text-right mobile-hide">Stock Value</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((row, idx) => (
                  <tr key={`${row.material_id}-${row.location_id}-${idx}`}>
                    <td className="mobile-hide">
                      <span className="text-xs font-mono text-gray-500">
                        {row.item_code || '—'}
                      </span>
                    </td>
                    <td>
                      <p className="font-medium text-gray-800 text-sm leading-snug max-w-[200px] line-clamp-2">
                        {row.title}
                      </p>
                      {row.isbn && (
                        <p className="text-[11px] text-gray-400 mt-0.5">{row.isbn}</p>
                      )}
                    </td>
                    <td className="text-sm text-gray-600 mobile-hide">{row.author || '—'}</td>
                    <td className="mobile-hide">
                      {row.category
                        ? <span className="badge-blue">{row.category}</span>
                        : <span className="text-gray-400 text-sm">—</span>
                      }
                    </td>
                    <td className="text-sm text-gray-600 mobile-hide">{row.location}</td>
                    <td className="text-right">
                      <span
                        className="font-bold text-base tabular-nums"
                        style={{
                          color: row.qty_available <= 0
                            ? '#DC2626'
                            : row.qty_available <= 10
                            ? '#D97706'
                            : 'var(--ift-navy)',
                        }}
                      >
                        {row.qty_available}
                      </span>
                    </td>
                    <td className="text-right text-sm text-gray-600 tabular-nums mobile-hide">
                      ₹{row.mrp.toLocaleString('en-IN')}
                    </td>
                    <td className="text-right text-sm font-medium tabular-nums mobile-hide" style={{ color: 'var(--ift-navy)' }}>
                      {fmtRupee(row.stock_value)}
                    </td>
                    <td className="text-center">
                      <StatusBadge qty={row.qty_available} />
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setUpdateRow(row)}
                          className="px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-[#1B2A6B] hover:text-[#1B2A6B] transition-colors"
                          title="Update Stock"
                        >
                          <RefreshCw size={13} />
                        </button>
                        <button
                          onClick={() => setTransferRow(row)}
                          className="px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-[#C8922A] hover:text-[#C8922A] transition-colors"
                          title="Transfer Stock"
                        >
                          <ArrowLeftRight size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot className="border-t-2 border-gray-200 bg-gray-50 mobile-hide">
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-3 text-right text-sm font-semibold text-gray-500"
                  >
                    Total Stock Value ({filtered.length} item{filtered.length !== 1 ? 's' : ''})
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-[15px] tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                    {fmtRupee(filteredValue)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddStock && (
        <AddStockEntryModal
          locations={locations}
          userId={user?.id ?? null}
          onClose={() => setShowAddStock(false)}
          onSaved={() => { setShowAddStock(false); void load() }}
        />
      )}

      {updateRow && (
        <UpdateStockModal
          row={updateRow}
          userId={user?.id ?? null}
          onClose={() => setUpdateRow(null)}
          onSaved={handleSaved}
        />
      )}

      {transferRow && (
        <TransferStockModal
          row={transferRow}
          locations={locations}
          userId={user?.id ?? null}
          onClose={() => setTransferRow(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
