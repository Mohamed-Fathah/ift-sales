'use server'
// Billing server actions — run on the server with the admin client,
// bypassing RLS for catalog reads (materials, stock, locations).

import { createAdminClient } from '@/lib/supabase/admin'

// ─── Shared result types (serialisable — no class instances) ─────────────────

export interface MaterialResult {
  id: string
  title: string
  author: string
  isbn: string
  itemCode: string
  mrp: number
  discountPct: number
  stock: number
}

export interface LocationResult {
  id: string
  name: string
}

export interface MaterialCacheRow {
  id: string
  itemCode: string
  isbn: string
  trackingId: string
  title: string
  author: string
  category: string
  mrp: number
  discountPct: number
}

// ─── Fetch default location ───────────────────────────────────────────────────

export async function getDefaultLocation(): Promise<LocationResult | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('locations')
    .select('id, name')
    .eq('is_default', true)
    .maybeSingle()
  return data as LocationResult | null
}

// ─── Fetch all active materials for local Dexie cache ────────────────────────

export async function getAllMaterialsForCache(): Promise<MaterialCacheRow[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('materials')
    .select('id, item_code, isbn, tracking_id, title, author, category, mrp, discount_pct')
    .eq('is_active', true)
    .limit(2000)
  if (!data) return []
  return (data as any[]).map(m => ({
    id:          m.id,
    itemCode:    m.item_code    ?? '',
    isbn:        m.isbn         ?? '',
    trackingId:  m.tracking_id  ?? '',
    title:       m.title,
    author:      m.author       ?? '',
    category:    m.category     ?? '',
    mrp:         m.mrp,
    discountPct: m.discount_pct ?? 0,
  }))
}

// ─── Search materials by title / author / ISBN / item_code ───────────────────

export async function searchMaterialsAction(query: string): Promise<MaterialResult[]> {
  const q = query.trim()
  if (!q) return []

  const supabase = createAdminClient()

  const { data: mats, error } = await supabase
    .from('materials')
    .select('id, item_code, isbn, title, author, mrp, discount_pct')
    .or(`title.ilike.%${q}%,author.ilike.%${q}%,isbn.ilike.%${q}%,item_code.ilike.%${q}%`)
    .eq('is_active', true)
    .limit(8)

  if (error || !mats || mats.length === 0) return []

  // Fetch stock from the stock table (aggregate across all locations)
  const ids = (mats as any[]).map(m => m.id as string)
  const { data: stocks } = await supabase
    .from('stock')
    .select('material_id, qty_in_hand')
    .in('material_id', ids)

  const stockMap = new Map<string, number>()
  for (const s of (stocks ?? []) as any[]) {
    const prev = stockMap.get(s.material_id) ?? 0
    stockMap.set(s.material_id, prev + Number(s.qty_in_hand ?? 0))
  }

  return (mats as any[]).map(m => ({
    id:          m.id,
    title:       m.title,
    author:      m.author       ?? '',
    isbn:        m.isbn         ?? '',
    itemCode:    m.item_code    ?? '',
    mrp:         m.mrp,
    discountPct: m.discount_pct ?? 0,
    stock:       stockMap.get(m.id) ?? 0,
  }))
}

// ─── Barcode / ISBN / item_code lookup ────────────────────────────────────────

export async function lookupBarcodeAction(code: string): Promise<MaterialResult | null> {
  const c = code.trim()
  if (!c) return null

  const supabase = createAdminClient()

  const { data: mat } = await supabase
    .from('materials')
    .select('id, item_code, isbn, tracking_id, title, author, mrp, discount_pct')
    .or(`isbn.eq.${c},tracking_id.eq.${c},item_code.eq.${c}`)
    .eq('is_active', true)
    .maybeSingle()

  if (!mat) return null

  const { data: stocks } = await supabase
    .from('stock')
    .select('qty_in_hand')
    .eq('material_id', (mat as any).id)

  const totalStock = ((stocks ?? []) as any[]).reduce(
    (sum, s) => sum + Number(s.qty_in_hand ?? 0), 0
  )

  return {
    id:          (mat as any).id,
    title:       (mat as any).title,
    author:      (mat as any).author       ?? '',
    isbn:        (mat as any).isbn         ?? '',
    itemCode:    (mat as any).item_code    ?? '',
    mrp:         (mat as any).mrp,
    discountPct: (mat as any).discount_pct ?? 0,
    stock:       totalStock,
  }
}

// ─── Deduct stock after a completed sale ─────────────────────────────────────
// Runs on the server with the admin client — stock writes need RLS bypass.
// Uses fetch-then-update per item (acceptable for low-concurrency single-store).

// ─── Save completed bill (invoice + items + stock deduction) ─────────────────
// The browser client cannot write to sales_invoices — RLS requires
// auth.role() = 'authenticated'. Using the admin client here bypasses RLS
// for all three writes in one server round-trip.

export interface BillItem {
  materialId: string
  title: string
  isbn: string
  qty: number
  mrp: number
  discountPct: number
  discountAmount: number  // per unit
  rate: number
  total: number
}

export interface SaveBillPayload {
  invoiceNo: string
  customerName: string | null
  customerPhone: string | null
  locationId: string
  invoiceDate: string          // 'yyyy-MM-dd'
  subtotalMrp: number
  totalDiscount: number
  grandTotal: number
  paymentMode: string
  createdBy: string | null
  items: BillItem[]
}

export interface SaveBillResult {
  invoiceId: string
}

export async function saveBillAction(payload: SaveBillPayload): Promise<SaveBillResult> {
  const supabase = createAdminClient()

  // 1. Insert sales_invoice
  const { data: inv, error: invErr } = await supabase
    .from('sales_invoices')
    .insert({
      invoice_no:      payload.invoiceNo,
      customer_name:   payload.customerName   || null,
      customer_phone:  payload.customerPhone  || null,
      location_id:     payload.locationId,
      invoice_date:    payload.invoiceDate,
      subtotal_mrp:    payload.subtotalMrp,
      discount_amount: payload.totalDiscount,
      total_amount:    payload.grandTotal,
      paid_amount:     payload.grandTotal,
      // balance_due is GENERATED ALWAYS — omitted intentionally
      payment_mode:    payload.paymentMode,
      status:          'paid',
      created_by:      payload.createdBy || null,
    })
    .select('id')
    .single()

  if (invErr) throw new Error(invErr.message)

  const invoiceId = (inv as { id: string }).id

  // 2. Insert line items
  const { error: itemsErr } = await supabase
    .from('sales_invoice_items')
    .insert(
      payload.items.map(item => ({
        invoice_id:      invoiceId,
        material_id:     item.materialId,
        title:           item.title,
        isbn:            item.isbn || null,
        qty:             item.qty,
        mrp:             item.mrp,
        discount_pct:    item.discountPct,
        discount_amount: parseFloat((item.discountAmount * item.qty).toFixed(2)),
        rate:            item.rate,
        total_amount:    item.total,
      }))
    )

  if (itemsErr) throw new Error(itemsErr.message)

  // 3. Deduct stock
  const materialIds = payload.items.map(i => i.materialId)
  const { data: stockRows } = await supabase
    .from('stock')
    .select('id, material_id, qty_in_hand')
    .in('material_id', materialIds)
    .eq('location_id', payload.locationId)

  if (stockRows && stockRows.length > 0) {
    const qtyMap = new Map(payload.items.map(i => [i.materialId, i.qty]))
    await Promise.all(
      (stockRows as any[]).map(row =>
        supabase
          .from('stock')
          .update({
            qty_in_hand: Math.max(
              0,
              Number(row.qty_in_hand) - (qtyMap.get(row.material_id) ?? 0)
            ),
          })
          .eq('id', row.id)
      )
    )
  }

  return { invoiceId }
}

export interface StockDeductItem {
  materialId: string
  qty: number
}

export async function deductStockAction(
  items: StockDeductItem[],
  locationId: string
): Promise<void> {
  if (!items.length || !locationId) return

  const supabase = createAdminClient()

  // Fetch current qty_in_hand for all affected materials in one query
  const materialIds = items.map(i => i.materialId)
  const { data: rows } = await supabase
    .from('stock')
    .select('id, material_id, qty_in_hand')
    .in('material_id', materialIds)
    .eq('location_id', locationId)

  if (!rows || rows.length === 0) return

  const qtyMap = new Map(items.map(i => [i.materialId, i.qty]))

  // Update each row — Math.max(0, …) prevents going negative
  await Promise.all(
    (rows as any[]).map(row =>
      supabase
        .from('stock')
        .update({
          qty_in_hand: Math.max(0, Number(row.qty_in_hand) - (qtyMap.get(row.material_id) ?? 0)),
        })
        .eq('id', row.id)
    )
  )
}
