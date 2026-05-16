'use server'

import { createAdminClient } from '@/lib/supabase/admin'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getPartiesAction(): Promise<PartyRow[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('parties')
    .select('*')
    .order('name')
  if (error) throw new Error(error.message)
  return ((data ?? []) as any[]).map(r => ({
    id:              r.id,
    name:            r.name            ?? '',
    party_type:      r.party_type      ?? 'customer',
    contact_person:  r.contact_person  ?? '',
    phone:           r.phone           ?? '',
    whatsapp:        r.whatsapp        ?? '',
    email:           r.email           ?? '',
    address:         r.address         ?? '',
    city:            r.city            ?? '',
    gstin:           r.gstin           ?? '',
    credit_limit:    Number(r.credit_limit    ?? 0),
    credit_days:     Number(r.credit_days     ?? 0),
    opening_balance: Number(r.opening_balance ?? 0),
    notes:           r.notes           ?? '',
    is_active:       Boolean(r.is_active ?? true),
  }))
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function savePartyAction(input: SavePartyInput): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('parties')
    .insert({
      name:            input.name,
      party_type:      input.party_type,
      contact_person:  input.contact_person  || null,
      phone:           input.phone           || null,
      whatsapp:        input.whatsapp        || null,
      email:           input.email           || null,
      address:         input.address         || null,
      city:            input.city            || null,
      gstin:           input.gstin           || null,
      credit_limit:    input.credit_limit,
      credit_days:     input.credit_days,
      opening_balance: input.opening_balance,
      notes:           input.notes           || null,
      is_active:       true,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return { id: (data as any).id }
}

export async function updatePartyAction(
  id: string,
  input: SavePartyInput & { is_active: boolean },
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('parties')
    .update({
      name:            input.name,
      party_type:      input.party_type,
      contact_person:  input.contact_person  || null,
      phone:           input.phone           || null,
      whatsapp:        input.whatsapp        || null,
      email:           input.email           || null,
      address:         input.address         || null,
      city:            input.city            || null,
      gstin:           input.gstin           || null,
      credit_limit:    input.credit_limit,
      credit_days:     input.credit_days,
      opening_balance: input.opening_balance,
      notes:           input.notes           || null,
      is_active:       input.is_active,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deletePartyAction(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('parties')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}
