'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Search, Plus, Pencil, Trash2, X,
  Loader2, AlertTriangle, Download,
  IndianRupee, Calendar, Tag,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format, isToday, isThisWeek, isThisMonth, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { exportToExcel } from '@/lib/excel-export'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpenseCategory {
  id: string
  name: string
}

interface ExpenseRow {
  id: string
  expense_date: string
  category_id: string
  category_name: string
  description: string
  amount: number
  payment_mode: string
  paid_to: string
  location: string
  notes: string
  created_at: string
}

interface ExpenseForm {
  expense_date: string
  category_id: string
  description: string
  amount: number
  payment_mode: string
  paid_to: string
  location: string
  notes: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque']

const EMPTY_FORM: ExpenseForm = {
  expense_date: new Date().toISOString().slice(0, 10),
  category_id:  '',
  description:  '',
  amount:       0,
  payment_mode: 'Cash',
  paid_to:      '',
  location:     '',
  notes:        '',
}

const MODE_BADGE: Record<string, string> = {
  'Cash':          'badge-green',
  'UPI':           'badge-blue',
  'Bank Transfer': 'badge-yellow',
  'Cheque':        'badge-gray',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtRupee(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function fmtDate(d: string) {
  try { return format(parseISO(d), 'dd MMM yyyy') } catch { return d }
}

function safeParseISO(d: string) {
  try { return parseISO(d) } catch { return new Date(0) }
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

function ExpenseModal({
  expense,
  categories,
  onClose,
  onSaved,
}: {
  expense: ExpenseRow | null
  categories: ExpenseCategory[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = expense !== null

  const [form, setForm] = useState<ExpenseForm>(
    expense
      ? {
          expense_date: expense.expense_date,
          category_id:  expense.category_id,
          description:  expense.description,
          amount:       expense.amount,
          payment_mode: expense.payment_mode,
          paid_to:      expense.paid_to,
          location:     expense.location,
          notes:        expense.notes,
        }
      : { ...EMPTY_FORM }
  )
  const [saving, setSaving] = useState(false)
  const [errs, setErrs] = useState<Record<string, string>>({})

  const set = <K extends keyof ExpenseForm>(key: K, val: ExpenseForm[K]) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.expense_date)       e.expense_date = 'Required'
    if (!form.category_id)        e.category_id  = 'Required'
    if (!form.description.trim()) e.description  = 'Required'
    if (!form.amount || form.amount <= 0) e.amount = 'Must be > 0'
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrs(e); return }
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = {
        expense_date: form.expense_date,
        category_id:  form.category_id,
        description:  form.description.trim(),
        amount:       form.amount,
        payment_mode: form.payment_mode,
        paid_to:      form.paid_to.trim()  || null,
        location:     form.location.trim() || null,
        notes:        form.notes.trim()    || null,
      }
      if (isEdit) {
        const { error } = await supabase.from('expenses').update(payload).eq('id', expense.id)
        if (error) throw new Error(error.message)
        toast.success('Expense updated')
      } else {
        const { error } = await supabase.from('expenses').insert(payload)
        if (error) throw new Error(error.message)
        toast.success('Expense added')
      }
      onSaved()
    } catch (err: any) {
      toast.error(err.message ?? 'Save failed')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[94vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ background: 'linear-gradient(135deg,#1B2A6B 0%,#2D3F8F 100%)' }}
        >
          <p className="font-bold text-white">{isEdit ? 'Edit Expense' : 'Add Expense'}</p>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                className={`input ${errs.expense_date ? 'input-error' : ''}`}
                value={form.expense_date}
                onChange={e => set('expense_date', e.target.value)}
              />
              {errs.expense_date && <p className="text-red-500 text-xs mt-1">{errs.expense_date}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Category <span className="text-red-400">*</span>
              </label>
              <select
                className={`input ${errs.category_id ? 'input-error' : ''}`}
                value={form.category_id}
                onChange={e => set('category_id', e.target.value)}
              >
                <option value="">— Select —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errs.category_id && <p className="text-red-500 text-xs mt-1">{errs.category_id}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Description <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              autoFocus={!isEdit}
              className={`input ${errs.description ? 'input-error' : ''}`}
              placeholder="What was this expense for?"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
            {errs.description && <p className="text-red-500 text-xs mt-1">{errs.description}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Amount (₹) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                className={`input ${errs.amount ? 'input-error' : ''}`}
                placeholder="0.00"
                value={form.amount || ''}
                onChange={e => set('amount', parseFloat(e.target.value) || 0)}
              />
              {errs.amount && <p className="text-red-500 text-xs mt-1">{errs.amount}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment Mode</label>
              <select
                className="input"
                value={form.payment_mode}
                onChange={e => set('payment_mode', e.target.value)}
              >
                {PAYMENT_MODES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Paid To</label>
              <input
                type="text"
                className="input"
                placeholder="Vendor / person name"
                value={form.paid_to}
                onChange={e => set('paid_to', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
              <input
                type="text"
                className="input"
                placeholder="Branch / location"
                value={form.location}
                onChange={e => set('location', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Any additional notes…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
          <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
              : isEdit ? 'Save Changes' : 'Add Expense'
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function ConfirmDelete({
  expense,
  onConfirm,
  onCancel,
  deleting,
}: {
  expense: ExpenseRow
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={22} className="text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Delete Expense</p>
            <p className="text-xs text-gray-400 mt-0.5">This cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Delete{' '}
          <span className="font-semibold text-gray-800">{expense.description}</span>
          {' — '}
          <span className="font-semibold text-red-600">{fmtRupee(expense.amount)}</span>?
        </p>
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel} className="btn-outline flex-1">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="btn flex-1 text-white"
            style={{ background: deleting ? '#fca5a5' : '#ef4444' }}
          >
            {deleting
              ? <><Loader2 size={14} className="animate-spin" /> Deleting…</>
              : 'Delete'
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [rows,         setRows]         = useState<ExpenseRow[]>([])
  const [categories,   setCategories]   = useState<ExpenseCategory[]>([])
  const [loading,      setLoading]      = useState(true)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [filterCat,    setFilterCat]    = useState('all')
  const [filterMode,   setFilterMode]   = useState('all')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const [showModal,    setShowModal]    = useState(false)
  const [editExpense,  setEditExpense]  = useState<ExpenseRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRow | null>(null)
  const [deleting,     setDeleting]     = useState(false)

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const [
        { data: expenses, error: expErr },
        { data: cats,     error: catErr },
      ] = await Promise.all([
        supabase
          .from('expenses')
          .select('*, expense_categories(name)')
          .order('expense_date', { ascending: false })
          .order('created_at',   { ascending: false }),
        supabase
          .from('expense_categories')
          .select('id, name')
          .order('name'),
      ])
      if (expErr) throw new Error(expErr.message)
      if (catErr) throw new Error(catErr.message)

      setRows(((expenses ?? []) as any[]).map(r => ({
        id:            r.id,
        expense_date:  r.expense_date  ?? '',
        category_id:   r.category_id   ?? '',
        category_name: (r.expense_categories as any)?.name ?? '',
        description:   r.description   ?? '',
        amount:        Number(r.amount  ?? 0),
        payment_mode:  r.payment_mode  ?? 'Cash',
        paid_to:       r.paid_to       ?? '',
        location:      r.location      ?? '',
        notes:         r.notes         ?? '',
        created_at:    r.created_at    ?? '',
      })))
      setCategories((cats ?? []) as ExpenseCategory[])
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Summary stats ─────────────────────────────────────────────────────────
  const todayTotal = useMemo(() =>
    rows
      .filter(r => isToday(safeParseISO(r.expense_date)))
      .reduce((s, r) => s + r.amount, 0),
  [rows])

  const weekTotal = useMemo(() =>
    rows
      .filter(r => isThisWeek(safeParseISO(r.expense_date), { weekStartsOn: 1 }))
      .reduce((s, r) => s + r.amount, 0),
  [rows])

  const monthTotal = useMemo(() =>
    rows
      .filter(r => isThisMonth(safeParseISO(r.expense_date)))
      .reduce((s, r) => s + r.amount, 0),
  [rows])

  const topCategories = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>()
    for (const r of rows) {
      if (!isThisMonth(safeParseISO(r.expense_date))) continue
      const prev = map.get(r.category_id)
      if (prev) { prev.total += r.amount }
      else { map.set(r.category_id, { name: r.category_name || 'Uncategorised', total: r.amount }) }
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 4)
  }, [rows])

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return rows.filter(r => {
      const matchSearch = !q
        || r.description.toLowerCase().includes(q)
        || r.category_name.toLowerCase().includes(q)
        || r.paid_to.toLowerCase().includes(q)
        || r.location.toLowerCase().includes(q)
      const matchCat  = filterCat  === 'all' || r.category_id  === filterCat
      const matchMode = filterMode === 'all' || r.payment_mode === filterMode
      const matchFrom = !dateFrom || r.expense_date >= dateFrom
      const matchTo   = !dateTo   || r.expense_date <= dateTo
      return matchSearch && matchCat && matchMode && matchFrom && matchTo
    })
  }, [rows, searchQuery, filterCat, filterMode, dateFrom, dateTo])

  const filteredTotal = useMemo(
    () => filtered.reduce((s, r) => s + r.amount, 0),
    [filtered]
  )

  const hasFilters = searchQuery || filterCat !== 'all' || filterMode !== 'all' || dateFrom || dateTo

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!filtered.length) return
    exportToExcel([{
      name: 'Expenses',
      headers: ['Date', 'Category', 'Description', 'Amount (₹)', 'Payment Mode', 'Paid To', 'Location', 'Notes'],
      rows: filtered.map(r => [
        r.expense_date, r.category_name, r.description,
        r.amount, r.payment_mode, r.paid_to, r.location, r.notes,
      ]),
      colWidths: [12, 18, 32, 13, 14, 22, 16, 28],
    }], 'IFT_Expenses')
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('expenses').delete().eq('id', deleteTarget.id)
      if (error) throw new Error(error.message)
      toast.success('Expense deleted')
      setDeleteTarget(null)
      await load()
    } catch (err: any) {
      toast.error(err.message ?? 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const openAdd    = () => { setEditExpense(null); setShowModal(true) }
  const openEdit   = (r: ExpenseRow) => { setEditExpense(r); setShowModal(true) }
  const handleSaved = async () => { setShowModal(false); await load() }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Heading */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Expenses</h2>
          <p className="page-sub mt-0.5">Track and manage all operating expenses</p>
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
          <button onClick={openAdd} className="btn-primary">
            <Plus size={16} />
            Add Expense
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">

        {/* Today */}
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <IndianRupee size={18} className="text-red-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Today</p>
              <p className="text-xl font-bold text-red-600 tabular-nums">
                {loading ? '—' : fmtRupee(todayTotal)}
              </p>
            </div>
          </div>
        </div>

        {/* This week */}
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <Calendar size={18} className="text-amber-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">This Week</p>
              <p className="text-xl font-bold text-amber-600 tabular-nums">
                {loading ? '—' : fmtRupee(weekTotal)}
              </p>
            </div>
          </div>
        </div>

        {/* This month */}
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(27,42,107,0.08)' }}
            >
              <IndianRupee size={18} style={{ color: 'var(--ift-navy)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">This Month</p>
              <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                {loading ? '—' : fmtRupee(monthTotal)}
              </p>
            </div>
          </div>
        </div>

        {/* Top categories this month */}
        <div className="stat-card">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: 'rgba(200,146,42,0.12)' }}
            >
              <Tag size={18} style={{ color: 'var(--ift-gold)' }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 mb-1.5">By Category (month)</p>
              {loading ? (
                <p className="text-sm text-gray-400">—</p>
              ) : topCategories.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No data this month</p>
              ) : (
                <div className="space-y-1">
                  {topCategories.map(c => (
                    <div key={c.name} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-600 truncate">{c.name}</span>
                      <span
                        className="text-xs font-semibold tabular-nums shrink-0"
                        style={{ color: 'var(--ift-navy)' }}
                      >
                        {fmtRupee(c.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Search description, category, paid to…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="input w-auto min-w-[150px]"
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
        >
          <option value="all">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          className="input w-auto min-w-[140px]"
          value={filterMode}
          onChange={e => setFilterMode(e.target.value)}
        >
          <option value="all">All Modes</option>
          {PAYMENT_MODES.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <input
            type="date"
            className="input w-auto"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            title="From date"
          />
          <span className="text-gray-400 text-sm shrink-0">to</span>
          <input
            type="date"
            className="input w-auto"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            title="To date"
          />
        </div>

        {hasFilters && (
          <button
            onClick={() => {
              setSearchQuery('')
              setFilterCat('all')
              setFilterMode('all')
              setDateFrom('')
              setDateTo('')
            }}
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
              Loading expenses…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
              <IndianRupee size={40} />
              <p className="font-medium text-sm">
                {rows.length === 0 ? 'No expenses recorded yet' : 'No expenses match your filters'}
              </p>
              {rows.length === 0 && (
                <button onClick={openAdd} className="btn-primary text-sm">
                  <Plus size={14} /> Add First Expense
                </button>
              )}
            </div>
          ) : (
            <table className="table-auto-ift">
              <thead>
                <tr>
                  <th className="w-28">Date</th>
                  <th className="w-36">Category</th>
                  <th>Description</th>
                  <th className="w-32 text-right">Amount</th>
                  <th className="w-32">Payment Mode</th>
                  <th className="w-36">Paid To</th>
                  <th className="w-28">Location</th>
                  <th className="w-20 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap text-sm text-gray-600">
                      {fmtDate(row.expense_date)}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{ background: 'rgba(27,42,107,0.08)', color: 'var(--ift-navy)' }}
                      >
                        {row.category_name || '—'}
                      </span>
                    </td>
                    <td className="max-w-[220px]">
                      <p className="font-medium text-gray-800 text-sm truncate">{row.description}</p>
                      {row.notes && (
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{row.notes}</p>
                      )}
                    </td>
                    <td className="text-right">
                      <span className="font-bold text-sm tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                        {fmtRupee(row.amount)}
                      </span>
                    </td>
                    <td>
                      <span className={MODE_BADGE[row.payment_mode] ?? 'badge-gray'}>
                        {row.payment_mode}
                      </span>
                    </td>
                    <td className="text-sm text-gray-600 max-w-[140px] truncate">
                      {row.paid_to || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="text-sm text-gray-600">
                      {row.location || <span className="text-gray-300">—</span>}
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEdit(row)}
                          className="px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-[#1B2A6B] hover:text-[#1B2A6B] transition-colors"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(row)}
                          className="px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-red-400 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-3 text-right text-sm font-semibold text-gray-500"
                  >
                    Total ({filtered.length} expense{filtered.length !== 1 ? 's' : ''})
                  </td>
                  <td
                    className="px-4 py-3 text-right font-bold text-[15px] tabular-nums"
                    style={{ color: 'var(--ift-navy)' }}
                  >
                    {fmtRupee(filteredTotal)}
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Add / Edit modal */}
      {showModal && (
        <ExpenseModal
          key={editExpense?.id ?? 'new'}
          expense={editExpense}
          categories={categories}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDelete
          expense={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

    </div>
  )
}
