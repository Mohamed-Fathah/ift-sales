// New purchase actions — offline via Dexie IndexedDB
import { localDB, uuid, nowISO } from '@/lib/local-db'

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

export async function getSuppliersAction(): Promise<SupplierOption[]> {
  const parties = await localDB.parties
    .filter(p => p.is_active && (p.party_type === 'supplier' || p.party_type === 'both'))
    .toArray()
  return parties.sort((a, b) => a.name.localeCompare(b.name)).map(p => ({
    id: p.id,
    name: p.name,
    phone: p.phone ?? '',
  }))
}

export async function getPurchaseLocationsAction(): Promise<PurchaseLocationOption[]> {
  const locs = await localDB.locations.orderBy('name').toArray()
  return locs.map(l => ({
    id: l.id,
    name: l.name,
    is_default: l.is_default,
  }))
}

export async function searchPurchaseMaterialsAction(query: string): Promise<PurchaseMaterialResult[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const mats = await localDB.materials.filter(m =>
    m.is_active &&
    (m.title.toLowerCase().includes(q) ||
     m.author.toLowerCase().includes(q) ||
     m.isbn.toLowerCase().includes(q) ||
     m.item_code.toLowerCase().includes(q))
  ).limit(8).toArray()

  return mats.map(m => ({
    id: m.id,
    item_code: m.item_code ?? '',
    isbn: m.isbn ?? '',
    title: m.title ?? '',
    author: m.author ?? '',
    mrp: m.mrp ?? 0,
    purchase_rate: m.purchase_rate ?? 0,
    discount_pct: m.discount_pct ?? 0,
  }))
}

export async function savePurchaseInvoiceAction(
  payload: SavePurchasePayload,
): Promise<{ invoiceId: string; invoiceNo: string }> {
  const invoiceId = uuid()

  await localDB.purchaseInvoices.add({
    id: invoiceId,
    invoice_no: payload.invoiceNo,
    supplier_id: payload.supplierId,
    location_id: payload.locationId,
    invoice_date: payload.invoiceDate,
    supplier_inv_no: payload.supplierInvNo || '',
    subtotal: payload.subtotal,
    discount_amount: payload.discountAmount,
    transport_charge: payload.transportCharge,
    unloading_charge: payload.unloadingCharge,
    other_charges: payload.otherCharges,
    total_amount: payload.totalAmount,
    paid_amount: payload.paidAmount,
    balance_due: payload.totalAmount - payload.paidAmount,
    status: payload.status,
    notes: payload.notes || '',
    created_by: payload.createdBy || null,
    created_at: nowISO(),
  })

  for (const item of payload.items) {
    await localDB.purchaseInvoiceItems.add({
      id: uuid(),
      invoice_id: invoiceId,
      material_id: item.materialId,
      qty: item.qty,
      rate: item.rate,
      mrp: item.mrp,
      discount_pct: item.discountPct,
      total_amount: item.total,
    })
  }

  if (payload.status === 'confirmed') {
    for (const item of payload.items) {
      const stockRow = await localDB.stock
        .where('[material_id+location_id]')
        .equals([item.materialId, payload.locationId])
        .first()

      if (stockRow) {
        await localDB.stock.update(stockRow.id, {
          qty_in_hand: stockRow.qty_in_hand + item.qty,
        })
      } else {
        await localDB.stock.add({
          id: uuid(),
          material_id: item.materialId,
          location_id: payload.locationId,
          qty_in_hand: item.qty,
        })
      }

      await localDB.stockMovements.add({
        id: uuid(),
        material_id: item.materialId,
        location_id: payload.locationId,
        movement_type: 'purchase',
        qty: item.qty,
        rate: null,
        ref_id: null,
        ref_type: null,
        reference_id: invoiceId,
        notes: `Purchase invoice ${payload.invoiceNo}`,
        created_by: payload.createdBy || null,
        created_at: nowISO(),
      })
    }
  }

  return { invoiceId, invoiceNo: payload.invoiceNo }
}
