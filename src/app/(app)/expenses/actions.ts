// Expense actions — offline via Dexie IndexedDB
import { localDB } from '@/lib/local-db'

export async function getExpenseCategoriesAction(): Promise<{ id: string; name: string }[]> {
  return localDB.expenseCategories.orderBy('name').toArray()
}
