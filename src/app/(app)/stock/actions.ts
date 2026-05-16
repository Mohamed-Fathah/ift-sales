'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { execFileSync } from 'child_process'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StockRow {
  material_id: string
  location_id: string
  item_code: string
  isbn: string
  title: string
  author: string
  category: string
  location: string
  qty_available: number
  mrp: number
  purchase_rate: number
  stock_value: number
}

export interface LocationOption {
  id: string
  name: string
}

export interface UpdateStockPayload {
  materialId: string
  locationId: string
  currentQty: number
  newQty: number
  movementType: string
  notes: string
  createdBy: string | null
  itemCode: string
  title: string
}

export interface TransferStockPayload {
  materialId: string
  fromLocationId: string
  toLocationId: string
  qty: number
  notes: string
  createdBy: string | null
}

// ─── Git auto-commit (best-effort) ───────────────────────────────────────────

function gitAutoCommit(msg: string) {
  try {
    const cwd = process.cwd()
    execFileSync('git', ['add', '-A'], { cwd, stdio: 'ignore' })
    execFileSync('git', ['commit', '-m', msg], { cwd, stdio: 'ignore' })
    execFileSync('git', ['push'], { cwd, stdio: 'ignore' })
  } catch {
    // best-effort — stock update already succeeded
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getStockSummaryAction(): Promise<StockRow[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('v_stock_summary')
    .select('*')
    .order('title')
  if (error) throw new Error(error.message)
  return ((data ?? []) as any[]).map(r => ({
    material_id:   r.material_id   ?? '',
    location_id:   r.location_id   ?? '',
    item_code:     r.item_code     ?? '',
    isbn:          r.isbn          ?? '',
    title:         r.title         ?? '',
    author:        r.author        ?? '',
    category:      r.category      ?? '',
    location:      r.location      ?? '',
    qty_available: Number(r.qty_available ?? r.qty_in_hand ?? 0),
    mrp:           Number(r.mrp           ?? 0),
    purchase_rate: Number(r.purchase_rate  ?? 0),
    stock_value:   Number(r.stock_value   ?? 0),
  }))
}

export async function getLocationsAction(): Promise<LocationOption[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('locations')
    .select('id, name')
    .order('name')
  return ((data ?? []) as any[]).map(l => ({ id: l.id as string, name: l.name as string }))
}

// ─── Update stock quantity ────────────────────────────────────────────────────

export async function updateStockAction(payload: UpdateStockPayload): Promise<void> {
  const supabase = createAdminClient()

  const { data: row } = await supabase
    .from('stock')
    .select('id, qty_in_hand')
    .eq('material_id', payload.materialId)
    .eq('location_id', payload.locationId)
    .maybeSingle()

  const delta = payload.newQty - payload.currentQty

  if (row) {
    const { error } = await supabase
      .from('stock')
      .update({ qty_in_hand: payload.newQty })
      .eq('id', (row as any).id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase
      .from('stock')
      .insert({
        material_id: payload.materialId,
        location_id: payload.locationId,
        qty_in_hand: payload.newQty,
      })
    if (error) throw new Error(error.message)
  }

  await supabase.from('stock_movements').insert({
    material_id:   payload.materialId,
    location_id:   payload.locationId,
    movement_type: payload.movementType,
    qty:           Math.abs(delta),
    notes:         payload.notes || null,
    created_by:    payload.createdBy || null,
  })

  gitAutoCommit(
    `stock: ${payload.movementType} - ${payload.itemCode} qty ${payload.currentQty}→${payload.newQty}`
  )
}

// ─── Transfer stock between locations ────────────────────────────────────────

export async function transferStockAction(payload: TransferStockPayload): Promise<void> {
  if (payload.qty <= 0) throw new Error('Transfer qty must be positive')

  const supabase = createAdminClient()

  const { data: srcRow } = await supabase
    .from('stock')
    .select('id, qty_in_hand')
    .eq('material_id', payload.materialId)
    .eq('location_id', payload.fromLocationId)
    .maybeSingle()

  if (!srcRow) throw new Error('Source stock record not found')
  const srcQty = Number((srcRow as any).qty_in_hand)
  if (srcQty < payload.qty) throw new Error(`Insufficient stock. Available: ${srcQty}`)

  const { error: srcErr } = await supabase
    .from('stock')
    .update({ qty_in_hand: srcQty - payload.qty })
    .eq('id', (srcRow as any).id)
  if (srcErr) throw new Error(srcErr.message)

  const { data: dstRow } = await supabase
    .from('stock')
    .select('id, qty_in_hand')
    .eq('material_id', payload.materialId)
    .eq('location_id', payload.toLocationId)
    .maybeSingle()

  if (dstRow) {
    await supabase
      .from('stock')
      .update({ qty_in_hand: Number((dstRow as any).qty_in_hand) + payload.qty })
      .eq('id', (dstRow as any).id)
  } else {
    await supabase.from('stock').insert({
      material_id: payload.materialId,
      location_id: payload.toLocationId,
      qty_in_hand: payload.qty,
    })
  }

  await supabase.from('stock_movements').insert([
    {
      material_id:   payload.materialId,
      location_id:   payload.fromLocationId,
      movement_type: 'transfer_out',
      qty:           payload.qty,
      notes:         payload.notes || null,
      created_by:    payload.createdBy || null,
    },
    {
      material_id:   payload.materialId,
      location_id:   payload.toLocationId,
      movement_type: 'transfer_in',
      qty:           payload.qty,
      notes:         payload.notes || null,
      created_by:    payload.createdBy || null,
    },
  ])

  gitAutoCommit(`stock: transfer ${payload.qty} units - material ${payload.materialId}`)
}
