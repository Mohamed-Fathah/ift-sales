'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { seedIfEmpty, localDB } from '@/lib/local-db'

export default function PWARegister() {
  useEffect(() => {
    useAuthStore.persist.rehydrate()
    seedIfEmpty().then(async () => {
      if (!useAuthStore.getState().user) {
        const profile = await localDB.profiles.toCollection().first()
        const org = await localDB.organizations.toCollection().first()
        if (profile) {
          useAuthStore.getState().setUser({
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            phone: profile.phone,
            role: profile.role,
            status: profile.status,
            avatar_url: profile.avatar_url,
            org_id: profile.org_id,
          })
        }
        if (org) {
          useAuthStore.getState().setOrg({ id: org.id, name: org.name })
        }
      }
    }).catch(() => {})
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return null
}
