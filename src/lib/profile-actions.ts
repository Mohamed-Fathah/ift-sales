// Offline mode — profile is loaded from local DB
import { localDB } from '@/lib/local-db'

export async function fetchProfileById(userId: string) {
  return localDB.profiles.get(userId) ?? null
}
