'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { Shield, Search, X, Loader2, UserCheck, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore, type UserRole } from '@/store/auth.store'

interface UserRow {
  id: string
  full_name: string
  email: string
  role: UserRole
  status: string
  created_at: string
}

const ROLES: { value: UserRole; label: string; color: string }[] = [
  { value: 'superadmin', label: 'Super Admin', color: 'bg-red-100 text-red-700' },
  { value: 'admin',      label: 'Admin',       color: 'bg-purple-100 text-purple-700' },
  { value: 'manager',    label: 'Manager',     color: 'bg-blue-100 text-blue-700' },
  { value: 'billing',    label: 'Billing',     color: 'bg-emerald-100 text-emerald-700' },
  { value: 'viewer',     label: 'Viewer',      color: 'bg-gray-100 text-gray-600' },
]

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLES.find(r => r.value === role) ?? { label: role, color: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function fmtDate(d: string) {
  try { return format(parseISO(d), 'dd MMM yyyy') } catch { return d }
}

export default function UsersPage() {
  const { user: currentUser } = useAuthStore()
  const [users,     setUsers]     = useState<UserRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRole,  setEditRole]  = useState<UserRole>('viewer')
  const [saving,    setSaving]    = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, status, created_at')
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      setUsers(((data ?? []) as any[]).map(r => ({
        id:         r.id,
        full_name:  r.full_name  ?? '—',
        email:      r.email      ?? '',
        role:       r.role       ?? 'viewer',
        status:     r.status     ?? 'active',
        created_at: r.created_at ?? '',
      })))
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const startEdit = (u: UserRow) => {
    setEditingId(u.id)
    setEditRole(u.role)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveRole = async (userId: string) => {
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .update({ role: editRole })
        .eq('id', userId)
      if (error) throw new Error(error.message)
      toast.success('Role updated')
      setEditingId(null)
      load()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update role')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (u: UserRow) => {
    const newStatus = u.status === 'active' ? 'inactive' : 'active'
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', u.id)
      if (error) throw new Error(error.message)
      toast.success(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
      load()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update status')
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return q
      ? users.filter(u =>
          u.full_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
        )
      : users
  }, [users, search])

  const activeCount   = useMemo(() => users.filter(u => u.status === 'active').length,   [users])
  const inactiveCount = useMemo(() => users.filter(u => u.status !== 'active').length, [users])

  const canManage = currentUser?.role === 'superadmin' || currentUser?.role === 'admin'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">User Management</h2>
          <p className="page-sub mt-0.5">Manage staff accounts and permissions</p>
        </div>
        {!canManage && (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Shield size={13} />
            Admin access required to edit
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-xs text-gray-500">Total Users</p>
          <p className="text-xl font-bold mt-1" style={{ color: 'var(--ift-navy)' }}>
            {loading ? '—' : users.length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-500">Active</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{loading ? '—' : activeCount}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-500">Inactive</p>
          <p className="text-xl font-bold text-gray-400 mt-1">{loading ? '—' : inactiveCount}</p>
        </div>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-2">
        {ROLES.map(r => (
          <span key={r.value} className={`px-2.5 py-1 rounded-full text-xs font-medium ${r.color}`}>
            {r.label}
          </span>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            className="input pl-9 text-sm"
            placeholder="Search name, email, role…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
              <X size={13} />
            </button>
          )}
        </div>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} of {users.length}</span>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
              <Loader2 size={18} className="animate-spin" /> Loading users…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <Shield size={36} />
              <p className="text-sm font-medium">No users found</p>
            </div>
          ) : (
            <table className="table-auto-ift">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th className="text-center">Status</th>
                  <th>Joined</th>
                  {canManage && <th className="text-center">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: 'var(--ift-navy)' }}>
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-sm text-gray-800">{u.full_name}</span>
                        {u.id === currentUser?.id && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">you</span>
                        )}
                      </div>
                    </td>
                    <td className="text-sm text-gray-600">{u.email}</td>
                    <td>
                      {editingId === u.id ? (
                        <select
                          className="input py-1 text-xs w-36"
                          value={editRole}
                          onChange={e => setEditRole(e.target.value as UserRole)}
                        >
                          {ROLES.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      ) : (
                        <RoleBadge role={u.role} />
                      )}
                    </td>
                    <td className="text-center">
                      <span className={u.status === 'active' ? 'badge-green' : 'badge-gray'}>
                        {u.status}
                      </span>
                    </td>
                    <td className="text-xs text-gray-500 whitespace-nowrap">{fmtDate(u.created_at)}</td>
                    {canManage && (
                      <td className="text-center">
                        {editingId === u.id ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              className="text-xs btn-primary py-1 px-2"
                              onClick={() => saveRole(u.id)}
                              disabled={saving}
                            >
                              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            </button>
                            <button
                              className="text-xs btn-outline py-1 px-2"
                              onClick={cancelEdit}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                              onClick={() => startEdit(u)}
                            >
                              Edit Role
                            </button>
                            {u.id !== currentUser?.id && (
                              <button
                                className={`text-xs font-medium ${u.status === 'active' ? 'text-red-400 hover:text-red-600' : 'text-emerald-500 hover:text-emerald-700'}`}
                                onClick={() => toggleStatus(u)}
                              >
                                {u.status === 'active' ? 'Deactivate' : 'Activate'}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
