// User admin actions — offline via Dexie IndexedDB
import { localDB, uuid, nowISO } from '@/lib/local-db'

export async function createUserAction(input: {
  fullName: string
  email: string
  password: string
  role: string
}): Promise<void> {
  const org = await localDB.organizations.toCollection().first()
  await localDB.profiles.add({
    id: uuid(),
    full_name: input.fullName,
    email: input.email,
    phone: '',
    role: input.role as any,
    status: 'active',
    avatar_url: '',
    org_id: org?.id ?? '',
    created_at: nowISO(),
  })
}
