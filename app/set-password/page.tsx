'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const [slug, setSlug] = useState('')
  const [nome, setNome] = useState('')

  useEffect(() => {
    async function checkSession() {
      // Pega tokens do hash da URL (#access_token=...&refresh_token=...)
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
      }

      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('Link inválido ou expirado.')
        setChecking(false)
        return
      }

      setSlug(session.user.user_metadata?.slug || '')
      setNome(session.user.user_metadata?.nome || '')
      setChecking(false)
    }

    checkSession()
  }, [])

  async function handleSetPassword() {
    setError('')
    if (!password || !confirm) { setError('Preencha todos os campos.'); return }
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não coincidem.'); return }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({
  password,
  data: {
    password_set: true,
  },
})

    if (updateError) {
      setError('Erro ao definir senha: ' + updateError.message)
      setLoading(false)
      return
    }

    // Aguarda sessão atualizar e redireciona
    router.push(`/${slug}/admin`)
  }

  if (checking) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #1e2535', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (error && !slug) return (
    <div style={S.root}>
      <div style={S.card}>
        <div style={S.logoWrap}><div style={S.logo}>✂</div></div>
        <h1 style={S.title}>Link expirado</h1>
        <p style={S.desc}>{error}</p>
        <button onClick={() => router.push('/')} style={S.btn}>
          Voltar ao início
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div style={S.root}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={S.card}>
        <div style={S.logoWrap}><div style={S.logo}>✂</div></div>
        <h1 style={S.title}>Defina sua senha</h1>
        {slug && <p style={S.subtitle}>{slug.toUpperCase()}</p>}
        {nome && <p style={{ ...S.desc, color: '#94a3b8' }}>Bem-vindo, <strong>{nome}</strong>!</p>}
        <p style={S.desc}>Crie uma senha para acessar seu painel nas próximas vezes.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
          <div>
            <label style={S.label}>Nova senha</label>
            <input
              style={S.input}
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
            />
          </div>
          <div>
            <label style={S.label}>Confirmar senha</label>
            <input
              style={S.input}
              type="password"
              placeholder="Repita a senha"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
            />
          </div>

          {error && <div style={S.errorBox}>⚠️ {error}</div>}

          <button
            onClick={handleSetPassword}
            disabled={loading}
            style={{ ...S.btn, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                Salvando...
              </span>
            ) : 'Salvar senha e entrar →'}
          </button>
        </div>
      </div>
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
  desc: { margin: '8px 0 0', color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 1.6 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 },
  input: { width: '100%', padding: '12px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#f1f5f9', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'DM Sans,sans-serif' },
  errorBox: { padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#f87171', fontSize: 13 },
  btn: { padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', width: '100%', boxShadow: '0 4px 20px rgba(37,99,235,0.3)' },
}