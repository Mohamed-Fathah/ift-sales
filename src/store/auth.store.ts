// src/store/auth.store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UserRole = 'superadmin' | 'admin' | 'manager' | 'billing' | 'viewer'

export interface UserProfile {
  id: string
  full_name: string
  email: string
  phone?: string
  role: UserRole
  status: string
  avatar_url?: string
  org_id: string
}

interface AuthState {
  user: UserProfile | null
  org: { id: string; name: string; logo_url?: string } | null
  setUser: (user: UserProfile | null) => void
  setOrg: (org: AuthState['org']) => void
  logout: () => void
  // Permission helpers
  can: (action: 'view_reports' | 'manage_users' | 'manage_materials' | 'manage_purchases' | 'manage_accounts' | 'delete_records') => boolean
}

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  superadmin: ['view_reports','manage_users','manage_materials','manage_purchases','manage_accounts','delete_records'],
  admin:      ['view_reports','manage_users','manage_materials','manage_purchases','manage_accounts'],
  manager:    ['view_reports','manage_materials','manage_purchases'],
  billing:    [],
  viewer:     ['view_reports'],
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      org: null,
      setUser: (user) => set({ user }),
      setOrg: (org) => set({ org }),
      logout: () => set({ user: null }),
      can: (action) => {
        const role = get().user?.role
        if (!role) return false
        return ROLE_PERMISSIONS[role]?.includes(action) ?? false
      },
    }),
    { name: 'ift-auth' }
  )
)
