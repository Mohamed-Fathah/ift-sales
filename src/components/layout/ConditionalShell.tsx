'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import Header from './Header'
import { useAuthStore } from '@/store/auth.store'
import { createClient } from '@/lib/supabase/client'

export default function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const { user, setUser } = useAuthStore()

  useEffect(() => { setOpen(false) }, [pathname])

  // If the Zustand store has no user but a Supabase session exists (e.g. after
  // a page refresh, or after migration 005 ran post-login), re-load the profile
  // so role-gated pages work without requiring a full logout/login cycle.
  useEffect(() => {
    if (user) return
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        console.log('[Auth] session profile load:', profile, error ?? 'ok')
        if (profile && !error) setUser(profile as any)
      } catch (e) {
        console.error('[Auth] session profile load failed:', e)
      }
    })()
  }, [user, setUser])

  if (pathname.startsWith('/auth')) return <>{children}</>
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar isOpen={open} />
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[#1B2A6B] text-white shrink-0">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="p-2 -ml-1 rounded-md active:bg-white/20 transition-colors focus:outline-none"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span className="font-semibold text-[15px]">IFT ERP</span>
        </div>
        <div className="hidden md:block">
          <Header onMenuClick={() => setOpen(true)} />
        </div>
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
