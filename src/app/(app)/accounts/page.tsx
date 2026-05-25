'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { BookMarked, Search, Loader2, ChevronDown, TrendingDown, TrendingUp, IndianRupee } from 'lucide-react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

interface Party {
  id: string
  name: string
  type: string
  phone: string
}

interface LedgerEntry {
  id: string
  date: string
  reference: string
  type: 'purchase' | 'payment' | 'purchase_return'
  description: string
  debit: number
  credit: number
  balance: number
}

function fmtRupee(n: number) {
  return '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}
function fmtDate(d: string) {
  try { return format(parseISO(d), 'dd MMM yyyy') } catch { return d }
}

const STATUS_CLASS: Record<string, string> = {
  paid: 'badge-green', confirmed: 'badge-blue',
  draft: 'badge-gray', partial: 'badge-yellow', cancelled: 'badge-red',
}

export default function AccountsPage() {
  const [parties,        setParties]        = useState<Party[]>([])
  const [selectedParty,  setSelectedParty]  = useState<Party | null>(null)
  const [ledger,         setLedger]         = useState<LedgerEntry[]>([])
  const [loadingParties, setLoadingParties] = useState(true)
  const [loadingLedger,  setLoadingLedger]  = useState(false)
  const [search,         setSearch]         = useState('')
  const [partySearch,    setPartySearch]    = useState('')

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('parties')
          .select('id, name, party_type, phone')
          .eq('is_active', true)
          .order('name')
        if (error) throw new Error(error.message)
        setParties(((data ?? []) as any[]).map(r => ({
          id:    r.id,
          name:  r.name  ?? '',
          type:  r.party_type  ?? 'supplier',
          phone: r.phone ?? '',
        })))
      } catch (err: any) {
        toast.error(err.message ?? 'Failed to load parties')
      } finally {
        setLoadingParties(false)
      }
    })()
  }, [])

  const loadLedger = async (party: Party) => {
    setSelectedParty(party)
    setLedger([])
    setLoadingLedger(true)
    try {
      const supabase = createClient()

      const [{ data: invoices, error: invErr }, { data: returns, error: retErr }] = await Promise.all([
        supabase
          .from('purchase_invoices')
          .select('id, invoice_no, invoice_date, total_amount, paid_amount, balance_due, status')
          .eq('supplier_id', party.id)
          .order('invoice_date', { ascending: true }),
        supabase
          .from('purchase_returns')
          .select('id, return_no, return_date, total_amount, purchase_invoice_id')
          .eq('purchase_invoices.supplier_id', party.id)
          .order('return_date', { ascending: true }),
      ])
      if (invErr) throw new Error(invErr.message)

      const entries: Omit<LedgerEntry, 'balance'>[] = []

      // Purchases: debit (we owe supplier)
      for (const inv of ((invoices ?? []) as any[])) {
        entries.push({
          id:          inv.id,
          date:        inv.invoice_date ?? '',
          reference:   inv.invoice_no ?? '',
          type:        'purchase',
          description: `Purchase Invoice ${inv.invoice_no}`,
          debit:       Number(inv.total_amount ?? 0),
          credit:      Number(inv.paid_amount ?? 0),
        })
      }

      // Purchase returns: credit (reduces what we owe)
      for (const ret of ((returns ?? []) as any[])) {
        entries.push({
          id:          ret.id,
          date:        ret.return_date ?? '',
          reference:   ret.return_no ?? '',
          type:        'purchase_return',
          description: `Purchase Return ${ret.return_no}`,
          debit:       0,
          credit:      Number(ret.total_amount ?? 0),
        })
      }

      // Sort by date
      entries.sort((a, b) => a.date.localeCompare(b.date))

      // Calculate running balance
      let bal = 0
      const withBalance: LedgerEntry[] = entries.map(e => {
        bal += e.debit - e.credit
        return { ...e, balance: bal }
      })

      setLedger(withBalance)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load ledger')
    } finally {
      setLoadingLedger(false)
    }
  }

  const filteredParties = useMemo(() => {
    const q = partySearch.toLowerCase()
    return q ? parties.filter(p => p.name.toLowerCase().includes(q)) : parties
  }, [parties, partySearch])

  const filteredLedger = useMemo(() => {
    const q = search.toLowerCase()
    return q
      ? ledger.filter(e => e.reference.toLowerCase().includes(q) || e.description.toLowerCase().includes(q))
      : ledger
  }, [ledger, search])

  const totalDebit  = useMemo(() => ledger.reduce((s, e) => s + e.debit,  0), [ledger])
  const totalCredit = useMemo(() => ledger.reduce((s, e) => s + e.credit, 0), [ledger])
  const closingBalance = totalDebit - totalCredit

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-title">Accounts — Party Ledger</h2>
        <p className="page-sub mt-0.5">Supplier-wise statement of account</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Party list */}
        <div className="card p-0 overflow-hidden md:col-span-1">
          <div className="px-3 py-3 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                className="input pl-7 py-1.5 text-sm"
                placeholder="Search party…"
                value={partySearch}
                onChange={e => setPartySearch(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-[420px]">
            {loadingParties ? (
              <div className="flex items-center justify-center py-10 text-gray-400 gap-2 text-sm">
                <Loader2 size={16} className="animate-spin" /> Loading…
              </div>
            ) : filteredParties.length === 0 ? (
              <p className="text-center py-8 text-sm text-gray-400">No parties found</p>
            ) : (
              filteredParties.map(p => (
                <button
                  key={p.id}
                  onClick={() => loadLedger(p)}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    selectedParty?.id === p.id ? 'bg-blue-50 border-l-2' : ''
                  }`}
                  style={selectedParty?.id === p.id ? { borderLeftColor: 'var(--ift-navy)' } : {}}
                >
                  <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 capitalize">
                      {p.type}
                    </span>
                    {p.phone && <span className="text-[11px] text-gray-400">{p.phone}</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Ledger */}
        <div className="md:col-span-3 space-y-3">
          {!selectedParty ? (
            <div className="card flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(27,42,107,0.08)' }}>
                <BookMarked size={24} style={{ color: 'var(--ift-navy)' }} />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Select a Party</p>
                <p className="text-sm text-gray-400 mt-1">Choose a supplier from the list to view their ledger</p>
              </div>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="stat-card">
                  <p className="text-xs text-gray-500">Total Purchases</p>
                  <p className="text-lg font-bold text-red-600 tabular-nums mt-1">
                    {loadingLedger ? '—' : fmtRupee(totalDebit)}
                  </p>
                </div>
                <div className="stat-card">
                  <p className="text-xs text-gray-500">Total Paid / Returns</p>
                  <p className="text-lg font-bold text-emerald-600 tabular-nums mt-1">
                    {loadingLedger ? '—' : fmtRupee(totalCredit)}
                  </p>
                </div>
                <div className="stat-card">
                  <p className="text-xs text-gray-500">Outstanding Balance</p>
                  <p className={`text-lg font-bold tabular-nums mt-1 ${closingBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {loadingLedger ? '—' : fmtRupee(closingBalance)}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {closingBalance > 0 ? 'Amount to Give' : 'Overpaid'}
                  </p>
                </div>
              </div>

              {/* Party info + search */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-800">{selectedParty.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{selectedParty.type}{selectedParty.phone ? ` · ${selectedParty.phone}` : ''}</p>
                </div>
                <div className="relative max-w-xs flex-1">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    className="input pl-7 text-sm"
                    placeholder="Search reference…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Ledger table */}
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  {loadingLedger ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm">
                      <Loader2 size={18} className="animate-spin" /> Loading ledger…
                    </div>
                  ) : filteredLedger.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
                      <BookMarked size={32} />
                      <p className="text-sm">No transactions found</p>
                    </div>
                  ) : (
                    <table className="table-auto-ift">
                      <thead>
                        <tr>
                          <th className="w-28">Date</th>
                          <th>Reference</th>
                          <th>Description</th>
                          <th className="text-right">Debit (Dr)</th>
                          <th className="text-right">Credit (Cr)</th>
                          <th className="text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLedger.map(e => (
                          <tr key={e.id}>
                            <td className="text-xs text-gray-500 whitespace-nowrap">{fmtDate(e.date)}</td>
                            <td className="font-mono text-xs font-semibold" style={{ color: 'var(--ift-navy)' }}>
                              {e.reference}
                            </td>
                            <td className="text-sm text-gray-600">{e.description}</td>
                            <td className="text-right text-sm tabular-nums">
                              {e.debit > 0
                                ? <span className="text-red-600 font-medium">{fmtRupee(e.debit)}</span>
                                : <span className="text-gray-300">—</span>
                              }
                            </td>
                            <td className="text-right text-sm tabular-nums">
                              {e.credit > 0
                                ? <span className="text-emerald-600 font-medium">{fmtRupee(e.credit)}</span>
                                : <span className="text-gray-300">—</span>
                              }
                            </td>
                            <td className="text-right text-sm font-bold tabular-nums"
                              style={{ color: e.balance >= 0 ? '#dc2626' : '#059669' }}>
                              {fmtRupee(e.balance)}
                              <span className="text-[10px] font-normal ml-1">
                                {e.balance >= 0 ? 'Dr' : 'Cr'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-gray-500">
                            Closing Balance
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-red-600 tabular-nums">
                            {fmtRupee(totalDebit)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600 tabular-nums">
                            {fmtRupee(totalCredit)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold tabular-nums"
                            style={{ color: closingBalance >= 0 ? '#dc2626' : '#059669' }}>
                            {fmtRupee(closingBalance)}
                            <span className="text-xs font-normal ml-1">
                              {closingBalance >= 0 ? 'Dr' : 'Cr'}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
