'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function createUserAction(input: {
  fullName: string
  email: string
  password: string
  role: string
}): Promise<void> {
  const supabase = createAdminClient()

  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  })
  if (error) throw new Error(error.message)

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id:        data.user.id,
      full_name: input.fullName,
      email:     input.email,
      role:      input.role,
      status:    'active',
    })
  if (profileError) throw new Error(profileError.message)
}
