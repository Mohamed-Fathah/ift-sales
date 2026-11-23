// Purchase detail actions — offline via Dexie IndexedDB
import { localDB } from '@/lib/local-db'

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

export async function getPurchaseDetailAction(id: string): Promise<PurchaseDetail | null> {
  const inv = await localDB.purchaseInvoices.get(id)
  if (!inv) return null

  const supplier = await localDB.parties.get(inv.supplier_id)
  const location = await localDB.locations.get(inv.location_id)
  const items = await localDB.purchaseInvoiceItems.where('invoice_id').equals(id).toArray()
  const matIds = items.map(i => i.material_id)
  const mats = await localDB.materials.where('id').anyOf(matIds).toArray()
  const matMap = new Map(mats.map(m => [m.id, m]))

  return {
    id: inv.id,
    invoice_no: inv.invoice_no ?? '',
    invoice_date: inv.invoice_date ?? '',
    supplier_name: supplier?.name ?? 'Unknown',
    supplier_phone: supplier?.phone ?? '',
    supplier_inv_no: inv.supplier_inv_no ?? '',
    location_name: location?.name ?? '',
    subtotal: inv.subtotal ?? 0,
    discount_amount: inv.discount_amount ?? 0,
    transport_charge: inv.transport_charge ?? 0,
    unloading_charge: inv.unloading_charge ?? 0,
    other_charges: inv.other_charges ?? 0,
    total_amount: inv.total_amount ?? 0,
    paid_amount: inv.paid_amount ?? 0,
    balance_due: inv.balance_due ?? 0,
    status: inv.status ?? 'draft',
    notes: inv.notes ?? '',
    created_at: inv.created_at ?? '',
    items: items.map(item => {
      const m = matMap.get(item.material_id)
      return {
        id: item.id,
        material_id: item.material_id,
        item_code: m?.item_code ?? '',
        isbn: m?.isbn ?? '',
        title: m?.title ?? '',
        qty: item.qty ?? 0,
        rate: item.rate ?? 0,
        mrp: item.mrp ?? 0,
        discount_pct: item.discount_pct ?? 0,
        total_amount: item.total_amount ?? 0,
      }
    }),
  }
}

export async function cancelPurchaseInvoiceAction(id: string): Promise<void> {
  await localDB.purchaseInvoices.update(id, { status: 'cancelled' })
}
