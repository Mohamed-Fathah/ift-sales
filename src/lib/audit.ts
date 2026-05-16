// src/lib/audit.ts
import { createClient } from '@/lib/supabase/client'

export async function logChange(params: {
  tableName: string
  recordId: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  oldData?: Record<string, unknown>
  newData?: Record<string, unknown>
  userId: string
  userName: string
}) {
  const supabase = createClient()
  const changedFields: string[] = []

  if (params.oldData && params.newData) {
    for (const key of Object.keys(params.newData)) {
      if (JSON.stringify(params.oldData[key]) !== JSON.stringify(params.newData[key])) {
        changedFields.push(key)
      }
    }
  }

  await supabase.from('audit_log').insert({
    table_name:     params.tableName,
    record_id:      params.recordId,
    action:         params.action,
    old_data:       params.oldData ?? null,
    new_data:       params.newData ?? null,
    changed_fields: changedFields,
    user_id:        params.userId,
    user_name:      params.userName,
  })
}

// Format audit log for display in timeline UI
export function formatAuditEntry(entry: {
  action: string
  user_name: string
  created_at: string
  changed_fields: string[]
  old_data: Record<string, unknown>
  new_data: Record<string, unknown>
}) {
  const date = new Date(entry.created_at).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  const changes = entry.changed_fields?.map(field => {
    const oldVal = entry.old_data?.[field] ?? '—'
    const newVal = entry.new_data?.[field] ?? '—'
    return { field, from: String(oldVal), to: String(newVal) }
  }) ?? []

  return { date, user: entry.user_name, action: entry.action, changes }
}
