'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getTenantAccess } from '@/lib/subscription-access'

export default function BarberLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('Email ou senha inválidos')
      setLoading(false)
      return
    }

    let { data: barber, error: barberError } = await supabase
      .from('barbeiros')
      .select('id, ativo, tenant_id')
      .eq('user_id', data.user.id)
      .maybeSingle()

    if (!barber && data.user.email) {
      const fallback = await supabase
        .from('barbeiros')
        .select('id, ativo, tenant_id')
        .eq('email', data.user.email)
        .maybeSingle()

      barber = fallback.data
      barberError = fallback.error

      if (barber) {
        await supabase
          .from('barbeiros')
          .update({ user_id: data.user.id })
          .eq('id', barber.id)
          .eq('tenant_id', barber.tenant_id)
      }
    }

    if (barberError || !barber) {
      await supabase.auth.signOut()
      setError('Este usuário não possui acesso de barbeiro')
      setLoading(false)
      return
    }

    if (!barber.ativo) {
      await supabase.auth.signOut()
      setError('Seu acesso de barbeiro está desativado')
      setLoading(false)
      return
    }

    const { data: tenant } = await supabase
      .from('tenants')
      .select('status, trial_ends_at')
      .eq('id', barber.tenant_id)
      .maybeSingle()

    if (!getTenantAccess(tenant).allowed) {
      await supabase.auth.signOut()
      setError('A assinatura desta barbearia esta bloqueada ou vencida')
      setLoading(false)
      return
    }

    router.push('/barber/dashboard')
  }

  return (
    <main className="min-h-screen bg-[#09090b] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-10 shadow-2xl">
        <div className="mb-10 text-center">
          <p className="text-zinc-500 uppercase tracking-[0.3em] text-sm">
            Barber Area
          </p>
          <h1 className="text-4xl font-bold text-white mt-4">
            Login do Barbeiro
          </h1>
          <p className="text-zinc-500 mt-4">
            Acesse sua agenda
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="text-sm text-zinc-400 block mb-2">
              Email
            </label>
            <input
              type="email"
              placeholder="Digite seu email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 text-white outline-none focus:border-yellow-500"
            />
          </div>

          <div>
            <label className="text-sm text-zinc-400 block mb-2">
              Senha
            </label>
            <input
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 text-white outline-none focus:border-yellow-500"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl p-4 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-2xl transition disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}
