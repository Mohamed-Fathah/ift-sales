'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { seedIfEmpty, localDB } from '@/lib/local-db'

async function ensureAuth() {
  await seedIfEmpty()
  const stored = localStorage.getItem('ift-auth')
  const hasUser = stored && JSON.parse(stored)?.state?.user
  if (hasUser) return

  const profile = await localDB.profiles.toCollection().first()
  const org = await localDB.organizations.toCollection().first()
  if (!profile) return

  const authState = {
    state: {
      user: {
        id: profile.id, full_name: profile.full_name, email: profile.email,
        phone: profile.phone, role: profile.role, status: profile.status,
        avatar_url: profile.avatar_url, org_id: profile.org_id,
      },
      org: org ? { id: org.id, name: org.name } : null,
    },
    version: 0,
  }
  localStorage.setItem('ift-auth', JSON.stringify(authState))
  useAuthStore.persist.rehydrate()
}

export default function PWARegister() {
  useEffect(() => {
    useAuthStore.persist.rehydrate()
    ensureAuth().catch(() => {})
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return null
}
