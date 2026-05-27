'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  CalendarCheck,
  Crown,
  ExternalLink,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Scissors,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getTenantAccess } from '@/lib/subscription-access'

const LAST_ACCESS_KEY = 'nexbarber:last-access'
const LAST_CLIENT_SLUG_KEY = 'nexbarber:last-client-slug'

function cleanSlug(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const sanitize = (input: string) => input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '')

  if (!trimmed.includes('.') && !trimmed.includes('/')) {
    return sanitize(trimmed)
  }

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const firstPath = url.pathname.split('/').filter(Boolean)[0]
    if (firstPath) return sanitize(firstPath)

    const host = url.hostname.replace(/^www\./, '')
    if (host === 'nexbarber.com.br') return ''
    return sanitize(host.split('.')[0] || '')
  } catch {
    const fallback = trimmed
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split('.')[0]
    return fallback ? sanitize(fallback) : ''
  }
}

export default function AppStartPage() {
  const router = useRouter()
  const [barbershop, setBarbershop] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [barberEmail, setBarberEmail] = useState('')
  const [barberPassword, setBarberPassword] = useState('')
  const [ownerLoading, setOwnerLoading] = useState(false)
  const [barberLoading, setBarberLoading] = useState(false)
  const [ownerError, setOwnerError] = useState('')
  const [barberError, setBarberError] = useState('')
  const [showOwnerPassword, setShowOwnerPassword] = useState(false)
  const [showBarberPassword, setShowBarberPassword] = useState(false)

  useEffect(() => {
    let active = true

    async function restoreAccess() {
      const lastClientSlug = localStorage.getItem(LAST_CLIENT_SLUG_KEY) || ''
      const lastAccess = localStorage.getItem(LAST_ACCESS_KEY)

      if (lastClientSlug) setBarbershop(lastClientSlug)

      const { data: { user } } = await supabase.auth.getUser()
      if (!active) return

      if (!user) {
        if (lastAccess === 'client' && lastClientSlug) {
          router.replace(`/${lastClientSlug}`)
        }
        return
      }

      const { data: memberships } = await supabase
        .from('tenant_users')
        .select('tenant_id, role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'owner'])
        .limit(1)

      if (!active) return

      if (memberships?.length) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('slug')
          .eq('id', memberships[0].tenant_id)
          .maybeSingle()

        if (!active) return

        if (tenant?.slug) {
          localStorage.setItem(LAST_ACCESS_KEY, 'owner')
          router.replace(`/${tenant.slug}/admin`)
          return
        }
      }

      let { data: barber } = await supabase
        .from('barbeiros')
        .select('id, ativo, tenant_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!barber && user.email) {
        const fallback = await supabase
          .from('barbeiros')
          .select('id, ativo, tenant_id')
          .eq('email', user.email)
          .maybeSingle()

        barber = fallback.data
      }

      if (!active || !barber?.ativo) return

      const { data: tenant } = await supabase
        .from('tenants')
        .select('status, trial_ends_at')
        .eq('id', barber.tenant_id)
        .maybeSingle()

      if (!active) return

      if (getTenantAccess(tenant).allowed) {
        localStorage.setItem(LAST_ACCESS_KEY, 'barber')
        router.replace('/barber/dashboard')
      }
    }

    restoreAccess()

    return () => {
      active = false
    }
  }, [router])

  function goToShop() {
    const slug = cleanSlug(barbershop)
    if (!slug) return
    localStorage.setItem(LAST_ACCESS_KEY, 'client')
    localStorage.setItem(LAST_CLIENT_SLUG_KEY, slug)
    setBarbershop(slug)
    router.push(`/${slug}`)
  }

  async function signInOwner(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ownerEmail || !ownerPassword) {
      setOwnerError('Preencha e-mail e senha.')
      return
    }

    setOwnerLoading(true)
    setOwnerError('')
    setBarberError('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email: ownerEmail.trim().toLowerCase(),
      password: ownerPassword,
    })

    if (error || !data.user) {
      setOwnerError('E-mail ou senha incorretos.')
      setOwnerLoading(false)
      return
    }

    const { data: memberships, error: membershipError } = await supabase
      .from('tenant_users')
      .select('tenant_id, role')
      .eq('user_id', data.user.id)
      .in('role', ['admin', 'owner'])
      .limit(1)

    if (membershipError || !memberships?.length) {
      await supabase.auth.signOut()
      setOwnerError('Esta conta nao possui acesso de dono.')
      setOwnerLoading(false)
      return
    }

    const { data: tenant } = await supabase
      .from('tenants')
      .select('slug')
      .eq('id', memberships[0].tenant_id)
      .maybeSingle()

    if (!tenant?.slug) {
      await supabase.auth.signOut()
      setOwnerError('Nao encontrei a barbearia desta conta.')
      setOwnerLoading(false)
      return
    }

    localStorage.setItem(LAST_ACCESS_KEY, 'owner')
    router.push(`/${tenant.slug}/admin`)
  }

  async function signInBarber(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!barberEmail || !barberPassword) {
      setBarberError('Preencha e-mail e senha.')
      return
    }

    setBarberLoading(true)
    setBarberError('')
    setOwnerError('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email: barberEmail.trim().toLowerCase(),
      password: barberPassword,
    })

    if (error || !data.user) {
      setBarberError('E-mail ou senha incorretos.')
      setBarberLoading(false)
      return
    }

    let { data: barber, error: barberLookupError } = await supabase
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
      barberLookupError = fallback.error

      if (barber) {
        await supabase
          .from('barbeiros')
          .update({ user_id: data.user.id })
          .eq('id', barber.id)
          .eq('tenant_id', barber.tenant_id)
      }
    }

    if (barberLookupError || !barber) {
      await supabase.auth.signOut()
      setBarberError('Esta conta nao possui acesso de barbeiro.')
      setBarberLoading(false)
      return
    }

    if (!barber.ativo) {
      await supabase.auth.signOut()
      setBarberError('Seu acesso de barbeiro esta desativado.')
      setBarberLoading(false)
      return
    }

    const { data: tenant } = await supabase
      .from('tenants')
      .select('status, trial_ends_at')
      .eq('id', barber.tenant_id)
      .maybeSingle()

    if (!getTenantAccess(tenant).allowed) {
      await supabase.auth.signOut()
      setBarberError('A assinatura desta barbearia esta bloqueada ou vencida.')
      setBarberLoading(false)
      return
    }

    localStorage.setItem(LAST_ACCESS_KEY, 'barber')
    router.push('/barber/dashboard')
  }

  return (
    <main className="app-shell">
      <style>{`
        .app-shell {
          min-height: 100vh;
          color: #f8f3e8;
          background:
            radial-gradient(circle at 70% 18%, rgba(214,178,74,0.16), transparent 28%),
            radial-gradient(circle at 18% 78%, rgba(59,130,246,0.12), transparent 26%),
            linear-gradient(135deg, #05070d 0%, #0a0f1b 48%, #05070d 100%);
          font-family: var(--font-geist-sans), Arial, sans-serif;
          overflow-x: hidden;
        }
        .app-shell::before {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
          background-size: 72px 72px;
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent 82%);
        }
        .app-wrap {
          position: relative;
          z-index: 1;
          width: min(1120px, calc(100% - 32px));
          margin: 0 auto;
          padding: 34px 0 42px;
        }
        .app-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 58px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: inherit;
        }
        .brand-mark {
          width: 48px;
          height: 48px;
          border-radius: 15px;
          display: grid;
          place-items: center;
          background: #070a12;
          border: 1px solid rgba(214,178,74,0.24);
          box-shadow: 0 18px 45px rgba(59,130,246,0.18);
          overflow: hidden;
        }
        .brand-mark img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .brand-name {
          margin: 0;
          font-size: 18px;
          font-weight: 950;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .brand-sub {
          margin: 1px 0 0;
          font-size: 11px;
          color: #8b95aa;
          letter-spacing: 2.4px;
          text-transform: uppercase;
        }
        .top-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 42px;
          padding: 0 16px;
          border-radius: 12px;
          border: 1px solid rgba(214,178,74,0.28);
          color: #d6b24a;
          text-decoration: none;
          font-size: 13px;
          font-weight: 800;
          background: rgba(214,178,74,0.08);
        }
        .hero {
          display: grid;
          grid-template-columns: 0.92fr 1.08fr;
          gap: 42px;
          align-items: center;
        }
        .kicker {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          min-height: 34px;
          padding: 0 13px;
          border: 1px solid rgba(214,178,74,0.36);
          color: #d6b24a;
          font-size: 11px;
          letter-spacing: 2.8px;
          text-transform: uppercase;
          font-weight: 900;
          background: rgba(214,178,74,0.06);
        }
        .title {
          margin: 24px 0 18px;
          font-size: clamp(48px, 8vw, 92px);
          line-height: 0.88;
          letter-spacing: -2px;
          font-weight: 950;
        }
        .title span {
          color: #d6b24a;
        }
        .lead {
          margin: 0;
          max-width: 560px;
          color: #9aa4b8;
          font-size: 17px;
          line-height: 1.75;
        }
        .quick {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 28px;
        }
        .quick-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 36px;
          padding: 0 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.045);
          border: 1px solid rgba(255,255,255,0.08);
          color: #c8d0df;
          font-size: 12px;
          font-weight: 800;
        }
        .cards {
          display: grid;
          gap: 14px;
        }
        .choice-card {
          position: relative;
          overflow: hidden;
          padding: 22px;
          border-radius: 20px;
          background: rgba(13,19,32,0.82);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 24px 70px rgba(0,0,0,0.28);
          backdrop-filter: blur(18px);
        }
        .choice-card::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(135deg, rgba(214,178,74,0.12), transparent 45%);
          opacity: 0.72;
        }
        .choice-inner {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 54px 1fr;
          gap: 16px;
        }
        .choice-icon {
          width: 54px;
          height: 54px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          background: rgba(214,178,74,0.12);
          border: 1px solid rgba(214,178,74,0.28);
          color: #d6b24a;
        }
        .choice-title {
          margin: 0;
          font-size: 22px;
          font-weight: 950;
        }
        .choice-copy {
          margin: 6px 0 16px;
          color: #8b95aa;
          font-size: 14px;
          line-height: 1.55;
        }
        .input-hint {
          margin: 8px 0 0;
          color: #6f7a8f;
          font-size: 12px;
          font-weight: 700;
        }
        .input-hint strong {
          color: #d6b24a;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
        }
        .login-stack {
          display: grid;
          gap: 10px;
        }
        .input-wrap {
          position: relative;
        }
        .field-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #768196;
          pointer-events: none;
        }
        .input {
          width: 100%;
          min-width: 0;
          height: 48px;
          border-radius: 13px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(0,0,0,0.22);
          color: #f8f3e8;
          padding: 0 14px;
          font-size: 14px;
          font-weight: 700;
          outline: none;
        }
        .input.has-icon {
          padding-left: 42px;
        }
        .input.has-action {
          padding-right: 46px;
        }
        .input:focus {
          border-color: rgba(214,178,74,0.65);
          box-shadow: 0 0 0 4px rgba(214,178,74,0.1);
        }
        .password-toggle {
          position: absolute;
          right: 11px;
          top: 50%;
          transform: translateY(-50%);
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 9px;
          display: grid;
          place-items: center;
          background: rgba(255,255,255,0.04);
          color: #aab3c4;
          cursor: pointer;
        }
        .auth-error {
          border: 1px solid rgba(239,68,68,0.28);
          background: rgba(239,68,68,0.1);
          color: #fca5a5;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.35;
        }
        .btn {
          height: 48px;
          border: 0;
          border-radius: 13px;
          padding: 0 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: linear-gradient(135deg, #f2d26c, #c4932c);
          color: #070a12;
          font-weight: 950;
          cursor: pointer;
          text-decoration: none;
          white-space: nowrap;
          box-shadow: 0 18px 42px rgba(214,178,74,0.2);
        }
        .btn:disabled {
          cursor: wait;
          opacity: 0.68;
        }
        .btn.secondary {
          background: rgba(255,255,255,0.06);
          color: #f8f3e8;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: none;
        }
        .split-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        @media (max-width: 860px) {
          .app-wrap { padding-top: 22px; }
          .app-top { margin-bottom: 36px; }
          .top-link { display: none; }
          .hero { grid-template-columns: 1fr; gap: 28px; }
          .title { font-size: clamp(44px, 15vw, 68px); }
          .choice-card { padding: 18px; border-radius: 18px; }
          .choice-inner { grid-template-columns: 46px 1fr; gap: 12px; }
          .choice-icon { width: 46px; height: 46px; border-radius: 14px; }
          .choice-title { font-size: 19px; }
          .form-row { grid-template-columns: 1fr; }
          .btn { width: 100%; }
        }
      `}</style>

      <div className="app-wrap">
        <header className="app-top">
          <a className="brand" href="/">
            <div className="brand-mark">
              <img src="/icons/nexbarber-192.png" alt="" />
            </div>
            <div>
              <p className="brand-name">NexBarber</p>
              <p className="brand-sub">App da barbearia</p>
            </div>
          </a>
          <a className="top-link" href="/pricing">
            Criar minha barbearia
            <ExternalLink size={15} />
          </a>
        </header>

        <section className="hero">
          <div>
            <div className="kicker">
              <Sparkles size={14} />
              Escolha seu acesso
            </div>
            <h1 className="title">
              Entre no <span>NexBarber</span> certo.
            </h1>
            <p className="lead">
              Um app para clientes, barbeiros e donos. Cada pessoa entra no seu painel certo,
              com agenda, atendimentos e gestão separados por barbearia.
            </p>
            <div className="quick">
              <span className="quick-item"><ShieldCheck size={15} /> Acesso seguro</span>
              <span className="quick-item"><CalendarCheck size={15} /> Agenda online</span>
              <span className="quick-item"><Store size={15} /> Multi-barbearia</span>
            </div>
          </div>

          <div className="cards" aria-label="Escolha o tipo de acesso">
            <article className="choice-card">
              <div className="choice-inner">
                <div className="choice-icon"><UserRound size={25} /></div>
                <div>
                  <h2 className="choice-title">Sou cliente</h2>
                  <p className="choice-copy">Acesse a página pública da barbearia e agende seu horário.</p>
                  <div className="form-row">
                    <input
                      className="input"
                      value={barbershop}
                      onChange={(event) => setBarbershop(event.target.value)}
                      onBlur={() => setBarbershop((value) => cleanSlug(value))}
                      onKeyDown={(event) => { if (event.key === 'Enter') goToShop() }}
                      placeholder="Digite só: domnenem"
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                    <button className="btn" onClick={goToShop}>
                      Abrir agenda <ArrowRight size={16} />
                    </button>
                  </div>
                  <p className="input-hint">Nao precisa colocar o dominio. Use apenas <strong>domnenem</strong>.</p>
                </div>
              </div>
            </article>

            <article className="choice-card">
              <div className="choice-inner">
                <div className="choice-icon"><Scissors size={25} /></div>
                <div>
                  <h2 className="choice-title">Sou barbeiro</h2>
                  <p className="choice-copy">Entre no seu painel para ver seus horários, clientes e comissões.</p>
                  <form className="login-stack" onSubmit={signInBarber}>
                    <div className="input-wrap">
                      <Mail className="field-icon" size={16} />
                      <input
                        className="input has-icon"
                        type="email"
                        value={barberEmail}
                        onChange={(event) => setBarberEmail(event.target.value)}
                        placeholder="E-mail do barbeiro"
                        autoComplete="email"
                      />
                    </div>
                    <div className="input-wrap">
                      <Lock className="field-icon" size={16} />
                      <input
                        className="input has-icon has-action"
                        type={showBarberPassword ? 'text' : 'password'}
                        value={barberPassword}
                        onChange={(event) => setBarberPassword(event.target.value)}
                        placeholder="Senha"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowBarberPassword((value) => !value)}
                        aria-label={showBarberPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showBarberPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {barberError && <div className="auth-error">{barberError}</div>}
                    <button className="btn" type="submit" disabled={barberLoading}>
                      {barberLoading ? 'Entrando...' : 'Entrar como barbeiro'} <ArrowRight size={16} />
                    </button>
                  </form>
                </div>
              </div>
            </article>

            <article className="choice-card">
              <div className="choice-inner">
                <div className="choice-icon"><Crown size={25} /></div>
                <div>
                  <h2 className="choice-title">Sou dono</h2>
                  <p className="choice-copy">Acesse o painel administrativo sem precisar lembrar o link da barbearia.</p>
                  <form className="login-stack" onSubmit={signInOwner}>
                    <div className="input-wrap">
                      <Mail className="field-icon" size={16} />
                      <input
                        className="input has-icon"
                        type="email"
                        value={ownerEmail}
                        onChange={(event) => setOwnerEmail(event.target.value)}
                        placeholder="E-mail do dono"
                        autoComplete="email"
                      />
                    </div>
                    <div className="input-wrap">
                      <Lock className="field-icon" size={16} />
                      <input
                        className="input has-icon has-action"
                        type={showOwnerPassword ? 'text' : 'password'}
                        value={ownerPassword}
                        onChange={(event) => setOwnerPassword(event.target.value)}
                        placeholder="Senha"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowOwnerPassword((value) => !value)}
                        aria-label={showOwnerPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showOwnerPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {ownerError && <div className="auth-error">{ownerError}</div>}
                    <button className="btn" type="submit" disabled={ownerLoading}>
                      {ownerLoading ? 'Entrando...' : 'Entrar como dono'} <ArrowRight size={16} />
                    </button>
                  </form>
                  <div className="split-actions" style={{ marginTop: 10 }}>
                    <a className="btn secondary" href="/pricing">Criar barbearia</a>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>
  )
}
