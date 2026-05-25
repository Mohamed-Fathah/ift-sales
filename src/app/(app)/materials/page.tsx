'use client'

export const dynamic = 'force-dynamic'

import React, {
  useState, useEffect, useMemo, useCallback,
  createContext, useContext, useRef,
} from 'react'
import {
  Search, Plus, Upload, Download, Trash2, X,
  Loader2, FileSpreadsheet, AlertTriangle, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { useAuthStore } from '@/store/auth.store'
import { logChange } from '@/lib/audit'
import { exportStockReport } from '@/lib/excel-export'
import { createClient } from '@/lib/supabase/client'
import {
  getStockReportDataAction,
  saveMaterialAction,
  updateMaterialAction,
  archiveMaterialAction,
  bulkImportMaterialsAction,
  type MaterialRow,
  type CategoryOption,
  type SaveMaterialInput,
} from './actions'

// ─── Inline-edit context (avoids nested-component re-mount bug) ───────────────

interface EditCtxType {
  editCell: { id: string; field: string } | null
  editValue: string
  canEdit: boolean
  categories: CategoryOption[]
  onStartEdit: (id: string, field: string, value: string | number) => void
  onSetValue: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onCommit: () => void
}

const EditCtx = createContext<EditCtxType>(null as any)

// ─── Editable text / number cell ─────────────────────────────────────────────

function EC({
  rowId, field, value, type = 'text', align = 'left', className = '',
}: {
  rowId: string; field: string; value: string | number
  type?: 'text' | 'number'; align?: 'left' | 'right'; className?: string
}) {
  const ctx = useContext(EditCtx)
  const isEditing = ctx.editCell?.id === rowId && ctx.editCell?.field === field

  if (isEditing) {
    return (
      <input
        autoFocus
        type={type}
        step={type === 'number' ? '0.01' : undefined}
        value={ctx.editValue}
        onChange={e => ctx.onSetValue(e.target.value)}
        onKeyDown={ctx.onKeyDown}
        onBlur={ctx.onCommit}
        className={`w-full px-2 py-0.5 text-sm rounded border border-blue-400 ring-2 ring-blue-200 outline-none tabular-nums ${align === 'right' ? 'text-right' : ''} ${className}`}
      />
    )
  }

  const display = value !== '' && value !== null && value !== undefined
    ? String(value)
    : null

  return (
    <span
      onClick={() => ctx.canEdit && ctx.onStartEdit(rowId, field, value)}
      title={ctx.canEdit ? 'Click to edit' : undefined}
      className={`block truncate rounded px-1 py-0.5 -mx-1 transition-colors
        ${ctx.canEdit ? 'cursor-pointer hover:bg-blue-50 hover:text-blue-800' : ''}
        ${align === 'right' ? 'text-right tabular-nums' : ''}
        ${className}`}
    >
      {display ?? <span className="text-gray-300 italic text-xs">—</span>}
    </span>
  )
}

// ─── Category select cell ─────────────────────────────────────────────────────

function SC({ rowId, field, value, label }: {
  rowId: string; field: string; value: string; label: string
}) {
  const ctx = useContext(EditCtx)
  const isEditing = ctx.editCell?.id === rowId && ctx.editCell?.field === field

  if (isEditing) {
    return (
      <select
        autoFocus
        value={ctx.editValue}
        onChange={e => ctx.onSetValue(e.target.value)}
        onKeyDown={ctx.onKeyDown}
        onBlur={ctx.onCommit}
        className="w-full px-2 py-0.5 text-sm rounded border border-blue-400 ring-2 ring-blue-200 outline-none"
      >
        <option value="">— None —</option>
        {ctx.categories.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    )
  }

  return (
    <span
      onClick={() => ctx.canEdit && ctx.onStartEdit(rowId, field, value)}
      title={ctx.canEdit ? 'Click to edit' : undefined}
      className={`block truncate rounded px-1 py-0.5 -mx-1 transition-colors
        ${ctx.canEdit ? 'cursor-pointer hover:bg-blue-50 hover:text-blue-800' : ''}`}
    >
      {label || <span className="text-gray-300 italic text-xs">—</span>}
    </span>
  )
}

// ─── Stock badge ──────────────────────────────────────────────────────────────

function StockBadge({ qty }: { qty: number }) {
  if (qty === 0)  return <span className="badge badge-red">0</span>
  if (qty <= 10)  return <span className="badge badge-yellow">{qty}</span>
  return                 <span className="badge badge-green">{qty}</span>
}

// ─── Add Book modal ───────────────────────────────────────────────────────────

function AddBookModal({
  categories,
  onClose,
  onSave,
}: {
  categories: CategoryOption[]
  onClose: () => void
  onSave: (data: SaveMaterialInput) => Promise<void>
}) {
  const [form, setForm] = useState<SaveMaterialInput>({
    item_code: '', isbn: '', title: '', author: '',
    category_id: '', mrp: 0, purchase_rate: 0, discount_pct: 0,
    publication: 'Islamic Foundation Trust', initial_stock: 0,
  })
  const [saving, setSaving] = useState(false)
  const [errs, setErrs] = useState<Record<string, string>>({})

  const f = <K extends keyof SaveMaterialInput>(k: K, v: SaveMaterialInput[K]) =>
    setForm(p => ({ ...p, [k]: v }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.item_code.trim()) e.item_code = 'Required'
    if (!form.title.trim())     e.title     = 'Required'
    if (!form.mrp || form.mrp <= 0) e.mrp   = 'Must be > 0'
    return e
  }

  const submit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrs(e); return }
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg,#1B2A6B 0%,#2D3F8F 100%)' }}
        >
          <p className="font-bold text-white">Add New Book</p>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[68vh]">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Item Code *</label>
              <input
                className={`input ${errs.item_code ? 'input-error' : ''}`}
                value={form.item_code}
                onChange={e => f('item_code', e.target.value)}
                placeholder="IFT-001"
              />
              {errs.item_code && <p className="text-red-500 text-xs mt-1">{errs.item_code}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">ISBN</label>
              <input
                className="input"
                value={form.isbn}
                onChange={e => f('isbn', e.target.value)}
                placeholder="978-…"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
            <input
              className={`input ${errs.title ? 'input-error' : ''}`}
              value={form.title}
              onChange={e => f('title', e.target.value)}
              placeholder="Book title"
            />
            {errs.title && <p className="text-red-500 text-xs mt-1">{errs.title}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Author</label>
            <input
              className="input"
              value={form.author}
              onChange={e => f('author', e.target.value)}
              placeholder="Author name"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select
              className="input"
              value={form.category_id}
              onChange={e => f('category_id', e.target.value)}
            >
              <option value="">— Select category —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">MRP (₹) *</label>
              <input
                type="number" min={0} step={0.01}
                className={`input ${errs.mrp ? 'input-error' : ''}`}
                value={form.mrp || ''}
                onChange={e => f('mrp', parseFloat(e.target.value) || 0)}
              />
              {errs.mrp && <p className="text-red-500 text-xs mt-1">{errs.mrp}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Purchase Rate</label>
              <input
                type="number" min={0} step={0.01}
                className="input"
                value={form.purchase_rate || ''}
                onChange={e => f('purchase_rate', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Discount %</label>
              <input
                type="number" min={0} max={100} step={0.1}
                className="input"
                value={form.discount_pct || ''}
                onChange={e => f('discount_pct', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Publication</label>
            <input
              className="input"
              value={form.publication ?? ''}
              onChange={e => f('publication', e.target.value)}
              placeholder="Islamic Foundation Trust"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Initial Stock</label>
            <input
              type="number" min={0} step={1}
              className="input"
              value={form.initial_stock || ''}
              onChange={e => f('initial_stock', parseInt(e.target.value) || 0)}
              placeholder="0"
            />
            <p className="text-xs text-gray-400 mt-1">Added to default location on save</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-outline">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Add Book'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Import preview modal ─────────────────────────────────────────────────────

function ImportModal({
  rawRows,
  categories,
  onClose,
  onImport,
}: {
  rawRows: Record<string, any>[]
  categories: CategoryOption[]
  onClose: () => void
  onImport: (rows: SaveMaterialInput[]) => Promise<void>
}) {
  const [importing, setImporting] = useState(false)

  const catByName = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories) m.set(c.name.toLowerCase().trim(), c.id)
    return m
  }, [categories])

  const parsed = useMemo<SaveMaterialInput[]>(() =>
    rawRows.map(r => ({
      item_code:     String(r.item_code     ?? ''),
      isbn:          String(r.isbn          ?? ''),
      title:         String(r.title         ?? ''),
      author:        String(r.author        ?? ''),
      category_id:   catByName.get(String(r.category ?? '').toLowerCase().trim()) ?? '',
      mrp:           Number(r.mrp)           || 0,
      purchase_rate: Number(r.purchase_rate) || 0,
      discount_pct:  Number(r.discount_pct)  || 0,
    })).filter(r => r.title.trim()),
  [rawRows, catByName])

  const noCode = parsed.filter(r => !r.item_code).length

  const run = async () => {
    setImporting(true)
    try {
      await onImport(parsed)
      onClose()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg,#1B2A6B 0%,#2D3F8F 100%)' }}
        >
          <div className="text-white">
            <p className="font-bold">Excel Import Preview</p>
            <p className="text-blue-200 text-xs">{parsed.length} rows ready to import</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Preview table */}
        <div className="max-h-96 overflow-auto">
          <table className="table-auto-ift">
            <thead className="sticky top-0">
              <tr>
                <th className="w-8">#</th>
                <th className="w-24">Item Code</th>
                <th className="w-32">ISBN</th>
                <th>Title</th>
                <th className="w-32">Author</th>
                <th className="w-20 text-right">MRP</th>
                <th className="w-24 text-right">Rate</th>
              </tr>
            </thead>
            <tbody>
              {parsed.slice(0, 100).map((r, i) => (
                <tr key={i}>
                  <td className="text-gray-400 text-xs">{i + 1}</td>
                  <td className="font-mono text-xs">{r.item_code || <span className="text-amber-500">—</span>}</td>
                  <td className="font-mono text-xs">{r.isbn || '—'}</td>
                  <td className="max-w-xs truncate font-medium">{r.title}</td>
                  <td className="truncate">{r.author || '—'}</td>
                  <td className="text-right tabular-nums">₹{r.mrp.toFixed(2)}</td>
                  <td className="text-right tabular-nums">₹{r.purchase_rate.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {parsed.length > 100 && (
            <p className="text-center text-xs text-gray-400 py-3">
              …and {parsed.length - 100} more rows not shown
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-4">
          <div className="text-xs text-gray-500">
            {noCode > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertTriangle size={12} />
                {noCode} row{noCode > 1 ? 's' : ''} have no item code — will be inserted without a code
              </span>
            )}
          </div>
          <div className="flex gap-3 shrink-0">
            <button onClick={onClose} className="btn-outline">Cancel</button>
            <button
              onClick={run}
              disabled={importing || parsed.length === 0}
              className="btn-primary"
            >
              {importing
                ? <><Loader2 size={14} className="animate-spin" /> Importing…</>
                : `Import ${parsed.length} Books`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MaterialsPage() {
  const user = useAuthStore(s => s.user)
  const can  = useAuthStore(s => s.can)

  // Zustand persist reads localStorage synchronously on the client, causing a
  // server/client mismatch for any can() call that gates structural rendering.
  // Gate all permission-dependent JSX behind `mounted` so the first client
  // render matches the server render exactly.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const [rows,         setRows]         = useState<MaterialRow[]>([])
  const [categories,   setCategories]   = useState<CategoryOption[]>([])
  const [isLoading,    setIsLoading]    = useState(true)
  const [loadError,    setLoadError]    = useState(false)
  const [search,          setSearch]          = useState('')
  const [showInactive,    setShowInactive]    = useState(false)
  const [filterCategory,  setFilterCategory]  = useState('')

  // Modals
  const [showAdd,    setShowAdd]    = useState(false)
  const [importRaw,  setImportRaw]  = useState<Record<string, any>[]>([])
  const [showImport, setShowImport] = useState(false)

  // Inline edit
  const [editCell,  setEditCell]  = useState<{ id: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  // Delete / deactivate confirmations
  const [deleteId,      setDeleteId]      = useState<string | null>(null)
  const [isDeleting,    setIsDeleting]    = useState(false)
  const [deactivateRow, setDeactivateRow] = useState<MaterialRow | null>(null)

  // Busy flags
  const [isExporting,  setIsExporting]  = useState(false)

  // ── Load ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    const timer = setTimeout(() => { setIsLoading(false); setLoadError(true) }, 10_000)
    try {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('materials')
        .select(`
          *,
          categories(name),
          stock(qty_in_hand, location_id)
        `)
        .eq('is_active', true)
        .order('item_code')

      console.log('Materials query result:', data, error)
      if (error) console.error('Materials error:', error)
      if (error) throw new Error(error.message)

      const { data: cats, error: catsErr } = await supabase
        .from('categories')
        .select('id, name')
        .order('name')
      if (catsErr) throw new Error(catsErr.message)

      setRows(((data ?? []) as any[]).map(m => ({
        id:            m.id,
        item_code:     m.item_code    ?? '',
        isbn:          m.isbn         ?? '',
        title:         m.title        ?? '',
        author:        m.author       ?? '',
        category_id:   m.category_id  ?? '',
        category:      (m.categories as any)?.name ?? '',
        mrp:           Number(m.mrp           ?? 0),
        purchase_rate: Number(m.purchase_rate  ?? 0),
        discount_pct:  Number(m.discount_pct   ?? 0),
        is_active:     Boolean(m.is_active     ?? true),
        stock:         ((m.stock ?? []) as any[]).reduce(
                         (s: number, row: any) => s + Number(row.qty_in_hand ?? 0), 0
                       ),
      })))
      setCategories((cats ?? []) as CategoryOption[])
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      clearTimeout(timer)
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Filtered list ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (!showInactive && !r.is_active) return false
      if (filterCategory && r.category_id !== filterCategory) return false
      if (!q) return true
      return (
        r.title.toLowerCase().includes(q)     ||
        r.author.toLowerCase().includes(q)    ||
        r.item_code.toLowerCase().includes(q) ||
        r.isbn.toLowerCase().includes(q)      ||
        r.category.toLowerCase().includes(q)
      )
    })
  }, [rows, search, showInactive, filterCategory])

  // ── Inline edit handlers ────────────────────────────────────────────────
  const startEdit = useCallback((id: string, field: string, value: string | number) => {
    setEditCell({ id, field })
    setEditValue(String(value))
  }, [])

  const cancelEdit = useCallback(() => setEditCell(null), [])

  const commitEdit = useCallback(async () => {
    const cell = editCell   // capture before any state change
    if (!cell || !user) { setEditCell(null); return }

    const row = rows.find(r => r.id === cell.id)
    if (!row) { setEditCell(null); return }

    setEditCell(null)   // clear immediately so next click works

    let newValue: string | number = editValue
    if (['mrp', 'purchase_rate', 'discount_pct'].includes(cell.field)) {
      newValue = parseFloat(editValue) || 0
    }

    if (String((row as any)[cell.field]) === String(newValue)) return

    const oldData: Record<string, unknown> = { [cell.field]: (row as any)[cell.field] }
    const newData: Record<string, unknown> = { [cell.field]: newValue }

    // Optimistic: update row + resolve category display name for category_id
    let patch: Partial<MaterialRow> = { [cell.field]: newValue }
    if (cell.field === 'category_id') {
      patch = { category_id: newValue as string, category: categories.find(c => c.id === newValue)?.name ?? '' }
    }
    setRows(prev => prev.map(r => r.id === cell.id ? { ...r, ...patch } : r))

    try {
      await updateMaterialAction(cell.id, { [cell.field]: newValue })
      await logChange({
        tableName: 'materials',
        recordId: cell.id,
        action: 'UPDATE',
        oldData,
        newData,
        userId: user.id,
        userName: user.full_name,
      })
      toast.success('Saved')
    } catch (err: any) {
      toast.error(err.message)
      setRows(prev => prev.map(r => r.id === cell.id ? { ...r, ...oldData } : r))
    }
  }, [editCell, editValue, rows, user, categories])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter')  { e.preventDefault(); commitEdit() }
    if (e.key === 'Escape') cancelEdit()
  }, [commitEdit, cancelEdit])

  // ── Status toggle ───────────────────────────────────────────────────────
  const toggleActive = useCallback(async (row: MaterialRow) => {
    if (!can('manage_materials') || !user) return
    const next = !row.is_active
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, is_active: next } : r))
    try {
      await updateMaterialAction(row.id, { is_active: next })
      await logChange({
        tableName: 'materials',
        recordId: row.id,
        action: 'UPDATE',
        oldData: { is_active: row.is_active },
        newData: { is_active: next },
        userId: user.id,
        userName: user.full_name,
      })
    } catch (err: any) {
      toast.error(err.message)
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, is_active: !next } : r))
    }
  }, [can, user])

  // ── Add book ────────────────────────────────────────────────────────────
  const handleAdd = useCallback(async (data: SaveMaterialInput) => {
    if (!user) return
    const { id } = await saveMaterialAction(data)
    await logChange({
      tableName: 'materials',
      recordId: id,
      action: 'INSERT',
      newData: data as unknown as Record<string, unknown>,
      userId: user.id,
      userName: user.full_name,
    })
    toast.success('Book added')
    await load()
  }, [user, load])

  // ── Archive / delete ────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!deleteId || !user) return
    const row = rows.find(r => r.id === deleteId)
    setIsDeleting(true)
    try {
      await archiveMaterialAction(deleteId)
      await logChange({
        tableName: 'materials',
        recordId: deleteId,
        action: 'DELETE',
        oldData: row as unknown as Record<string, unknown>,
        userId: user.id,
        userName: user.full_name,
      })
      setRows(prev => prev.filter(r => r.id !== deleteId))
      toast.success('Book archived')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }, [deleteId, rows, user])

  // ── Excel import ────────────────────────────────────────────────────────
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const wb  = XLSX.read(ev.target?.result, { type: 'array' })
        const ws  = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' })

        // Normalise column names (case-insensitive, space/underscore flexible)
        const normalise = (r: Record<string, any>): Record<string, any> => {
          const alias: Record<string, string> = {
            'item code': 'item_code', 'itemcode': 'item_code',
            'isbn': 'isbn',
            'title': 'title',
            'author': 'author',
            'category': 'category',
            'mrp': 'mrp',
            'purchase rate': 'purchase_rate', 'purchaserate': 'purchase_rate', 'rate': 'purchase_rate',
            'discount%': 'discount_pct', 'discount': 'discount_pct', 'disc%': 'discount_pct',
          }
          const out: Record<string, any> = {}
          for (const [k, v] of Object.entries(r)) {
            const norm = alias[k.toLowerCase().trim().replace(/_/g, ' ')] ?? k.toLowerCase().trim()
            out[norm] = v
          }
          return out
        }

        const mapped = raw.map(normalise).filter(r => String(r.title ?? '').trim())
        if (!mapped.length) { toast.error('No valid rows found in the Excel file'); return }

        setImportRaw(mapped)
        setShowImport(true)
      } catch {
        toast.error('Failed to parse Excel file')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleBulkImport = useCallback(async (parsedRows: SaveMaterialInput[]) => {
    if (!user) return
    const { inserted, errors } = await bulkImportMaterialsAction(parsedRows, user.id, user.full_name)
    if (errors.length) {
      toast.error(`Imported ${inserted} books — ${errors.length} batch error(s)`)
    } else {
      toast.success(`${inserted} books imported`)
    }
    await load()
  }, [user, load])

  // ── Export stock report ─────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    setIsExporting(true)
    try {
      const data = await getStockReportDataAction()
      exportStockReport(data)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsExporting(false)
    }
  }, [])

  // ── Edit context value ──────────────────────────────────────────────────
  const editCtxValue = useMemo<EditCtxType>(() => ({
    editCell,
    editValue,
    canEdit: mounted && can('manage_materials'),
    categories,
    onStartEdit: startEdit,
    onSetValue:  setEditValue,
    onKeyDown:   handleKeyDown,
    onCommit:    commitEdit,
  }), [editCell, editValue, mounted, can, categories, startEdit, handleKeyDown, commitEdit])

  // ── Derived counts ──────────────────────────────────────────────────────
  const activeCount = rows.filter(r => r.is_active).length

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <EditCtx.Provider value={editCtxValue}>
      <div className="flex flex-col h-full gap-5">

        {/* ── Page header ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="page-title">Materials</h2>
            <p className="page-sub mt-0.5">
              Book catalog — {activeCount} active title{activeCount !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Export */}
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="btn-outline"
            >
              {isExporting
                ? <Loader2 size={15} className="animate-spin" />
                : <Download size={15} />}
              Stock Report
            </button>

            {mounted && can('manage_materials') && (
              <>
                {/* Import Excel */}
                <label className="btn-outline cursor-pointer">
                  <Upload size={15} />
                  Import Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleImportFile}
                  />
                </label>

                {/* Add Book */}
                <button onClick={() => setShowAdd(true)} className="btn-primary">
                  <Plus size={15} />
                  Add Book
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Search / filter bar ───────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              className="input pl-9 pr-8"
              placeholder="Search title, author, ISBN, item code…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <select
            className="input w-auto min-w-[160px]"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show inactive
          </label>

          <p className="text-xs text-gray-400 ml-auto">
            {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
          </p>
        </div>

        {/* ── Table card ────────────────────────────────────────────────── */}
        <div className="card p-0 flex-1 overflow-hidden flex flex-col min-h-0">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center gap-2 text-gray-400">
              <Loader2 size={20} className="animate-spin" />
              Loading materials…
            </div>
          ) : loadError ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
              <AlertTriangle size={40} className="text-amber-400" />
              <p className="font-medium text-sm">Failed to load — connection timed out</p>
              <button onClick={load} className="btn-outline text-sm flex items-center gap-2">
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-300 py-20">
              <FileSpreadsheet size={44} />
              <p className="text-sm font-medium text-gray-400">
                {search ? 'No books match your search' : 'No materials yet'}
              </p>
              {mounted && can('manage_materials') && !search && (
                <button onClick={() => setShowAdd(true)} className="btn-primary mt-2">
                  <Plus size={15} /> Add First Book
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="table-auto-ift">
                <thead className="sticky top-0 z-10 bg-gray-50">
                  <tr>
                    <th className="w-24 mobile-hide">Item Code</th>
                    <th className="w-32 mobile-hide">ISBN</th>
                    <th>Title</th>
                    <th className="w-36 mobile-hide">Author</th>
                    <th className="w-28 mobile-hide">Category</th>
                    <th className="w-20 text-right mobile-hide">MRP</th>
                    <th className="w-24 text-right mobile-hide">Purch. Rate</th>
                    <th className="w-16 text-center mobile-hide">Disc%</th>
                    <th className="w-20 text-center">Stock</th>
                    <th className="w-20 text-center">Status</th>
                    {mounted && can('manage_materials') && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => (
                    <tr
                      key={row.id}
                      className={`group ${!row.is_active ? 'opacity-50' : ''}`}
                    >
                      {/* Item Code — read-only */}
                      <td className="mobile-hide">
                        <span className="font-mono text-xs text-gray-500">
                          {row.item_code || '—'}
                        </span>
                      </td>

                      {/* ISBN */}
                      <td className="mobile-hide">
                        <EC rowId={row.id} field="isbn" value={row.isbn} className="font-mono text-xs" />
                      </td>

                      {/* Title */}
                      <td className="max-w-xs">
                        <EC rowId={row.id} field="title" value={row.title} className="font-medium" />
                      </td>

                      {/* Author */}
                      <td className="mobile-hide">
                        <EC rowId={row.id} field="author" value={row.author} />
                      </td>

                      {/* Category */}
                      <td className="mobile-hide">
                        <SC
                          rowId={row.id}
                          field="category_id"
                          value={row.category_id}
                          label={row.category}
                        />
                      </td>

                      {/* MRP */}
                      <td className="mobile-hide">
                        <EC rowId={row.id} field="mrp" value={row.mrp} type="number" align="right" />
                      </td>

                      {/* Purchase Rate */}
                      <td className="mobile-hide">
                        <EC rowId={row.id} field="purchase_rate" value={row.purchase_rate} type="number" align="right" />
                      </td>

                      {/* Discount % */}
                      <td className="text-center mobile-hide">
                        <EC rowId={row.id} field="discount_pct" value={row.discount_pct} type="number" align="right" />
                      </td>

                      {/* Stock */}
                      <td className="text-center">
                        <StockBadge qty={row.stock} />
                      </td>

                      {/* Status toggle */}
                      <td className="text-center">
                        <button
                          onClick={() => {
                            if (!mounted || !can('manage_materials')) return
                            row.is_active ? setDeactivateRow(row) : toggleActive(row)
                          }}
                          disabled={!mounted || !can('manage_materials')}
                          title={row.is_active ? 'Click to deactivate' : 'Click to activate'}
                          className="disabled:cursor-default"
                        >
                          {row.is_active
                            ? <span className="badge badge-green">Active</span>
                            : <span className="badge badge-red">Inactive</span>}
                        </button>
                      </td>

                      {/* Delete */}
                      {mounted && can('manage_materials') && (
                        <td>
                          <button
                            onClick={() => setDeleteId(row.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors p-1"
                            title="Archive book"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Deactivate confirm dialog ─────────────────────────────────── */}
        {deactivateRow && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 shrink-0 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Deactivate this book?</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {deactivateRow.title}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-5">
                It will be hidden from billing and the catalog. You can reactivate it at any time.
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setDeactivateRow(null)} className="btn-outline">
                  Cancel
                </button>
                <button
                  onClick={() => { toggleActive(deactivateRow); setDeactivateRow(null) }}
                  className="btn text-white focus:ring-amber-400"
                  style={{ background: '#D97706' }}
                >
                  Deactivate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Archive confirm dialog ─────────────────────────────────────── */}
        {deleteId && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 shrink-0 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-red-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Archive this book?</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {rows.find(r => r.id === deleteId)?.title}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-5">
                The book will be hidden from billing and search. All historical sales records are preserved.
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setDeleteId(null)} className="btn-outline">
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="btn text-white focus:ring-red-400"
                  style={{ background: '#DC2626' }}
                >
                  {isDeleting
                    ? <><Loader2 size={14} className="animate-spin" /> Archiving…</>
                    : 'Archive'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Add Book modal ─────────────────────────────────────────────── */}
        {showAdd && (
          <AddBookModal
            categories={categories}
            onClose={() => setShowAdd(false)}
            onSave={handleAdd}
          />
        )}

        {/* ── Import preview modal ───────────────────────────────────────── */}
        {showImport && (
          <ImportModal
            rawRows={importRaw}
            categories={categories}
            onClose={() => { setShowImport(false); setImportRaw([]) }}
            onImport={handleBulkImport}
          />
        )}

      </div>
    </EditCtx.Provider>
  )
}
