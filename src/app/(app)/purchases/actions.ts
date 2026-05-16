'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { exportPurchaseReport } from '@/lib/excel-export'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PurchaseListRow {
  id: string
  invoice_no: string
  invoice_date: string
  supplier_name: string
  supplier_inv_no: string
  items_count: number
  subtotal: number
  discount_amount: number
  transport_charge: number
  unloading_charge: number
  other_charges: number
  total_amount: number
  paid_amount: number
  balance_due: number
  status: string
}

// ─── List query ───────────────────────────────────────────────────────────────

export async function getPurchaseInvoicesAction(): Promise<PurchaseListRow[]> {
  const supabase = createAdminClient()

  const { data: invoices, error } = await supabase
    .from('purchase_invoices')
    .select(`
      id, invoice_no, invoice_date, supplier_inv_no,
      subtotal, discount_amount, transport_charge, unloading_charge,
      other_charges, total_amount, paid_amount, balance_due, status,
      parties!supplier_id(name)
    `)
    .order('invoice_date', { ascending: false })

  if (error) throw new Error(error.message)

  const ids = ((invoices ?? []) as any[]).map(i => i.id as string)
  const countMap = new Map<string, number>()

  if (ids.length > 0) {
    const { data: items } = await supabase
      .from('purchase_invoice_items')
      .select('invoice_id')
      .in('invoice_id', ids)
    for (const item of (items ?? []) as any[]) {
      countMap.set(item.invoice_id, (countMap.get(item.invoice_id) ?? 0) + 1)
    }
  }

  return ((invoices ?? []) as any[]).map(inv => ({
    id:               inv.id,
    invoice_no:       inv.invoice_no       ?? '',
    invoice_date:     inv.invoice_date     ?? '',
    supplier_name:    (inv.parties as any)?.name ?? 'Unknown',
    supplier_inv_no:  inv.supplier_inv_no  ?? '',
    items_count:      countMap.get(inv.id) ?? 0,
    subtotal:         Number(inv.subtotal         ?? 0),
    discount_amount:  Number(inv.discount_amount  ?? 0),
    transport_charge: Number(inv.transport_charge ?? 0),
    unloading_charge: Number(inv.unloading_charge ?? 0),
    other_charges:    Number(inv.other_charges    ?? 0),
    total_amount:     Number(inv.total_amount     ?? 0),
    paid_amount:      Number(inv.paid_amount      ?? 0),
    balance_due:      Number(inv.balance_due      ?? 0),
    status:           inv.status ?? 'draft',
  }))
}

// Re-export for page convenience
export { exportPurchaseReport }
