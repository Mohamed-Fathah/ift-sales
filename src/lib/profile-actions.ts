'use server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function fetchProfileById(userId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, status, avatar_url, org_id')
    .eq('id', userId)
    .single()
  if (error) {
    console.error('[fetchProfileById] error:', error.message)
    return null
  }
  return data
}
