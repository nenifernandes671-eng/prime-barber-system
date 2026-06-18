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
  Download,
  Home,
  Lock,
  Mail,
  Menu,
  Scissors,
  Share2,
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
    text: 'Gerencie agendamentos de forma prática e evite conflitos de horário.',
  },
  {
    icon: Users,
    title: 'Clientes na Mão',
    text: 'Histórico completo dos clientes para um atendimento único.',
  },
  {
    icon: DollarSign,
    title: 'Comissões Justas',
    text: 'Controle comissões e desempenho da equipe com facilidade.',
  },
  {
    icon: BarChart3,
    title: 'Relatórios Reais',
    text: 'Acompanhe números e tome decisões com base em dados.',
  },
]

const CHECK_ITEMS = [
  'Interface simples e moderna',
  'Suporte rápido e humanizado',
  'Acesso de onde estiver',
  'Atualizações constantes',
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
          <img src="/icons/kortebarber-192.png" alt="KorteBarber" />
          <strong>Korte<span>Barber</span></strong>
        </a>
        <nav className="topnav" aria-label="Navegacao principal">
          <a href="/#funcionalidades">Recursos</a>
          <a href="/#como-funciona">Para quem é</a>
          <a href="/pricing">Preços</a>
          <a href="/suporte">Suporte</a>
        </nav>
        <a className="top-login" href="#acesso"><UserRound size={18} /> Entrar</a>
      </header>

      <section className="hero-shell" id="acesso">
        <div className="hero-content">
          <div className="eyebrow">Sistema completo para barbearias</div>
          <h1>Menos gestão.<span>Mais crescimento.</span></h1>
          <p className="lead">
            Agendamentos, clientes, financeiro e relatórios. Tudo que sua barbearia precisa, em um só lugar.
          </p>
          <a className="primary-cta" href="#acesso"><Download size={28} /> Acessar o sistema</a>
          <div className="safe-note"><ShieldCheck size={18} /> Seguro, rápido e sempre atualizado</div>

          <div className="feature-row">
            {FEATURE_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <article className="feature" key={item.title}>
                  <div><Icon size={28} /></div>
                  <strong>{item.title}</strong>
                </article>
              )
            })}
          </div>
        </div>

        <div className="hero-device" aria-hidden="true">
          <div className="k-glow">K</div>
          <div className="phone-mockup">
            <div className="phone-notch" />
            <div className="phone-status">11:47</div>
            <div className="phone-top"><UserRound size={16} /> <span>Ola, Thiago</span><Menu size={18} /></div>
            <p>Resumo financeiro</p>
            <small>Este mes</small>
            <strong>R$ 12.750,00</strong>
            <em>+18,4% no mes passado</em>
            <div className="bars">
              <i style={{ height: '36%' }} />
              <i style={{ height: '54%' }} />
              <i style={{ height: '45%' }} />
              <i style={{ height: '72%' }} />
              <i style={{ height: '50%' }} />
              <i style={{ height: '80%' }} />
            </div>
            <div className="phone-list"><span>Agendamentos</span><b>28</b></div>
            <div className="phone-list"><span>Clientes</span><b>38</b></div>
            <div className="phone-list"><span>Servicos</span><b>67</b></div>
            <div className="phone-list"><span>Faturamento</span><b>R$ 12.750,00</b></div>
            <div className="phone-nav"><Home size={15} /><CalendarDays size={15} /><button>+</button><Users size={15} /><BarChart3 size={15} /></div>
          </div>
        </div>

        <div className="access-stack">
          <article className="access-card">
            <div className="access-head">
              <div className="access-icon"><UserRound size={30} /></div>
              <div>
                <h2>Sou cliente</h2>
                <p>Acesse a pagina publica da barbearia</p>
              </div>
            </div>
            <div className="client-row">
              <input
                value={barbershop}
                onChange={(event) => setBarbershop(event.target.value)}
                onBlur={() => setBarbershop((value) => cleanSlug(value))}
                onKeyDown={(event) => { if (event.key === 'Enter') goToShop() }}
                placeholder="Link da barbearia"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <button onClick={goToShop}>Abrir agenda</button>
            </div>
          </article>

          <article className="access-card">
            <div className="access-head">
              <div className="access-icon"><Scissors size={30} /></div>
              <div>
                <h2>Sou barbeiro</h2>
                <p>Entre no painel para ver seus horarios, clientes e comissoes.</p>
              </div>
            </div>
            <form className="login-form" onSubmit={signInBarber}>
              <Field icon={<Mail size={16} />} placeholder="E-mail ou telefone" type="email" value={barberEmail} onChange={setBarberEmail} />
              <PasswordField value={barberPassword} onChange={setBarberPassword} show={showBarberPassword} onToggle={() => setShowBarberPassword((value) => !value)} />
              {barberError && <div className="error-box">{barberError}</div>}
              <button type="submit" disabled={barberLoading}>{barberLoading ? 'Entrando...' : 'Entrar como barbeiro'}</button>
            </form>
          </article>

          <article className="access-card">
            <div className="access-head">
              <div className="access-icon"><Crown size={30} /></div>
              <div>
                <h2>Sou dono</h2>
                <p>Acesse o painel administrativo e gerencie sua barbearia.</p>
              </div>
            </div>
            <form className="login-form" onSubmit={signInOwner}>
              <Field icon={<Mail size={16} />} placeholder="E-mail ou telefone" type="email" value={ownerEmail} onChange={setOwnerEmail} />
              <PasswordField value={ownerPassword} onChange={setOwnerPassword} show={showOwnerPassword} onToggle={() => setShowOwnerPassword((value) => !value)} />
              {ownerError && <div className="error-box">{ownerError}</div>}
              <button type="submit" disabled={ownerLoading}>{ownerLoading ? 'Entrando...' : 'Entrar como dono'}</button>
            </form>
          </article>
        </div>
      </section>

      <section className="install-card">
        <div className="install-copy">
          <h2>Como instalar o KorteBarber no seu celular</h2>
          <p>Tenha o sistema sempre na palma da mao.</p>
          <div className="install-steps">
            <span><b>1</b><Share2 size={23} /> Toque no botao Compartilhar no navegador.</span>
            <span><b>2</b><span className="plus-mini">+</span> Selecione Adicionar a Tela de Inicio.</span>
            <span><b>3</b><CheckCircle2 size={24} /> Pronto. O KorteBarber estara na sua tela.</span>
          </div>
        </div>
        <div className="install-phone" aria-hidden="true">
          <div className="install-notch" />
          <img src="/icons/kortebarber-192.png" alt="" />
          <strong>KorteBarber</strong>
        </div>
        <div className="hand-note">Use como<br />um aplicativo!</div>
      </section>

      <footer className="app-footer">
        <span>© 2026 KorteBarber. Todos os direitos reservados.</span>
        <nav>
          <a href="/termos">Termos de uso</a>
          <a href="/privacidade">Politica de privacidade</a>
        </nav>
      </footer>

      <style jsx global>{`
        .app-page {
          min-height: 100vh;
          color: #f8fafc;
          background:
            radial-gradient(circle at 53% 18%, rgba(37, 99, 235, .38), transparent 24%),
            radial-gradient(circle at 82% 56%, rgba(22, 78, 160, .28), transparent 34%),
            linear-gradient(90deg, rgba(2,6,23,.99), rgba(3,10,24,.93) 48%, rgba(2,6,23,.99)),
            #020617;
          font-family: var(--font-geist-sans), Arial, sans-serif;
          overflow-x: hidden;
        }
        .app-page::before {
          content: '';
          position: fixed;
          inset: 82px 0 0;
          pointer-events: none;
          background:
            linear-gradient(rgba(2,6,23,.82), rgba(2,6,23,.88)),
            url('/kortebarber-logo.jpg') center / 900px auto no-repeat;
          opacity: .12;
          filter: saturate(.8);
        }
        .topbar {
          position: sticky;
          top: 0;
          z-index: 10;
          min-height: 82px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 28px;
          padding: 0 clamp(22px, 3vw, 38px);
          border-bottom: 1px solid rgba(30,64,175,.22);
          background: rgba(0,0,0,.72);
          backdrop-filter: blur(20px);
        }
        .brand {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          color: #fff;
          text-decoration: none;
          font-size: clamp(24px, 2.2vw, 32px);
          font-weight: 950;
          letter-spacing: -1px;
        }
        .brand img {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          box-shadow: 0 0 30px rgba(37,99,235,.4);
        }
        .brand span { color: #0b63ff; }
        .topnav {
          display: flex;
          align-items: center;
          gap: clamp(28px, 4vw, 54px);
        }
        .topnav a,
        .top-login {
          color: #fff;
          text-decoration: none;
          font-size: 16px;
          font-weight: 700;
        }
        .topnav a:hover { color: #3b82f6; }
        .top-login {
          min-height: 46px;
          padding: 0 22px;
          border-radius: 7px;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          border: 1px solid #0b63ff;
          background: rgba(2,6,23,.4);
          transition: background .2s ease, transform .2s ease, box-shadow .2s ease;
        }
        .top-login:hover {
          background: #0b63ff;
          transform: translateY(-1px);
          box-shadow: 0 16px 36px rgba(37,99,235,.28);
        }
        .hero-shell {
          position: relative;
          z-index: 1;
          width: min(1510px, calc(100% - 76px));
          margin: 0 auto;
          min-height: calc(100vh - 82px);
          display: grid;
          grid-template-columns: minmax(390px, .92fr) minmax(300px, .72fr) minmax(390px, .66fr);
          gap: 32px;
          align-items: center;
          padding: 20px 0 28px;
        }
        .hero-content { min-width: 0; }
        .eyebrow {
          color: #0b72ff;
          text-transform: uppercase;
          letter-spacing: .18em;
          font-size: 15px;
          font-weight: 900;
          margin-bottom: 24px;
        }
        h1 {
          margin: 0 0 22px;
          font-size: clamp(58px, 5vw, 78px);
          line-height: .98;
          letter-spacing: -2px;
          font-weight: 950;
        }
        h1 span {
          display: block;
          color: #0b63ff;
        }
        .lead {
          max-width: 600px;
          color: #d6deeb;
          font-size: 21px;
          line-height: 1.38;
          margin: 0;
        }
        .primary-cta {
          width: fit-content;
          min-height: 64px;
          margin-top: 30px;
          padding: 0 36px;
          border-radius: 7px;
          display: inline-flex;
          align-items: center;
          gap: 18px;
          color: #fff;
          text-decoration: none;
          font-size: 21px;
          font-weight: 900;
          background: linear-gradient(135deg, #116bff, #0f43cb);
          box-shadow: 0 22px 52px rgba(37,99,235,.28);
        }
        .safe-note {
          margin-top: 18px;
          display: flex;
          align-items: center;
          gap: 9px;
          color: #d6deeb;
          font-size: 15px;
        }
        .safe-note svg { color: #0b72ff; }
        .feature-row {
          margin-top: 58px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 28px;
        }
        .feature { text-align: center; }
        .feature div {
          width: 54px;
          height: 54px;
          margin: 0 auto 14px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          color: #0b72ff;
          background: rgba(15, 23, 42, .84);
          border: 1px solid rgba(37,99,235,.28);
          box-shadow: 0 0 28px rgba(37,99,235,.18);
        }
        .feature strong {
          display: block;
          color: #fff;
          font-size: 15px;
          line-height: 1.35;
        }
        .hero-device {
          position: relative;
          min-height: 640px;
          display: grid;
          place-items: center;
        }
        .hero-device::before {
          content: '';
          position: absolute;
          inset: 12% -34% 0 -22%;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(37,99,235,.26), transparent 60%);
          filter: blur(18px);
        }
        .k-glow {
          position: absolute;
          top: 8%;
          right: 4%;
          width: 96px;
          height: 96px;
          border-radius: 20px;
          display: grid;
          place-items: center;
          color: #fff;
          font-size: 64px;
          font-weight: 950;
          background: linear-gradient(145deg, #0b63ff, #001a77);
          box-shadow: 0 0 54px rgba(37,99,235,.76);
          opacity: .92;
        }
        .phone-mockup {
          position: relative;
          width: 246px;
          min-height: 528px;
          padding: 22px 18px;
          border-radius: 34px;
          color: #fff;
          background: linear-gradient(150deg, #111827, #020617 58%, #06193f);
          border: 9px solid #05070c;
          box-shadow: 0 34px 80px rgba(0,0,0,.74), 0 0 0 1px rgba(255,255,255,.18);
          transform: rotate(8deg);
        }
        .phone-notch {
          position: absolute;
          top: 8px;
          left: 50%;
          width: 86px;
          height: 20px;
          border-radius: 0 0 16px 16px;
          transform: translateX(-50%);
          background: #05070c;
        }
        .phone-status,
        .phone-top,
        .phone-mockup small,
        .phone-mockup em,
        .phone-list span { color: #cbd5e1; }
        .phone-status { font-size: 10px; font-weight: 900; }
        .phone-top {
          margin-top: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
        }
        .phone-mockup p { margin: 22px 0 14px; font-size: 13px; font-weight: 900; }
        .phone-mockup small { display: block; font-size: 10px; }
        .phone-mockup strong { display: block; margin-top: 8px; font-size: 24px; }
        .phone-mockup em { display: block; margin-top: 7px; color: #0b72ff; font-size: 10px; font-style: normal; }
        .bars {
          height: 86px;
          margin: 18px 0 20px;
          display: flex;
          align-items: end;
          gap: 10px;
          border-bottom: 1px solid rgba(148,163,184,.18);
        }
        .bars i {
          flex: 1;
          border-radius: 4px 4px 0 0;
          background: linear-gradient(#0b72ff, #1d4ed8);
        }
        .phone-list {
          min-height: 42px;
          margin-top: 8px;
          padding: 0 12px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(15,23,42,.86);
          font-size: 11px;
        }
        .phone-nav {
          margin-top: 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #94a3b8;
        }
        .phone-nav button {
          width: 36px;
          height: 36px;
          min-height: 36px;
          padding: 0;
          border-radius: 999px;
          background: #0b63ff;
          color: #fff;
          font-size: 24px;
        }
        .access-stack {
          display: grid;
          gap: 8px;
        }
        .access-card {
          border-radius: 13px;
          border: 1px solid rgba(37,99,235,.18);
          background: linear-gradient(145deg, rgba(15,23,42,.72), rgba(2,6,23,.76));
          box-shadow: 0 28px 70px rgba(0,0,0,.25);
          padding: 24px 26px;
          backdrop-filter: blur(22px);
        }
        .access-head {
          display: grid;
          grid-template-columns: 50px 1fr;
          gap: 14px;
          align-items: center;
          margin-bottom: 16px;
        }
        .access-icon {
          width: 48px;
          height: 48px;
          border-radius: 9px;
          display: grid;
          place-items: center;
          color: #0b72ff;
          background: rgba(2,6,23,.42);
          border: 1px solid rgba(37,99,235,.42);
        }
        .access-card h2 {
          margin: 0;
          font-size: 24px;
          line-height: 1;
          font-weight: 950;
        }
        .access-card p {
          margin: 7px 0 0;
          color: #cbd5e1;
          font-size: 13px;
          line-height: 1.35;
        }
        .client-row,
        .login-form { display: grid; gap: 10px; }
        input {
          width: 100%;
          min-height: 40px;
          border: 1px solid rgba(148,163,184,.14);
          border-radius: 7px;
          background: rgba(15,23,42,.58);
          color: #f8fafc;
          outline: none;
          padding: 0 14px;
          font-size: 14px;
          font-weight: 700;
        }
        input::placeholder { color: #9aa4b8; }
        input:focus {
          border-color: rgba(37,99,235,.75);
          box-shadow: 0 0 0 4px rgba(37,99,235,.12);
        }
        button {
          min-height: 40px;
          border: 0;
          border-radius: 7px;
          padding: 0 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: linear-gradient(135deg, #116bff, #0f43cb);
          color: #fff;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
        }
        button:disabled { opacity: .72; cursor: wait; }
        .field-wrap { position: relative; display: block; }
        .field-wrap svg:first-child {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          z-index: 2;
          pointer-events: none;
        }
        .field-wrap input { padding-left: 42px; }
        .field-wrap.password input { padding-right: 52px; }
        .toggle-password {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 3;
          width: 34px;
          height: 34px;
          min-height: 34px;
          padding: 0;
          border-radius: 7px;
          display: grid;
          place-items: center;
          background: transparent !important;
          color: #94a3b8;
          box-shadow: none !important;
        }
        .toggle-password svg {
          position: static !important;
          transform: none !important;
          pointer-events: none;
        }
        .toggle-password:hover { background: rgba(148,163,184,.11) !important; color: #fff; }
        .error-box {
          padding: 10px 12px;
          border-radius: 9px;
          border: 1px solid rgba(248,113,113,.28);
          background: rgba(239,68,68,.1);
          color: #fca5a5;
          font-size: 12px;
          font-weight: 800;
        }
        .install-card {
          position: relative;
          z-index: 1;
          width: min(1510px, calc(100% - 76px));
          min-height: 178px;
          margin: 0 auto 26px;
          padding: 22px 30px;
          border-radius: 16px;
          border: 1px solid rgba(37,99,235,.22);
          background: linear-gradient(135deg, rgba(15,23,42,.66), rgba(2,6,23,.76));
          display: grid;
          grid-template-columns: 1fr 250px 220px;
          gap: 24px;
          align-items: center;
          overflow: hidden;
        }
        .install-card h2 { margin: 0 0 6px; font-size: 22px; }
        .install-card p { margin: 0 0 20px; color: #cbd5e1; font-size: 16px; }
        .install-steps {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }
        .install-steps span {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #e2e8f0;
          font-size: 13px;
          line-height: 1.3;
        }
        .install-steps b {
          width: 42px;
          height: 42px;
          border-radius: 999px;
          border: 1px solid rgba(37,99,235,.7);
          display: grid;
          place-items: center;
          color: #fff;
          flex-shrink: 0;
        }
        .install-steps svg,
        .plus-mini { color: #0b72ff; flex-shrink: 0; }
        .plus-mini {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: rgba(37,99,235,.15);
          font-size: 26px;
          font-weight: 900;
        }
        .install-phone {
          width: 162px;
          height: 230px;
          justify-self: end;
          margin-bottom: -78px;
          border: 8px solid #05070c;
          border-radius: 28px 28px 0 0;
          background: linear-gradient(145deg, #0f172a, #020617);
          display: grid;
          place-items: center;
          box-shadow: 0 24px 70px rgba(0,0,0,.5);
        }
        .install-phone img { width: 54px; height: 54px; border-radius: 10px; }
        .install-phone strong { margin-top: -58px; font-size: 13px; }
        .hand-note {
          color: #fff;
          font-size: 30px;
          line-height: 1.05;
          font-weight: 900;
          transform: rotate(-5deg);
        }
        .app-footer {
          position: relative;
          z-index: 1;
          width: min(1510px, calc(100% - 76px));
          margin: 0 auto;
          padding: 0 0 26px;
          display: flex;
          justify-content: center;
          gap: clamp(32px, 14vw, 360px);
          color: #8a94a8;
          font-size: 14px;
        }
        .app-footer nav { display: flex; gap: 34px; }
        .app-footer a { color: #8a94a8; text-decoration: none; }
        [data-theme='light'] .app-page {
          color: #f8fafc !important;
          background:
            radial-gradient(circle at 53% 18%, rgba(37, 99, 235, .38), transparent 24%),
            radial-gradient(circle at 82% 56%, rgba(22, 78, 160, .28), transparent 34%),
            linear-gradient(90deg, rgba(2,6,23,.99), rgba(3,10,24,.93) 48%, rgba(2,6,23,.99)),
            #020617 !important;
        }

        /* A pagina publica /app deve ficar sempre escura, mesmo quando o tema claro estiver salvo no sistema. */
        html[data-theme='light'] .app-page,
        html[data-theme='dark'] .app-page,
        .app-page {
          color-scheme: dark;
        }
        html[data-theme='light'] body:has(.app-page) {
          background: #020617 !important;
        }
        html[data-theme='light'] .app-page .topbar {
          background: rgba(0,0,0,.72) !important;
          border-bottom-color: rgba(30,64,175,.22) !important;
          color: #f8fafc !important;
        }
        html[data-theme='light'] .app-page .brand,
        html[data-theme='light'] .app-page .brand strong,
        html[data-theme='light'] .app-page .topnav a,
        html[data-theme='light'] .app-page .top-login,
        html[data-theme='light'] .app-page h1,
        html[data-theme='light'] .app-page .feature strong,
        html[data-theme='light'] .app-page .access-card h2,
        html[data-theme='light'] .app-page .install-card h2,
        html[data-theme='light'] .app-page .install-phone strong,
        html[data-theme='light'] .app-page .hand-note {
          color: #f8fafc !important;
        }
        html[data-theme='light'] .app-page .brand span,
        html[data-theme='light'] .app-page h1 span,
        html[data-theme='light'] .app-page .eyebrow,
        html[data-theme='light'] .app-page .feature div,
        html[data-theme='light'] .app-page .access-icon,
        html[data-theme='light'] .app-page .safe-note svg,
        html[data-theme='light'] .app-page .install-steps svg,
        html[data-theme='light'] .app-page .plus-mini {
          color: #0b72ff !important;
        }
        html[data-theme='light'] .app-page .lead,
        html[data-theme='light'] .app-page .safe-note,
        html[data-theme='light'] .app-page .access-card p,
        html[data-theme='light'] .app-page .install-card p,
        html[data-theme='light'] .app-page .install-steps span,
        html[data-theme='light'] .app-page .app-footer,
        html[data-theme='light'] .app-page .app-footer a,
        html[data-theme='light'] .app-page .phone-status,
        html[data-theme='light'] .app-page .phone-top,
        html[data-theme='light'] .app-page .phone-mockup small,
        html[data-theme='light'] .app-page .phone-mockup em,
        html[data-theme='light'] .app-page .phone-list span {
          color: #cbd5e1 !important;
        }
        html[data-theme='light'] .app-page .top-login {
          border-color: #0b63ff !important;
          background: rgba(2,6,23,.4) !important;
        }
        html[data-theme='light'] .app-page .top-login:hover {
          background: #0b63ff !important;
          color: #fff !important;
        }
        html[data-theme='light'] .app-page .feature div {
          background: rgba(15, 23, 42, .84) !important;
          border-color: rgba(37,99,235,.28) !important;
        }
        html[data-theme='light'] .app-page .access-card,
        html[data-theme='light'] .app-page .install-card {
          border-color: rgba(37,99,235,.18) !important;
          background: linear-gradient(145deg, rgba(15,23,42,.72), rgba(2,6,23,.76)) !important;
          box-shadow: 0 28px 70px rgba(0,0,0,.25) !important;
        }
        html[data-theme='light'] .app-page .access-icon {
          background: rgba(2,6,23,.42) !important;
          border-color: rgba(37,99,235,.42) !important;
        }
        html[data-theme='light'] .app-page input {
          background: rgba(15,23,42,.58) !important;
          border-color: rgba(148,163,184,.14) !important;
          color: #f8fafc !important;
          box-shadow: none !important;
        }
        html[data-theme='light'] .app-page input::placeholder {
          color: #9aa4b8 !important;
        }
        html[data-theme='light'] .app-page button,
        html[data-theme='light'] .app-page .primary-cta {
          background: linear-gradient(135deg, #116bff, #0f43cb) !important;
          color: #fff !important;
        }
        html[data-theme='light'] .app-page .toggle-password {
          background: transparent !important;
          color: #94a3b8 !important;
        }
        html[data-theme='light'] .app-page .toggle-password:hover {
          background: rgba(148,163,184,.11) !important;
          color: #fff !important;
        }
        html[data-theme='light'] .app-page .phone-mockup,
        html[data-theme='light'] .app-page .install-phone {
          background: linear-gradient(150deg, #111827, #020617 58%, #06193f) !important;
          border-color: #05070c !important;
          color: #f8fafc !important;
        }
        html[data-theme='light'] .app-page .phone-list {
          background: rgba(15,23,42,.86) !important;
        }
        @media (max-width: 1180px) {
          .hero-shell {
            grid-template-columns: 1fr;
            align-items: start;
            padding-top: 46px;
          }
          .hero-device { min-height: 520px; order: 3; }
          .access-stack { max-width: 760px; }
          .install-card { grid-template-columns: 1fr; }
          .install-phone, .hand-note { display: none; }
        }
        @media (max-width: 760px) {
          .topbar { min-height: 76px; padding: 0 18px; }
          .topnav { display: none; }
          .brand { font-size: 24px; }
          .brand img { width: 40px; height: 40px; }
          .top-login { min-height: 42px; padding: 0 14px; font-size: 14px; }
          .hero-shell,
          .install-card,
          .app-footer { width: min(100% - 28px, 1510px); }
          .hero-shell { padding-top: 34px; gap: 26px; }
          h1 { font-size: clamp(48px, 15vw, 70px); letter-spacing: -1.4px; }
          .lead { font-size: 18px; }
          .primary-cta { width: 100%; justify-content: center; min-height: 58px; font-size: 18px; }
          .feature-row { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; margin-top: 36px; }
          .hero-device { display: none; }
          .access-card { padding: 20px; }
          .access-head { grid-template-columns: 46px 1fr; }
          .access-icon { width: 44px; height: 44px; }
          .client-row button,
          .login-form button[type='submit'] { width: 100%; }
          .field-wrap.password input { padding-right: 50px; }
          .login-form .toggle-password {
            width: 34px !important;
            height: 34px !important;
            min-height: 34px !important;
            max-width: 34px !important;
            right: 8px;
            padding: 0 !important;
          }
          .install-card { padding: 22px; }
          .install-steps { grid-template-columns: 1fr; }
          .app-footer { flex-direction: column; align-items: center; gap: 14px; text-align: center; }
          .app-footer nav { gap: 20px; flex-wrap: wrap; justify-content: center; }
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
