'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import {
  Search, Plus, Pencil, Trash2, X,
  Loader2, AlertTriangle, Building2,
  Phone, Mail, MapPin, CreditCard, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import {
  savePartyAction,
  updatePartyAction,
  deletePartyAction,
  type PartyRow,
  type SavePartyInput,
} from './actions'

// ─── Constants ────────────────────────────────────────────────────────────────

const PARTY_TYPES = [
  { value: 'supplier', label: 'Supplier' },
  { value: 'customer', label: 'Customer' },
  { value: 'both',     label: 'Both'     },
] as const

type PartyType = 'supplier' | 'customer' | 'both'

const EMPTY_FORM: SavePartyInput & { is_active: boolean } = {
  name:            '',
  party_type:      'customer',
  contact_person:  '',
  phone:           '',
  whatsapp:        '',
  email:           '',
  address:         '',
  city:            '',
  gstin:           '',
  credit_limit:    0,
  credit_days:     0,
  opening_balance: 0,
  notes:           '',
  is_active:       true,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function PartyTypeBadge({ type }: { type: PartyType }) {
  if (type === 'supplier')
    return (
      <span className="badge text-white" style={{ background: 'var(--ift-navy)' }}>
        Supplier
      </span>
    )
  if (type === 'both')
    return (
      <span className="badge text-white" style={{ background: 'var(--ift-gold)' }}>
        Both
      </span>
    )
  return <span className="badge-green">Customer</span>
}

function fmtRupee(n: number) {
  if (n === 0) return '—'
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

// ─── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-gray-400">{icon}</span>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 flex-1">
        {label}
      </p>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

// ─── Party Modal (add + edit) ─────────────────────────────────────────────────

function PartyModal({
  party,
  onClose,
  onSaved,
}: {
  party: PartyRow | null      // null = add mode
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = party !== null

  const [form, setForm] = useState<SavePartyInput & { is_active: boolean }>(
    party
      ? {
          name:            party.name,
          party_type:      party.party_type,
          contact_person:  party.contact_person,
          phone:           party.phone,
          whatsapp:        party.whatsapp,
          email:           party.email,
          address:         party.address,
          city:            party.city,
          gstin:           party.gstin,
          credit_limit:    party.credit_limit,
          credit_days:     party.credit_days,
          opening_balance: party.opening_balance,
          notes:           party.notes,
          is_active:       party.is_active,
        }
      : { ...EMPTY_FORM }
  )
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      if (isEdit) {
        await updatePartyAction(party.id, form)
        toast.success('Party updated')
      } else {
        await savePartyAction(form)
        toast.success('Party added')
      }
      onSaved()
    } catch (err: any) {
      toast.error(err.message ?? 'Save failed')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[94vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ background: 'linear-gradient(135deg,#1B2A6B 0%,#2D3F8F 100%)' }}
        >
          <div className="text-white">
            <p className="font-bold text-sm">{isEdit ? 'Edit Party' : 'Add New Party'}</p>
            {isEdit && (
              <p className="text-blue-200 text-xs mt-0.5">{party.name}</p>
            )}
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Party type */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Party Type</p>
            <div className="grid grid-cols-3 gap-2">
              {PARTY_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => set('party_type', t.value)}
                  className={`py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                    form.party_type === t.value
                      ? 'text-white border-transparent shadow-sm'
                      : 'border-gray-200 text-gray-600 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  style={form.party_type === t.value ? { background: 'var(--ift-navy)' } : {}}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Basic info */}
          <div className="space-y-3">
            <SectionLabel icon={<Building2 size={13} />} label="Basic Information" />

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                className="input"
                placeholder="Organisation or person name"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contact Person</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Full name"
                  value={form.contact_person}
                  onChange={e => set('contact_person', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="+91 XXXXX XXXXX"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Contact details */}
          <div className="space-y-3">
            <SectionLabel icon={<Phone size={13} />} label="Contact Details" />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="+91 XXXXX XXXXX"
                  value={form.whatsapp}
                  onChange={e => set('whatsapp', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="email@example.com"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-3">
            <SectionLabel icon={<MapPin size={13} />} label="Address" />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                <input
                  type="text"
                  className="input"
                  placeholder="City"
                  value={form.city}
                  onChange={e => set('city', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">GSTIN</label>
                <input
                  type="text"
                  className="input font-mono uppercase"
                  placeholder="15-character GST number"
                  maxLength={15}
                  value={form.gstin}
                  onChange={e => set('gstin', e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
              <textarea
                className="input resize-none"
                rows={2}
                placeholder="Street / Building / Area"
                value={form.address}
                onChange={e => set('address', e.target.value)}
              />
            </div>
          </div>

          {/* Financial */}
          <div className="space-y-3">
            <SectionLabel icon={<CreditCard size={13} />} label="Financial Details" />

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Credit Limit (₹)</label>
                <input
                  type="number"
                  min={0}
                  className="input tabular-nums"
                  placeholder="0"
                  value={form.credit_limit}
                  onChange={e => set('credit_limit', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Credit Days</label>
                <input
                  type="number"
                  min={0}
                  className="input tabular-nums"
                  placeholder="0"
                  value={form.credit_days}
                  onChange={e => set('credit_days', parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Opening Balance (₹)</label>
                <input
                  type="number"
                  className="input tabular-nums"
                  placeholder="0"
                  value={form.opening_balance}
                  onChange={e => set('opening_balance', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <p className="text-[11px] text-gray-400">
              Opening balance: positive = they owe us, negative = we owe them
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <SectionLabel icon={<FileText size={13} />} label="Notes" />
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Any additional notes…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          {/* Active toggle (edit only) */}
          {isEdit && (
            <div
              className="flex items-center justify-between px-4 py-3 rounded-xl border"
              style={{
                borderColor: form.is_active ? '#d1fae5' : '#fee2e2',
                background:  form.is_active ? '#f0fdf4'  : '#fff5f5',
              }}
            >
              <div>
                <p className="text-sm font-medium text-gray-800">Party Status</p>
                <p className="text-xs text-gray-500">
                  {form.is_active ? 'Party is active and visible' : 'Party is deactivated'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => set('is_active', !form.is_active)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  form.is_active ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    form.is_active ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
          <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
              : isEdit ? 'Save Changes' : 'Add Party'
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete confirm dialog ────────────────────────────────────────────────────

function ConfirmDelete({
  party,
  onConfirm,
  onCancel,
  deleting,
}: {
  party: PartyRow
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={22} className="text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Delete Party</p>
            <p className="text-xs text-gray-400 mt-0.5">This action cannot be undone</p>
          </div>
        </div>

        <p className="text-sm text-gray-600">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-gray-800">{party.name}</span>?
          Any linked invoices or transactions may be affected.
        </p>

        <div className="flex gap-3 pt-1">
          <button onClick={onCancel} className="btn-outline flex-1">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="btn flex-1 text-white focus:ring-red-400"
            style={{ background: deleting ? '#fca5a5' : '#ef4444' }}
          >
            {deleting ? <><Loader2 size={14} className="animate-spin" /> Deleting…</> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PartiesPage() {
  const [rows,         setRows]         = useState<PartyRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [loadError,    setLoadError]    = useState(false)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [filterType,   setFilterType]   = useState<'all' | PartyType>('all')
  const [modalParty,   setModalParty]   = useState<PartyRow | null | 'new'>('new' as any)
  const [showModal,    setShowModal]    = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PartyRow | null>(null)
  const [deleting,     setDeleting]     = useState(false)

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true)
    setLoadError(false)
    const timer = setTimeout(() => { setLoading(false); setLoadError(true) }, 10_000)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('parties').select('*').order('name')
      if (error) throw new Error(error.message)
      setRows(((data ?? []) as any[]).map(r => ({
        id:              r.id,
        name:            r.name            ?? '',
        party_type:      r.party_type      ?? 'customer',
        contact_person:  r.contact_person  ?? '',
        phone:           r.phone           ?? '',
        whatsapp:        r.whatsapp        ?? '',
        email:           r.email           ?? '',
        address:         r.address         ?? '',
        city:            r.city            ?? '',
        gstin:           r.gstin           ?? '',
        credit_limit:    Number(r.credit_limit    ?? 0),
        credit_days:     Number(r.credit_days     ?? 0),
        opening_balance: Number(r.opening_balance ?? 0),
        notes:           r.notes           ?? '',
        is_active:       Boolean(r.is_active ?? true),
      })))
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load parties')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return rows.filter(r => {
      const matchSearch = !q
        || r.name.toLowerCase().includes(q)
        || r.phone.includes(q)
        || r.city.toLowerCase().includes(q)
      const matchType = filterType === 'all' || r.party_type === filterType
      return matchSearch && matchType
    })
  }, [rows, searchQuery, filterType])

  // ── Open modal helpers ────────────────────────────────────────────────────
  const openAdd  = () => { setModalParty(null); setShowModal(true) }
  const openEdit = (p: PartyRow) => { setModalParty(p); setShowModal(true) }
  const closeModal = () => setShowModal(false)

  const handleSaved = async () => {
    closeModal()
    await load()
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deletePartyAction(deleteTarget.id)
      toast.success(`${deleteTarget.name} deleted`)
      setDeleteTarget(null)
      await load()
    } catch (err: any) {
      toast.error(err.message ?? 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const hasFilters = searchQuery || filterType !== 'all'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Heading */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Parties</h2>
          <p className="page-sub mt-0.5">Suppliers and customers</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus size={16} />
          Add Party
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            className="input pl-9"
            placeholder="Search by name, phone, city…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="input w-auto min-w-[150px]"
          value={filterType}
          onChange={e => setFilterType(e.target.value as typeof filterType)}
        >
          <option value="all">All Types</option>
          <option value="supplier">Suppliers</option>
          <option value="customer">Customers</option>
          <option value="both">Both</option>
        </select>

        {hasFilters && (
          <button
            onClick={() => { setSearchQuery(''); setFilterType('all') }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={12} /> Clear
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400">
          {filtered.length} of {rows.length}
        </span>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-gray-400 text-sm">
              <Loader2 size={20} className="animate-spin" />
              Loading parties…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
              <Building2 size={40} />
              <p className="font-medium text-sm">
                {rows.length === 0 ? 'No parties yet' : 'No parties match your filters'}
              </p>
              {rows.length === 0 && (
                <button onClick={openAdd} className="btn-primary text-sm">
                  <Plus size={14} /> Add First Party
                </button>
              )}
            </div>
          ) : (
            <table className="table-auto-ift">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Phone</th>
                  <th>City</th>
                  <th className="text-right">Credit Limit</th>
                  <th className="text-right">Opening Balance</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id}>
                    <td>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{row.name}</p>
                        {row.contact_person && (
                          <p className="text-xs text-gray-400 mt-0.5">{row.contact_person}</p>
                        )}
                        {row.email && (
                          <p className="text-[11px] text-gray-400">{row.email}</p>
                        )}
                      </div>
                    </td>
                    <td>
                      <PartyTypeBadge type={row.party_type} />
                    </td>
                    <td className="text-sm text-gray-600">
                      {row.phone || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="text-sm text-gray-600">
                      {row.city || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="text-right text-sm tabular-nums text-gray-600">
                      {fmtRupee(row.credit_limit)}
                    </td>
                    <td className="text-right">
                      <span
                        className="text-sm font-medium tabular-nums"
                        style={{
                          color: row.opening_balance > 0
                            ? '#059669'
                            : row.opening_balance < 0
                            ? '#dc2626'
                            : '#9ca3af',
                        }}
                      >
                        {row.opening_balance === 0
                          ? '—'
                          : (row.opening_balance > 0 ? '+' : '') +
                            '₹' + Math.abs(row.opening_balance).toLocaleString('en-IN')
                        }
                      </span>
                    </td>
                    <td className="text-center">
                      {row.is_active
                        ? <span className="badge-green">Active</span>
                        : <span className="badge-red">Inactive</span>
                      }
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEdit(row)}
                          className="px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-[#1B2A6B] hover:text-[#1B2A6B] transition-colors"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(row)}
                          className="px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-red-400 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Party modal */}
      {showModal && (
        <PartyModal
          key={modalParty ? (modalParty as PartyRow).id : 'new'}
          party={modalParty as PartyRow | null}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDelete
          party={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </div>
  )
}
