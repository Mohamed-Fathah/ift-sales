'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  { section: 'OVERVIEW', items: [{ href: '/dashboard', label: 'Dashboard' }] },
  { section: 'PHASE 1 — CORE', items: [
    { href: '/billing', label: 'Billing / Sales' },
    { href: '/materials', label: 'Materials' },
    { href: '/stock', label: 'Stock' },
  ]},
  { section: 'PHASE 2 — OPERATIONS', items: [
    { href: '/parties', label: 'Parties' },
    { href: '/purchases', label: 'Purchases' },
    { href: '/purchase-returns', label: 'Purchase Returns' },
    { href: '/sales-returns', label: 'Sales Returns' },
    { href: '/transfers', label: 'Stock Transfer' },
  ]},
  { section: 'PHASE 3 — FINANCE', items: [
    { href: '/expenses', label: 'Expenses' },
    { href: '/outstandings', label: 'Outstandings' },
    { href: '/accounts', label: 'Accounts' },
    { href: '/reports', label: 'Reports' },
  ]},
  { section: 'ADMIN', items: [
    { href: '/admin/users', label: 'Users' },
    { href: '/audit-trail', label: 'Audit Trail' },
    { href: '/settings', label: 'Settings' },
  ]},
]

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  return (
    <div style={{ width:'210px', height:'100%', backgroundColor:'#1B2A6B', display:'flex', flexDirection:'column', overflowY:'auto', padding:'16px 0' }}>
      <div style={{ padding:'0 16px 16px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ color:'white', fontWeight:700, fontSize:'16px' }}>IFT</div>
        <div style={{ color:'#C8922A', fontSize:'12px' }}>Trust ERP</div>
      </div>
      {NAV.map(({ section, items }) => (
        <div key={section} style={{ marginTop:'16px' }}>
          <div style={{ color:'rgba(255,255,255,0.4)', fontSize:'10px', padding:'0 16px 6px', letterSpacing:'0.5px' }}>{section}</div>
          {items.map(({ href, label }) => (
            <Link key={href} href={href} onClick={onClose} style={{
              display:'block', padding:'8px 16px',
              color: pathname === href ? 'white' : 'rgba(255,255,255,0.7)',
              backgroundColor: pathname === href ? '#C8922A' : 'transparent',
              textDecoration:'none', fontSize:'14px',
              borderRadius:'6px', margin:'2px 8px'
            }}>{label}</Link>
          ))}
        </div>
      ))}
      <div style={{ marginTop:'auto', padding:'16px' }}>
        <Link href="/auth/login" style={{ color:'rgba(255,255,255,0.6)', fontSize:'13px', textDecoration:'none' }}>Sign out</Link>
      </div>
    </div>
  )
}

export default function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [pathname])
  if (pathname.startsWith('/auth')) return <>{children}</>
  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <div className="hidden md:block" style={{ flexShrink:0 }}>
        <SidebarContent />
      </div>
      {open && (
        <div className="md:hidden" onClick={() => setOpen(false)}
          style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.5)', zIndex:40 }} />
      )}
      <div className="md:hidden" style={{
        position:'fixed', top:0, bottom:0, left:0, zIndex:50,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition:'transform 0.3s ease'
      }}>
        <SidebarContent onClose={() => setOpen(false)} />
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        <div className="md:hidden" style={{
          display:'flex', alignItems:'center', gap:'12px',
          padding:'12px 16px', backgroundColor:'#1B2A6B', color:'white', flexShrink:0
        }}>
          <button onClick={() => setOpen(true)} style={{ background:'none', border:'none', color:'white', cursor:'pointer', padding:'4px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span style={{ fontWeight:600, fontSize:'15px' }}>IFT ERP</span>
        </div>
        <div style={{ flex:1, overflow:'auto' }}>{children}</div>
      </div>
    </div>
  )
}
