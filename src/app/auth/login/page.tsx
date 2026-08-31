'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'
import toast from 'react-hot-toast'

const schema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const router  = useRouter()
  const setUser = useAuthStore((s) => s.setUser)
  const [loading, setLoading]   = useState(false)
  const [showPass, setShowPass] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const supabase = createClient()

      const { error, data: auth } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
      if (error) throw error

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', auth.user.id)
        .single()

      console.log('[Login] auth.user.id:', auth.user.id)
      console.log('[Login] profile:', profile, '| error:', profileErr)
      if (profile) setUser(profile)
      router.push('/dashboard')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0f1a44 0%, #1B2A6B 60%, #2D3F8F 100%)' }}
    >
      <div className="w-full max-w-[400px]">

        {/* Brand block */}
        <div className="text-center mb-8">
          {/* IFT emblem */}
          <div className="mx-auto mb-5 w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl p-3"
               style={{ background: 'rgba(200,146,42,0.15)', border: '2px solid rgba(200,146,42,0.4)' }}>
            <img src="/ift-logo.png" alt="IFT" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Islamic Foundation Trust</h1>
          <p className="text-slate-400 text-sm mt-1">Enterprise Resource Planning System</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8">
          <h2 className="text-base font-semibold text-white mb-5">Sign in to your account</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1.5">
                Email address
              </label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder="admin@iftchennai.in"
                className={`w-full rounded-lg bg-white/10 border ${errors.email ? 'border-red-400' : 'border-white/20'} text-white placeholder:text-slate-400 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/50`}
              />
              {errors.email && (
                <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`w-full rounded-lg bg-white/10 border ${errors.password ? 'border-red-400' : 'border-white/20'} text-white placeholder:text-slate-400 px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/50`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 mt-2"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Signing in…</>
              ) : (
                'Sign in'
              )}
            </button>

          </form>
        </div>

        <p className="text-center text-xs text-slate-500 mt-5">
          Built by <span className="text-slate-300">fafa creatives</span> · IFT Chennai
        </p>

      </div>
    </div>
  )
}