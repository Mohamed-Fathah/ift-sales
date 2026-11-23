// Parties actions — offline via Dexie IndexedDB
import { localDB, uuid } from '@/lib/local-db'

export interface PartyRow {
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

export interface SavePartyInput {
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
}

export async function getPartiesAction(): Promise<PartyRow[]> {
  const data = await localDB.parties.orderBy('name').toArray()
  return data.map(r => ({
    id: r.id,
    name: r.name ?? '',
    party_type: r.party_type ?? 'customer',
    contact_person: r.contact_person ?? '',
    phone: r.phone ?? '',
    whatsapp: r.whatsapp ?? '',
    email: r.email ?? '',
    address: r.address ?? '',
    city: r.city ?? '',
    gstin: r.gstin ?? '',
    credit_limit: r.credit_limit ?? 0,
    credit_days: r.credit_days ?? 0,
    opening_balance: r.opening_balance ?? 0,
    notes: r.notes ?? '',
    is_active: r.is_active ?? true,
  }))
}

export async function savePartyAction(input: SavePartyInput): Promise<{ id: string }> {
  const id = uuid()
  await localDB.parties.add({
    id,
    name: input.name,
    party_type: input.party_type,
    contact_person: input.contact_person || '',
    phone: input.phone || '',
    whatsapp: input.whatsapp || '',
    email: input.email || '',
    address: input.address || '',
    city: input.city || '',
    gstin: input.gstin || '',
    credit_limit: input.credit_limit,
    credit_days: input.credit_days,
    opening_balance: input.opening_balance,
    notes: input.notes || '',
    is_active: true,
  })
  return { id }
}

export async function updatePartyAction(
  id: string,
  input: SavePartyInput & { is_active: boolean },
): Promise<void> {
  await localDB.parties.update(id, {
    name: input.name,
    party_type: input.party_type,
    contact_person: input.contact_person || '',
    phone: input.phone || '',
    whatsapp: input.whatsapp || '',
    email: input.email || '',
    address: input.address || '',
    city: input.city || '',
    gstin: input.gstin || '',
    credit_limit: input.credit_limit,
    credit_days: input.credit_days,
    opening_balance: input.opening_balance,
    notes: input.notes || '',
    is_active: input.is_active,
  })
}

export async function deletePartyAction(id: string): Promise<void> {
  await localDB.parties.delete(id)
}
