// src/types/erp.ts — All entity types

export type UserRole = 'superadmin' | 'admin' | 'manager' | 'billing' | 'viewer'
export type InvoiceStatus = 'draft' | 'confirmed' | 'partial' | 'paid' | 'cancelled'
export type PartyType = 'supplier' | 'customer' | 'both'
export type PaymentMode = 'cash' | 'upi' | 'card' | 'cheque' | 'credit'
export type StockMovementType = 'opening' | 'purchase' | 'purchase_return' | 'sale' | 'sale_return' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'damage' | 'loss'

export interface Organization {
  id: string
  name: string
  address: string
  city: string
  pincode: string
  phone: string
  email: string
  website: string
  gstin?: string
  logo_url?: string
}

export interface Profile {
  id: string
  full_name: string
  email: string
  phone?: string
  role: UserRole
  status: 'active' | 'inactive' | 'suspended'
  avatar_url?: string
  last_login?: string
  created_at: string
}

export interface Category {
  id: string
  name: string
}

export interface Location {
  id: string
  name: string
  address?: string
  is_default: boolean
}

export interface Party {
  id: string
  name: string
  party_type: PartyType
  contact_person?: string
  phone?: string
  whatsapp?: string
  email?: string
  address?: string
  city?: string
  gstin?: string
  credit_limit: number
  credit_days: number
  opening_balance: number
  is_active: boolean
}

export interface Material {
  id: string
  item_code: string
  isbn?: string
  tracking_id?: string
  title: string
  author?: string
  category_id: string
  category?: string
  publication: string
  language: string
  mrp: number
  purchase_rate: number
  discount_pct: number
  description?: string
  image_url?: string
  is_active: boolean
  // Joined
  stock?: number
  stock_value?: number
}

export interface StockSummary {
  id: string
  item_code: string
  isbn: string
  title: string
  author: string
  category: string
  mrp: number
  purchase_rate: number
  location: string
  qty_in_hand: number
  qty_available: number
  stock_value: number
}

export interface SalesInvoice {
  id: string
  invoice_no: string
  customer_name?: string
  customer_phone?: string
  customer_id?: string
  location_id: string
  invoice_date: string
  subtotal_mrp: number
  discount_amount: number
  total_amount: number
  paid_amount: number
  balance_due: number
  payment_mode: PaymentMode
  payment_ref?: string
  status: InvoiceStatus
  created_by: string
  items?: SalesInvoiceItem[]
}

export interface SalesInvoiceItem {
  id: string
  invoice_id: string
  material_id: string
  title: string
  isbn?: string
  qty: number
  mrp: number
  discount_pct: number
  discount_amount: number
  rate: number
  total_amount: number
}

export interface PurchaseInvoice {
  id: string
  invoice_no: string
  supplier_id: string
  supplier?: Party
  location_id: string
  invoice_date: string
  supplier_inv_no?: string
  due_date?: string
  subtotal: number
  discount_amount: number
  transport_charge: number
  unloading_charge: number
  other_charges: number
  total_amount: number
  paid_amount: number
  balance_due: number
  status: InvoiceStatus
  items?: PurchaseInvoiceItem[]
}

export interface PurchaseInvoiceItem {
  id: string
  invoice_id: string
  material_id: string
  material?: Material
  qty: number
  rate: number
  mrp: number
  discount_pct: number
  total_amount: number
}

export interface StockTransfer {
  id: string
  transfer_no: string
  from_location: string
  from_location_name?: string
  to_location: string
  to_location_name?: string
  transfer_date: string
  status: 'draft' | 'in_transit' | 'received' | 'cancelled'
  notes?: string
  items?: StockTransferItem[]
}

export interface StockTransferItem {
  id: string
  transfer_id: string
  material_id: string
  title?: string
  qty_sent: number
  qty_received: number
}

export interface Expense {
  id: string
  category_id: string
  category_name?: string
  location_id: string
  expense_date: string
  description: string
  amount: number
  payment_mode: PaymentMode
  paid_to?: string
  created_by: string
}

export interface AuditEntry {
  id: string
  user_name: string
  table_name: string
  record_id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  old_data: Record<string, unknown>
  new_data: Record<string, unknown>
  changed_fields: string[]
  created_at: string
}

export interface DashboardStats {
  todayRevenue: number
  todayBills: number
  todayBooksSold: number
  lowStockCount: number
  outstandingPayables: number
  outstandingReceivables: number
  monthRevenue: number
  monthExpenses: number
}
