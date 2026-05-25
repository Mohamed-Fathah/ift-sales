export const dynamic = 'force-dynamic'

import {
  IndianRupee, ShoppingCart, BookOpen,
  AlertTriangle, TrendingDown, TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

async function getDashboardStats() {
  try {
    const supabase = createAdminClient()

    const todayISO     = new Date().toISOString().slice(0, 10)           // 'YYYY-MM-DD'
    const tomorrowISO  = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

    const [
      { data: invoices },
      { data: stockRows },
      { data: org },
    ] = await Promise.all([
      supabase
        .from('sales_invoices')
        .select('id, total_amount, balance_due')
        .gte('invoice_date', todayISO)
        .lt('invoice_date', tomorrowISO)
        .neq('status', 'cancelled'),
      supabase
        .from('v_stock_summary')
        .select('material_id, qty_available'),
      supabase
        .from('organizations')
        .select('low_stock_threshold')
        .limit(1)
        .maybeSingle(),
    ])

    // Books sold today: query items for today's invoice IDs
    const invoiceIds = (invoices ?? []).map((i: any) => i.id as string)
    const { data: items } = invoiceIds.length
      ? await supabase
          .from('sales_invoice_items')
          .select('qty')
          .in('invoice_id', invoiceIds)
      : { data: [] }

    const threshold   = Number((org as any)?.low_stock_threshold ?? 10)
    const revenue     = (invoices ?? []).reduce((s: number, r: any) => s + Number(r.total_amount  ?? 0), 0)
    const billsCount  = (invoices ?? []).length
    const booksSold   = (items    ?? []).reduce((s: number, r: any) => s + Number(r.qty           ?? 0), 0)
    const receivables = (invoices ?? []).reduce((s: number, r: any) => s + Number(r.balance_due   ?? 0), 0)

    // Count unique materials where total stock is > 0 but below threshold
    const matQty = new Map<string, number>()
    for (const r of (stockRows ?? [])) {
      const id = (r as any).material_id as string
      matQty.set(id, (matQty.get(id) ?? 0) + Number((r as any).qty_available ?? 0))
    }
    const lowStockTitles  = [...matQty.values()].filter(q => q > 0 && q < threshold).length
    const outOfStockTitles = [...matQty.values()].filter(q => q <= 0).length

    return { revenue, billsCount, booksSold, lowStockTitles, outOfStockTitles, receivables, threshold }
  } catch (e) {
    console.error('[Dashboard] stats error:', e)
    return { revenue: 0, billsCount: 0, booksSold: 0, lowStockTitles: 0, outOfStockTitles: 0, receivables: 0, threshold: 10 }
  }
}

function fmtRupee(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export default async function DashboardPage() {
  const stats = await getDashboardStats()

  const STATS = [
    {
      label:      "Today's Revenue",
      value:      fmtRupee(stats.revenue),
      sub:        'Across all confirmed sales today',
      icon:       <IndianRupee size={20} />,
      iconBg:     'bg-emerald-50',
      iconColor:  'text-emerald-600',
      href:       '/billing',
    },
    {
      label:      'Bills Today',
      value:      String(stats.billsCount),
      sub:        'Invoices raised today',
      icon:       <ShoppingCart size={20} />,
      iconBg:     'bg-blue-50',
      iconColor:  'text-blue-600',
      href:       '/billing',
    },
    {
      label:      'Books Sold Today',
      value:      String(stats.booksSold),
      sub:        'Units sold across all bills',
      icon:       <BookOpen size={20} />,
      iconBg:     'bg-violet-50',
      iconColor:  'text-violet-600',
      href:       '/billing',
    },
    {
      label:      'Low Stock Titles',
      value:      String(stats.lowStockTitles),
      sub:        `Titles below ${stats.threshold}-unit threshold`,
      icon:       <AlertTriangle size={20} />,
      iconBg:     'bg-amber-50',
      iconColor:  'text-amber-600',
      href:       '/stock',
      alert:      stats.lowStockTitles > 0,
    },
    {
      label:      'Out of Stock',
      value:      String(stats.outOfStockTitles),
      sub:        'Titles with zero units',
      icon:       <TrendingDown size={20} />,
      iconBg:     'bg-red-50',
      iconColor:  'text-red-500',
      href:       '/stock',
      alert:      stats.outOfStockTitles > 0,
    },
    {
      label:      'Receivables Today',
      value:      fmtRupee(stats.receivables),
      sub:        'Balance due on today\'s bills',
      icon:       <TrendingUp size={20} />,
      iconBg:     'bg-teal-50',
      iconColor:  'text-teal-600',
      href:       '/accounts/outstandings',
    },
  ]

  return (
    <div className="space-y-6">

      <div>
        <h2 className="page-title">Dashboard</h2>
        <p className="page-sub mt-0.5">Overview for today</p>
      </div>

      {/* Low-stock alert banner */}
      {(stats.lowStockTitles > 0 || stats.outOfStockTitles > 0) && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
          <AlertTriangle size={18} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 flex-1">
            {stats.outOfStockTitles > 0 && (
              <span className="font-semibold">{stats.outOfStockTitles} title{stats.outOfStockTitles > 1 ? 's' : ''} out of stock</span>
            )}
            {stats.outOfStockTitles > 0 && stats.lowStockTitles > 0 && ' · '}
            {stats.lowStockTitles > 0 && (
              <span className="font-semibold">{stats.lowStockTitles} title{stats.lowStockTitles > 1 ? 's' : ''} running low</span>
            )}
            {' '}— consider restocking soon.
          </p>
          <Link href="/stock" className="shrink-0 text-xs font-semibold text-amber-700 underline hover:no-underline">
            View Stock
          </Link>
        </div>
      )}

      {/* 6 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {STATS.map((s) => (
          <Link
            key={s.label}
            href={(s as any).href ?? '#'}
            className={`stat-card flex items-start gap-4 hover:shadow-md transition-shadow ${(s as any).alert ? 'ring-2 ring-amber-200' : ''}`}
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${s.iconBg} ${s.iconColor}`}>
              {s.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</p>
              <p className={`text-2xl font-bold mt-0.5 leading-none ${(s as any).alert ? 'text-amber-600' : 'text-gray-900'}`}>
                {s.value}
              </p>
              <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Welcome banner */}
      <div
        className="rounded-xl p-6 text-white"
        style={{ background: 'linear-gradient(135deg, #1B2A6B 0%, #2D3F8F 100%)' }}
      >
        <p className="text-lg font-semibold">Islamic Foundation Trust — ERP</p>
        <p className="text-blue-200 text-sm mt-1">Chennai · All data is live from the database</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {['Billing', 'Materials', 'Stock', 'Purchases', 'Parties', 'Accounts', 'Reports'].map((m) => (
            <span key={m} className="px-3 py-1 rounded-full bg-white/10 text-blue-100">{m}</span>
          ))}
        </div>
      </div>

    </div>
  )
}
