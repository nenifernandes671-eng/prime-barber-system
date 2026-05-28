'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SlugLoginPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)

  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState('')
  const [showPass, setShowPass] = useState(false)

  // ✅ NOVO
  const [checkingTenant, setCheckingTenant] = useState(true)
  const [tenantExists, setTenantExists] = useState(false)

  // ✅ VALIDA O SLUG
  useEffect(() => {
    async function validateTenant() {
      const { data } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()

      if (data) {
        setTenantExists(true)
      } else {
        setTenantExists(false)
      }

      setCheckingTenant(false)
    }

    if (slug) {
      validateTenant()
    }
  }, [slug])

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Preencha e-mail e senha.')
      return
    }

    setLoading(true)
    setError('')

    const { data, error: authError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

    if (authError || !data.user) {
      setError('E-mail ou senha inválidos.')
      setLoading(false)
      return
    }

    // ✅ BUSCA TENANT
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!tenantData) {
      await supabase.auth.signOut()

      setError('Barbearia não encontrada.')
      setLoading(false)

      return
    }

    // ✅ VERIFICA ACESSO
    const { data: membership } = await supabase
      .from('tenant_users')
      .select('role')
      .eq('user_id', data.user.id)
      .eq('tenant_id', tenantData.id)
      .maybeSingle()

    if (!membership) {
      await supabase.auth.signOut()

      setError('Você não tem acesso a esta barbearia.')
      setLoading(false)

      return
    }

    router.push(`/${slug}/admin`)
  }

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setResetMessage('')
      setError('Digite seu e-mail para receber o link de redefinição.')
      return
    }

    setResetLoading(true)
    setError('')
    setResetMessage('')

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), slug }),
    })

    setResetLoading(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Não consegui enviar o e-mail de redefinição agora.')
      return
    }

    setResetMessage('Se este e-mail estiver cadastrado, enviamos o link para redefinir sua senha.')
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Enter') {
      handleLogin()
    }
  }

  // ✅ LOADING VALIDAÇÃO TENANT
  if (checkingTenant) {
    return (
      <div style={styles.loadingRoot}>
        <div style={styles.spinner} />
      </div>
    )
  }

  // ✅ TENANT NÃO EXISTE
  if (!tenantExists) {
    return (
      <div style={styles.notFoundRoot}>
        <div style={styles.notFoundCard}>
          <div style={styles.notFoundIcon}>⚠️</div>

          <h1 style={styles.notFoundTitle}>
            Barbearia não encontrada
          </h1>

          <p style={styles.notFoundText}>
            O endereço acessado não existe.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.root}>
      <div style={styles.bgDecor1} />
      <div style={styles.bgDecor2} />

      <div style={styles.card}>
        <div style={styles.topSection}>
          <div style={styles.iconWrap}>
            <img src="/icons/nexbarber-192.png" alt="NexBarber" style={styles.logoImg} />
          </div>

          <h1 style={styles.title}>Painel Admin</h1>

          <p style={styles.subtitle}>{slug}</p>
        </div>

        <div style={styles.form}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>E-mail</label>

            <div style={styles.inputWrap}>
              <span style={styles.inputIcon}>✉</span>

              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                style={styles.input}
                autoComplete="email"
              />
            </div>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Senha</label>

            <div style={styles.inputWrap}>
              <span style={styles.inputIcon}>🔒</span>

              <input
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  ...styles.input,
                  paddingRight: 44,
                }}
                autoComplete="current-password"
              />

              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                style={styles.eyeBtn}
                tabIndex={-1}
              >
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {error && (
            <div style={styles.errorBox}>
              <span>⚠️</span>
              {error}
            </div>
          )}

          {resetMessage && (
            <div style={styles.successBox}>
              <span>✓</span>
              {resetMessage}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              ...styles.submitBtn,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Entrando...' : 'Entrar no Painel'}
          </button>

          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={resetLoading}
            style={{
              ...styles.resetBtn,
              opacity: resetLoading ? 0.7 : 1,
            }}
          >
            {resetLoading ? 'Enviando...' : 'Esqueci minha senha'}
          </button>
        </div>

        <p style={styles.footer}>
          Barbeiro?{' '}
          <a
            href="/barber/login"
            style={{
              color: '#60a5fa',
              textDecoration: 'none',
            }}
          >
            Acesse seu painel aqui
          </a>
        </p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f1117',
    fontFamily: "'DM Sans','Segoe UI',sans-serif",
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
  },

  loadingRoot: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f1117',
  },

  spinner: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.08)',
    borderTopColor: '#3b82f6',
    animation: 'spin 0.8s linear infinite',
  },

  notFoundRoot: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f1117',
    padding: 24,
  },

  notFoundCard: {
    width: '100%',
    maxWidth: 420,
    background: '#161b27',
    border: '1px solid #1e2535',
    borderRadius: 20,
    padding: 40,
    textAlign: 'center',
  },

  notFoundIcon: {
    fontSize: 52,
    marginBottom: 18,
  },

  notFoundTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: '#f1f5f9',
    marginBottom: 12,
  },

  notFoundText: {
    color: '#64748b',
    fontSize: 14,
    margin: 0,
  },

  bgDecor1: {
    position: 'absolute',
    top: -120,
    right: -120,
    width: 400,
    height: 400,
    borderRadius: '50%',
    background:
      'radial-gradient(circle, #1e3a5f55 0%, transparent 70%)',
    pointerEvents: 'none',
  },

  bgDecor2: {
    position: 'absolute',
    bottom: -100,
    left: -100,
    width: 320,
    height: 320,
    borderRadius: '50%',
    background:
      'radial-gradient(circle, #2a1a2e55 0%, transparent 70%)',
    pointerEvents: 'none',
  },

  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#161b27',
    borderRadius: 20,
    border: '1px solid #1e2535',
    padding: '40px 36px 32px',
    position: 'relative',
    zIndex: 1,
    boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
  },

  topSection: {
    textAlign: 'center',
    marginBottom: 36,
  },

  iconWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    backgroundColor: '#1e2d45',
    borderRadius: 16,
    fontSize: 28,
    marginBottom: 16,
    border: '1px solid #2d3f5a',
    overflow: 'hidden',
  },

  logoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },

  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#f1f5f9',
    margin: '0 0 8px',
  },

  subtitle: {
    fontSize: 13,
    color: '#64748b',
    margin: 0,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },

  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#94a3b8',
    letterSpacing: 0.3,
  },

  inputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },

  inputIcon: {
    position: 'absolute',
    left: 14,
    fontSize: 15,
    pointerEvents: 'none',
    zIndex: 1,
  },

  input: {
    width: '100%',
    padding: '12px 14px 12px 42px',
    backgroundColor: '#0f1117',
    border: '1px solid #2d3748',
    borderRadius: 10,
    color: '#f1f5f9',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  },

  eyeBtn: {
    position: 'absolute',
    right: 12,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    padding: 4,
    lineHeight: 1,
    color: '#94a3b8',
  },

  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ef444415',
    border: '1px solid #ef444430',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    color: '#f87171',
  },

  successBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#10b98118',
    border: '1px solid #10b98135',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    color: '#34d399',
  },

  submitBtn: {
    marginTop: 4,
    padding: '13px',
    borderRadius: 10,
    border: 'none',
    background:
      'linear-gradient(135deg,#2563eb,#3b82f6)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: 0.3,
  },

  resetBtn: {
    marginTop: -8,
    padding: '6px 8px',
    border: 'none',
    background: 'transparent',
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },

  footer: {
    marginTop: 28,
    textAlign: 'center',
    fontSize: 12,
    color: '#475569',
  },
}
