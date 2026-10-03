/**
 * Script to parse raw OCR book data and seed into Supabase materials catalog
 * Run: npx tsx scripts/parse-and-seed-books.ts
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// ── Load .env.local manually ────────────────────
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
    // ignore
  }
}
loadEnvFile(resolve(process.cwd(), '.env.local'))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('\n❌  Missing Supabase credentials in .env.local\n')
  process.exit(1)
}

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

// ── Parse OCR File ────────────────────────────────────────────────────────────
function parseBooks(filePath: string) {
  const rawText = readFileSync(filePath, 'utf-8')
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)

  const books = []

  for (const line of lines) {
    // Typical line: Sr Title Edition Author ISBN
    // Example: 1 Hussan (Rali) 1 Dr. Ali Mohammad Assallaabi 978-81-687174-9-7
    // There might be some trailing notes like "Cancelled - Double Entry"
    const isbnMatch = line.match(/(978-81-[\d\-]+)/)
    if (!isbnMatch) continue

    const isbn = isbnMatch[1]
    const isbnIndex = line.indexOf(isbn)

    // Everything before ISBN is Sr, Title, Edition, Author
    let beforeIsbn = line.substring(0, isbnIndex).trim()

    // Extract Sr No (first token)
    const tokens = beforeIsbn.split(' ')
    const srNo = tokens[0]

    // Find Edition
    // We can assume edition is a number somewhere between Title and Author
    // Often it is a single standalone number before a known author prefix like Dr. / Syed / Moulana etc,
    // but the safest way is looking for a standalone number. Let's find the LAST standalone number before Author.
    let edition = ''
    let title = ''
    let author = ''

    // A simple regex approach:
    // ^(\d+)\s+(.+?)\s+(\d+)\s+(.+)$
    // Sr No | Title | Edition | Author
    const parseRegex = /^(\d+)\s+(.+?)\s+(\d+|Hajj Umra Vazhikaatti)\s+(.+)$/
    const match = beforeIsbn.match(parseRegex)

    if (match) {
      title = match[2].trim()
      edition = match[3].trim()
      author = match[4].trim()
    } else {
      // Fallback
      title = beforeIsbn.substring(srNo.length).trim()
      author = "Unknown"
    }

    books.push({
      item_code: `IFT-B-${isbn.replace(/-/g, '')}`,
      isbn: isbn,
      title: title.substring(0, 200), // Safety truncation
      author: author.substring(0, 100),
      // We ignore edition for the database as there isn't an edition column in materials
    })
  }

  return books
}

// ── Main script ───────────────────────────────────────────────────────────────
async function run() {
  console.log('\n🌱  IFT ERP — PDF Books Seed script starting…\n')

  const booksList = parseBooks(resolve(process.cwd(), 'scripts', 'raw-books.txt'))
  console.log(`Parsed ${booksList.length} books from raw text.`)

  // 1. Get org_id
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (orgErr || !org) fail('organizations (fetch)', orgErr ?? { message: 'No row found' })
  const orgId = org?.id

  // 2. Get category_id for General
  const { data: cat, error: catErr } = await supabase
    .from('categories')
    .select('id')
    .eq('name', 'General')
    .limit(1)
    .single()

  let catId = null
  if (cat && !catErr) catId = cat.id

  // Prepare objects to insert
  const materials = booksList.map(b => ({
    org_id: orgId,
    item_code: b.item_code,
    isbn: b.isbn,
    tracking_id: b.isbn,
    title: b.title,
    author: b.author,
    category_id: catId,
    publication: 'Islamic Foundation Trust',
    language: 'Tamil',
    mrp: 0,
    purchase_rate: 0,
    discount_pct: 0,
    is_active: true,
  }))

  console.log('\n📚  Inserting materials in batches…')

  // Insert in batches of 50 to avoid any Supabase limits
  const BATCH_SIZE = 50
  for (let i = 0; i < materials.length; i += BATCH_SIZE) {
    const batch = materials.slice(i, i + BATCH_SIZE)
    const { data, error } = await supabase
      .from('materials')
      .upsert(batch, { onConflict: 'item_code', ignoreDuplicates: false })

    if (error) {
      fail(`batch insert failed at index ${i}`, error)
    }
  }

  console.log(`\n✅ Successfully upserted ${materials.length} books into the catalog!`)
}

run().catch(err => {
  console.error('\n❌  Unexpected error:', err)
  process.exit(1)
})
