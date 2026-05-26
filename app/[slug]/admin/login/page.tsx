'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SlugLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!email || !password) { setError('Preencha todos os campos.'); return }
    setLoading(true); setError('')

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError('Email ou senha incorretos.'); setLoading(false); return }

    const { data: { user } } = await supabase.auth.getUser()

    // ✅ CORRIGIDO: busca o tenant_id pelo slug primeiro
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!tenant) {
      await supabase.auth.signOut()
      setError('Barbearia não encontrada.')
      setLoading(false)
      return
    }

    // ✅ CORRIGIDO: filtra por tenant_id e usa maybeSingle() (era .single() — causava 406)
    const { data: membership } = await supabase
      .from('tenant_users')
      .select('role')
      .eq('user_id', user?.id)
      .eq('tenant_id', tenant.id)
      .maybeSingle()

    if (!membership) {
      await supabase.auth.signOut()
      setError('Você não tem acesso a esta barbearia.')
      setLoading(false)
      return
    }

    router.push(`/${slug}/admin`)
  }

  return (
    <div style={S.root}>
      <div style={S.card}>
        <div style={S.logoWrap}>
          <div style={S.logo}>✂</div>
        </div>
        <h1 style={S.title}>Acesso ao Painel</h1>
        <p style={S.subtitle}>{slug.toUpperCase()}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 28 }}>
          <div>
            <label style={S.label}>Email</label>
            <input
              style={S.input}
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <div>
            <label style={S.label}>Senha</label>
            <input
              style={S.input}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          {error && (
            <div style={S.errorBox}>⚠️ {error}</div>
          )}

          <button onClick={handleLogin} disabled={loading} style={{ ...S.btn, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#475569' }}>
          Não tem conta?{' '}
          <a href="/register" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
            Cadastre sua barbearia
          </a>
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans','Segoe UI',sans-serif", padding: '20px' },
  card: { width: '100%', maxWidth: 400, background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '36px 32px' },
  logoWrap: { display: 'flex', justifyContent: 'center', marginBottom: 20 },
  logo: { width: 52, height: 52, borderRadius: 14, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 },
  title: { margin: 0, fontSize: 22, fontWeight: 800, color: '#f1f5f9', textAlign: 'center' },
  subtitle: { margin: '4px 0 0', color: '#475569', fontSize: 13, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 },
  input: { width: '100%', padding: '12px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#f1f5f9', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  errorBox: { padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#f87171', fontSize: 13 },
  btn: { padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', width: '100%', boxShadow: '0 4px 20px rgba(37,99,235,0.3)' },
}