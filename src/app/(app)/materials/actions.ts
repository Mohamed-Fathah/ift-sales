// Materials actions — offline via Dexie IndexedDB
import { localDB, uuid, nowISO } from '@/lib/local-db'

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
  publication?: string
  initial_stock?: number
}

export async function getNextItemCodeAction(): Promise<string> {
  const mats = await localDB.materials.toArray()
  let maxNum = 0
  for (const m of mats) {
    const match = (m.item_code ?? '').match(/(\d+)$/)
    if (match) {
      const n = parseInt(match[1], 10)
      if (n > maxNum) maxNum = n
    }
  }
  return `IFT-${String(maxNum + 1).padStart(3, '0')}`
}

export async function getMaterialsAction(): Promise<MaterialRow[]> {
  const mats = await localDB.materials.orderBy('item_code').toArray()
  const cats = await localDB.categories.toArray()
  const catMap = new Map(cats.map(c => [c.id, c.name]))
  const stocks = await localDB.stock.toArray()

  const stockMap = new Map<string, number>()
  for (const s of stocks) {
    stockMap.set(s.material_id, (stockMap.get(s.material_id) ?? 0) + s.qty_in_hand)
  }

  return mats.map(m => ({
    id: m.id,
    item_code: m.item_code ?? '',
    isbn: m.isbn ?? '',
    title: m.title ?? '',
    author: m.author ?? '',
    category_id: m.category_id ?? '',
    category: catMap.get(m.category_id) ?? '',
    mrp: m.mrp ?? 0,
    purchase_rate: m.purchase_rate ?? 0,
    discount_pct: m.discount_pct ?? 0,
    is_active: m.is_active ?? true,
    stock: stockMap.get(m.id) ?? 0,
  }))
}

export async function getCategoriesAction(): Promise<CategoryOption[]> {
  return localDB.categories.orderBy('name').toArray()
}

export async function getStockReportDataAction(): Promise<{
  itemCode: string; isbn: string; title: string; author: string;
  category: string; mrp: number; purchaseRate: number;
  openingStock: number; qtyIn: number; qtySold: number;
  currentStock: number; stockValue: number; location: string
}[]> {
  const mats = await localDB.materials.where('is_active').equals(1).toArray()
  const cats = await localDB.categories.toArray()
  const catMap = new Map(cats.map(c => [c.id, c.name]))
  const stocks = await localDB.stock.toArray()
  const locs = await localDB.locations.toArray()
  const locMap = new Map(locs.map(l => [l.id, l.name]))

  return mats.map(m => {
    const matStocks = stocks.filter(s => s.material_id === m.id)
    const currentStock = matStocks.reduce((sum, s) => sum + s.qty_in_hand, 0)
    const loc = matStocks.length === 1 ? (locMap.get(matStocks[0].location_id) ?? 'All') : 'All'
    return {
      itemCode: m.item_code ?? '',
      isbn: m.isbn ?? '',
      title: m.title ?? '',
      author: m.author ?? '',
      category: catMap.get(m.category_id) ?? '',
      mrp: m.mrp ?? 0,
      purchaseRate: m.purchase_rate ?? 0,
      openingStock: 0,
      qtyIn: 0,
      qtySold: 0,
      currentStock,
      stockValue: +(currentStock * (m.purchase_rate ?? 0)).toFixed(2),
      location: loc,
    }
  })
}

export async function saveMaterialAction(input: SaveMaterialInput): Promise<{ id: string }> {
  const materialId = uuid()
  await localDB.materials.add({
    id: materialId,
    item_code: input.item_code ? input.item_code.trim().toUpperCase() : '',
    isbn: input.isbn || '',
    tracking_id: '',
    title: input.title,
    author: input.author || '',
    category_id: input.category_id || '',
    publication: input.publication || '',
    language: '',
    mrp: input.mrp,
    purchase_rate: input.purchase_rate,
    discount_pct: input.discount_pct ?? 0,
    description: '',
    is_active: true,
    created_at: nowISO(),
  })

  if (input.initial_stock && input.initial_stock > 0) {
    const loc = await localDB.locations.toCollection().first()
    if (loc) {
      await localDB.stock.add({
        id: uuid(),
        material_id: materialId,
        location_id: loc.id,
        qty_in_hand: input.initial_stock,
      })
      await localDB.stockMovements.add({
        id: uuid(),
        material_id: materialId,
        location_id: loc.id,
        movement_type: 'opening',
        qty: input.initial_stock,
        rate: null,
        ref_id: null,
        ref_type: null,
        reference_id: null,
        notes: 'Initial stock on book creation',
        created_by: null,
        created_at: nowISO(),
      })
    }
  }

  return { id: materialId }
}

export async function updateMaterialAction(
  id: string,
  changes: Record<string, unknown>
): Promise<void> {
  await localDB.materials.update(id, changes)
}

export async function archiveMaterialAction(id: string): Promise<void> {
  await localDB.materials.update(id, { is_active: false })
}

export async function bulkImportMaterialsAction(
  rows: SaveMaterialInput[],
  _userId: string,
  _userName: string,
): Promise<{ inserted: number; errors: string[] }> {
  let inserted = 0
  const errors: string[] = []

  for (const r of rows) {
    try {
      const existing = r.item_code
        ? await localDB.materials.where('item_code').equals(r.item_code.trim().toUpperCase()).first()
        : undefined

      if (existing) {
        await localDB.materials.update(existing.id, {
          isbn: r.isbn || existing.isbn,
          title: r.title,
          author: r.author || existing.author,
          category_id: r.category_id || existing.category_id,
          mrp: r.mrp,
          purchase_rate: r.purchase_rate,
          discount_pct: r.discount_pct ?? existing.discount_pct,
        })
      } else {
        await localDB.materials.add({
          id: uuid(),
          item_code: r.item_code ? r.item_code.trim().toUpperCase() : '',
          isbn: r.isbn || '',
          tracking_id: '',
          title: r.title,
          author: r.author || '',
          category_id: r.category_id || '',
          publication: r.publication || '',
          language: '',
          mrp: r.mrp,
          purchase_rate: r.purchase_rate,
          discount_pct: r.discount_pct ?? 0,
          description: '',
          is_active: true,
          created_at: nowISO(),
        })
      }
      inserted++
    } catch (e: any) {
      errors.push(e.message)
    }
  }

  return { inserted, errors }
}
