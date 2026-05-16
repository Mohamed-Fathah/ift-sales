/**
 * IFT ERP — Sample data seed script
 * Run: npx tsx scripts/seed.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 * (Dashboard → Settings → API → service_role key)
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// ── Load .env.local manually (no dotenv dependency needed) ────────────────────
function loadEnvFile(filePath: string) {
  try {
    const lines = readFileSync(filePath, 'utf-8').split('\n')
    for (const line of lines) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.+)$/)
      if (m) {
        const key = m[1].trim()
        const val = m[2].trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) process.env[key] = val
      }
    }
  } catch {
    // no .env.local — rely on actual env vars
  }
}
loadEnvFile(resolve(process.cwd(), '.env.local'))

// ── Validate credentials ──────────────────────────────────────────────────────
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? ''
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY     ?? ''

if (!SUPABASE_URL || SUPABASE_URL.includes('your')) {
  console.error('\n❌  NEXT_PUBLIC_SUPABASE_URL is not set in .env.local\n')
  process.exit(1)
}
if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.includes('paste') || SERVICE_ROLE_KEY.includes('your')) {
  console.error('\n❌  SUPABASE_SERVICE_ROLE_KEY is not set in .env.local')
  console.error('   Find it at: Supabase Dashboard → Settings → API → service_role\n')
  process.exit(1)
}

// Service-role client bypasses RLS entirely — safe for seed scripts only
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function ok(label: string, data: unknown) {
  const count = Array.isArray(data) ? data.length : 1
  console.log(`  ✅  ${label} (${count} row${count !== 1 ? 's' : ''})`)
  return data
}

function fail(label: string, error: { message: string }) {
  console.error(`  ❌  ${label}: ${error.message}`)
  process.exit(1)
}

// ── Main seed ─────────────────────────────────────────────────────────────────
async function seed() {
  console.log('\n🌱  IFT ERP — Seed script starting…\n')

  // ── 1. Get org_id ──────────────────────────────────────────────────────────
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (orgErr || !org) fail('organizations (fetch)', orgErr ?? { message: 'No row found' })
  const orgId = (org as { id: string; name: string }).id
  ok(`org: "${(org as any).name}"`, org)

  // ── 2. Get location_id (Main Office) ───────────────────────────────────────
  const { data: loc, error: locErr } = await supabase
    .from('locations')
    .select('id, name')
    .eq('is_default', true)
    .limit(1)
    .single()

  if (locErr || !loc) fail('locations (fetch Main Office)', locErr ?? { message: 'No default location' })
  const locationId = (loc as { id: string; name: string }).id
  ok(`location: "${(loc as any).name}"`, loc)

  // ── 3. Get category_ids ────────────────────────────────────────────────────
  const { data: cats, error: catErr } = await supabase
    .from('categories')
    .select('id, name')

  if (catErr || !cats || cats.length === 0) fail('categories (fetch)', catErr ?? { message: 'No categories found' })
  ok('categories loaded', cats)

  const catMap = new Map<string, string>(
    (cats as { id: string; name: string }[]).map(c => [c.name, c.id])
  )

  // Helpers to look up category id (fallback to 'General')
  const cat = (name: string) => catMap.get(name) ?? catMap.get('General') ?? ''

  // ── 4. Upsert 5 books into materials ──────────────────────────────────────
  console.log('\n📚  Inserting materials…')

  const books = [
    {
      org_id:        orgId,
      item_code:     'IFT-001',
      isbn:          '978-81-232-0355-3',
      tracking_id:   'IFT-001',
      title:         'Arabic Words for Children',
      author:        'IFT Publication Team',
      category_id:   cat('Children'),
      publication:   'Islamic Foundation Trust',
      language:      'Arabic',
      mrp:           65,
      purchase_rate: 40,
      discount_pct:  0,
      is_active:     true,
    },
    {
      org_id:        orgId,
      item_code:     'IFT-002',
      isbn:          '978-81-232-0412-3',
      tracking_id:   'IFT-002',
      title:         'Understanding the Quran',
      author:        'Dr. Abdul Karim',
      category_id:   cat('Quran & Tafseer'),
      publication:   'Islamic Foundation Trust',
      language:      'English',
      mrp:           180,
      purchase_rate: 120,
      discount_pct:  5,
      is_active:     true,
    },
    {
      org_id:        orgId,
      item_code:     'IFT-003',
      isbn:          '978-81-232-0201-3',
      tracking_id:   'IFT-003',
      title:         'Prophet\'s Biography Seerah',
      author:        'Maulana Safi ur Rahman',
      category_id:   cat('Seerah'),
      publication:   'Islamic Foundation Trust',
      language:      'Tamil',
      mrp:           250,
      purchase_rate: 160,
      discount_pct:  10,
      is_active:     true,
    },
    {
      org_id:        orgId,
      item_code:     'IFT-004',
      isbn:          '978-81-232-0700-1',
      tracking_id:   'IFT-004',
      title:         'Dua and Dhikr Collection',
      author:        'IFT Publication Team',
      category_id:   cat('Prayer & Dua'),
      publication:   'Islamic Foundation Trust',
      language:      'Arabic',
      mrp:           95,
      purchase_rate: 60,
      discount_pct:  0,
      is_active:     true,
    },
    {
      org_id:        orgId,
      item_code:     'IFT-005',
      isbn:          '978-81-232-0611-0',
      tracking_id:   'IFT-005',
      title:         'Stories of the Prophets',
      author:        'Ibn Kathir (Trans.)',
      category_id:   cat('Stories'),
      publication:   'Islamic Foundation Trust',
      language:      'Tamil',
      mrp:           145,
      purchase_rate: 90,
      discount_pct:  5,
      is_active:     true,
    },
  ]

  const { data: insertedMats, error: matErr } = await supabase
    .from('materials')
    .upsert(books, { onConflict: 'item_code', ignoreDuplicates: false })
    .select('id, item_code, title, mrp')

  if (matErr) fail('materials (upsert)', matErr)
  ok('materials upserted', insertedMats)

  // ── 5. Insert stock rows ───────────────────────────────────────────────────
  console.log('\n📦  Inserting stock…')

  // Build a map: item_code → material id from what was just inserted
  const matMap = new Map<string, string>(
    (insertedMats as { id: string; item_code: string }[]).map(m => [m.item_code, m.id])
  )

  // Stock quantities in the same order as books above
  const stockQtys: Record<string, number> = {
    'IFT-001': 100,
    'IFT-002': 45,
    'IFT-003': 30,
    'IFT-004': 60,
    'IFT-005': 8,
  }

  const stockRows = Object.entries(stockQtys)
    .filter(([code]) => matMap.has(code))
    .map(([code, qty]) => ({
      material_id:  matMap.get(code)!,
      location_id:  locationId,
      qty_in_hand:  qty,
      qty_reserved: 0,
    }))

  const { data: insertedStock, error: stockErr } = await supabase
    .from('stock')
    .upsert(stockRows, { onConflict: 'material_id,location_id', ignoreDuplicates: false })
    .select('material_id, qty_in_hand')

  if (stockErr) fail('stock (upsert)', stockErr)
  ok('stock rows upserted', insertedStock)

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────')
  console.log('📋  Seed summary\n')
  ;(insertedMats as any[]).forEach(m => {
    const qty = stockQtys[m.item_code] ?? '?'
    console.log(`  ${m.item_code}  ${m.title.padEnd(35)}  MRP ₹${m.mrp}  Stock: ${qty}`)
  })
  console.log('\n✅  Seed complete!\n')
}

seed().catch(err => {
  console.error('\n❌  Unexpected error:', err)
  process.exit(1)
})
