// src/lib/invoice-number.ts — offline invoice number generator
import { getNextInvoiceNo as getNext } from '@/lib/local-db'

export type InvoiceType =
  | 'sales' | 'purchase' | 'transfer'
  | 'return_sales' | 'return_purchase'
  | 'payment' | 'expense'

export async function getNextInvoiceNo(type: InvoiceType, prefix?: string): Promise<string> {
  return getNext(type, prefix)
}
