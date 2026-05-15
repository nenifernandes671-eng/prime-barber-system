'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const router = useRouter()

  async function handleLogin() {

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  console.log('DATA:', data)
  console.log('ERROR:', error)

  if (error) {
    alert(error.message)
    return
  }

  window.location.href = '/admin'
}
  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-6">

      <div className="bg-zinc-900 p-10 rounded-3xl border border-zinc-800 w-full max-w-md">

        <h1 className="text-4xl font-bold text-white mb-8 text-center">
          Login Admin
        </h1>

        <div className="flex flex-col gap-4">

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-4 py-4 rounded-xl bg-white text-black"
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-4 py-4 rounded-xl bg-white text-black"
          />

          <button
            onClick={handleLogin}
            className="bg-yellow-500 text-black py-4 rounded-xl font-bold hover:scale-105 transition"
          >
            Entrar
          </button>

        </div>

      </div>

    </main>
  )
}