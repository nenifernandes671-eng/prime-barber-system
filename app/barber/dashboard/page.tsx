'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useIsMobile } from '@/lib/useIsMobile'
import { getTenantAccess } from '@/lib/subscription-access'

interface Appointment {
  id: string
  client_name: string
  service: string
  price: number
  appointment_date: string
  appointment_time: string
  status: string
  notes?: string
  phone?: string
}

interface Barber {
  id: string
  nome: string
  email?: string | null
  tenant_id: string
  commission_percentage?: number
  commission_type?: 'percentage'
}

interface BarberStats {
  todayCount: number
  weekEarnings: number
  monthEarnings: number
  completedTotal: number
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
  scheduled: 'Agendado',
}

const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  completed: '#10b981',
  finished: '#10b981',
  cancelled: '#ef4444',
  scheduled: '#8b5cf6',
}

function formatCurrency(v: number) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(date: string, time?: string) {
  if (!date) return '—'
  const d = new Date(date + 'T' + (time || '00:00'))
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function isToday(date: string) {
  return new Date(date + 'T00:00').toDateString() === new Date().toDateString()
}

function isFuture(date: string) {
  return new Date(date + 'T23:59') > new Date()
}

export default function BarberDashboard() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [barber, setBarber] = useState<Barber | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [stats, setStats] = useState<BarberStats>({ todayCount: 0, weekEarnings: 0, monthEarnings: 0, completedTotal: 0 })
  const [tab, setTab] = useState<'today' | 'upcoming' | 'history'>('today')
  const [now] = useState(new Date())

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/barber/login')
        return
      }

      let { data: barberData, error } = await supabase
        .from('barbeiros')
        .select('id, nome, email, tenant_id')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .maybeSingle()

      if (!barberData && user.email) {
        const fallback = await supabase
          .from('barbeiros')
          .select('id, nome, email, tenant_id')
          .eq('email', user.email)
          .eq('ativo', true)
          .maybeSingle()

        barberData = fallback.data
        error = fallback.error

        if (barberData) {
          await supabase
            .from('barbeiros')
            .update({ user_id: user.id })
            .eq('id', barberData.id)
            .eq('tenant_id', barberData.tenant_id)
        }
      }

      if (error || !barberData) {
        await supabase.auth.signOut()
        router.push('/barber/login')
        return
      }

      const { data: tenant } = await supabase
        .from('tenants')
        .select('status, trial_ends_at')
        .eq('id', barberData.tenant_id)
        .maybeSingle()

      if (!getTenantAccess(tenant).allowed) {
        await supabase.auth.signOut()
        router.push('/barber/login')
        return
      }

      const { data: commissionRows } = await supabase
        .from('barbers')
        .select('name, email, commission_percentage, commission_type')
        .eq('tenant_id', barberData.tenant_id)
        .or(`email.eq.${barberData.email ?? user.email},name.eq.${barberData.nome}`)

      const normalizedEmail = (barberData.email || user.email || '').toLowerCase()
      const normalizedName = (barberData.nome || '').toLowerCase()
      const matchingByEmail = (commissionRows || []).filter((row: any) =>
        row.email && row.email.toLowerCase() === normalizedEmail
      )
      const matchingByName = (commissionRows || []).filter((row: any) =>
        row.name && row.name.toLowerCase() === normalizedName
      )
      const matchingRows = matchingByEmail.length > 0 ? matchingByEmail : matchingByName
      const commissionConfig = matchingRows.reduce((best: any, row: any) => {
        if (!best) return row
        return (row.commission_percentage || 0) > (best.commission_percentage || 0) ? row : best
      }, null)

      const barberWithCommission = {
        ...barberData,
        commission_percentage: commissionConfig?.commission_percentage ?? 0,
        commission_type: 'percentage' as const,
      }

      setBarber(barberWithCommission)
      await fetchAppointments(barberWithCommission)
      setLoading(false)
    }

    init()
  }, [router])

  async function fetchAppointments(currentBarber: Barber) {
    const { data } = await supabase
      .from('appointments')
      .select('id, client_name, service, price, appointment_date, appointment_time, status, notes, phone')
      .eq('tenant_id', currentBarber.tenant_id)
      .eq('barber', currentBarber.nome)
      .order('appointment_date', { ascending: false })

    const list: Appointment[] = data ?? []
    setAppointments(list)

    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const calcCommission = (price: number) => {
      return price * ((currentBarber.commission_percentage || 0) / 100)
    }

    const todayCount = list.filter((a) => isToday(a.appointment_date) && a.status !== 'cancelled').length

    const weekEarnings = list
      .filter((a) => ['completed', 'finished', 'scheduled'].includes(a.status) && new Date(a.appointment_date) >= startOfWeek)
      .reduce((s, a) => s + calcCommission(a.price || 0), 0)

    const monthEarnings = list
      .filter((a) => ['completed', 'finished', 'scheduled'].includes(a.status) && new Date(a.appointment_date) >= startOfMonth)
      .reduce((s, a) => s + calcCommission(a.price || 0), 0)

    const completedTotal = list.filter((a) => a.status === 'completed' || a.status === 'finished').length

    setStats({ todayCount, weekEarnings, monthEarnings, completedTotal })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/barber/login')
  }

  const todayList = appointments.filter((a) => isToday(a.appointment_date) && a.status !== 'cancelled')
  const upcomingList = appointments.filter((a) => isFuture(a.appointment_date) && !isToday(a.appointment_date) && a.status !== 'cancelled')
  const historyList = [...appointments].filter((a) => !isFuture(a.appointment_date) || a.status === 'completed' || a.status === 'finished' || a.status === 'cancelled')
  const activeList = tab === 'today' ? todayList : tab === 'upcoming' ? upcomingList : historyList

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.spinner} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: '#475569', marginTop: 16, fontSize: 14 }}>Carregando seu painel...</p>
      </div>
    )
  }

  return (
    <div style={{ ...styles.root, flexDirection: isMobile ? 'column' : 'row', overflowX: 'hidden' }} className="barber-dashboard-shell">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <aside style={{ ...styles.sidebar, ...(isMobile ? styles.mobileSidebar : {}) }} className="barber-dashboard-sidebar">
        <div style={{ textAlign: 'center', marginBottom: 40, display: isMobile ? 'none' : 'block' }}>
          <div style={styles.logo}>✂</div>
          <p style={styles.logoLabel}>Meu Painel</p>
        </div>
        <nav style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: 8, flex: 1, overflowX: isMobile ? 'auto' : undefined }}>
          {(['today', 'upcoming', 'history'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ ...styles.navBtn, ...(tab === t ? styles.navBtnActive : {}) }}>
              <span style={{ fontSize: 16 }}>{t === 'today' ? '📅' : t === 'upcoming' ? '🗓' : '📋'}</span>
              {t === 'today' ? 'Hoje' : t === 'upcoming' ? 'Próximos' : 'Histórico'}
            </button>
          ))}
        </nav>
        <button onClick={handleLogout} style={{ ...styles.logoutBtn, marginTop: isMobile ? 10 : styles.logoutBtn.marginTop }}>Sair</button>
      </aside>

      <main style={{ ...styles.main, ...(isMobile ? styles.mobileMain : {}) }} className="barber-dashboard-main">
        <header style={{ marginBottom: isMobile ? 20 : 32 }}>
          <h1 style={{ fontSize: isMobile ? 24 : 26, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' }}>
            Olá, {barber?.nome} 👋
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </header>

        <div style={{ ...styles.statsGrid, gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : styles.statsGrid.gridTemplateColumns, gap: isMobile ? 10 : styles.statsGrid.gap, marginBottom: isMobile ? 24 : styles.statsGrid.marginBottom }} className="barber-dashboard-stats">
          <StatCard icon="✂️" label="Cortes hoje" value={String(stats.todayCount)} color="#3b82f6" />
          <StatCard icon="💰" label="Comissão esta semana" value={formatCurrency(stats.weekEarnings)} color="#10b981" />
          <StatCard icon="📈" label="Comissão este mês" value={formatCurrency(stats.monthEarnings)} color="#8b5cf6" />
          <StatCard icon="🏆" label="Total concluídos" value={String(stats.completedTotal)} color="#f59e0b" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#cbd5e1', margin: 0 }}>
            {tab === 'today' ? `Hoje (${todayList.length})` : tab === 'upcoming' ? `Próximos (${upcomingList.length})` : 'Histórico'}
          </h2>
          <button onClick={() => barber && fetchAppointments(barber)} style={styles.refreshBtn}>↻ Atualizar</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>🗓</span>
              <p style={{ color: '#475569', fontSize: 15 }}>
                {tab === 'today' ? 'Nenhum agendamento para hoje.' : tab === 'upcoming' ? 'Nenhum agendamento futuro.' : 'Nenhum histórico ainda.'}
              </p>
            </div>
          ) : activeList.map((a) => (
            <div key={a.id} style={styles.card}>
              <div style={{ ...styles.cardAccent, backgroundColor: STATUS_COLOR[a.status] ?? '#64748b' }} />
              <div style={{ flex: 1, padding: isMobile ? '14px 12px' : '16px 20px', minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexDirection: isMobile ? 'column' : 'row' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', margin: '0 0 2px' }}>{a.client_name}</p>
                    <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 2px' }}>{a.service}</p>
                    {a.phone && <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>📱 {a.phone}</p>}
                  </div>
                  <div style={{ textAlign: isMobile ? 'left' : 'right', flexShrink: 0, width: isMobile ? '100%' : undefined }}>
                    <p style={{ fontSize: 17, fontWeight: 700, color: '#10b981', margin: '0 0 2px' }}>{formatCurrency(a.price)}</p>
                    <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 4px' }}>
                      {formatDate(a.appointment_date)} {a.appointment_time ? a.appointment_time.slice(0, 5) : ''}
                    </p>
                    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, backgroundColor: (STATUS_COLOR[a.status] ?? '#64748b') + '22', color: STATUS_COLOR[a.status] ?? '#94a3b8' }}>
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div style={{ backgroundColor: '#161b27', borderRadius: 14, padding: '20px 20px 16px', border: '1px solid #1e2535', borderTop: `3px solid ${color}` }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <p style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: '8px 0 2px' }}>{value}</p>
      <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{label}</p>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', minHeight: '100vh', backgroundColor: '#0f1117', color: '#e2e8f0', fontFamily: "'DM Sans','Segoe UI',sans-serif" },
  sidebar: { width: 220, minHeight: '100vh', backgroundColor: '#161b27', display: 'flex', flexDirection: 'column', padding: '32px 16px', borderRight: '1px solid #1e2535', position: 'sticky', top: 0, height: '100vh' },
  mobileSidebar: { width: '100%', minHeight: 0, height: 'auto', padding: 12, borderRight: 0, borderBottom: '1px solid #1e2535', position: 'sticky', zIndex: 20 },
  logo: { fontSize: 36, marginBottom: 4 },
  logoLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2, margin: 0 },
  navBtn: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: 'none', background: 'transparent', color: '#64748b', fontSize: 14, cursor: 'pointer', textAlign: 'left' },
  navBtnActive: { backgroundColor: '#1e2d45', color: '#60a5fa' },
  logoutBtn: { marginTop: 'auto', padding: '10px 14px', borderRadius: 10, border: '1px solid #2d3748', background: 'transparent', color: '#ef4444', fontSize: 13, cursor: 'pointer' },
  main: { flex: 1, padding: '32px 40px', overflowY: 'auto' },
  mobileMain: { width: '100%', padding: '20px 14px 84px', overflowY: 'visible' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 36 },
  refreshBtn: { padding: '6px 14px', borderRadius: 8, border: '1px solid #2d3748', background: 'transparent', color: '#64748b', fontSize: 13, cursor: 'pointer' },
  card: { display: 'flex', backgroundColor: '#161b27', borderRadius: 14, border: '1px solid #1e2535', overflow: 'hidden' },
  cardAccent: { width: 4, flexShrink: 0 },
  loadingScreen: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1117' },
  spinner: { width: 36, height: 36, borderRadius: '50%', border: '3px solid #1e2535', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite' },
}
