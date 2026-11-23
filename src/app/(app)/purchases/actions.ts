// Purchases list actions — offline via Dexie IndexedDB
import { localDB } from '@/lib/local-db'
import { exportPurchaseReport } from '@/lib/excel-export'

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

export async function getPurchaseInvoicesAction(): Promise<PurchaseListRow[]> {
  const invoices = await localDB.purchaseInvoices.orderBy('invoice_date').reverse().toArray()
  const parties = await localDB.parties.toArray()
  const partyMap = new Map(parties.map(p => [p.id, p.name]))
  const items = await localDB.purchaseInvoiceItems.toArray()

  const countMap = new Map<string, number>()
  for (const item of items) {
    countMap.set(item.invoice_id, (countMap.get(item.invoice_id) ?? 0) + 1)
  }

  return invoices.map(inv => ({
    id: inv.id,
    invoice_no: inv.invoice_no ?? '',
    invoice_date: inv.invoice_date ?? '',
    supplier_name: partyMap.get(inv.supplier_id) ?? 'Unknown',
    supplier_inv_no: inv.supplier_inv_no ?? '',
    items_count: countMap.get(inv.id) ?? 0,
    subtotal: inv.subtotal ?? 0,
    discount_amount: inv.discount_amount ?? 0,
    transport_charge: inv.transport_charge ?? 0,
    unloading_charge: inv.unloading_charge ?? 0,
    other_charges: inv.other_charges ?? 0,
    total_amount: inv.total_amount ?? 0,
    paid_amount: inv.paid_amount ?? 0,
    balance_due: inv.balance_due ?? 0,
    status: inv.status ?? 'draft',
  }))
}

export { exportPurchaseReport }
