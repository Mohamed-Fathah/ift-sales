// Billing actions — offline via Dexie IndexedDB
import { localDB, uuid, nowISO } from '@/lib/local-db'

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

export async function getDefaultLocation(): Promise<LocationResult | null> {
  const loc = await localDB.locations.where('is_default').equals(1).first()
  if (!loc) return null
  return { id: loc.id, name: loc.name }
}

export async function getOrgSettingsAction(): Promise<{ invoice_prefix: string; receipt_footer: string }> {
  const org = await localDB.organizations.toCollection().first()
  return {
    invoice_prefix: org?.invoice_prefix ?? 'IFT-BILL-',
    receipt_footer: org?.receipt_footer ?? 'Thank you for your purchase!',
  }
}

export async function getAllMaterialsForCache(): Promise<MaterialCacheRow[]> {
  const mats = await localDB.materials.where('is_active').equals(1).toArray()
  const cats = await localDB.categories.toArray()
  const catMap = new Map(cats.map(c => [c.id, c.name]))
  return mats.map(m => ({
    id: m.id,
    itemCode: m.item_code ?? '',
    isbn: m.isbn ?? '',
    trackingId: m.tracking_id ?? '',
    title: m.title,
    author: m.author ?? '',
    category: catMap.get(m.category_id) ?? '',
    mrp: m.mrp,
    discountPct: m.discount_pct ?? 0,
  }))
}

async function getStockForMaterials(ids: string[]): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>()
  const stocks = await localDB.stock.where('material_id').anyOf(ids).toArray()
  for (const s of stocks) {
    stockMap.set(s.material_id, (stockMap.get(s.material_id) ?? 0) + s.qty_in_hand)
  }
  return stockMap
}

export async function searchMaterialsAction(query: string): Promise<MaterialResult[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const all = await localDB.materials.filter(m =>
    m.is_active &&
    (m.title.toLowerCase().includes(q) ||
     m.author.toLowerCase().includes(q) ||
     m.isbn.toLowerCase().includes(q) ||
     m.item_code.toLowerCase().includes(q))
  ).limit(8).toArray()

  const stockMap = await getStockForMaterials(all.map(m => m.id))

  return all.map(m => ({
    id: m.id,
    title: m.title,
    author: m.author ?? '',
    isbn: m.isbn ?? '',
    itemCode: m.item_code ?? '',
    mrp: m.mrp,
    discountPct: m.discount_pct ?? 0,
    stock: stockMap.get(m.id) ?? 0,
  }))
}

export async function lookupBarcodeAction(code: string): Promise<MaterialResult | null> {
  const c = code.trim()
  if (!c) return null

  const mat = await localDB.materials.filter(m =>
    m.is_active && (m.isbn === c || m.tracking_id === c || m.item_code === c)
  ).first()

  if (!mat) return null

  const stocks = await localDB.stock.where('material_id').equals(mat.id).toArray()
  const totalStock = stocks.reduce((sum, s) => sum + s.qty_in_hand, 0)

  return {
    id: mat.id,
    title: mat.title,
    author: mat.author ?? '',
    isbn: mat.isbn ?? '',
    itemCode: mat.item_code ?? '',
    mrp: mat.mrp,
    discountPct: mat.discount_pct ?? 0,
    stock: totalStock,
  }
}

export interface BillItem {
  materialId: string
  title: string
  isbn: string
  qty: number
  mrp: number
  discountPct: number
  discountAmount: number
  rate: number
  total: number
}

export interface SaveBillPayload {
  invoiceNo: string
  customerName: string | null
  customerPhone: string | null
  locationId: string
  invoiceDate: string
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
  const invoiceId = uuid()

  await localDB.salesInvoices.add({
    id: invoiceId,
    invoice_no: payload.invoiceNo,
    customer_name: payload.customerName || null,
    customer_phone: payload.customerPhone || null,
    customer_id: null,
    location_id: payload.locationId,
    invoice_date: payload.invoiceDate,
    subtotal_mrp: payload.subtotalMrp,
    discount_amount: payload.totalDiscount,
    total_amount: payload.grandTotal,
    paid_amount: payload.grandTotal,
    balance_due: 0,
    payment_mode: payload.paymentMode,
    payment_ref: null,
    status: 'paid',
    created_by: payload.createdBy || null,
    created_at: nowISO(),
  })

  for (const item of payload.items) {
    await localDB.salesInvoiceItems.add({
      id: uuid(),
      invoice_id: invoiceId,
      material_id: item.materialId,
      title: item.title,
      isbn: item.isbn || null,
      qty: item.qty,
      mrp: item.mrp,
      discount_pct: item.discountPct,
      discount_amount: parseFloat((item.discountAmount * item.qty).toFixed(2)),
      rate: item.rate,
      total_amount: item.total,
    })

    // Deduct stock
    const stockRow = await localDB.stock
      .where('[material_id+location_id]')
      .equals([item.materialId, payload.locationId])
      .first()

    if (stockRow) {
      await localDB.stock.update(stockRow.id, {
        qty_in_hand: Math.max(0, stockRow.qty_in_hand - item.qty),
      })
    }
  }

  return { invoiceId }
}

export interface InvoiceListRow {
  id: string
  invoice_no: string
  invoice_date: string
  customer_name: string | null
  customer_phone: string | null
  payment_mode: string
  subtotal_mrp: number
  discount_amount: number
  total_amount: number
  status: string
  items_count: number
}

export interface InvoiceDetailItem {
  title: string
  isbn: string | null
  qty: number
  mrp: number
  discount_pct: number
  rate: number
  total_amount: number
}

export async function getInvoicesAction(filters: {
  from?: string
  to?: string
  search?: string
  paymentMode?: string
}): Promise<InvoiceListRow[]> {
  let invoices = await localDB.salesInvoices
    .orderBy('invoice_date')
    .reverse()
    .toArray()

  if (filters.from) invoices = invoices.filter(i => i.invoice_date >= filters.from!)
  if (filters.to) invoices = invoices.filter(i => i.invoice_date <= filters.to!)
  if (filters.paymentMode && filters.paymentMode !== 'all') {
    invoices = invoices.filter(i => i.payment_mode === filters.paymentMode)
  }
  if (filters.search?.trim()) {
    const s = filters.search.trim().toLowerCase()
    invoices = invoices.filter(i =>
      i.invoice_no.toLowerCase().includes(s) ||
      (i.customer_name ?? '').toLowerCase().includes(s)
    )
  }

  invoices = invoices.slice(0, 300)

  const allItems = await localDB.salesInvoiceItems.toArray()
  const countMap = new Map<string, number>()
  for (const item of allItems) {
    countMap.set(item.invoice_id, (countMap.get(item.invoice_id) ?? 0) + 1)
  }

  return invoices.map(inv => ({
    id: inv.id,
    invoice_no: inv.invoice_no,
    invoice_date: inv.invoice_date,
    customer_name: inv.customer_name ?? null,
    customer_phone: inv.customer_phone ?? null,
    payment_mode: inv.payment_mode,
    subtotal_mrp: inv.subtotal_mrp,
    discount_amount: inv.discount_amount,
    total_amount: inv.total_amount,
    status: inv.status,
    items_count: countMap.get(inv.id) ?? 0,
  }))
}

export async function getInvoiceItemsAction(invoiceId: string): Promise<InvoiceDetailItem[]> {
  const items = await localDB.salesInvoiceItems.where('invoice_id').equals(invoiceId).toArray()
  return items.map(item => ({
    title: item.title ?? '',
    isbn: item.isbn ?? null,
    qty: item.qty,
    mrp: item.mrp,
    discount_pct: item.discount_pct,
    rate: item.rate,
    total_amount: item.total_amount,
  }))
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

  for (const item of items) {
    const stockRow = await localDB.stock
      .where('[material_id+location_id]')
      .equals([item.materialId, locationId])
      .first()
    if (stockRow) {
      await localDB.stock.update(stockRow.id, {
        qty_in_hand: Math.max(0, stockRow.qty_in_hand - item.qty),
      })
    }
  }
}
