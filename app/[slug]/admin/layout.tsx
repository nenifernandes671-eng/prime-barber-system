'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import { TenantProvider, useTenant } from '@/lib/tenant-context'
import { UnitProvider, useUnit } from '@/lib/unit-context'
import { getBlockedPlanForPath, isAdminPathAllowed } from '@/lib/permissions'
import { ThemeToggle } from '@/components/theme-toggle'
import { useTheme } from '@/components/theme-provider'
import { BarChart3 } from 'lucide-react'
import { Building2 } from 'lucide-react'
import {
  LayoutDashboard, CalendarDays, DollarSign, Scissors, Users, Settings,
  HandCoins, Wrench, Menu, X, Crown, LogOut, ChevronRight,
  ShieldCheck, Copy, CheckCircle2,ReceiptText,MessageCircle,
} from 'lucide-react' 

function fmtDate(value?: string | null) {
  if (!value) return 'Vencimento não informado'
  return new Date(value).toLocaleDateString('pt-BR')
}

function daysLeft(value?: string | null) {
  if (!value) return null
  const end = new Date(value).getTime()
  const now = Date.now()
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)))
}

function progressPercent(start?: string | null, end?: string | null) {
  if (!start || !end) return 78
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  const n = Date.now()
  if (e <= s) return 100
  return Math.min(100, Math.max(0, Math.round(((n - s) / (e - s)) * 100)))
}

function AdminLayoutInner({ slug, children }: { slug: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme } = useTheme()
  const { tenant, loading, isTrialing, trialDaysLeft, hasAccess, accessReason, isPremium, isProOrPremium, refreshTenant } = useTenant()
  const { units, selectedUnitId, setSelectedUnitId, loadingUnits } = useUnit()

  const [checking, setChecking] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [copied, setCopied] = useState(false)
  const [renewing, setRenewing] = useState(false)
  const [renewError, setRenewError] = useState('')

  const t = tenant as any
  const planName = t?.plano ? String(t.plano).toUpperCase() : 'PRO'
  const tenantName = t?.nome ?? slug
  const initial = tenantName?.slice(0, 2).toUpperCase() || 'NB'
  const emailInitial = adminEmail?.slice(0, 1).toUpperCase() || 'A'
  const isSubscriptionActive = ['active', 'paid'].includes(String(t?.subscription_status || '').toLowerCase())
  const isTrial = hasAccess && !isSubscriptionActive
  const periodEnd = t?.trial_ends_at ?? t?.trial_end ?? null
  const periodStart = isTrial
    ? t?.trial_start ?? t?.created_at ?? null
    : t?.created_at ?? null
  const remainingDays = isSubscriptionActive ? null : daysLeft(periodEnd)
  const planProgress = progressPercent(periodStart, periodEnd)

  const publicBookingUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/${slug}`
    return `${window.location.origin}/${slug}`
  }, [slug])
  const existingTenantPricingUrl = `/pricing?mode=existing&slug=${encodeURIComponent(slug)}`

  async function copyBookingLink() {
    await navigator.clipboard.writeText(publicBookingUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const menuItems = [
    { name: 'Dashboard', path: `/${slug}/admin`, icon: LayoutDashboard },
    { name: 'Agendamentos', path: `/${slug}/admin/agendamentos`, icon: CalendarDays },
    { name: 'Financeiro', path: `/${slug}/admin/financeiro`, icon: DollarSign },
    { name: 'Barbeiros', path: `/${slug}/admin/barbeiros`, icon: Scissors },
    { name: 'Clientes', path: `/${slug}/admin/clientes`, icon: Users },
    { name: 'Servicos', path: `/${slug}/admin/servicos`, icon: Wrench },

    ...(isPremium
      ? [
          { name: 'Dashboard Executivo', path: `/${slug}/admin/dashboard-executivo`, icon: BarChart3 },
          { name: 'Clientes Inativos', path: `/${slug}/admin/clientes-inativos`, icon: MessageCircle },
        ]
      : []),

    ...(isProOrPremium
      ? [
          { name: 'Despesas', path: `/${slug}/admin/despesas`, icon: ReceiptText },
          { name: 'Assinaturas', path: `/${slug}/admin/memberships`, icon: Crown },
          { name: 'Comissoes', path: `/${slug}/admin/comissoes`, icon: HandCoins },
          { name: 'WhatsApp', path: `/${slug}/admin/whatsapp`, icon: MessageCircle },
          { name: 'Relatorios', path: `/${slug}/admin/relatorios`, icon: BarChart3 },
        ]
      : []),

    ...(isPremium
      ? [
          { name: 'Unidades', path: `/${slug}/admin/unidades`, icon: Building2 },
        ]
      : []),

    { name: 'Configuracoes', path: `/${slug}/admin/configuracoes`, icon: Settings },
  ]

  useEffect(() => {
    if (pathname === `/${slug}/login`) {
      setChecking(false)
      return
    }

    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push(`/${slug}/login`)
        return
      }

      if (!user.user_metadata?.password_set) {
        router.push('/set-password')
        return
      }

      setAdminEmail(user.email ?? '')
      setChecking(false)
    }

    checkAuth()
  }, [slug, router])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    void refreshTenant({ silent: true })
  }, [pathname, refreshTenant])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push(`/${slug}/login`)
  }

  const handleRenewSubscription = async () => {
    setRenewing(true)
    setRenewError('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        router.replace(`/${slug}/login`)
        return
      }

      const response = await fetch('/api/asaas/renew', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
        body: JSON.stringify({ slug }),
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok || !result.url) {
        throw new Error(result.error || 'Nao foi possivel iniciar a renovacao.')
      }

      window.location.assign(result.url)
    } catch (error: any) {
      setRenewError(error?.message || 'Nao foi possivel iniciar a renovacao.')
      setRenewing(false)
    }
  }

  if (loading || checking) {
    return (
      <div className="admin-loading">
        <div className="admin-loader" />
        <style>{`
          .admin-loading{min-height:100vh;background:#050816;display:grid;place-items:center}
          .admin-loader{width:34px;height:34px;border-radius:999px;border:3px solid #1e293b;border-top-color:#3b82f6;animation:spin .8s linear infinite}
          @keyframes spin{to{transform:rotate(360deg)}}
        `}</style>
      </div>
    )
  }

  if (!hasAccess) {
    const title =
      accessReason === 'trial-expired'
        ? 'Seu teste gratuito terminou'
        : accessReason === 'subscription-expired'
          ? 'Sua assinatura venceu'
          : 'Acesso bloqueado'

    return (
      <div style={{ minHeight: '100vh', background: '#050816', color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Inter','DM Sans','Segoe UI',sans-serif" }}>
        <div style={{ width: '100%', maxWidth: 480, background: 'linear-gradient(145deg, rgba(15,23,42,.96), rgba(8,13,28,.98))', border: '1px solid rgba(148,163,184,.12)', borderRadius: 24, padding: 30, textAlign: 'center', boxShadow: '0 30px 90px rgba(0,0,0,.5)' }}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>🔒</div>
          <h1 style={{ fontSize: 28, margin: '0 0 10px', fontWeight: 950 }}>{title}</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, margin: '0 0 22px' }}>
            Para continuar usando o painel e a página de agendamento da sua barbearia, regularize sua assinatura.
          </p>
          {renewError && (
            <p style={{ color: '#fca5a5', fontSize: 13, lineHeight: 1.5, margin: '0 0 16px' }}>
              {renewError}
            </p>
          )}
          <button
            type="button"
            onClick={handleRenewSubscription}
            disabled={renewing}
            style={{ display: 'inline-flex', justifyContent: 'center', width: '100%', padding: '14px 18px', borderRadius: 14, border: 0, background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', fontWeight: 900, cursor: renewing ? 'wait' : 'pointer', opacity: renewing ? .7 : 1 }}
          >
            {renewing ? 'Abrindo renovacao...' : `Renovar assinatura ${planName}`}
          </button>
          <button onClick={handleLogout} style={{ marginTop: 12, width: '100%', padding: '12px 18px', borderRadius: 14, border: '1px solid rgba(239,68,68,.28)', background: 'transparent', color: '#f87171', fontWeight: 800, cursor: 'pointer' }}>
            Sair
          </button>
        </div>
      </div>
    )
  }

  const blockedPlan = getBlockedPlanForPath(pathname, slug)

  if (!isAdminPathAllowed(pathname, slug, t?.plano)) {
    const isPremiumBlock = blockedPlan === 'premium'

    return (
      <div style={{ minHeight: '100vh', background: '#050816', color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Inter','DM Sans','Segoe UI',sans-serif" }}>
        <div style={{ width: '100%', maxWidth: 520, background: 'linear-gradient(145deg, rgba(15,23,42,.96), rgba(8,13,28,.98))', border: '1px solid rgba(148,163,184,.12)', borderRadius: 24, padding: 30, textAlign: 'center', boxShadow: '0 30px 90px rgba(0,0,0,.5)' }}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>??</div>
          <h1 style={{ fontSize: 28, margin: '0 0 10px', fontWeight: 950 }}>Recurso {isPremiumBlock ? 'Premium' : 'Pro'}</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, margin: '0 0 22px' }}>
            Este recurso esta disponivel apenas no plano {isPremiumBlock ? 'Premium' : 'Pro ou Premium'}.
          </p>
          <Link href="/pricing" style={{ display: 'inline-flex', justifyContent: 'center', width: '100%', padding: '14px 18px', borderRadius: 14, background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', textDecoration: 'none', fontWeight: 900 }}>
            Fazer upgrade
          </Link>
          <Link href={`/${slug}/admin`} style={{ display: 'inline-flex', justifyContent: 'center', width: '100%', marginTop: 12, padding: '12px 18px', borderRadius: 14, border: '1px solid rgba(148,163,184,.18)', color: '#cbd5e1', textDecoration: 'none', fontWeight: 800 }}>
            Voltar ao dashboard
          </Link>
        </div>
      </div>
    )
  }

  const SidebarContent = () => (
    <div className="sidebar-content">
      <div className="brand-area">
        <div className="brand-logo">
          <img src="/icons/kortebarber-192.png" alt="KorteBarber" />
        </div>
        <div className="brand-text">
          <div><strong>KorteBarber</strong><span>{planName}</span></div>
          <small>Painel Admin</small>
        </div>
      </div>

      <div className="sidebar-theme-row">
        <ThemeToggle />
      </div>

      <div className="tenant-card">
        <div className="tenant-avatar">{initial}</div>
        <div className="tenant-info">
          <strong>{tenantName}</strong>
          <span>
            {hasAccess
              ? isSubscriptionActive
                ? 'Sistema ativo'
                : 'Teste ativo'
              : 'Sistema bloqueado'}
          </span>
          <button type="button" onClick={copyBookingLink} className="copy-link-btn">
            {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
            {copied ? 'Link copiado' : 'Copiar agenda'}
          </button>
        </div>
        <div className="tenant-status" />
        <ChevronRight size={16} className="tenant-chevron" />
      </div>

      {isTrialing && (
        <div className="trial-card">
          <div>
            <strong>{trialDaysLeft <= 1 ? 'Seu teste termina amanhã' : 'Teste gratuito'}</strong>
            <span>
              {trialDaysLeft <= 1
                ? 'Escolha um plano para continuar usando.'
                : `Você está no teste gratuito. Restam ${trialDaysLeft} dias.`}
            </span>
          </div>
          <div className="trial-actions">
            <Link href={existingTenantPricingUrl}>Escolher plano</Link>
            <button
              type="button"
              className="trial-pay-now"
              onClick={handleRenewSubscription}
              disabled={renewing}
            >
              {renewing ? 'Abrindo...' : 'Pagar agora'}
            </button>
          </div>
        </div>
      )}

      {isPremium && (
      <div className="unit-selector-card">
        <div className="unit-selector-head">
          <Building2 size={15} />
          <span>Unidade ativa</span>
        </div>

        <select
          value={selectedUnitId}
          onChange={(event) => setSelectedUnitId(event.target.value)}
          disabled={loadingUnits}
        >
          <option value="all">Todas as unidades</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </select>

        <small>
          {selectedUnitId === 'all'
            ? 'Visão consolidada da rede'
            : units.find((unit) => unit.id === selectedUnitId)?.name || 'Unidade selecionada'}
        </small>
      </div>
      )}

      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const active = pathname === item.path
          const Icon = item.icon
          return (
            <Link key={item.path} href={item.path} className={`sidebar-link ${active ? 'active' : ''}`}>
              <span className="sidebar-icon"><Icon size={18} strokeWidth={2.25} /></span>
              <span>{item.name}</span>
              {active && <i className="active-dot" />}
            </Link>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="plan-card">
          <div className="plan-icon"><Crown size={18} /></div>
          <span>Seu plano</span>
          <strong>{planName}</strong>
          <small>
            {isSubscriptionActive
              ? 'Assinatura ativa'
              : remainingDays !== null
              ? `${remainingDays} dia${remainingDays !== 1 ? 's' : ''} restante${remainingDays !== 1 ? 's' : ''}`
              : 'Vencimento não informado'}
          </small>
          <small>{fmtDate(periodStart)} → {fmtDate(periodEnd)}</small>
          <div className="plan-progress">
            <i style={{ width: `${planProgress}%` }} />
          </div>
        </div>

        {!isPremium && (
  <Link href="/pricing" className="upgrade-plan-btn">
    Fazer upgrade
  </Link>
)}

        <div className="account-card">
          <div className="account-avatar">{emailInitial}</div>
          <div>
            <strong>{adminEmail || 'Administrador'}</strong>
            <span>Administrador</span>
          </div>
          <ShieldCheck size={16} />
        </div>

        <button onClick={handleLogout} className="logout-btn">
          <LogOut size={16} /> Sair
        </button>
      </div>
    </div>
  )

  return (
    <div className="admin-shell" data-theme={theme}>
      <aside className="admin-sidebar admin-sidebar-desktop"><SidebarContent /></aside>

      <header className="admin-mobile-header">
        <div className="mobile-brand">
          <img src="/icons/kortebarber-192.png" alt="KorteBarber" />
          <div><strong>{tenantName}</strong><span>Painel Admin</span></div>
        </div>
        <div className="mobile-actions">
          {isPremium && (
            <select
              className="mobile-unit-select"
              value={selectedUnitId}
              onChange={(event) => setSelectedUnitId(event.target.value)}
              disabled={loadingUnits}
            >
              <option value="all">Todas</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          )}

          <button onClick={() => setMobileOpen((v) => !v)} className="mobile-menu-btn">
            {mobileOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
          <ThemeToggle compact />
        </div>
      </header>

      {mobileOpen && (
        <div className="mobile-drawer">
          <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />
          <aside className="admin-sidebar mobile-sidebar"><SidebarContent /></aside>
        </div>
      )}

      <main className="admin-main">
        <div className="admin-main-inner">
          {isTrialing && (
            <div className={`trial-notice ${trialDaysLeft <= 1 ? 'urgent' : ''}`}>
              <div>
                <strong>
                  {trialDaysLeft <= 1
                    ? 'Seu teste termina amanhã. Escolha um plano para continuar usando.'
                    : `Você está no teste gratuito. Restam ${trialDaysLeft} dias.`}
                </strong>
                <span>Todos os recursos do seu plano continuam disponíveis durante o período de teste.</span>
              </div>
              <div>
                <Link href={existingTenantPricingUrl}>Escolher plano</Link>
                <button
                  type="button"
                  className="primary"
                  onClick={handleRenewSubscription}
                  disabled={renewing}
                >
                  {renewing ? 'Abrindo...' : 'Pagar agora'}
                </button>
              </div>
            </div>
          )}
          {children}
        </div>
      </main>

      <style>{`
        :root{--admin-bg:#050816;--admin-muted:#94a3b8;--admin-text:#f8fafc}
        *{box-sizing:border-box}
        .admin-shell{min-height:100vh;display:flex;background:radial-gradient(circle at 18% 0%,rgba(37,99,235,.16),transparent 28%),radial-gradient(circle at 100% 20%,rgba(124,58,237,.10),transparent 26%),var(--admin-bg);color:var(--admin-text);font-family:'Inter','DM Sans','Segoe UI',sans-serif}
        .admin-sidebar{width:292px;min-width:292px;min-height:100vh;background:radial-gradient(circle at top left,rgba(37,99,235,.18),transparent 34%),linear-gradient(180deg,rgba(8,15,30,.98),rgba(5,8,18,.99));border-right:1px solid rgba(148,163,184,.10);backdrop-filter:blur(22px);position:sticky;top:0;height:100vh;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#1e3a8a transparent;box-shadow:24px 0 80px rgba(0,0,0,.26)}
        .sidebar-content{min-height:100%;display:flex;flex-direction:column;padding:24px 18px;gap:18px}
        .brand-area{display:flex;align-items:center;gap:13px;padding:4px 8px 10px}
        .brand-logo{width:46px;height:46px;border-radius:15px;overflow:hidden;flex-shrink:0;background:linear-gradient(135deg,#0ea5e9,#2563eb,#7c3aed);box-shadow:0 16px 35px rgba(37,99,235,.28)}
        .brand-logo img{width:100%;height:100%;object-fit:cover;display:block}
        .brand-text{min-width:0}
        .brand-text div{display:flex;align-items:center;gap:8px}
        .brand-text strong{font-size:21px;font-weight:950;letter-spacing:-.05em;color:#fff;line-height:1}
        .brand-text span{font-size:10px;font-weight:950;color:#fff;padding:4px 6px;border-radius:6px;background:linear-gradient(135deg,#2563eb,#4f46e5);box-shadow:0 8px 20px rgba(37,99,235,.30)}
        .brand-text small{display:block;margin-top:4px;color:#64748b;font-size:11px;font-weight:700}
        .tenant-card{position:relative;display:flex;align-items:center;gap:12px;padding:16px;border-radius:20px;background:radial-gradient(circle at right,rgba(16,185,129,.14),transparent 32%),linear-gradient(145deg,rgba(15,23,42,.92),rgba(8,13,28,.94));border:1px solid rgba(148,163,184,.14);box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 18px 45px rgba(0,0,0,.20)}
        .tenant-avatar{width:48px;height:48px;border-radius:16px;display:grid;place-items:center;flex-shrink:0;background:linear-gradient(135deg,#0ea5e9,#2563eb,#4f46e5);color:white;font-size:16px;font-weight:950;box-shadow:0 14px 30px rgba(37,99,235,.28)}
        .tenant-info{min-width:0;flex:1}
        .tenant-info strong{display:block;font-size:14px;font-weight:950;color:#f8fafc;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
        .tenant-info span{display:block;margin-top:3px;font-size:12px;color:#94a3b8}
        .copy-link-btn{margin-top:9px;border:1px solid rgba(59,130,246,.25);background:rgba(37,99,235,.12);color:#93c5fd;border-radius:10px;padding:7px 9px;font-size:11px;font-weight:900;display:inline-flex;align-items:center;gap:6px;cursor:pointer}
        .tenant-status{width:9px;height:9px;border-radius:99px;background:#10b981;box-shadow:0 0 18px rgba(16,185,129,.9);flex-shrink:0}
        .tenant-chevron{color:#94a3b8;flex-shrink:0}
        .trial-card{padding:14px;border-radius:16px;display:grid;gap:10px;background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.22)}
        .trial-card strong{display:block;color:#fbbf24;font-size:13px;font-weight:950}
        .trial-card span{display:block;margin-top:2px;color:#fcd34d;font-size:11px}
        .trial-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}
        .trial-card a,.trial-card button{min-width:0;color:#fbbf24;border:1px solid rgba(245,158,11,.30);border-radius:10px;padding:8px 9px;font-size:10px;font-weight:950;text-align:center;text-decoration:none;background:transparent;cursor:pointer}
        .trial-card .trial-pay-now{color:#111827;background:#f59e0b;border-color:#f59e0b}
        .trial-card button:disabled{cursor:wait;opacity:.7}
        [data-theme="light"] .trial-card{background:#eff6ff;border-color:#bfdbfe;box-shadow:0 10px 28px rgba(37,99,235,.08)}
        [data-theme="light"] .trial-card strong{color:#1e3a8a}
        [data-theme="light"] .trial-card span{color:#475569}
        [data-theme="light"] .trial-card a{color:#1d4ed8;background:#fff;border-color:#93c5fd}
        [data-theme="light"] .trial-card .trial-pay-now{color:#fff;background:#2563eb;border-color:#2563eb}
        .unit-selector-card{padding:13px;border-radius:16px;background:rgba(15,23,42,.62);border:1px solid rgba(148,163,184,.10);display:grid;gap:9px}
        .unit-selector-head{display:flex;align-items:center;gap:7px;color:#93c5fd;font-size:12px;font-weight:950;text-transform:uppercase;letter-spacing:.08em}
        .unit-selector-card select{width:100%;min-height:39px;border-radius:12px;border:1px solid rgba(148,163,184,.14);background:rgba(2,6,23,.58);color:#f8fafc;padding:0 10px;font-size:12px;font-weight:900;outline:none}
        .unit-selector-card option,.mobile-unit-select option{background:#020617;color:#f8fafc}
        .unit-selector-card small{color:#64748b;font-size:11px;font-weight:800;line-height:1.35}
        .sidebar-nav{display:flex;flex-direction:column;gap:7px;flex:1;padding-top:6px}
        .sidebar-link{position:relative;display:flex;align-items:center;gap:13px;min-height:46px;padding:12px 14px;border-radius:15px;text-decoration:none;color:#a8b3c7;font-size:14px;font-weight:760;border:1px solid transparent;transition:.18s ease}
        .sidebar-link:hover{color:#fff;background:rgba(15,23,42,.78);border-color:rgba(148,163,184,.10);transform:translateX(2px)}
        .sidebar-link.active{color:#fff;background:radial-gradient(circle at right,rgba(59,130,246,.24),transparent 34%),linear-gradient(135deg,rgba(37,99,235,.40),rgba(29,78,216,.16));border-color:rgba(59,130,246,.56);box-shadow:0 14px 34px rgba(37,99,235,.18),inset 0 1px 0 rgba(255,255,255,.05)}
        .sidebar-icon{width:22px;display:grid;place-items:center;color:#93c5fd;flex-shrink:0}
        .active-dot{margin-left:auto;width:6px;height:6px;border-radius:99px;background:#3b82f6;box-shadow:0 0 16px rgba(59,130,246,.9)}
        .sidebar-footer{margin-top:auto;padding-top:16px;border-top:1px solid rgba(148,163,184,.10);display:flex;flex-direction:column;gap:10px}
        .plan-card{position:relative;overflow:hidden;border-radius:20px;padding:16px;background:radial-gradient(circle at top right,rgba(245,158,11,.28),transparent 26%),linear-gradient(145deg,rgba(15,23,42,.96),rgba(15,23,42,.70));border:1px solid rgba(148,163,184,.14)}
        .plan-icon{position:absolute;top:16px;right:16px;width:34px;height:34px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#111827;box-shadow:0 0 34px rgba(245,158,11,.45)}
        .plan-card span{display:block;font-size:12px;color:#94a3b8}
        .plan-card strong{display:block;margin-top:4px;font-size:16px;font-weight:950;color:#fff}
        .plan-card small{display:block;margin-top:3px;color:#94a3b8;font-size:11px}
        .plan-progress{margin-top:10px;width:100%;height:7px;border-radius:99px;overflow:hidden;background:rgba(148,163,184,.16)}
        .plan-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#2563eb,#7c3aed);box-shadow:0 0 18px rgba(124,58,237,.55)}
        .account-card{display:flex;align-items:center;gap:10px;padding:12px;border-radius:16px;background:rgba(15,23,42,.62);border:1px solid rgba(148,163,184,.10)}
        .account-avatar{width:34px;height:34px;border-radius:12px;display:grid;place-items:center;background:rgba(37,99,235,.20);color:#93c5fd;font-size:13px;font-weight:950;flex-shrink:0}
        .account-card div:nth-child(2){flex:1;min-width:0}
        .account-card strong{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:#cbd5e1;font-size:12px;font-weight:800}
        .account-card span{display:block;margin-top:2px;color:#64748b;font-size:11px}
        .account-card svg{color:#10b981;flex-shrink:0}
        .logout-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:44px;border-radius:14px;border:1px solid rgba(239,68,68,.30);background:rgba(239,68,68,.045);color:#f87171;font-size:13px;font-weight:900;cursor:pointer;transition:.18s ease}
        .logout-btn:hover{background:rgba(239,68,68,.10);border-color:rgba(239,68,68,.50)}
        .admin-main{flex:1;min-width:0;min-height:100vh}
        .admin-main-inner{max-width:1680px;margin:0 auto;padding:36px 42px}
        .trial-notice{margin-bottom:18px;padding:14px 16px;border-radius:16px;display:flex;align-items:center;justify-content:space-between;gap:18px;background:rgba(37,99,235,.10);border:1px solid rgba(59,130,246,.24)}
        .trial-notice.urgent{background:rgba(245,158,11,.11);border-color:rgba(245,158,11,.30)}
        .trial-notice strong{display:block;color:#dbeafe;font-size:13px;font-weight:950}
        .trial-notice.urgent strong{color:#fde68a}
        .trial-notice span{display:block;margin-top:3px;color:#94a3b8;font-size:12px}
        .trial-notice>div:last-child{display:flex;gap:8px;flex-shrink:0}
        .trial-notice a,.trial-notice button{min-height:38px;padding:0 13px;border-radius:11px;display:inline-flex;align-items:center;justify-content:center;color:#93c5fd;border:1px solid rgba(59,130,246,.28);font-size:11px;font-weight:950;text-decoration:none;background:transparent;cursor:pointer}
        .trial-notice .primary{background:#2563eb;border-color:#2563eb;color:#fff}
        .trial-notice button:disabled{cursor:wait;opacity:.7}
        .admin-mobile-header{display:none;position:fixed;top:0;left:0;right:0;height:64px;z-index:40;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(8,15,30,.96);border-bottom:1px solid rgba(148,163,184,.10);backdrop-filter:blur(20px)}
        .mobile-brand{display:flex;align-items:center;gap:10px}
        .mobile-brand img{width:34px;height:34px;border-radius:12px}
        .mobile-brand strong{display:block;font-size:14px;font-weight:950;color:#fff}
        .mobile-brand span{display:block;font-size:11px;color:#94a3b8}
        .mobile-actions{display:flex;align-items:center;gap:8px}
        .mobile-unit-select{max-width:116px;height:38px;border-radius:12px;border:1px solid rgba(148,163,184,.14);background:rgba(15,23,42,.82);color:#f8fafc;padding:0 9px;font-size:12px;font-weight:900;outline:none}
        .mobile-menu-btn{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;border:1px solid rgba(148,163,184,.14);background:rgba(15,23,42,.82);color:#f8fafc;cursor:pointer}
        .mobile-drawer{position:fixed;inset:0;z-index:60}
        .mobile-overlay{position:absolute;inset:0;background:rgba(0,0,0,.58);backdrop-filter:blur(3px)}
        .mobile-sidebar{position:relative;z-index:1;height:100vh;width:min(88vw,310px);min-width:unset;animation:slideIn .18s ease}
        @keyframes slideIn{from{transform:translateX(-20px);opacity:.6}to{transform:translateX(0);opacity:1}}
        @media(max-width:1280px){.admin-sidebar{width:270px;min-width:270px}.admin-main-inner{padding:30px 32px}}
        @media(max-width:768px){.admin-shell{display:block}.admin-sidebar-desktop{display:none!important}.admin-mobile-header{display:flex}.admin-main{padding-top:64px;background:#020617}.admin-main-inner{padding:16px 14px 86px!important}.sidebar-content{padding:22px 16px}.brand-text strong{font-size:20px}.sidebar-link{min-height:48px;font-size:14px}.trial-notice{align-items:stretch;flex-direction:column}.trial-notice>div:last-child{display:grid;grid-template-columns:1fr 1fr}.trial-notice a{width:100%}}
        @media(max-height:760px) and (min-width:769px){.sidebar-content{gap:12px;padding-top:16px;padding-bottom:16px}.sidebar-link{min-height:40px;padding-top:9px;padding-bottom:9px}.tenant-card{padding:12px}.plan-card{padding:13px}}
        .upgrade-plan-btn {
  margin-top: 12px;
  min-height: 36px;
  border-radius: 12px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #111827;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 950;
  text-decoration: none;
  box-shadow: 0 14px 30px rgba(245, 158, 11, .25);
}
      `}</style>
    </div>
  )
}

export default function SlugAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)

  return (
    <TenantProvider slug={slug}>
      <UnitProvider>
        <AdminLayoutInner slug={slug}>{children}</AdminLayoutInner>
      </UnitProvider>
    </TenantProvider>
  )
}
