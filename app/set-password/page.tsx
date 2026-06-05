'use client'

import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
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
    let active = true

    async function checkSession() {
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        window.history.replaceState(null, '', '/set-password')
      }

      const { data: { session } } = await supabase.auth.getSession()

      if (!active) return

      if (!session) {
        setError('Link invalido ou expirado.')
        setChecking(false)
        return
      }

      let nextSlug = session.user.user_metadata?.slug || ''
      let nextNome = session.user.user_metadata?.nome || ''

      if (!nextSlug) {
        const { data: memberships } = await supabase
          .from('tenant_users')
          .select('tenant_id')
          .eq('user_id', session.user.id)
          .in('role', ['admin', 'owner'])
          .limit(1)

        if (memberships?.length) {
          const { data: tenant } = await supabase
            .from('tenants')
            .select('slug,nome')
            .eq('id', memberships[0].tenant_id)
            .maybeSingle()

          nextSlug = tenant?.slug || ''
          nextNome = nextNome || tenant?.nome || ''
        }
      }

      if (nextSlug) {
        await supabase.auth.updateUser({
          data: {
            ...session.user.user_metadata,
            slug: nextSlug,
            nome: nextNome,
          },
        })
      }

      if (!active) return

      setSlug(nextSlug)
      setNome(nextNome)
      if (!nextSlug) {
        setError('Nao encontrei a barbearia vinculada a esta conta.')
      }
      setChecking(false)
    }

    checkSession()

    return () => {
      active = false
    }
  }, [])

  async function leaveSetup() {
    await supabase.auth.signOut()
    try {
      localStorage.removeItem('kortebarber:last-access')
    } catch {}
    router.replace('/app')
  }

  async function handleSetPassword() {
    setError('')
    if (!password || !confirm) { setError('Preencha todos os campos.'); return }
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return }
    if (password !== confirm) { setError('As senhas nao coincidem.'); return }
    if (!slug) {
      setError('Nao encontrei a barbearia desta conta. Saia e entre novamente pelo app.')
      return
    }

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: {
        ...(user?.user_metadata || {}),
        password_set: true,
        slug,
        nome,
      },
    })

    if (updateError) {
      setError('Erro ao definir senha: ' + updateError.message)
      setLoading(false)
      return
    }

    router.replace(`/${slug}/admin`)
  }

  if (checking) return (
    <div style={S.loadingRoot}>
      <div style={S.spinner} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div style={S.root}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={S.card}>
        <div style={S.logoWrap}><div style={S.logo}>NB</div></div>
        <h1 style={S.title}>{slug ? 'Defina sua senha' : 'Acesso nao encontrado'}</h1>
        {slug && <p style={S.subtitle}>{slug.toUpperCase()}</p>}
        {nome && <p style={{ ...S.desc, color: '#94a3b8' }}>Bem-vindo, <strong>{nome}</strong>!</p>}
        <p style={S.desc}>
          {slug
            ? 'Crie uma senha para acessar seu painel nas proximas vezes.'
            : 'Saia desta tela e tente entrar novamente pelo app da KorteBarber.'}
        </p>

        <div style={S.form}>
          {slug && (
            <>
              <div>
                <label style={S.label}>Nova senha</label>
                <input
                  style={S.input}
                  type="password"
                  placeholder="Minimo 6 caracteres"
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
            </>
          )}

          {error && <div style={S.errorBox}>{error}</div>}

          {slug && (
            <button
              onClick={handleSetPassword}
              disabled={loading}
              style={{ ...S.btn, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <span style={S.loadingLabel}>
                  <span style={S.smallSpinner} />
                  Salvando...
                </span>
              ) : 'Salvar senha e entrar'}
            </button>
          )}

          <button type="button" onClick={leaveSetup} style={S.secondaryBtn}>
            Sair e voltar para o app
          </button>
        </div>
      </div>
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  root: { minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans','Segoe UI',sans-serif", padding: 20 },
  loadingRoot: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617' },
  spinner: { width: 32, height: 32, borderRadius: '50%', border: '3px solid #1e2535', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite' },
  card: { width: '100%', maxWidth: 400, background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '36px 32px' },
  logoWrap: { display: 'flex', justifyContent: 'center', marginBottom: 20 },
  logo: { width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#2563eb,#37e0cf)', border: '1px solid rgba(96,165,250,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#f8fafc' },
  title: { margin: 0, fontSize: 22, fontWeight: 800, color: '#f1f5f9', textAlign: 'center' },
  subtitle: { margin: '4px 0 0', color: '#64748b', fontSize: 13, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
  desc: { margin: '8px 0 0', color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 1.6 },
  form: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 },
  input: { width: '100%', padding: '12px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#f1f5f9', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'DM Sans,sans-serif' },
  errorBox: { padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#f87171', fontSize: 13, lineHeight: 1.45 },
  btn: { padding: 13, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', width: '100%', boxShadow: '0 4px 20px rgba(37,99,235,0.3)' },
  secondaryBtn: { padding: 12, borderRadius: 12, border: '1px solid rgba(148,163,184,0.22)', background: 'rgba(15,23,42,0.55)', color: '#cbd5e1', fontWeight: 700, fontSize: 14, cursor: 'pointer', width: '100%' },
  loadingLabel: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  smallSpinner: { width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite', display: 'inline-block' },
}
