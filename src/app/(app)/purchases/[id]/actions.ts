'use server'

import { createAdminClient } from '@/lib/supabase/admin'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PurchaseDetailItem {
  id: string
  material_id: string
  item_code: string
  isbn: string
  title: string
  qty: number
  rate: number
  mrp: number
  discount_pct: number
  total_amount: number
}

export interface PurchaseDetail {
  id: string
  invoice_no: string
  invoice_date: string
  supplier_name: string
  supplier_phone: string
  supplier_inv_no: string
  location_name: string
  subtotal: number
  discount_amount: number
  transport_charge: number
  unloading_charge: number
  other_charges: number
  total_amount: number
  paid_amount: number
  balance_due: number
  status: string
  notes: string
  created_at: string
  items: PurchaseDetailItem[]
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getPurchaseDetailAction(id: string): Promise<PurchaseDetail | null> {
  const supabase = createAdminClient()

  const [{ data: inv, error }, { data: items }] = await Promise.all([
    supabase
      .from('purchase_invoices')
      .select(`
        id, invoice_no, invoice_date, supplier_inv_no,
        subtotal, discount_amount, transport_charge, unloading_charge,
        other_charges, total_amount, paid_amount, balance_due,
        status, notes, created_at,
        parties!supplier_id(name, phone),
        locations!location_id(name)
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('purchase_invoice_items')
      .select(`
        id, material_id, qty, rate, mrp, discount_pct, total_amount,
        materials!material_id(item_code, isbn, title)
      `)
      .eq('invoice_id', id)
      .order('id'),
  ])

  if (error || !inv) return null

  return {
    id:               (inv as any).id,
    invoice_no:       (inv as any).invoice_no       ?? '',
    invoice_date:     (inv as any).invoice_date     ?? '',
    supplier_name:    (inv as any).parties?.name    ?? 'Unknown',
    supplier_phone:   (inv as any).parties?.phone   ?? '',
    supplier_inv_no:  (inv as any).supplier_inv_no  ?? '',
    location_name:    (inv as any).locations?.name  ?? '',
    subtotal:         Number((inv as any).subtotal         ?? 0),
    discount_amount:  Number((inv as any).discount_amount  ?? 0),
    transport_charge: Number((inv as any).transport_charge ?? 0),
    unloading_charge: Number((inv as any).unloading_charge ?? 0),
    other_charges:    Number((inv as any).other_charges    ?? 0),
    total_amount:     Number((inv as any).total_amount     ?? 0),
    paid_amount:      Number((inv as any).paid_amount      ?? 0),
    balance_due:      Number((inv as any).balance_due      ?? 0),
    status:           (inv as any).status           ?? 'draft',
    notes:            (inv as any).notes            ?? '',
    created_at:       (inv as any).created_at       ?? '',
    items: ((items ?? []) as any[]).map(item => ({
      id:           item.id,
      material_id:  item.material_id,
      item_code:    item.materials?.item_code ?? '',
      isbn:         item.materials?.isbn      ?? '',
      title:        item.materials?.title     ?? '',
      qty:          Number(item.qty           ?? 0),
      rate:         Number(item.rate          ?? 0),
      mrp:          Number(item.mrp           ?? 0),
      discount_pct: Number(item.discount_pct  ?? 0),
      total_amount: Number(item.total_amount  ?? 0),
    })),
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function cancelPurchaseInvoiceAction(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('purchase_invoices')
    .update({ status: 'cancelled' })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
