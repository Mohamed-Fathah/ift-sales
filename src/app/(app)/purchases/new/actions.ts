'use server'

import { createAdminClient } from '@/lib/supabase/admin'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SupplierOption {
  id: string
  name: string
  phone: string
}

export interface PurchaseLocationOption {
  id: string
  name: string
  is_default: boolean
}

export interface PurchaseMaterialResult {
  id: string
  item_code: string
  isbn: string
  title: string
  author: string
  mrp: number
  purchase_rate: number
  discount_pct: number
}

export interface PurchaseItemInput {
  materialId: string
  title: string
  isbn: string
  qty: number
  rate: number
  mrp: number
  discountPct: number
  total: number
}

export interface SavePurchasePayload {
  invoiceNo: string
  supplierId: string
  locationId: string
  invoiceDate: string
  supplierInvNo: string
  items: PurchaseItemInput[]
  subtotal: number
  discountAmount: number
  transportCharge: number
  unloadingCharge: number
  otherCharges: number
  totalAmount: number
  paidAmount: number
  notes: string
  status: 'draft' | 'confirmed'
  createdBy: string | null
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getSuppliersAction(): Promise<SupplierOption[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('parties')
    .select('id, name, phone')
    .in('party_type', ['supplier', 'both'])
    .eq('is_active', true)
    .order('name')
  return ((data ?? []) as any[]).map(p => ({
    id:    p.id    as string,
    name:  p.name  as string,
    phone: p.phone ?? '',
  }))
}

export async function getPurchaseLocationsAction(): Promise<PurchaseLocationOption[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('locations')
    .select('id, name, is_default')
    .order('name')
  return ((data ?? []) as any[]).map(l => ({
    id:         l.id as string,
    name:       l.name as string,
    is_default: Boolean(l.is_default),
  }))
}

export async function searchPurchaseMaterialsAction(
  query: string,
): Promise<PurchaseMaterialResult[]> {
  const q = query.trim()
  if (!q) return []
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('materials')
    .select('id, item_code, isbn, title, author, mrp, purchase_rate, discount_pct')
    .or(`title.ilike.%${q}%,author.ilike.%${q}%,isbn.ilike.%${q}%,item_code.ilike.%${q}%`)
    .eq('is_active', true)
    .limit(8)
  return ((data ?? []) as any[]).map(m => ({
    id:            m.id,
    item_code:     m.item_code    ?? '',
    isbn:          m.isbn         ?? '',
    title:         m.title        ?? '',
    author:        m.author       ?? '',
    mrp:           Number(m.mrp           ?? 0),
    purchase_rate: Number(m.purchase_rate ?? 0),
    discount_pct:  Number(m.discount_pct  ?? 0),
  }))
}

// ─── Save purchase invoice ─────────────────────────────────────────────────────
// invoiceNo is generated client-side (getNextInvoiceNo uses browser Supabase client).
// Status 'confirmed' additionally updates stock and logs stock_movements.

export async function savePurchaseInvoiceAction(
  payload: SavePurchasePayload,
): Promise<{ invoiceId: string; invoiceNo: string }> {
  const supabase = createAdminClient()

  // 1. Insert purchase_invoice
  // balance_due is a GENERATED ALWAYS column — omitted intentionally
  const { data: inv, error: invErr } = await supabase
    .from('purchase_invoices')
    .insert({
      invoice_no:       payload.invoiceNo,
      supplier_id:      payload.supplierId,
      location_id:      payload.locationId,
      invoice_date:     payload.invoiceDate,
      supplier_inv_no:  payload.supplierInvNo || null,
      subtotal:         payload.subtotal,
      discount_amount:  payload.discountAmount,
      transport_charge: payload.transportCharge,
      unloading_charge: payload.unloadingCharge,
      other_charges:    payload.otherCharges,
      total_amount:     payload.totalAmount,
      paid_amount:      payload.paidAmount,
      status:           payload.status,
      notes:            payload.notes || null,
      created_by:       payload.createdBy || null,
    })
    .select('id')
    .single()

  if (invErr) throw new Error(invErr.message)
  const invoiceId = (inv as any).id as string

  // 2. Insert line items
  if (payload.items.length > 0) {
    const { error: itemsErr } = await supabase
      .from('purchase_invoice_items')
      .insert(
        payload.items.map(item => ({
          invoice_id:   invoiceId,
          material_id:  item.materialId,
          qty:          item.qty,
          rate:         item.rate,
          mrp:          item.mrp,
          discount_pct: item.discountPct,
          total_amount: item.total,
        })),
      )
    if (itemsErr) throw new Error(itemsErr.message)
  }

  // 3. If confirmed: increment stock and log movements
  if (payload.status === 'confirmed' && payload.items.length > 0) {
    for (const item of payload.items) {
      const { data: stockRow } = await supabase
        .from('stock')
        .select('id, qty_in_hand')
        .eq('material_id', item.materialId)
        .eq('location_id', payload.locationId)
        .maybeSingle()

      if (stockRow) {
        await supabase
          .from('stock')
          .update({ qty_in_hand: Number((stockRow as any).qty_in_hand) + item.qty })
          .eq('id', (stockRow as any).id)
      } else {
        await supabase.from('stock').insert({
          material_id: item.materialId,
          location_id: payload.locationId,
          qty_in_hand: item.qty,
        })
      }

      await supabase.from('stock_movements').insert({
        material_id:   item.materialId,
        location_id:   payload.locationId,
        movement_type: 'purchase',
        qty:           item.qty,
        reference_id:  invoiceId,
        notes:         `Purchase invoice ${payload.invoiceNo}`,
        created_by:    payload.createdBy || null,
      })
    }
  }

  return { invoiceId, invoiceNo: payload.invoiceNo }
}
