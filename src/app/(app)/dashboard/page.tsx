import {
  IndianRupee, ShoppingCart, BookOpen,
  AlertTriangle, TrendingDown, TrendingUp,
} from 'lucide-react'

interface StatCard {
  label:    string
  value:    string
  sub:      string
  icon:     React.ReactNode
  iconBg:   string
  iconColor: string
  trend?:   string
}

const STATS: StatCard[] = [
  {
    label:     "Today's Revenue",
    value:     '₹0',
    sub:       'Across all sales today',
    icon:      <IndianRupee size={20} />,
    iconBg:    'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  {
    label:     'Bills Today',
    value:     '0',
    sub:       'Invoices raised today',
    icon:      <ShoppingCart size={20} />,
    iconBg:    'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    label:     'Books Sold',
    value:     '0',
    sub:       'Units sold today',
    icon:      <BookOpen size={20} />,
    iconBg:    'bg-violet-50',
    iconColor: 'text-violet-600',
  },
  {
    label:     'Low Stock Items',
    value:     '0',
    sub:       'Titles below threshold',
    icon:      <AlertTriangle size={20} />,
    iconBg:    'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  {
    label:     'Payables',
    value:     '₹0',
    sub:       'Outstanding to suppliers',
    icon:      <TrendingDown size={20} />,
    iconBg:    'bg-red-50',
    iconColor: 'text-red-500',
  },
  {
    label:     'Receivables',
    value:     '₹0',
    sub:       'Outstanding from customers',
    icon:      <TrendingUp size={20} />,
    iconBg:    'bg-teal-50',
    iconColor: 'text-teal-600',
  },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">

      {/* Page heading */}
      <div>
        <h2 className="page-title">Dashboard</h2>
        <p className="page-sub mt-0.5">Overview for today</p>
      </div>

      {/* 6 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {STATS.map((s) => (
          <div key={s.label} className="stat-card flex items-start gap-4">
            {/* Icon */}
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${s.iconBg} ${s.iconColor}`}>
              {s.icon}
            </div>
            {/* Text */}
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5 leading-none">{s.value}</p>
              <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Welcome banner */}
      <div
        className="rounded-xl p-6 text-white"
        style={{ background: 'linear-gradient(135deg, #1B2A6B 0%, #2D3F8F 100%)' }}
      >
        <p className="text-lg font-semibold">Welcome to IFT ERP</p>
        <p className="text-blue-200 text-sm mt-1">
          Islamic Foundation Trust — Enterprise Resource Planning System, Chennai
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {['Billing', 'Materials', 'Stock', 'Purchases', 'Parties', 'Accounts', 'Reports'].map((m) => (
            <span key={m} className="px-3 py-1 rounded-full bg-white/10 text-blue-100">{m}</span>
          ))}
        </div>
      </div>

    </div>
  )
}
