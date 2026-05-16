'use server'

import { createAdminClient } from '@/lib/supabase/admin'

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface MaterialRow {
  id: string
  item_code: string
  isbn: string
  title: string
  author: string
  category_id: string
  category: string
  mrp: number
  purchase_rate: number
  discount_pct: number
  is_active: boolean
  stock: number
}

export interface CategoryOption {
  id: string
  name: string
}

export interface SaveMaterialInput {
  item_code: string
  isbn?: string
  title: string
  author?: string
  category_id?: string
  mrp: number
  purchase_rate: number
  discount_pct?: number
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getMaterialsAction(): Promise<MaterialRow[]> {
  const supabase = createAdminClient()

  const [{ data: mats, error }, { data: stocks }] = await Promise.all([
    supabase
      .from('materials')
      .select('id, item_code, isbn, title, author, category_id, mrp, purchase_rate, discount_pct, is_active, categories(name)')
      .order('item_code', { ascending: true }),
    supabase
      .from('stock')
      .select('material_id, qty_in_hand'),
  ])

  if (error) throw new Error(error.message)

  const stockMap = new Map<string, number>()
  for (const s of (stocks ?? []) as any[]) {
    const prev = stockMap.get(s.material_id) ?? 0
    stockMap.set(s.material_id, prev + Number(s.qty_in_hand ?? 0))
  }

  return ((mats ?? []) as any[]).map(m => ({
    id:            m.id,
    item_code:     m.item_code    ?? '',
    isbn:          m.isbn         ?? '',
    title:         m.title        ?? '',
    author:        m.author       ?? '',
    category_id:   m.category_id  ?? '',
    category:      (m.categories as any)?.name ?? '',
    mrp:           Number(m.mrp           ?? 0),
    purchase_rate: Number(m.purchase_rate  ?? 0),
    discount_pct:  Number(m.discount_pct   ?? 0),
    is_active:     Boolean(m.is_active     ?? true),
    stock:         stockMap.get(m.id)       ?? 0,
  }))
}

export async function getCategoriesAction(): Promise<CategoryOption[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('categories')
    .select('id, name')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as CategoryOption[]
}

export async function getStockReportDataAction(): Promise<{
  itemCode: string; isbn: string; title: string; author: string;
  category: string; mrp: number; purchaseRate: number;
  openingStock: number; qtyIn: number; qtySold: number;
  currentStock: number; stockValue: number; location: string
}[]> {
  const supabase = createAdminClient()

  const [{ data: mats }, { data: stocks }, { data: locations }] = await Promise.all([
    supabase
      .from('materials')
      .select('id, item_code, isbn, title, author, mrp, purchase_rate, categories(name)')
      .eq('is_active', true)
      .order('item_code'),
    supabase.from('stock').select('material_id, qty_in_hand, location_id'),
    supabase.from('locations').select('id, name'),
  ])

  const locMap = new Map(((locations ?? []) as any[]).map(l => [l.id, l.name as string]))

  return ((mats ?? []) as any[]).map(m => {
    const matStocks = ((stocks ?? []) as any[]).filter(s => s.material_id === m.id)
    const currentStock = matStocks.reduce((sum: number, s: any) => sum + Number(s.qty_in_hand ?? 0), 0)
    const loc = matStocks.length === 1 ? (locMap.get(matStocks[0].location_id) ?? 'All') : 'All'
    return {
      itemCode:     m.item_code ?? '',
      isbn:         m.isbn ?? '',
      title:        m.title ?? '',
      author:       m.author ?? '',
      category:     (m.categories as any)?.name ?? '',
      mrp:          Number(m.mrp ?? 0),
      purchaseRate: Number(m.purchase_rate ?? 0),
      openingStock: 0,
      qtyIn:        0,
      qtySold:      0,
      currentStock,
      stockValue:   +(currentStock * Number(m.purchase_rate ?? 0)).toFixed(2),
      location:     loc,
    }
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function saveMaterialAction(input: SaveMaterialInput): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('materials')
    .insert({
      item_code:     input.item_code,
      isbn:          input.isbn         || null,
      title:         input.title,
      author:        input.author       || null,
      category_id:   input.category_id  || null,
      mrp:           input.mrp,
      purchase_rate: input.purchase_rate,
      discount_pct:  input.discount_pct ?? 0,
      is_active:     true,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return { id: (data as any).id }
}

export async function updateMaterialAction(
  id: string,
  changes: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('materials')
    .update(changes)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function archiveMaterialAction(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('materials')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function bulkImportMaterialsAction(
  rows: SaveMaterialInput[],
  userId: string,
  userName: string,
): Promise<{ inserted: number; errors: string[] }> {
  const supabase = createAdminClient()
  let inserted = 0
  const errors: string[] = []

  const BATCH = 50
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { data, error } = await supabase
      .from('materials')
      .upsert(
        batch.map(r => ({
          item_code:     r.item_code    || null,
          isbn:          r.isbn         || null,
          title:         r.title,
          author:        r.author       || null,
          category_id:   r.category_id  || null,
          mrp:           r.mrp,
          purchase_rate: r.purchase_rate,
          discount_pct:  r.discount_pct ?? 0,
          is_active:     true,
        })),
        { onConflict: 'item_code', ignoreDuplicates: false }
      )
      .select('id')

    if (error) {
      errors.push(`Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`)
    } else {
      inserted += (data ?? []).length
      // Bulk audit via admin client — too many rows to send back to browser
      if (data && data.length > 0) {
        await supabase.from('audit_log').insert(
          (data as any[]).map((row, idx) => ({
            table_name:     'materials',
            record_id:      row.id,
            action:         'INSERT',
            new_data:       batch[idx] as unknown as Record<string, unknown>,
            old_data:       null,
            changed_fields: Object.keys(batch[idx]),
            user_id:        userId,
            user_name:      userName,
          }))
        )
      }
    }
  }

  return { inserted, errors }
}
