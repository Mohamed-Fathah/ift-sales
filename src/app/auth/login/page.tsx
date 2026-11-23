'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { localDB, seedIfEmpty } from '@/lib/local-db'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)
  const setOrg = useAuthStore((s) => s.setOrg)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    seedIfEmpty().then(() => setReady(true))
  }, [])

  async function handleEnter() {
    setLoading(true)
    try {
      await seedIfEmpty()
      const profile = await localDB.profiles.toCollection().first()
      if (!profile) {
        toast.error('No local profile found. Database may be corrupted.')
        return
      }
      const org = await localDB.organizations.toCollection().first()
      setUser({
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        role: profile.role,
        status: profile.status,
        avatar_url: profile.avatar_url,
        org_id: profile.org_id,
      })
      if (org) {
        setOrg({ id: org.id, name: org.name })
      }
      router.push('/dashboard')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to initialize')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0f1a44 0%, #1B2A6B 60%, #2D3F8F 100%)' }}
    >
      <div className="w-full max-w-[400px]">

        {/* Brand block */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-5 w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl p-3"
               style={{ background: 'rgba(200,146,42,0.15)', border: '2px solid rgba(200,146,42,0.4)' }}>
            <img src="/ift-logo.png" alt="IFT" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Islamic Foundation Trust</h1>
          <p className="text-slate-400 text-sm mt-1">Enterprise Resource Planning System</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8">
          <h2 className="text-base font-semibold text-white mb-3">Offline Mode</h2>
          <p className="text-slate-400 text-sm mb-6">
            All data is stored locally on this computer. No internet connection required.
          </p>

          <button
            onClick={handleEnter}
            disabled={loading || !ready}
            className="btn-primary w-full py-2.5"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Loading…</>
            ) : !ready ? (
              <><Loader2 size={16} className="animate-spin" /> Initializing…</>
            ) : (
              'Enter ERP System'
            )}
          </button>
        </div>

        <p className="text-center text-xs text-slate-500 mt-5">
          Built by <span className="text-slate-300">fafa creatives</span> · IFT Chennai
        </p>

      </div>
    </div>
  )
}
