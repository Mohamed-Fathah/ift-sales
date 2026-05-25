'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Download, Loader2, ShoppingCart, PackageOpen,
  IndianRupee, TrendingUp, TrendingDown,
  BookOpen, Boxes, Receipt, X,
  AlertTriangle, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format, subDays, parseISO } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import {
  exportToExcel,
  exportSalesReport,
  exportStockReport,
  exportPurchaseReport,
} from '@/lib/excel-export'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'sales' | 'stock' | 'purchases' | 'expenses'

interface SalesRow {
  id: string
  invoice_no: string
  invoice_date: string
  customer_name: string
  customer_phone: string
  payment_mode: string
  subtotal_mrp: number
  discount_amount: number
  total_amount: number
  status: string
  created_by: string
}

interface StockRow {
  material_id: string
  location_id: string
  item_code: string
  isbn: string
  title: string
  author: string
  category: string
  location: string
  qty_available: number
  mrp: number
  purchase_rate: number
  stock_value: number
}

interface PurchaseRow {
  id: string
  invoice_no: string
  invoice_date: string
  supplier_name: string
  supplier_inv_no: string
  total_amount: number
  paid_amount: number
  balance_due: number
  status: string
}

interface ExpenseRow {
  id: string
  expense_date: string
  category_name: string
  description: string
  amount: number
  payment_mode: string
  paid_to: string
  location: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtRupee(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function fmtDate(d: string) {
  try { return format(parseISO(d), 'dd MMM yyyy') } catch { return d }
}

function today()   { return format(new Date(), 'yyyy-MM-dd') }
function daysAgo(n: number) { return format(subDays(new Date(), n), 'yyyy-MM-dd') }

// ─── Shared sub-components ────────────────────────────────────────────────────

function StatCard({
  icon, iconBg, label, value, valueColor, sub,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: string
  valueColor?: string
  sub?: string
}) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{label}</p>
          <p
            className="text-xl font-bold tabular-nums leading-tight mt-0.5"
            style={{ color: valueColor ?? 'var(--ift-navy)' }}
          >
            {value}
          </p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

function DateRange({
  from, to, onFrom, onTo, onClear,
}: {
  from: string; to: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
  onClear: () => void
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-gray-500">Period</span>
      <input
        type="date"
        className="input w-auto text-sm"
        value={from}
        onChange={e => onFrom(e.target.value)}
      />
      <span className="text-gray-400 text-sm">to</span>
      <input
        type="date"
        className="input w-auto text-sm"
        value={to}
        onChange={e => onTo(e.target.value)}
      />
      <button
        onClick={onClear}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        <X size={12} /> Reset
      </button>
    </div>
  )
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
      {icon}
      <p className="text-sm font-medium">{label}</p>
    </div>
  )
}

// ─── Custom chart tooltip ─────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {fmtRupee(p.value)}
        </p>
      ))}
    </div>
  )
}

// ─── Status badge helper ──────────────────────────────────────────────────────

const STATUS_CLASS: Record<string, string> = {
  paid:      'badge-green',
  confirmed: 'badge-blue',
  draft:     'badge-gray',
  partial:   'badge-yellow',
  cancelled: 'badge-red',
}

// ═══════════════════════════════════════════════════════════════════════════════
// SALES TAB
// ═══════════════════════════════════════════════════════════════════════════════

function SalesTab() {
  const [rows,      setRows]      = useState<SalesRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [from,      setFrom]      = useState('')
  const [to,        setTo]        = useState('')

  useEffect(() => {
    setFrom(daysAgo(29))
    setTo(today())
  }, [])

  const load = useCallback(async () => {
    if (!from || !to) return
    setLoading(true)
    setLoadError(false)
    const timer = setTimeout(() => { setLoading(false); setLoadError(true) }, 10_000)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('sales_invoices')
        .select('id, invoice_no, invoice_date, customer_name, customer_phone, payment_mode, subtotal_mrp, discount_amount, total_amount, status, created_by')
        .gte('invoice_date', from)
        .lte('invoice_date', to)
        .order('invoice_date', { ascending: false })
      if (error) throw new Error(error.message)
      setRows(((data ?? []) as any[]).map(r => ({
        id:              r.id,
        invoice_no:      r.invoice_no      ?? '',
        invoice_date:    r.invoice_date    ?? '',
        customer_name:   r.customer_name   ?? '',
        customer_phone:  r.customer_phone  ?? '',
        payment_mode:    r.payment_mode    ?? '',
        subtotal_mrp:    Number(r.subtotal_mrp    ?? 0),
        discount_amount: Number(r.discount_amount ?? 0),
        total_amount:    Number(r.total_amount    ?? 0),
        status:          r.status          ?? '',
        created_by:      r.created_by      ?? '',
      })))
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load sales')
    } finally {
      clearTimeout(timer)
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { void load() }, [load])

  // ── Stats ────────────────────────────────────────────────────────────────
  const totalRevenue  = useMemo(() => rows.reduce((s, r) => s + r.total_amount,    0), [rows])
  const totalDiscount = useMemo(() => rows.reduce((s, r) => s + r.discount_amount, 0), [rows])
  const totalMrp      = useMemo(() => rows.reduce((s, r) => s + r.subtotal_mrp,    0), [rows])
  const avgBill       = useMemo(() => rows.length ? totalRevenue / rows.length : 0, [rows, totalRevenue])

  // ── Daily chart data ─────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      map.set(r.invoice_date, (map.get(r.invoice_date) ?? 0) + r.total_amount)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({
        date:    format(parseISO(date), 'dd MMM'),
        Revenue: revenue,
      }))
  }, [rows])

  // ── Export ───────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!rows.length) return
    exportSalesReport(rows.map(r => ({
      invoiceNo:    r.invoice_no,
      date:         r.invoice_date,
      customerName: r.customer_name  || '—',
      customerPhone:r.customer_phone || '—',
      items:        0,
      grossMrp:     r.subtotal_mrp,
      discount:     r.discount_amount,
      netAmount:    r.total_amount,
      paymentMode:  r.payment_mode,
      location:     '',
      createdBy:    r.created_by,
    })))
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <DateRange
          from={from} to={to}
          onFrom={setFrom} onTo={setTo}
          onClear={() => { setFrom(daysAgo(29)); setTo(today()) }}
        />
        <button onClick={handleExport} disabled={!rows.length} className="btn-outline">
          <Download size={15} /> Export Excel
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={<IndianRupee size={18} className="text-emerald-600" />}
          iconBg="bg-emerald-50"
          label="Net Revenue"
          value={loading ? '—' : fmtRupee(totalRevenue)}
          valueColor="#059669"
          sub={`${rows.length} bill${rows.length !== 1 ? 's' : ''}`}
        />
        <StatCard
          icon={<ShoppingCart size={18} className="text-blue-600" />}
          iconBg="bg-blue-50"
          label="Gross MRP"
          value={loading ? '—' : fmtRupee(totalMrp)}
        />
        <StatCard
          icon={<TrendingDown size={18} className="text-amber-500" />}
          iconBg="bg-amber-50"
          label="Total Discount"
          value={loading ? '—' : fmtRupee(totalDiscount)}
          valueColor="#D97706"
        />
        <StatCard
          icon={<TrendingUp size={18} style={{ color: 'var(--ift-gold)' }} />}
          iconBg=""
          label="Avg Bill Value"
          value={loading ? '—' : fmtRupee(avgBill)}
        />
      </div>

      {/* Chart */}
      {!loading && chartData.length > 0 && (
        <div className="card">
          <p className="text-sm font-semibold text-gray-700 mb-4">Daily Revenue</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="Revenue" fill="#1B2A6B" radius={[4, 4, 0, 0]} maxBarSize={40} minPointSize={3} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
              <Loader2 size={18} className="animate-spin" /> Loading sales…
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <AlertTriangle size={36} className="text-amber-400" />
              <p className="font-medium text-sm">Failed to load — connection timed out</p>
              <button onClick={load} className="btn-outline text-sm flex items-center gap-2">
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={<ShoppingCart size={36} />} label="No sales in this period" />
          ) : (
            <table className="table-auto-ift">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Payment</th>
                  <th className="text-right">Gross MRP</th>
                  <th className="text-right">Discount</th>
                  <th className="text-right">Net Amount</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className="font-semibold text-sm" style={{ color: 'var(--ift-navy)' }}>
                      {r.invoice_no}
                    </td>
                    <td className="text-sm text-gray-600 whitespace-nowrap">{fmtDate(r.invoice_date)}</td>
                    <td>
                      <p className="text-sm text-gray-800">{r.customer_name || <span className="text-gray-400 italic">Walk-in</span>}</p>
                      {r.customer_phone && <p className="text-[11px] text-gray-400">{r.customer_phone}</p>}
                    </td>
                    <td><span className="badge-blue">{r.payment_mode}</span></td>
                    <td className="text-right text-sm text-gray-600 tabular-nums">{fmtRupee(r.subtotal_mrp)}</td>
                    <td className="text-right text-sm text-amber-600 tabular-nums">{fmtRupee(r.discount_amount)}</td>
                    <td className="text-right font-bold text-sm tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                      {fmtRupee(r.total_amount)}
                    </td>
                    <td className="text-center">
                      <span className={STATUS_CLASS[r.status] ?? 'badge-gray'}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right text-sm font-semibold text-gray-500">
                    Total ({rows.length} bills)
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-700">{fmtRupee(totalMrp)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-amber-600">{fmtRupee(totalDiscount)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums" style={{ color: 'var(--ift-navy)' }}>{fmtRupee(totalRevenue)}</td>
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

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK TAB
// ═══════════════════════════════════════════════════════════════════════════════

function StockTab() {
  const [rows,      setRows]      = useState<StockRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search,    setSearch]    = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    const timer = setTimeout(() => { setLoading(false); setLoadError(true) }, 10_000)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('v_stock_summary')
        .select('*')
        .order('title')
      if (error) throw new Error(error.message)
      setRows(((data ?? []) as any[]).map(r => ({
        material_id:  r.material_id  ?? '',
        location_id:  r.location_id  ?? '',
        item_code:    r.item_code    ?? '',
        isbn:         r.isbn         ?? '',
        title:        r.title        ?? '',
        author:       r.author       ?? '',
        category:     r.category     ?? '',
        location:     r.location     ?? '',
        qty_available:Number(r.qty_available ?? r.qty_in_hand ?? 0),
        mrp:          Number(r.mrp           ?? 0),
        purchase_rate:Number(r.purchase_rate ?? 0),
        stock_value:  Number(r.stock_value   ?? 0),
      })))
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load stock')
    } finally {
      clearTimeout(timer)
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return q
      ? rows.filter(r =>
          r.title.toLowerCase().includes(q) ||
          r.item_code.toLowerCase().includes(q) ||
          r.isbn.toLowerCase().includes(q) ||
          r.author.toLowerCase().includes(q)
        )
      : rows
  }, [rows, search])

  const totalTitles  = useMemo(() => new Set(rows.map(r => r.material_id)).size, [rows])
  const totalUnits   = useMemo(() => rows.reduce((s, r) => s + r.qty_available, 0), [rows])
  const outOfStock   = useMemo(() => rows.filter(r => r.qty_available === 0).length, [rows])
  const totalValue   = useMemo(() => rows.reduce((s, r) => s + r.stock_value, 0), [rows])

  const handleExport = () => {
    if (!filtered.length) return
    exportStockReport(filtered.map(r => ({
      itemCode: r.item_code, isbn: r.isbn, title: r.title,
      author: r.author, category: r.category,
      mrp: r.mrp, purchaseRate: r.purchase_rate,
      openingStock: 0, qtyIn: 0, qtySold: 0,
      currentStock: r.qty_available, stockValue: r.stock_value,
      location: r.location,
    })))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="relative">
          <input
            type="text"
            className="input pl-8 w-64 text-sm"
            placeholder="Search title, item code, ISBN…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <button onClick={handleExport} disabled={!filtered.length} className="btn-outline">
          <Download size={15} /> Export Excel
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={<BookOpen size={18} className="text-blue-600" />}
          iconBg="bg-blue-50"
          label="Total Titles"
          value={loading ? '—' : totalTitles.toLocaleString('en-IN')}
        />
        <StatCard
          icon={<Boxes size={18} className="text-violet-600" />}
          iconBg="bg-violet-50"
          label="Total Units"
          value={loading ? '—' : totalUnits.toLocaleString('en-IN')}
        />
        <StatCard
          icon={<AlertTriangle size={18} className="text-red-500" />}
          iconBg="bg-red-50"
          label="Out of Stock"
          value={loading ? '—' : String(outOfStock)}
          valueColor="#dc2626"
        />
        <StatCard
          icon={<IndianRupee size={18} className="text-emerald-600" />}
          iconBg="bg-emerald-50"
          label="Stock Value"
          value={loading ? '—' : fmtRupee(totalValue)}
          valueColor="#059669"
        />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
              <Loader2 size={18} className="animate-spin" /> Loading stock…
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <AlertTriangle size={36} className="text-amber-400" />
              <p className="font-medium text-sm">Failed to load — connection timed out</p>
              <button onClick={load} className="btn-outline text-sm flex items-center gap-2">
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Boxes size={36} />} label="No stock records" />
          ) : (
            <table className="table-auto-ift">
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Title</th>
                  <th>Author</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">MRP</th>
                  <th className="text-right">Stock Value</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={`${r.material_id}-${r.location_id}-${i}`}>
                    <td className="font-mono text-xs text-gray-500">{r.item_code || '—'}</td>
                    <td className="max-w-[200px]">
                      <p className="font-medium text-sm text-gray-800 truncate">{r.title}</p>
                      {r.isbn && <p className="text-[11px] text-gray-400">{r.isbn}</p>}
                    </td>
                    <td className="text-sm text-gray-600">{r.author || '—'}</td>
                    <td>
                      {r.category
                        ? <span className="badge-blue">{r.category}</span>
                        : <span className="text-gray-400 text-sm">—</span>}
                    </td>
                    <td className="text-sm text-gray-600">{r.location}</td>
                    <td className="text-right">
                      <span
                        className="font-bold text-base tabular-nums"
                        style={{
                          color: r.qty_available <= 0 ? '#dc2626'
                               : r.qty_available <= 10 ? '#d97706'
                               : 'var(--ift-navy)',
                        }}
                      >
                        {r.qty_available}
                      </span>
                    </td>
                    <td className="text-right text-sm text-gray-600 tabular-nums">{fmtRupee(r.mrp)}</td>
                    <td className="text-right text-sm font-medium tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                      {fmtRupee(r.stock_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={7} className="px-4 py-3 text-right text-sm font-semibold text-gray-500">
                    Total ({filtered.length} rows)
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                    {fmtRupee(filtered.reduce((s, r) => s + r.stock_value, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASES TAB
// ═══════════════════════════════════════════════════════════════════════════════

function PurchasesTab() {
  const [rows,      setRows]      = useState<PurchaseRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [from,      setFrom]      = useState('')
  const [to,        setTo]        = useState('')

  useEffect(() => {
    setFrom(daysAgo(29))
    setTo(today())
  }, [])

  const load = useCallback(async () => {
    if (!from || !to) return
    setLoading(true)
    setLoadError(false)
    const timer = setTimeout(() => { setLoading(false); setLoadError(true) }, 10_000)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('purchase_invoices')
        .select('id, invoice_no, invoice_date, supplier_inv_no, total_amount, paid_amount, balance_due, status, parties!supplier_id(name)')
        .gte('invoice_date', from)
        .lte('invoice_date', to)
        .order('invoice_date', { ascending: false })
      if (error) throw new Error(error.message)
      setRows(((data ?? []) as any[]).map(r => ({
        id:              r.id,
        invoice_no:      r.invoice_no     ?? '',
        invoice_date:    r.invoice_date   ?? '',
        supplier_name:   (r.parties as any)?.name ?? 'Unknown',
        supplier_inv_no: r.supplier_inv_no ?? '',
        total_amount:    Number(r.total_amount  ?? 0),
        paid_amount:     Number(r.paid_amount   ?? 0),
        balance_due:     Number(r.balance_due   ?? 0),
        status:          r.status         ?? 'draft',
      })))
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load purchases')
    } finally {
      clearTimeout(timer)
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { void load() }, [load])

  const totalValue   = useMemo(() => rows.reduce((s, r) => s + r.total_amount, 0), [rows])
  const totalPaid    = useMemo(() => rows.reduce((s, r) => s + r.paid_amount,  0), [rows])
  const totalBalance = useMemo(() => rows.reduce((s, r) => s + r.balance_due,  0), [rows])

  const handleExport = () => {
    if (!rows.length) return
    exportPurchaseReport(rows.map(r => ({
      invoiceNo:   r.invoice_no,
      date:        r.invoice_date,
      supplier:    r.supplier_name,
      invoiceRef:  r.supplier_inv_no,
      items:       0,
      subtotal:    r.total_amount,
      transport:   0,
      unloading:   0,
      totalAmount: r.total_amount,
      paid:        r.paid_amount,
      balance:     r.balance_due,
      status:      r.status,
    })))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <DateRange
          from={from} to={to}
          onFrom={setFrom} onTo={setTo}
          onClear={() => { setFrom(daysAgo(29)); setTo(today()) }}
        />
        <button onClick={handleExport} disabled={!rows.length} className="btn-outline">
          <Download size={15} /> Export Excel
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={<PackageOpen size={18} className="text-blue-600" />}
          iconBg="bg-blue-50"
          label="Invoices"
          value={loading ? '—' : String(rows.length)}
          sub="in period"
        />
        <StatCard
          icon={<IndianRupee size={18} style={{ color: 'var(--ift-navy)' }} />}
          iconBg=""
          label="Total Value"
          value={loading ? '—' : fmtRupee(totalValue)}
        />
        <StatCard
          icon={<TrendingUp size={18} className="text-emerald-600" />}
          iconBg="bg-emerald-50"
          label="Total Paid"
          value={loading ? '—' : fmtRupee(totalPaid)}
          valueColor="#059669"
        />
        <StatCard
          icon={<TrendingDown size={18} className="text-red-500" />}
          iconBg="bg-red-50"
          label="Balance Due"
          value={loading ? '—' : fmtRupee(totalBalance)}
          valueColor={totalBalance > 0 ? '#dc2626' : undefined}
        />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
              <Loader2 size={18} className="animate-spin" /> Loading purchases…
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <AlertTriangle size={36} className="text-amber-400" />
              <p className="font-medium text-sm">Failed to load — connection timed out</p>
              <button onClick={load} className="btn-outline text-sm flex items-center gap-2">
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={<PackageOpen size={36} />} label="No purchase invoices in this period" />
          ) : (
            <table className="table-auto-ift">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Supplier Ref</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Balance</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className="font-semibold text-sm" style={{ color: 'var(--ift-navy)' }}>
                      {r.invoice_no}
                    </td>
                    <td className="text-sm text-gray-600 whitespace-nowrap">{fmtDate(r.invoice_date)}</td>
                    <td className="text-sm font-medium text-gray-800">{r.supplier_name}</td>
                    <td className="text-sm text-gray-500">{r.supplier_inv_no || '—'}</td>
                    <td className="text-right font-bold text-sm tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                      {fmtRupee(r.total_amount)}
                    </td>
                    <td className="text-right text-sm text-emerald-600 tabular-nums font-medium">
                      {fmtRupee(r.paid_amount)}
                    </td>
                    <td className="text-right text-sm tabular-nums font-semibold"
                        style={{ color: r.balance_due > 0 ? '#dc2626' : '#9ca3af' }}>
                      {fmtRupee(r.balance_due)}
                    </td>
                    <td className="text-center">
                      <span className={STATUS_CLASS[r.status] ?? 'badge-gray'}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right text-sm font-semibold text-gray-500">
                    Total ({rows.length} invoices)
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums" style={{ color: 'var(--ift-navy)' }}>{fmtRupee(totalValue)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-600">{fmtRupee(totalPaid)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-red-600">{fmtRupee(totalBalance)}</td>
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

// ═══════════════════════════════════════════════════════════════════════════════
// EXPENSES TAB
// ═══════════════════════════════════════════════════════════════════════════════

function ExpensesTab() {
  const [rows,      setRows]      = useState<ExpenseRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [from,      setFrom]      = useState('')
  const [to,        setTo]        = useState('')

  useEffect(() => {
    setFrom(daysAgo(29))
    setTo(today())
  }, [])

  const load = useCallback(async () => {
    if (!from || !to) return
    setLoading(true)
    setLoadError(false)
    const timer = setTimeout(() => { setLoading(false); setLoadError(true) }, 10_000)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('expenses')
        .select('id, expense_date, description, amount, payment_mode, paid_to, expense_categories(name)')
        .gte('expense_date', from)
        .lte('expense_date', to)
        .order('expense_date', { ascending: false })
      if (error) throw new Error(error.message)
      setRows(((data ?? []) as any[]).map(r => ({
        id:            r.id,
        expense_date:  r.expense_date  ?? '',
        category_name: (r.expense_categories as any)?.name ?? '',
        description:   r.description   ?? '',
        amount:        Number(r.amount  ?? 0),
        payment_mode:  r.payment_mode  ?? '',
        paid_to:       r.paid_to       ?? '',
        location:      '',
      })))
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load expenses')
    } finally {
      clearTimeout(timer)
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { void load() }, [load])

  const total     = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows])

  // Top categories
  const byCat = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      const k = r.category_name || 'Uncategorised'
      map.set(k, (map.get(k) ?? 0) + r.amount)
    }
    return [...map.entries()].sort(([, a], [, b]) => b - a)
  }, [rows])

  const topCat   = byCat[0]
  const cashTotal = useMemo(() => rows.filter(r => r.payment_mode === 'Cash').reduce((s, r) => s + r.amount, 0), [rows])
  const upiTotal  = useMemo(() => rows.filter(r => r.payment_mode === 'UPI').reduce((s, r)  => s + r.amount, 0), [rows])

  // Chart: expenses by category
  const chartData = useMemo(() =>
    byCat.slice(0, 8).map(([name, amount]) => ({ name: name.length > 14 ? name.slice(0, 13) + '…' : name, amount })),
  [byCat])

  const handleExport = () => {
    if (!rows.length) return
    exportToExcel([{
      name: 'Expenses',
      headers: ['Date', 'Category', 'Description', 'Amount (₹)', 'Payment Mode', 'Paid To', 'Location'],
      rows: rows.map(r => [r.expense_date, r.category_name, r.description, r.amount, r.payment_mode, r.paid_to, r.location]),
      colWidths: [12, 18, 32, 13, 14, 22, 16],
    }], 'IFT_Expenses_Report')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <DateRange
          from={from} to={to}
          onFrom={setFrom} onTo={setTo}
          onClear={() => { setFrom(daysAgo(29)); setTo(today()) }}
        />
        <button onClick={handleExport} disabled={!rows.length} className="btn-outline">
          <Download size={15} /> Export Excel
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={<IndianRupee size={18} className="text-red-500" />}
          iconBg="bg-red-50"
          label="Total Expenses"
          value={loading ? '—' : fmtRupee(total)}
          valueColor="#dc2626"
          sub={`${rows.length} entries`}
        />
        <StatCard
          icon={<Receipt size={18} className="text-emerald-600" />}
          iconBg="bg-emerald-50"
          label="Cash Payments"
          value={loading ? '—' : fmtRupee(cashTotal)}
        />
        <StatCard
          icon={<Receipt size={18} className="text-blue-600" />}
          iconBg="bg-blue-50"
          label="UPI Payments"
          value={loading ? '—' : fmtRupee(upiTotal)}
        />
        <StatCard
          icon={<TrendingUp size={18} style={{ color: 'var(--ift-gold)' }} />}
          iconBg=""
          label="Top Category"
          value={loading || !topCat ? '—' : fmtRupee(topCat[1])}
          sub={topCat?.[0]}
        />
      </div>

      {/* Category breakdown chart */}
      {!loading && chartData.length > 0 && (
        <div className="card">
          <p className="text-sm font-semibold text-gray-700 mb-4">Expenses by Category</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                width={90}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="amount" name="Amount" fill="#C8922A" radius={[0, 4, 4, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
              <Loader2 size={18} className="animate-spin" /> Loading expenses…
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <AlertTriangle size={36} className="text-amber-400" />
              <p className="font-medium text-sm">Failed to load — connection timed out</p>
              <button onClick={load} className="btn-outline text-sm flex items-center gap-2">
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={<Receipt size={36} />} label="No expenses in this period" />
          ) : (
            <table className="table-auto-ift">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th className="text-right">Amount</th>
                  <th>Payment Mode</th>
                  <th>Paid To</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className="text-sm text-gray-600 whitespace-nowrap">{fmtDate(r.expense_date)}</td>
                    <td>
                      <span className="badge" style={{ background: 'rgba(27,42,107,0.08)', color: 'var(--ift-navy)' }}>
                        {r.category_name || '—'}
                      </span>
                    </td>
                    <td className="text-sm text-gray-800 max-w-[200px] truncate">{r.description}</td>
                    <td className="text-right font-bold text-sm tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                      {fmtRupee(r.amount)}
                    </td>
                    <td>
                      <span className={
                        r.payment_mode === 'Cash'          ? 'badge-green'  :
                        r.payment_mode === 'UPI'           ? 'badge-blue'   :
                        r.payment_mode === 'Bank Transfer' ? 'badge-yellow' : 'badge-gray'
                      }>{r.payment_mode}</span>
                    </td>
                    <td className="text-sm text-gray-600">{r.paid_to || <span className="text-gray-300">—</span>}</td>
                    <td className="text-sm text-gray-600">{r.location || <span className="text-gray-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-gray-500">
                    Total ({rows.length} entries)
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums" style={{ color: 'var(--ift-navy)' }}>
                    {fmtRupee(total)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'sales',     label: 'Sales',     icon: <ShoppingCart size={16} /> },
  { id: 'stock',     label: 'Stock',     icon: <Boxes size={16} /> },
  { id: 'purchases', label: 'Purchases', icon: <PackageOpen size={16} /> },
  { id: 'expenses',  label: 'Expenses',  icon: <Receipt size={16} /> },
]

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('sales')

  return (
    <div className="space-y-5">

      {/* Page heading */}
      <div>
        <h2 className="page-title">Reports</h2>
        <p className="page-sub mt-0.5">Analytics and data exports across all modules</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white shadow-sm text-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            style={activeTab === tab.id ? { color: 'var(--ift-navy)' } : {}}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — each tab manages its own data & loading */}
      {activeTab === 'sales'     && <SalesTab />}
      {activeTab === 'stock'     && <StockTab />}
      {activeTab === 'purchases' && <PurchasesTab />}
      {activeTab === 'expenses'  && <ExpensesTab />}

    </div>
  )
}
