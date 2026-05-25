'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function getExpenseCategoriesAction(): Promise<{ id: string; name: string }[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('expense_categories')
    .select('id, name')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as { id: string; name: string }[]
}
