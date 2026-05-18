// src/lib/supabase/admin.ts
// Service-role client — bypasses RLS entirely.
// ONLY import this in server-side code ('use server' files, Route Handlers, Server Components).
// Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
            || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error(`Supabase config missing: url=${!!url} key=${!!key}`)
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
