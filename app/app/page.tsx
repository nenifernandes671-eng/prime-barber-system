'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Crown,
  DollarSign,
  Eye,
  EyeOff,
  HelpCircle,
  Lock,
  Mail,
  Scissors,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getTenantAccess } from '@/lib/subscription-access'

const LAST_ACCESS_KEY = 'kortebarber:last-access'
const LAST_CLIENT_SLUG_KEY = 'kortebarber:last-client-slug'

type OwnerTenant = {
  id: string
  slug: string
  status?: string | null
  trial_ends_at?: string | null
  created_at?: string | null
}

const FEATURE_ITEMS = [
  {
    icon: CalendarDays,
    title: 'Agenda Inteligente',
    text: 'Gerencie agendamentos de forma pratica e evite conflitos de horario.',
  },
  {
    icon: Users,
    title: 'Clientes na Mao',
    text: 'Historico completo dos clientes para um atendimento unico.',
  },
  {
    icon: DollarSign,
    title: 'Comissoes Justas',
    text: 'Controle comissoes e desempenho da equipe com facilidade.',
  },
  {
    icon: BarChart3,
    title: 'Relatorios Reais',
    text: 'Acompanhe numeros e tome decisoes com base em dados.',
  },
]

const CHECK_ITEMS = [
  'Interface simples e moderna',
  'Suporte rapido e humanizado',
  'Acesso de onde estiver',
  'Atualizacoes constantes',
]

function cleanSlug(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const sanitize = (input: string) =>
    input
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
    if (host === 'kortebarber.com.br') return ''
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

function chooseOwnerTenant(tenants: OwnerTenant[]) {
  if (!tenants.length) return null

  const sorted = [...tenants].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
    return bTime - aTime
  })

  return (
    sorted.find((tenant) => getTenantAccess(tenant).allowed && tenant.status === 'active') ||
    sorted.find((tenant) => getTenantAccess(tenant).allowed) ||
    sorted[0]
  )
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

      if (lastClientSlug) setBarbershop(lastClientSlug)

      const { data: { user } } = await supabase.auth.getUser()
      if (!active || !user) return

      const { data: memberships } = await supabase
        .from('tenant_users')
        .select('tenant_id, role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'owner'])

      if (!active) return

      if (memberships?.length) {
        if (!user.user_metadata?.password_set) return

        const tenantIds = memberships.map((item) => item.tenant_id)
        const { data: tenants } = await supabase
          .from('tenants')
          .select('id, slug, status, trial_ends_at, created_at')
          .in('id', tenantIds)

        if (!active) return

        const tenant = chooseOwnerTenant(tenants || [])

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
    router.push(`/${slug}?from=app`)
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

    if (membershipError || !memberships?.length) {
      await supabase.auth.signOut()
      setOwnerError('Esta conta nao possui acesso de dono.')
      setOwnerLoading(false)
      return
    }

    const tenantIds = memberships.map((item) => item.tenant_id)
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, slug, status, trial_ends_at, created_at')
      .in('id', tenantIds)

    const tenant = chooseOwnerTenant(tenants || [])

    if (!tenant?.slug) {
      await supabase.auth.signOut()
      setOwnerError('Nao encontrei a barbearia desta conta.')
      setOwnerLoading(false)
      return
    }

    if (!data.user.user_metadata?.password_set) {
      await supabase.auth.updateUser({
        data: {
          ...data.user.user_metadata,
          password_set: true,
          slug: tenant.slug,
        },
      })
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
    <main className="app-page">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-icon"><Scissors size={28} /></span>
          <strong>Korte<span>Barber</span></strong>
        </a>
        <div className="top-actions">
          <a className="help-btn" href="/suporte"><HelpCircle size={16} /> Ajuda</a>
        </div>
      </header>

      <section className="app-grid">
        <div className="left-panel">
          <div className="welcome-pill"><Scissors size={13} /> Bem-vindo ao KorteBarber</div>
          <h1>Tudo que sua barbearia precisa, <span>em um so lugar.</span></h1>
          <p className="lead">
            Agendamentos, clientes, barbeiros, comissoes e relatorios. Organize sua
            barbearia e ofereca a melhor experiencia.
          </p>

          <div className="feature-row">
            {FEATURE_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <article className="feature" key={item.title}>
                  <div><Icon size={25} /></div>
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </article>
              )
            })}
          </div>

          <div className="trust-card">
            <div className="trust-icon"><ShieldCheck size={28} /></div>
            <div>
              <strong>Seguro e confiavel</strong>
              <span>Seus dados e informacoes estao protegidos com criptografia e backups automaticos.</span>
            </div>
            <a href="/suporte">Saiba mais</a>
          </div>

          <div className="check-card">
            <h2>Feito para barbearias que querem crescer</h2>
            <div className="check-grid">
              {CHECK_ITEMS.map((item) => (
                <span key={item}><CheckCircle2 size={18} /> {item}</span>
              ))}
            </div>
          </div>

          <footer className="app-footer">
            <span>KorteBarber © 2026 - Todos os direitos reservados.</span>
            <nav>
              <a href="/termos">Termos de uso</a>
              <a href="/privacidade">Politica de privacidade</a>
            </nav>
          </footer>
        </div>

        <div className="access-stack">
          <article className="access-card featured">
            <div className="access-head">
              <div className="access-icon"><UserRound size={28} /></div>
              <div>
                <h2>Sou cliente</h2>
                <p>Acesse a pagina publica da barbearia e agende seu horario.</p>
              </div>
            </div>
            <div className="client-row">
              <input
                value={barbershop}
                onChange={(event) => setBarbershop(event.target.value)}
                onBlur={() => setBarbershop((value) => cleanSlug(value))}
                onKeyDown={(event) => { if (event.key === 'Enter') goToShop() }}
                placeholder="Digite o link da barbearia"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <button onClick={goToShop}>Abrir agenda <ArrowRight size={16} /></button>
            </div>
            <small>Nao precisa colocar o dominio. Use apenas o nome do link da barbearia.</small>
          </article>

          <article className="access-card">
            <div className="access-head">
              <div className="access-icon"><Scissors size={28} /></div>
              <div>
                <h2>Sou barbeiro</h2>
                <p>Entre no seu painel para ver seus horarios, clientes e comissoes.</p>
              </div>
            </div>
            <form className="login-form" onSubmit={signInBarber}>
              <Field icon={<Mail size={16} />} placeholder="E-mail do barbeiro" type="email" value={barberEmail} onChange={setBarberEmail} />
              <PasswordField value={barberPassword} onChange={setBarberPassword} show={showBarberPassword} onToggle={() => setShowBarberPassword((value) => !value)} />
              {barberError && <div className="error-box">{barberError}</div>}
              <button type="submit" disabled={barberLoading}>{barberLoading ? 'Entrando...' : 'Entrar como barbeiro'} <ArrowRight size={16} /></button>
            </form>
          </article>

          <article className="access-card">
            <div className="access-head">
              <div className="access-icon"><Crown size={29} /></div>
              <div>
                <h2>Sou dono</h2>
                <p>Acesse o painel administrativo e gerencie toda a sua barbearia.</p>
              </div>
            </div>
            <form className="login-form" onSubmit={signInOwner}>
              <Field icon={<Mail size={16} />} placeholder="E-mail do dono" type="email" value={ownerEmail} onChange={setOwnerEmail} />
              <PasswordField value={ownerPassword} onChange={setOwnerPassword} show={showOwnerPassword} onToggle={() => setShowOwnerPassword((value) => !value)} />
              {ownerError && <div className="error-box">{ownerError}</div>}
              <button type="submit" disabled={ownerLoading}>{ownerLoading ? 'Entrando...' : 'Entrar como dono'} <ArrowRight size={16} /></button>
            </form>
          </article>
        </div>
      </section>

      <style jsx global>{`
        .app-page {
          min-height: 100vh;
          color: #f8fafc;
          background:
            linear-gradient(90deg, rgba(4,8,16,.96), rgba(6,13,24,.82) 48%, rgba(4,8,16,.98)),
            radial-gradient(circle at 28% 32%, rgba(224,182,65,.15), transparent 34%),
            radial-gradient(circle at 78% 76%, rgba(37,99,235,.14), transparent 38%),
            #050913;
          font-family: var(--font-geist-sans), Arial, sans-serif;
          overflow-x: hidden;
        }
        .app-page::before {
          content: '';
          position: fixed;
          inset: 80px 0 0;
          pointer-events: none;
          background:
            linear-gradient(rgba(5,9,19,.38), rgba(5,9,19,.92)),
            url('/kortebarber-logo.jpg') center left / 820px auto no-repeat;
          opacity: .18;
          filter: saturate(.85);
        }
        .topbar {
          position: relative;
          z-index: 2;
          min-height: 80px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 clamp(24px, 5vw, 72px);
          border-bottom: 1px solid rgba(148,163,184,.13);
          background: rgba(4,8,16,.72);
          backdrop-filter: blur(18px);
        }
        .brand {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          color: #fff;
          text-decoration: none;
          font-size: 22px;
          font-weight: 950;
        }
        .brand span,
        .brand-icon {
          color: #f2c94c;
        }
        .brand-icon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
        }
        .top-actions {
          display: flex;
          align-items: center;
          gap: 18px;
        }
        .top-actions .theme-toggle {
          min-height: 42px;
          border: 1px solid rgba(148,163,184,.18);
          background: rgba(15,23,42,.55);
          box-shadow: none;
          color: #f8fafc;
        }
        .top-actions .theme-toggle-track {
          background: rgba(242,201,76,.12);
        }
        .theme-icons {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #f2c94c;
        }
        .theme-icons svg:last-child {
          color: #64748b;
        }
        .help-btn {
          height: 42px;
          padding: 0 18px;
          border-radius: 12px;
          border: 1px solid rgba(148,163,184,.18);
          color: #f8fafc;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 800;
          background: rgba(15,23,42,.55);
        }
        .help-btn svg {
          color: #f2c94c;
        }
        .app-grid {
          position: relative;
          z-index: 1;
          min-height: calc(100vh - 80px);
          width: min(1440px, calc(100% - 64px));
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1.04fr) minmax(420px, .72fr);
          gap: 72px;
          align-items: center;
          padding: 52px 0 34px;
        }
        .left-panel {
          min-width: 0;
        }
        .welcome-pill {
          width: fit-content;
          height: 36px;
          padding: 0 16px;
          border-radius: 999px;
          border: 1px solid rgba(242,201,76,.28);
          color: #f2c94c;
          background: rgba(15,23,42,.56);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-transform: uppercase;
          letter-spacing: .16em;
          font-size: 11px;
          font-weight: 950;
        }
        h1 {
          max-width: 690px;
          margin: 24px 0 18px;
          font-size: clamp(48px, 5.2vw, 78px);
          line-height: .98;
          letter-spacing: -1.8px;
          font-weight: 950;
        }
        h1 span {
          color: #f2c94c;
        }
        .lead {
          max-width: 620px;
          margin: 0;
          color: #a8b1c3;
          font-size: 18px;
          line-height: 1.65;
        }
        .feature-row {
          margin-top: 62px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 28px;
        }
        .feature div,
        .trust-icon {
          width: 58px;
          height: 58px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          color: #f2c94c;
          background: rgba(242,201,76,.12);
          border: 1px solid rgba(242,201,76,.1);
          margin-bottom: 18px;
        }
        .feature strong {
          display: block;
          color: #fff;
          font-size: 15px;
          margin-bottom: 8px;
        }
        .feature span {
          display: block;
          color: #9aa4b8;
          font-size: 14px;
          line-height: 1.45;
        }
        .trust-card,
        .check-card {
          margin-top: 34px;
          border-radius: 16px;
          border: 1px solid rgba(148,163,184,.13);
          background: linear-gradient(135deg, rgba(15,23,42,.76), rgba(15,23,42,.38));
          box-shadow: 0 20px 70px rgba(0,0,0,.22);
        }
        .trust-card {
          min-height: 110px;
          display: grid;
          grid-template-columns: 68px 1fr auto;
          align-items: center;
          gap: 16px;
          padding: 18px 24px;
          max-width: 710px;
        }
        .trust-icon {
          margin: 0;
        }
        .trust-card strong,
        .check-card h2 {
          display: block;
          color: #fff;
          font-size: 15px;
          margin: 0 0 6px;
        }
        .trust-card span {
          color: #9aa4b8;
          font-size: 14px;
          line-height: 1.45;
        }
        .trust-card a {
          min-height: 42px;
          padding: 0 18px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          color: #fff;
          text-decoration: none;
          font-size: 13px;
          font-weight: 900;
          background: rgba(148,163,184,.12);
        }
        .check-card {
          max-width: 710px;
          padding: 24px;
        }
        .check-card h2 {
          color: #f2c94c;
          font-size: 16px;
          padding-bottom: 18px;
          border-bottom: 1px solid rgba(148,163,184,.2);
        }
        .check-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
          margin-top: 20px;
        }
        .check-grid span {
          color: #a8b1c3;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          line-height: 1.25;
        }
        .check-grid svg {
          color: #f2c94c;
          flex-shrink: 0;
        }
        .app-footer {
          max-width: 710px;
          margin-top: 26px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          color: #8a94a8;
          font-size: 13px;
        }
        .app-footer nav {
          display: flex;
          gap: 22px;
        }
        .app-footer a {
          color: #8a94a8;
          text-decoration: none;
        }
        .access-stack {
          display: grid;
          gap: 14px;
        }
        .access-card {
          border-radius: 18px;
          border: 1px solid rgba(148,163,184,.15);
          background:
            linear-gradient(135deg, rgba(20,27,39,.92), rgba(9,15,27,.84));
          box-shadow: 0 30px 90px rgba(0,0,0,.28);
          padding: 30px;
          backdrop-filter: blur(22px);
        }
        .access-card.featured {
          border-color: rgba(242,201,76,.34);
          background:
            radial-gradient(circle at top left, rgba(242,201,76,.14), transparent 36%),
            linear-gradient(135deg, rgba(20,27,39,.96), rgba(9,15,27,.84));
        }
        .access-head {
          display: grid;
          grid-template-columns: 62px 1fr;
          gap: 18px;
          align-items: center;
          margin-bottom: 24px;
        }
        .access-icon {
          width: 62px;
          height: 62px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          color: #f2c94c;
          background: rgba(242,201,76,.13);
        }
        .access-card h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 950;
        }
        .access-card p {
          margin: 7px 0 0;
          color: #a8b1c3;
          font-size: 14px;
          line-height: 1.5;
        }
        .client-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(156px, auto);
          gap: 12px;
          align-items: stretch;
          max-width: 100%;
        }
        .client-row input {
          min-width: 0;
          background: rgba(2,6,23,.48);
          border-color: rgba(148,163,184,.22);
          color: #f8fafc;
        }
        .client-row input::placeholder {
          color: #9aa4b8;
        }
        .client-row button {
          min-width: 156px;
          padding: 0 18px;
        }
        input {
          width: 100%;
          min-height: 46px;
          border: 1px solid rgba(148,163,184,.18);
          border-radius: 10px;
          background: rgba(2,6,23,.38);
          color: #f8fafc;
          outline: none;
          padding: 0 15px;
          font-size: 14px;
          font-weight: 700;
        }
        input:focus {
          border-color: rgba(242,201,76,.72);
          box-shadow: 0 0 0 4px rgba(242,201,76,.1);
        }
        .access-card small {
          display: block;
          margin-top: 12px;
          color: #8a94a8;
          font-size: 12px;
        }
        button {
          min-height: 46px;
          border: 0;
          border-radius: 10px;
          padding: 0 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: linear-gradient(135deg, #f8d86d, #d7a52e);
          color: #090d14;
          font-size: 14px;
          font-weight: 950;
          cursor: pointer;
          white-space: nowrap;
        }
        button:disabled {
          opacity: .7;
          cursor: wait;
        }
        .login-form {
          display: grid;
          gap: 11px;
        }
        .field-wrap {
          position: relative;
          display: block;
        }
        .field-wrap svg:first-child {
          position: absolute;
          left: 15px;
          top: 50%;
          transform: translateY(-50%);
          color: #8792a6;
          z-index: 2;
          pointer-events: none;
        }
        .field-wrap input {
          position: relative;
          z-index: 1;
          padding-left: 44px;
        }
        .field-wrap.password input {
          padding-right: 56px;
        }
        .toggle-password {
          position: absolute;
          right: 9px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 3;
          width: 38px;
          height: 38px;
          min-height: 38px;
          padding: 0;
          border-radius: 9px;
          display: grid;
          place-items: center;
          background: transparent !important;
          color: #a8b1c3;
          box-shadow: none !important;
          cursor: pointer;
        }
        .toggle-password svg {
          position: static !important;
          transform: none !important;
          color: currentColor;
          pointer-events: none;
        }
        .toggle-password:hover {
          background: rgba(148,163,184,.10) !important;
          color: #f8fafc;
        }
        .error-box {
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid rgba(248,113,113,.28);
          background: rgba(239,68,68,.1);
          color: #fca5a5;
          font-size: 12px;
          font-weight: 800;
        }
        @media (max-width: 1100px) {
          .app-grid {
            grid-template-columns: 1fr;
            gap: 34px;
            align-items: start;
          }
          .feature-row,
          .check-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .access-stack {
            max-width: 680px;
          }
        }
        @media (max-width: 680px) {
          .topbar {
            min-height: 72px;
            padding: 0 18px;
          }
          .brand {
            font-size: 19px;
          }
          .theme-icons {
            display: none;
          }
          .help-btn {
            height: 38px;
            padding: 0 12px;
            font-size: 13px;
          }
          .app-grid {
            width: min(100% - 28px, 1440px);
            padding: 30px 0 24px;
          }
          h1 {
            font-size: clamp(40px, 12vw, 56px);
            letter-spacing: -1px;
          }
          .lead {
            font-size: 15px;
          }
          .feature-row,
          .check-grid,
          .client-row,
          .trust-card {
            grid-template-columns: 1fr;
          }
          .client-row {
            gap: 10px;
          }
          .client-row input,
          .client-row button {
            width: 100%;
          }
          .feature-row {
            gap: 18px;
            margin-top: 34px;
          }
          .trust-card a,
          .client-row button,
          .login-form button[type="submit"] {
            width: 100%;
          }
          .login-form .toggle-password {
            position: absolute;
            right: 9px;
            top: 50%;
            width: 38px !important;
            height: 38px !important;
            min-height: 38px !important;
            max-width: 38px !important;
            padding: 0 !important;
            transform: translateY(-50%);
          }
          .app-footer {
            align-items: flex-start;
            flex-direction: column;
          }
          .app-footer nav {
            flex-wrap: wrap;
          }
          .access-card {
            padding: 22px;
          }
          .access-head {
            grid-template-columns: 52px 1fr;
            gap: 14px;
          }
          .access-icon {
            width: 52px;
            height: 52px;
          }
        }
        [data-theme='light'] .app-page {
          color: #f8fafc !important;
          background:
            linear-gradient(90deg, rgba(4,8,16,.96), rgba(6,13,24,.82) 48%, rgba(4,8,16,.98)),
            radial-gradient(circle at 28% 32%, rgba(224,182,65,.15), transparent 34%),
            radial-gradient(circle at 78% 76%, rgba(37,99,235,.14), transparent 38%),
            #050913 !important;
        }
        [data-theme='light'] .app-page::before {
          background:
            linear-gradient(rgba(5,9,19,.38), rgba(5,9,19,.92)),
            url('/kortebarber-logo.jpg') center left / 820px auto no-repeat !important;
          opacity: .18 !important;
          filter: saturate(.85) !important;
        }
        [data-theme='light'] .app-page .topbar,
        [data-theme='light'] .app-page .access-card,
        [data-theme='light'] .app-page .trust-card,
        [data-theme='light'] .app-page .check-card {
          border-color: rgba(148,163,184,.15) !important;
          color: #f8fafc !important;
          box-shadow: 0 30px 90px rgba(0,0,0,.28) !important;
        }
        [data-theme='light'] .app-page .topbar {
          background: rgba(4,8,16,.72) !important;
        }
        [data-theme='light'] .app-page .access-card {
          background: linear-gradient(135deg, rgba(20,27,39,.92), rgba(9,15,27,.84)) !important;
        }
        [data-theme='light'] .app-page .access-card.featured {
          border-color: rgba(242,201,76,.34) !important;
          background:
            radial-gradient(circle at top left, rgba(242,201,76,.14), transparent 36%),
            linear-gradient(135deg, rgba(20,27,39,.96), rgba(9,15,27,.84)) !important;
        }
        [data-theme='light'] .app-page .trust-card,
        [data-theme='light'] .app-page .check-card {
          background: linear-gradient(135deg, rgba(15,23,42,.76), rgba(15,23,42,.38)) !important;
        }
        [data-theme='light'] .app-page h1,
        [data-theme='light'] .app-page h2,
        [data-theme='light'] .app-page strong,
        [data-theme='light'] .app-page .brand,
        [data-theme='light'] .app-page .feature strong,
        [data-theme='light'] .app-page .access-card h2,
        [data-theme='light'] .app-page .trust-card strong {
          color: #f8fafc !important;
        }
        [data-theme='light'] .app-page h1 span,
        [data-theme='light'] .app-page .brand span,
        [data-theme='light'] .app-page .brand-icon,
        [data-theme='light'] .app-page .welcome-pill,
        [data-theme='light'] .app-page .feature div,
        [data-theme='light'] .app-page .access-icon,
        [data-theme='light'] .app-page .trust-icon,
        [data-theme='light'] .app-page .check-card h2,
        [data-theme='light'] .app-page .check-grid svg,
        [data-theme='light'] .app-page .help-btn svg {
          color: #f2c94c !important;
        }
        [data-theme='light'] .app-page p,
        [data-theme='light'] .app-page small,
        [data-theme='light'] .app-page .lead,
        [data-theme='light'] .app-page .feature span,
        [data-theme='light'] .app-page .access-card p,
        [data-theme='light'] .app-page .trust-card span,
        [data-theme='light'] .app-page .check-grid span,
        [data-theme='light'] .app-page .app-footer,
        [data-theme='light'] .app-page .app-footer a {
          color: #a8b1c3 !important;
        }
        [data-theme='light'] .app-page input {
          background: rgba(2,6,23,.38) !important;
          border-color: rgba(148,163,184,.18) !important;
          color: #f8fafc !important;
          box-shadow: none !important;
        }
        [data-theme='light'] .app-page input::placeholder {
          color: #8a94a8 !important;
        }
        [data-theme='light'] .app-page .help-btn {
          background: rgba(15,23,42,.55) !important;
          border-color: rgba(148,163,184,.18) !important;
          color: #f8fafc !important;
          box-shadow: none !important;
        }
      `}</style>
    </main>
  )
}

function Field({
  icon,
  placeholder,
  type,
  value,
  onChange,
}: {
  icon: ReactNode
  placeholder: string
  type: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="field-wrap">
      {icon}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={type === 'email' ? 'email' : 'current-password'}
      />
    </div>
  )
}

function PasswordField({
  value,
  onChange,
  show,
  onToggle,
}: {
  value: string
  onChange: (value: string) => void
  show: boolean
  onToggle: () => void
}) {
  return (
    <div className="field-wrap password">
      <Lock size={16} />
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Senha"
        autoComplete="current-password"
      />
      <button type="button" className="toggle-password" onClick={onToggle} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}
