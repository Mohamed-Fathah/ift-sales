// src/lib/local-db.ts
// Dexie (IndexedDB) — for billing drafts and offline-first data
import Dexie, { type Table } from 'dexie'

export interface BillingDraftItem {
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

export interface BillingDraft {
  id?: number
  userId: string
  locationId: string
  customerName: string
  customerPhone: string
  paymentMode: string
  items: BillingDraftItem[]
  subtotalMrp: number
  totalDiscount: number
  grandTotal: number
  updatedAt: Date
}

export interface CachedMaterial {
  id: string
  itemCode: string
  isbn: string
  trackingId: string
  title: string
  author: string
  category: string
  mrp: number
  discountPct: number
  stock: number
  updatedAt: Date
}

class IFTLocalDB extends Dexie {
  billingDrafts!: Table<BillingDraft, number>
  materials!: Table<CachedMaterial, string>

  constructor() {
    super('IFT_ERP_LocalDB')
    this.version(1).stores({
      billingDrafts: '++id, userId, updatedAt',
      materials: 'id, isbn, trackingId, title, author, category',
    })
  }
}

export const localDB = new IFTLocalDB()

// Auto-save billing draft every 30 seconds
export async function saveDraft(userId: string, draft: Omit<BillingDraft, 'id' | 'updatedAt'>) {
  const existing = await localDB.billingDrafts.where('userId').equals(userId).first()
  const data = { ...draft, userId, updatedAt: new Date() }
  if (existing?.id) {
    await localDB.billingDrafts.update(existing.id, data)
  } else {
    await localDB.billingDrafts.add(data)
  }
}

export async function loadDraft(userId: string): Promise<BillingDraft | undefined> {
  return localDB.billingDrafts.where('userId').equals(userId).first()
}

export async function clearDraft(userId: string) {
  await localDB.billingDrafts.where('userId').equals(userId).delete()
}

// Cache materials locally for fast barcode lookup
export async function syncMaterialsToLocal(materials: CachedMaterial[]) {
  await localDB.materials.bulkPut(materials)
}

export async function findByBarcode(code: string): Promise<CachedMaterial | undefined> {
  return (
    await localDB.materials.where('isbn').equals(code).first() ||
    await localDB.materials.where('trackingId').equals(code).first() ||
    await localDB.materials.where('itemCode').equals(code).first()
  )
}
