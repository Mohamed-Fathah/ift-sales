// src/lib/invoice-number.ts
import { createClient } from '@/lib/supabase/client'

export type InvoiceType =
  | 'sales' | 'purchase' | 'transfer'
  | 'return_sales' | 'return_purchase'
  | 'payment' | 'expense'

export async function getNextInvoiceNo(type: InvoiceType, prefix?: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('fn_next_invoice_no', { p_type: type })
  if (error) throw new Error(`Failed to generate invoice number: ${error.message}`)
  if (!prefix) return data as string
  const match = String(data).match(/(\d+)$/)
  if (match) return `${prefix}${match[1].padStart(3, '0')}`
  return data as string
}
