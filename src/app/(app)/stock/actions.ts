// Stock actions — offline via Dexie IndexedDB
import { localDB, uuid, nowISO } from '@/lib/local-db'

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

export interface AddStockEntryPayload {
  materialId: string
  locationId: string
  qty: number
  purchaseRate?: number
  supplierId?: string | null
  notes?: string
  createdBy: string | null
}

export interface MaterialOption {
  id: string
  title: string
  item_code: string
  isbn: string
}

export interface PartyOption {
  id: string
  name: string
}

export async function getActiveMaterialsAction(): Promise<MaterialOption[]> {
  const mats = await localDB.materials.filter(m => m.is_active).toArray()
  return mats.sort((a, b) => a.title.localeCompare(b.title)).map(m => ({
    id: m.id,
    title: m.title ?? '',
    item_code: m.item_code ?? '',
    isbn: m.isbn ?? '',
  }))
}

export async function getActiveSuppliersAction(): Promise<PartyOption[]> {
  const parties = await localDB.parties
    .filter(p => p.is_active && (p.party_type === 'supplier' || p.party_type === 'both'))
    .toArray()
  return parties.sort((a, b) => a.name.localeCompare(b.name)).map(p => ({ id: p.id, name: p.name }))
}

export async function getLowStockCountAction(): Promise<number> {
  try {
    const org = await localDB.organizations.toCollection().first()
    const threshold = org?.low_stock_threshold ?? 10
    const stocks = await localDB.stock.toArray()
    const matQty = new Map<string, number>()
    for (const s of stocks) {
      matQty.set(s.material_id, (matQty.get(s.material_id) ?? 0) + s.qty_in_hand)
    }
    return [...matQty.values()].filter(q => q > 0 && q < threshold).length
  } catch {
    return 0
  }
}

export async function addStockEntryAction(payload: AddStockEntryPayload): Promise<void> {
  if (payload.qty <= 0) throw new Error('Quantity must be positive')

  const existing = await localDB.stock
    .where('[material_id+location_id]')
    .equals([payload.materialId, payload.locationId])
    .first()

  if (existing) {
    await localDB.stock.update(existing.id, {
      qty_in_hand: existing.qty_in_hand + payload.qty,
    })
  } else {
    await localDB.stock.add({
      id: uuid(),
      material_id: payload.materialId,
      location_id: payload.locationId,
      qty_in_hand: payload.qty,
    })
  }

  await localDB.stockMovements.add({
    id: uuid(),
    material_id: payload.materialId,
    location_id: payload.locationId,
    movement_type: 'purchase',
    qty: payload.qty,
    rate: payload.purchaseRate ?? null,
    ref_id: payload.supplierId ?? null,
    ref_type: payload.supplierId ? 'supplier' : null,
    reference_id: null,
    notes: payload.notes || '',
    created_by: payload.createdBy || null,
    created_at: nowISO(),
  })
}

export async function getStockSummaryAction(): Promise<StockRow[]> {
  const stocks = await localDB.stock.toArray()
  const mats = await localDB.materials.toArray()
  const cats = await localDB.categories.toArray()
  const locs = await localDB.locations.toArray()

  const matMap = new Map(mats.map(m => [m.id, m]))
  const catMap = new Map(cats.map(c => [c.id, c.name]))
  const locMap = new Map(locs.map(l => [l.id, l.name]))

  return stocks
    .map(s => {
      const m = matMap.get(s.material_id)
      if (!m) return null
      return {
        material_id: s.material_id,
        location_id: s.location_id,
        item_code: m.item_code ?? '',
        isbn: m.isbn ?? '',
        title: m.title ?? '',
        author: m.author ?? '',
        category: catMap.get(m.category_id) ?? '',
        location: locMap.get(s.location_id) ?? '',
        qty_available: s.qty_in_hand,
        mrp: m.mrp ?? 0,
        purchase_rate: m.purchase_rate ?? 0,
        stock_value: +(s.qty_in_hand * (m.purchase_rate ?? 0)).toFixed(2),
      }
    })
    .filter(Boolean)
    .sort((a, b) => (a!.title).localeCompare(b!.title)) as StockRow[]
}

export async function getLocationsAction(): Promise<LocationOption[]> {
  const locs = await localDB.locations.orderBy('name').toArray()
  return locs.map(l => ({ id: l.id, name: l.name }))
}

export async function updateStockAction(payload: UpdateStockPayload): Promise<void> {
  const existing = await localDB.stock
    .where('[material_id+location_id]')
    .equals([payload.materialId, payload.locationId])
    .first()

  const delta = payload.newQty - payload.currentQty

  if (existing) {
    await localDB.stock.update(existing.id, { qty_in_hand: payload.newQty })
  } else {
    await localDB.stock.add({
      id: uuid(),
      material_id: payload.materialId,
      location_id: payload.locationId,
      qty_in_hand: payload.newQty,
    })
  }

  await localDB.stockMovements.add({
    id: uuid(),
    material_id: payload.materialId,
    location_id: payload.locationId,
    movement_type: payload.movementType,
    qty: Math.abs(delta),
    rate: null,
    ref_id: null,
    ref_type: null,
    reference_id: null,
    notes: payload.notes || '',
    created_by: payload.createdBy || null,
    created_at: nowISO(),
  })
}

export async function transferStockAction(payload: TransferStockPayload): Promise<void> {
  if (payload.qty <= 0) throw new Error('Transfer qty must be positive')

  const srcRow = await localDB.stock
    .where('[material_id+location_id]')
    .equals([payload.materialId, payload.fromLocationId])
    .first()

  if (!srcRow) throw new Error('Source stock record not found')
  if (srcRow.qty_in_hand < payload.qty) throw new Error(`Insufficient stock. Available: ${srcRow.qty_in_hand}`)

  await localDB.stock.update(srcRow.id, {
    qty_in_hand: srcRow.qty_in_hand - payload.qty,
  })

  const dstRow = await localDB.stock
    .where('[material_id+location_id]')
    .equals([payload.materialId, payload.toLocationId])
    .first()

  if (dstRow) {
    await localDB.stock.update(dstRow.id, {
      qty_in_hand: dstRow.qty_in_hand + payload.qty,
    })
  } else {
    await localDB.stock.add({
      id: uuid(),
      material_id: payload.materialId,
      location_id: payload.toLocationId,
      qty_in_hand: payload.qty,
    })
  }

  const ts = nowISO()
  await localDB.stockMovements.bulkAdd([
    {
      id: uuid(),
      material_id: payload.materialId,
      location_id: payload.fromLocationId,
      movement_type: 'transfer_out',
      qty: payload.qty,
      rate: null, ref_id: null, ref_type: null, reference_id: null,
      notes: payload.notes || '',
      created_by: payload.createdBy || null,
      created_at: ts,
    },
    {
      id: uuid(),
      material_id: payload.materialId,
      location_id: payload.toLocationId,
      movement_type: 'transfer_in',
      qty: payload.qty,
      rate: null, ref_id: null, ref_type: null, reference_id: null,
      notes: payload.notes || '',
      created_by: payload.createdBy || null,
      created_at: ts,
    },
  ])
}
