import type { Metadata, Viewport } from 'next'
import dynamic from 'next/dynamic'
import { Toaster } from 'react-hot-toast'
import PWARegister from '@/components/PWARegister'
import './globals.css'

const ConditionalShell = dynamic(() => import('@/components/layout/ConditionalShell'), { ssr: false })

export const metadata: Metadata = {
  title: 'IFT ERP — Islamic Foundation Trust',
  description: 'Enterprise Resource Planning System for Islamic Foundation Trust, Chennai',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'IFT ERP' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1B2A6B',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <PWARegister />
        <ConditionalShell>{children}</ConditionalShell>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { fontSize: '14px', borderRadius: '10px' },
            success: { iconTheme: { primary: '#1B2A6B', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  )
}
