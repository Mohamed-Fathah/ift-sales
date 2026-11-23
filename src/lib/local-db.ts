// src/lib/local-db.ts
// Full offline IndexedDB via Dexie — replaces Supabase entirely
import Dexie, { type Table } from 'dexie'

function uuid() {
  return crypto.randomUUID()
}

function nowISO() {
  return new Date().toISOString()
}

// ─── Entity interfaces ──────────────────────────────────────────────────────

export interface DBOrganization {
  id: string
  name: string
  address: string
  city: string
  phone: string
  email: string
  gstin: string
  invoice_prefix: string
  receipt_footer: string
  low_stock_threshold: number
}

export interface DBProfile {
  id: string
  full_name: string
  email: string
  phone: string
  role: 'superadmin' | 'admin' | 'manager' | 'billing' | 'viewer'
  status: string
  avatar_url: string
  org_id: string
  created_at: string
}

export interface DBCategory {
  id: string
  name: string
}

export interface DBExpenseCategory {
  id: string
  name: string
}

export interface DBLocation {
  id: string
  name: string
  address: string
  is_default: boolean
}

export interface DBParty {
  id: string
  name: string
  party_type: 'supplier' | 'customer' | 'both'
  contact_person: string
  phone: string
  whatsapp: string
  email: string
  address: string
  city: string
  gstin: string
  credit_limit: number
  credit_days: number
  opening_balance: number
  notes: string
  is_active: boolean
}

export interface DBMaterial {
  id: string
  item_code: string
  isbn: string
  tracking_id: string
  title: string
  author: string
  category_id: string
  publication: string
  language: string
  mrp: number
  purchase_rate: number
  discount_pct: number
  description: string
  is_active: boolean
  created_at: string
}

export interface DBStock {
  id: string
  material_id: string
  location_id: string
  qty_in_hand: number
}

export interface DBStockMovement {
  id: string
  material_id: string
  location_id: string
  movement_type: string
  qty: number
  rate: number | null
  ref_id: string | null
  ref_type: string | null
  reference_id: string | null
  notes: string
  created_by: string | null
  created_at: string
}

export interface DBSalesInvoice {
  id: string
  invoice_no: string
  customer_name: string | null
  customer_phone: string | null
  customer_id: string | null
  location_id: string
  invoice_date: string
  subtotal_mrp: number
  discount_amount: number
  total_amount: number
  paid_amount: number
  balance_due: number
  payment_mode: string
  payment_ref: string | null
  status: string
  created_by: string | null
  created_at: string
}

export interface DBSalesInvoiceItem {
  id: string
  invoice_id: string
  material_id: string
  title: string
  isbn: string | null
  qty: number
  mrp: number
  discount_pct: number
  discount_amount: number
  rate: number
  total_amount: number
}

export interface DBPurchaseInvoice {
  id: string
  invoice_no: string
  supplier_id: string
  location_id: string
  invoice_date: string
  supplier_inv_no: string
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
  created_by: string | null
  created_at: string
}

export interface DBPurchaseInvoiceItem {
  id: string
  invoice_id: string
  material_id: string
  qty: number
  rate: number
  mrp: number
  discount_pct: number
  total_amount: number
}

export interface DBExpense {
  id: string
  category_id: string
  location_id: string
  expense_date: string
  description: string
  amount: number
  payment_mode: string
  paid_to: string
  created_by: string | null
  created_at: string
}

export interface DBAuditLog {
  id: string
  table_name: string
  record_id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  changed_fields: string[]
  user_id: string
  user_name: string
  created_at: string
}

export interface DBSalesReturn {
  id: string
  return_no: string
  return_date: string
  sales_invoice_id: string
  total_amount: number
  notes: string
  status: string
  created_by: string | null
  created_at: string
}

export interface DBSalesReturnItem {
  id: string
  return_id: string
  material_id: string
  qty: number
  rate: number
  amount: number
}

export interface DBPurchaseReturn {
  id: string
  return_no: string
  return_date: string
  purchase_invoice_id: string
  total_amount: number
  notes: string
  status: string
  created_by: string | null
  created_at: string
}

export interface DBPurchaseReturnItem {
  id: string
  return_id: string
  material_id: string
  qty: number
  rate: number
  amount: number
}

export interface DBInvoiceCounter {
  type: string
  last_number: number
}

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

// ─── Database ────────────────────────────────────────────────────────────────

class IFTLocalDB extends Dexie {
  organizations!: Table<DBOrganization, string>
  profiles!: Table<DBProfile, string>
  categories!: Table<DBCategory, string>
  expenseCategories!: Table<DBExpenseCategory, string>
  locations!: Table<DBLocation, string>
  parties!: Table<DBParty, string>
  materials!: Table<DBMaterial, string>
  stock!: Table<DBStock, string>
  stockMovements!: Table<DBStockMovement, string>
  salesInvoices!: Table<DBSalesInvoice, string>
  salesInvoiceItems!: Table<DBSalesInvoiceItem, string>
  purchaseInvoices!: Table<DBPurchaseInvoice, string>
  purchaseInvoiceItems!: Table<DBPurchaseInvoiceItem, string>
  expenses!: Table<DBExpense, string>
  salesReturns!: Table<DBSalesReturn, string>
  salesReturnItems!: Table<DBSalesReturnItem, string>
  purchaseReturns!: Table<DBPurchaseReturn, string>
  purchaseReturnItems!: Table<DBPurchaseReturnItem, string>
  auditLog!: Table<DBAuditLog, string>
  invoiceCounters!: Table<DBInvoiceCounter, string>
  billingDrafts!: Table<BillingDraft, number>

  constructor() {
    super('IFT_ERP_OfflineDB')
    this.version(1).stores({
      organizations:        'id',
      profiles:             'id, email, role',
      categories:           'id, name',
      expenseCategories:    'id, name',
      locations:            'id, name, is_default',
      parties:              'id, name, party_type, is_active',
      materials:            'id, item_code, isbn, tracking_id, title, category_id, is_active',
      stock:                'id, material_id, location_id, [material_id+location_id]',
      stockMovements:       'id, material_id, location_id, movement_type, created_at',
      salesInvoices:        'id, invoice_no, invoice_date, status, created_at',
      salesInvoiceItems:    'id, invoice_id, material_id',
      purchaseInvoices:     'id, invoice_no, invoice_date, supplier_id, status, created_at',
      purchaseInvoiceItems: 'id, invoice_id, material_id',
      expenses:             'id, category_id, location_id, expense_date, created_at',
      auditLog:             'id, table_name, record_id, created_at',
      invoiceCounters:      'type',
      billingDrafts:        '++id, userId, updatedAt',
    })
    this.version(2).stores({
      salesReturns:         'id, return_no, return_date, sales_invoice_id, status',
      salesReturnItems:     'id, return_id, material_id',
      purchaseReturns:      'id, return_no, return_date, purchase_invoice_id, status',
      purchaseReturnItems:  'id, return_id, material_id',
    })
  }
}

export const localDB = new IFTLocalDB()

// ─── Seed default data on first run ──────────────────────────────────────────

export async function seedIfEmpty() {
  const orgCount = await localDB.organizations.count()
  if (orgCount > 0) return

  const orgId = uuid()
  const profileId = uuid()

  await localDB.organizations.add({
    id: orgId,
    name: 'Islamic Foundation Trust',
    address: 'Chennai',
    city: 'Chennai',
    phone: '',
    email: '',
    gstin: '',
    invoice_prefix: 'IFT-BILL-',
    receipt_footer: 'Thank you for your purchase!',
    low_stock_threshold: 10,
  })

  await localDB.profiles.add({
    id: profileId,
    full_name: 'Admin',
    email: 'admin@iftchennai.in',
    phone: '',
    role: 'superadmin',
    status: 'active',
    avatar_url: '',
    org_id: orgId,
    created_at: nowISO(),
  })

  await localDB.locations.add({
    id: uuid(),
    name: 'Main Store',
    address: 'Chennai',
    is_default: true,
  })

  const defaultCategories = ['Islamic Books', 'Tamil Books', 'English Books', 'Urdu Books', 'Children Books', 'Stationery', 'Other']
  for (const name of defaultCategories) {
    await localDB.categories.add({ id: uuid(), name })
  }

  const defaultExpenseCategories = ['Rent', 'Electricity', 'Salary', 'Transport', 'Maintenance', 'Tea & Snacks', 'Printing', 'Other']
  for (const name of defaultExpenseCategories) {
    await localDB.expenseCategories.add({ id: uuid(), name })
  }

  // Initialize invoice counters
  for (const type of ['sales', 'purchase', 'transfer', 'return_sales', 'return_purchase', 'payment', 'expense']) {
    await localDB.invoiceCounters.add({ type, last_number: 0 })
  }
}

// ─── Invoice number generator (replaces Supabase RPC) ───────────────────────

export async function getNextInvoiceNo(type: string, prefix?: string): Promise<string> {
  const counter = await localDB.invoiceCounters.get(type)
  const next = (counter?.last_number ?? 0) + 1
  await localDB.invoiceCounters.put({ type, last_number: next })

  const PREFIXES: Record<string, string> = {
    sales: 'IFT-BILL-',
    purchase: 'IFT-PUR-',
    transfer: 'IFT-TRF-',
    return_sales: 'IFT-SRT-',
    return_purchase: 'IFT-PRT-',
    payment: 'IFT-PAY-',
    expense: 'IFT-EXP-',
  }
  const p = prefix ?? PREFIXES[type] ?? 'IFT-'
  return `${p}${String(next).padStart(4, '0')}`
}

// ─── Audit logger (replaces Supabase audit_log insert) ──────────────────────

export async function logChange(params: {
  tableName: string
  recordId: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  oldData?: Record<string, unknown>
  newData?: Record<string, unknown>
  userId: string
  userName: string
}) {
  const changedFields: string[] = []
  if (params.oldData && params.newData) {
    for (const key of Object.keys(params.newData)) {
      if (JSON.stringify(params.oldData[key]) !== JSON.stringify(params.newData[key])) {
        changedFields.push(key)
      }
    }
  }

  await localDB.auditLog.add({
    id: uuid(),
    table_name: params.tableName,
    record_id: params.recordId,
    action: params.action,
    old_data: params.oldData ?? null,
    new_data: params.newData ?? null,
    changed_fields: changedFields,
    user_id: params.userId,
    user_name: params.userName,
    created_at: nowISO(),
  })
}

// ─── Helper: generate UUID ──────────────────────────────────────────────────

export { uuid, nowISO }

// ─── Billing draft helpers (kept from original) ─────────────────────────────

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

// ─── Billing helpers for barcode / sync ────────────────────────────────────

export async function syncMaterialsToLocal(_mats: any[]) {
  // No-op in offline mode — materials are already in IndexedDB
}

export async function findByBarcode(code: string): Promise<DBMaterial | undefined> {
  const byIsbn = await localDB.materials.where('isbn').equals(code).first()
  if (byIsbn) return byIsbn
  const byTracking = await localDB.materials.where('tracking_id').equals(code).first()
  return byTracking
}
