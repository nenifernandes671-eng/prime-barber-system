'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import { TenantProvider, useTenant } from '@/lib/tenant-context'
import {
  LayoutDashboard, CalendarDays, DollarSign, Scissors,
  Users, Settings, HandCoins, Wrench, Menu, X, Crown,
} from 'lucide-react'

function AdminLayoutInner({ slug, children }: { slug: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { tenant, loading, isTrialing, trialDaysLeft, hasAccess, accessReason } = useTenant()
  const [checking, setChecking] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')

  const menuItems = [
    { name: 'Dashboard',     path: `/${slug}/admin`,               icon: LayoutDashboard },
    { name: 'Agendamentos',  path: `/${slug}/admin/agendamentos`,  icon: CalendarDays },
    { name: 'Financeiro',    path: `/${slug}/admin/financeiro`,    icon: DollarSign },
    { name: 'Barbeiros',     path: `/${slug}/admin/barbeiros`,     icon: Scissors },
    { name: 'Clientes',      path: `/${slug}/admin/clientes`,      icon: Users },
    { name: 'Serviços',      path: `/${slug}/admin/servicos`,      icon: Wrench },
    { name: 'Memberships',   path: `/${slug}/admin/memberships`,   icon: Crown },
    { name: 'Comissões',     path: `/${slug}/admin/comissoes`,     icon: HandCoins },
    { name: 'Configurações', path: `/${slug}/admin/configuracoes`, icon: Settings },
  ]

  useEffect(() => {
    if (pathname === `/${slug}/login`) { setChecking(false); return }
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push(`/${slug}/login`); return }
      const { data: tenantData } = await supabase
        .from('tenants').select('id').eq('slug', slug).maybeSingle()
      if (!tenantData) { router.push(`/${slug}/login`); return }
      const { data: membership } = await supabase
        .from('tenant_users').select('role')
        .eq('user_id', user.id).eq('tenant_id', tenantData.id).maybeSingle()
      if (!membership) { router.push(`/${slug}/login`); return }

      // ✅ Se ainda não definiu senha, redireciona
      if (!user.user_metadata?.password_set) {
        router.push(`/${slug}/set-password`)
        return
      }

      setAdminEmail(user.email ?? '')
      setChecking(false)
    }
    checkAuth()
  }, [pathname, slug, router])

  useEffect(() => { setMobileOpen(false) }, [pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push(`/${slug}/login`)
  }

  if (loading || checking) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#070b14' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #1e2535', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (!hasAccess) {
    const title = accessReason === 'trial-expired'
      ? 'Seu teste gratuito terminou'
      : accessReason === 'subscription-expired'
      ? 'Sua assinatura venceu'
      : 'Acesso bloqueado'

    return (
      <div style={{ minHeight: '100vh', background: '#070b14', color: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
        <div style={{ width: '100%', maxWidth: 480, background: 'rgba(11,18,32,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28, textAlign: 'center', boxShadow: '0 24px 70px rgba(0,0,0,0.45)' }}>
          <div style={{ fontSize: 38, marginBottom: 12 }}>🔒</div>
          <h1 style={{ fontSize: 26, margin: '0 0 10px', fontWeight: 900 }}>{title}</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, margin: '0 0 22px' }}>
            Para continuar usando o painel e a página de agendamento da sua barbearia, regularize sua assinatura.
          </p>
          <Link href="/pricing" style={{ display: 'inline-flex', justifyContent: 'center', width: '100%', padding: '13px 18px', borderRadius: 12, background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', textDecoration: 'none', fontWeight: 800 }}>
            Ver planos
          </Link>
          <button onClick={handleLogout} style={{ marginTop: 12, width: '100%', padding: '11px 18px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.25)', background: 'transparent', color: '#f87171', fontWeight: 700, cursor: 'pointer' }}>
            Sair
          </button>
        </div>
      </div>
    )
  }

  const SidebarContent = () => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '0 8px' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>✂</div>
        <div style={{ overflow: 'hidden' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tenant?.nome ?? slug.toUpperCase()}</p>
          <p style={{ fontSize: 10, color: '#475569', margin: 0 }}>Painel Admin</p>
        </div>
      </div>

      {isTrialing && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '10px 12px', marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: '#fbbf24', margin: '0 0 4px', fontWeight: 700 }}>⏳ Período de teste</p>
          <p style={{ fontSize: 11, color: '#92400e', margin: 0 }}>{trialDaysLeft} dias restantes</p>
          <Link href="/pricing" style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, textDecoration: 'none' }}>Assinar agora →</Link>
        </div>
      )}

      {tenant?.plano === 'basic' && (
        <div style={{ background: 'linear-gradient(135deg,rgba(37,99,235,0.16),rgba(245,158,11,0.08))', border: '1px solid rgba(96,165,250,0.22)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: '#f8fafc', margin: '0 0 5px', fontWeight: 900 }}>Seja Pro</p>
          <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 9px', lineHeight: 1.4 }}>Libere barbeiros ilimitados, comissões e lembretes via WhatsApp.</p>
          <Link href="/pricing" style={{ display: 'inline-flex', width: '100%', justifyContent: 'center', padding: '8px 10px', borderRadius: 9, background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 800, textDecoration: 'none' }}>
            Fazer upgrade
          </Link>
        </div>
      )}

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {menuItems.map((item) => {
          const active = pathname === item.path
          return (
            <Link key={item.path} href={item.path} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 12,
              fontSize: 13, textDecoration: 'none',
              background: active ? 'linear-gradient(90deg,rgba(37,99,235,0.22),rgba(37,99,235,0.08))' : 'transparent',
              border: `1px solid ${active ? 'rgba(59,130,246,0.18)' : 'transparent'}`,
              color: active ? '#fff' : '#94a3b8',
              fontWeight: active ? 700 : 400,
            }}>
              <item.icon size={16} strokeWidth={2} />
              <span>{item.name}</span>
              {active && <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: '#3b82f6' }} />}
            </Link>
          )
        })}
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid #1e2535', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: '#1e2d45', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#60a5fa', flexShrink: 0 }}>A</div>
          <p style={{ fontSize: 11, color: '#64748b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adminEmail}</p>
        </div>
        <button onClick={handleLogout} style={{ width: '100%', padding: '9px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          ⏻ Sair
        </button>
      </div>
    </>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#070b14', fontFamily: "'DM Sans','Segoe UI',sans-serif", color: '#f1f5f9' }}>
      <aside style={{ width: 240, minHeight: '100vh', background: 'rgba(8,15,30,0.95)', borderRight: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', padding: '20px 14px', position: 'sticky', top: 0, height: '100vh' }}
        className="admin-sidebar-desktop">
        <SidebarContent />
      </aside>

      <div className="admin-mobile-header" style={{ display: 'none', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40, background: 'rgba(8,15,30,0.95)', borderBottom: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', padding: '12px 18px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>✂</span>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>{tenant?.nome ?? slug}</p>
        </div>
        <button onClick={() => setMobileOpen(v => !v)} style={{ background: 'transparent', border: 'none', color: '#f1f5f9', cursor: 'pointer' }}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
          <div onClick={() => setMobileOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          <aside style={{ position: 'relative', zIndex: 1, width: 250, height: '100vh', background: 'rgba(8,15,30,0.98)', display: 'flex', flexDirection: 'column', padding: '20px 14px', overflowY: 'auto' }}>
            <SidebarContent />
          </aside>
        </div>
      )}

      <main style={{ flex: 1, background: `radial-gradient(circle at top left,rgba(37,99,235,0.12),transparent 22%),#070b14`, minHeight: '100vh' }} className="admin-main">
        <div style={{ padding: '36px 40px', maxWidth: 1600, margin: '0 auto', boxSizing: 'border-box' }} className="admin-main-inner">
          {children}
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .admin-sidebar-desktop { display: none !important; }
          .admin-mobile-header { display: flex !important; }
          .admin-main { padding-top: 56px; }
          .admin-main-inner { padding: 16px 14px 80px !important; }
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
      <AdminLayoutInner slug={slug}>{children}</AdminLayoutInner>
    </TenantProvider>
  )
}
