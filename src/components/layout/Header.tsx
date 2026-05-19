'use client'

import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard':           'Dashboard',
  '/billing':             'Billing / Sales',
  '/materials':           'Materials',
  '/stock':               'Stock',
  '/parties':             'Parties',
  '/purchases':           'Purchases',
  '/purchase-returns':    'Purchase Returns',
  '/sales-returns':       'Sales Returns',
  '/transfers':           'Stock Transfer',
  '/expenses':            'Expenses',
  '/accounts/outstandings': 'Outstandings',
  '/accounts':            'Accounts & Ledger',
  '/reports':             'Reports',
  '/admin/users':         'User Management',
  '/audit':               'Audit Trail',
  '/settings':            'Settings',
}

function getTitle(pathname: string): string {
  for (const [route, title] of Object.entries(ROUTE_TITLES)) {
    if (pathname === route || pathname.startsWith(route + '/')) return title
  }
  return 'IFT ERP'
}

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname()
  const { user } = useAuthStore()
  const title = getTitle(pathname)

  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between px-4 md:px-6 bg-white border-b border-gray-200 shrink-0"
      style={{ height: 'var(--header-h)' }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-base font-semibold text-gray-900">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
              style={{ backgroundColor: '#1B2A6B' }}
            >
              {user.full_name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-900 leading-tight">{user.full_name}</p>
              <p className="text-xs text-gray-500 capitalize leading-tight">{user.role}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
