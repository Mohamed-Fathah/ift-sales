'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { Settings, Building2, MapPin, Printer, Bell, Database, Loader2, Save, Check, AlertTriangle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'

interface OrgSettings {
  id: string
  name: string
  address: string
  gstin: string
  phone: string
  email: string
  invoice_prefix: string
  purchase_prefix: string
  receipt_footer: string
  low_stock_threshold: number
}

const DEFAULTS: Omit<OrgSettings, 'id'> = {
  name:                'Islamic Foundation Trust',
  address:             'Chennai, Tamil Nadu',
  gstin:               '33XXXXX0000X1ZX',
  phone:               '+91 44 XXXX XXXX',
  email:               '',
  invoice_prefix:      'IFT-BILL-',
  purchase_prefix:     'IFT-PUR-',
  receipt_footer:      'Thank you for your purchase!',
  low_stock_threshold: 10,
}

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [settings,   setSettings]   = useState<OrgSettings>({ id: '', ...DEFAULTS })
  const [loading,    setLoading]    = useState(true)
  const [loadError,  setLoadError]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [orgId,      setOrgId]      = useState<string | null>(null)

  const loadSettings = async () => {
    setLoading(true)
    setLoadError(false)
    const timer = setTimeout(() => { setLoading(false); setLoadError(true) }, 10_000)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .limit(1)
        .maybeSingle()
      if (error && !error.message.includes('does not exist')) throw new Error(error.message)
      if (data) {
        setOrgId((data as any).id)
        setSettings({
          id:                  (data as any).id,
          name:                (data as any).name                ?? DEFAULTS.name,
          address:             (data as any).address             ?? DEFAULTS.address,
          gstin:               (data as any).gstin               ?? DEFAULTS.gstin,
          phone:               (data as any).phone               ?? DEFAULTS.phone,
          email:               (data as any).email               ?? DEFAULTS.email,
          invoice_prefix:      (data as any).invoice_prefix      ?? DEFAULTS.invoice_prefix,
          purchase_prefix:     (data as any).purchase_prefix     ?? DEFAULTS.purchase_prefix,
          receipt_footer:      (data as any).receipt_footer      ?? DEFAULTS.receipt_footer,
          low_stock_threshold: Number((data as any).low_stock_threshold ?? DEFAULTS.low_stock_threshold),
        })
      }
    } catch (err: any) {
      if (!err.message?.includes('does not exist')) {
        setLoadError(true)
      }
    } finally {
      clearTimeout(timer)
      setLoading(false)
    }
  }

  useEffect(() => { void loadSettings() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = {
        name:                settings.name,
        address:             settings.address,
        gstin:               settings.gstin,
        phone:               settings.phone,
        email:               settings.email,
        invoice_prefix:      settings.invoice_prefix,
        purchase_prefix:     settings.purchase_prefix,
        receipt_footer:      settings.receipt_footer,
        low_stock_threshold: settings.low_stock_threshold,
      }
      let error
      if (orgId) {
        const res = await supabase.from('organizations').update(payload).eq('id', orgId)
        error = res.error
      } else {
        const res = await supabase.from('organizations').insert(payload).select('id').single()
        error = res.error
        if (!error && res.data) setOrgId((res.data as any).id)
      }
      if (error) throw new Error(error.message)
      setSaved(true)
      toast.success('Settings saved')
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const canEdit = user?.role === 'superadmin' || user?.role === 'admin'

  const Field = ({
    label, field, type = 'text', placeholder,
  }: {
    label: string
    field: keyof Omit<OrgSettings, 'id'>
    type?: string
    placeholder?: string
  }) => (
    <div className="flex items-center justify-between gap-4">
      <label className="text-xs font-medium text-gray-500 w-44 shrink-0">{label}</label>
      {canEdit ? (
        <input
          type={type}
          className="flex-1 input text-sm"
          value={String(settings[field] ?? '')}
          placeholder={placeholder}
          onChange={e => setSettings(prev => ({
            ...prev,
            [field]: type === 'number' ? Number(e.target.value) : e.target.value,
          }))}
        />
      ) : (
        <div className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 text-sm text-gray-700">
          {String(settings[field] || '—')}
        </div>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
        <Loader2 size={20} className="animate-spin" /> Loading settings…
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
        <AlertTriangle size={40} className="text-amber-400" />
        <p className="font-medium text-sm">Failed to load settings — connection timed out</p>
        <button onClick={loadSettings} className="btn-outline text-sm flex items-center gap-2">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-sub mt-0.5">Application configuration and preferences</p>
        </div>
        {canEdit ? (
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
              : saved
                ? <><Check size={14} /> Saved</>
                : <><Save size={14} /> Save Changes</>
            }
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Settings size={13} />
            Admin access required to edit
          </div>
        )}
      </div>

      <div className="space-y-4 max-w-2xl">
        {/* Organisation */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(27,42,107,0.08)', color: 'var(--ift-navy)' }}>
              <Building2 size={18} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Organisation</p>
              <p className="text-[11px] text-gray-400">Basic information about your organisation</p>
            </div>
          </div>
          <div className="space-y-3">
            <Field label="Organisation Name" field="name" placeholder="Your org name" />
            <Field label="Address" field="address" placeholder="City, State" />
            <Field label="GSTIN" field="gstin" placeholder="15-digit GSTIN" />
            <Field label="Phone" field="phone" placeholder="+91 XXXXX XXXXX" />
            <Field label="Email" field="email" type="email" placeholder="contact@example.com" />
          </div>
        </div>

        {/* Billing */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(27,42,107,0.08)', color: 'var(--ift-navy)' }}>
              <Printer size={18} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Billing & Receipts</p>
              <p className="text-[11px] text-gray-400">Invoice numbering and receipt settings</p>
            </div>
          </div>
          <div className="space-y-3">
            <Field label="Invoice Prefix" field="invoice_prefix" placeholder="IFT-BILL-" />
            <Field label="Purchase Prefix" field="purchase_prefix" placeholder="IFT-PUR-" />
            <Field label="Receipt Footer" field="receipt_footer" placeholder="Thank you…" />
          </div>
        </div>

        {/* Stock Alerts */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(27,42,107,0.08)', color: 'var(--ift-navy)' }}>
              <Bell size={18} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Stock Alerts</p>
              <p className="text-[11px] text-gray-400">Thresholds for low stock notifications</p>
            </div>
          </div>
          <div className="space-y-3">
            <Field label="Low Stock Threshold" field="low_stock_threshold" type="number" placeholder="10" />
          </div>
        </div>

        {/* Data (read-only) */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(27,42,107,0.08)', color: 'var(--ift-navy)' }}>
              <Database size={18} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Data</p>
              <p className="text-[11px] text-gray-400">Database and system information</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Database',  value: 'Supabase (PostgreSQL)' },
              { label: 'Region',    value: 'ap-south-1 (Mumbai)'   },
              { label: 'Version',   value: 'IFT ERP v2.0'          },
            ].map(f => (
              <div key={f.label} className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium text-gray-500 w-44 shrink-0">{f.label}</label>
                <div className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 text-sm text-gray-700">
                  {f.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
