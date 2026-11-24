'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { seedIfEmpty } from '@/lib/local-db'

export default function PWARegister() {
  useEffect(() => {
    useAuthStore.persist.rehydrate()
    seedIfEmpty().catch(() => {})
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return null
}
