// src/lib/supabase/admin.ts
// Service-role client — bypasses RLS entirely.
// ONLY import this in server-side code ('use server' files, Route Handlers, Server Components).
// Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
