import type { Metadata, Viewport } from 'next'
import { Toaster } from 'react-hot-toast'
import ConditionalShell from '@/components/layout/ConditionalShell'
import './globals.css'

export const metadata: Metadata = {
  title: 'IFT ERP — Islamic Foundation Trust',
  description: 'Enterprise Resource Planning System for Islamic Foundation Trust, Chennai',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#1B2A6B',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
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
