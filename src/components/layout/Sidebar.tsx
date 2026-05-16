'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import {
  LayoutDashboard,
  ShoppingCart,
  BookOpen,
  Boxes,
  Users,
  PackageOpen,
  Undo2,
  RefreshCw,
  ArrowLeftRight,
  Receipt,
  Wallet,
  BookMarked,
  BarChart3,
  Settings,
  ClipboardList,
  Shield,
  LogOut,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

interface NavGroup {
  section: string
  items: NavItem[]
}

const NAV: NavGroup[] = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard',     href: '/dashboard',  icon: <LayoutDashboard size={18} /> },
    ],
  },
  {
    section: 'Phase 1 — Core',
    items: [
      { label: 'Billing / Sales', href: '/billing',   icon: <ShoppingCart size={18} /> },
      { label: 'Materials',       href: '/materials', icon: <BookOpen size={18} /> },
      { label: 'Stock',           href: '/stock',     icon: <Boxes size={18} /> },
    ],
  },
  {
    section: 'Phase 2 — Operations',
    items: [
      { label: 'Parties',           href: '/parties',           icon: <Users size={18} /> },
      { label: 'Purchases',         href: '/purchases',         icon: <PackageOpen size={18} /> },
      { label: 'Purchase Returns',  href: '/purchase-returns',  icon: <Undo2 size={18} /> },
      { label: 'Sales Returns',     href: '/sales-returns',     icon: <RefreshCw size={18} /> },
      { label: 'Stock Transfer',    href: '/transfers',         icon: <ArrowLeftRight size={18} /> },
    ],
  },
  {
    section: 'Phase 3 — Finance',
    items: [
      { label: 'Expenses',     href: '/expenses',              icon: <Receipt size={18} /> },
      { label: 'Outstandings', href: '/accounts/outstandings', icon: <Wallet size={18} /> },
      { label: 'Accounts',     href: '/accounts',              icon: <BookMarked size={18} /> },
      { label: 'Reports',      href: '/reports',               icon: <BarChart3 size={18} /> },
    ],
  },
  {
    section: 'Admin',
    items: [
      { label: 'Users',       href: '/admin/users', icon: <Shield size={18} /> },
      { label: 'Audit Trail', href: '/audit',       icon: <ClipboardList size={18} /> },
      { label: 'Settings',    href: '/settings',    icon: <Settings size={18} /> },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const router = useRouter()

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    logout()
    router.push('/auth/login')
  }

  return (
    <aside className="sidebar flex flex-col h-screen sticky top-0 shrink-0">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base shrink-0"
          style={{ backgroundColor: '#C8922A', color: '#fff' }}
        >
          IFT
        </div>
        <div className="overflow-hidden">
          <p className="text-white font-semibold text-sm leading-tight truncate">Islamic Foundation</p>
          <p className="text-blue-300 text-xs leading-tight">Trust ERP</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5">
        {NAV.map((group) => (
          <div key={group.section}>
            <p className="sidebar-section">{group.section}</p>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx('sidebar-link mx-2', isActive(item.href) && 'active')}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 px-4 py-3">
        {user && (
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-gold-500 flex items-center justify-center text-white text-xs font-bold shrink-0"
                 style={{ backgroundColor: '#C8922A' }}>
              {user.full_name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-white text-xs font-medium truncate">{user.full_name}</p>
              <p className="text-blue-300 text-[11px] capitalize truncate">{user.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="sidebar-link w-full hover:bg-red-500/20 hover:text-red-300"
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
