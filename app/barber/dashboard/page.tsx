'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useIsMobile } from '@/lib/useIsMobile'
import { getTenantAccess } from '@/lib/subscription-access'
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  History,
  LogOut,
  Phone,
  RefreshCcw,
  Scissors,
  Target,
  TrendingUp,
  Trophy,
  UserRound,
  Wallet,
} from 'lucide-react'

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

function formatShortDate(date: string) {
  if (!date) return '—'
  const d = new Date(date + 'T00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function formatTime(time?: string) {
  if (!time) return '--:--'
  return time.slice(0, 5)
}

function isToday(date: string) {
  return new Date(date + 'T00:00').toDateString() === new Date().toDateString()
}

function isFuture(date: string) {
  return new Date(date + 'T23:59') > new Date()
}

function appointmentDateTime(a: Appointment) {
  return new Date(`${a.appointment_date}T${a.appointment_time || '00:00'}`).getTime()
}

export default function BarberDashboard() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [barber, setBarber] = useState<Barber | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [stats, setStats] = useState<BarberStats>({
    todayCount: 0,
    weekEarnings: 0,
    monthEarnings: 0,
    completedTotal: 0,
  })
  const [tab, setTab] = useState<'today' | 'upcoming' | 'history'>('today')
  const [now] = useState(new Date())

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

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
    setRefreshing(true)

    const { data } = await supabase
      .from('appointments')
      .select('id, client_name, service, price, appointment_date, appointment_time, status, notes, phone')
      .eq('tenant_id', currentBarber.tenant_id)
      .eq('barber', currentBarber.nome)
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: true })

    const list: Appointment[] = data ?? []
    setAppointments(list)

    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const calcCommission = (price: number) => {
      return price * ((currentBarber.commission_percentage || 0) / 100)
    }

    const commissionStatuses = ['completed', 'finished', 'scheduled']

    const todayCount = list.filter((a) => isToday(a.appointment_date) && a.status !== 'cancelled').length

    const weekEarnings = list
      .filter((a) => commissionStatuses.includes(a.status) && new Date(a.appointment_date) >= startOfWeek)
      .reduce((s, a) => s + calcCommission(a.price || 0), 0)

    const monthEarnings = list
      .filter((a) => commissionStatuses.includes(a.status) && new Date(a.appointment_date) >= startOfMonth)
      .reduce((s, a) => s + calcCommission(a.price || 0), 0)

    const completedTotal = list.filter((a) => a.status === 'completed' || a.status === 'finished').length

    setStats({ todayCount, weekEarnings, monthEarnings, completedTotal })
    setRefreshing(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/barber/login')
  }

  const todayList = useMemo(
    () =>
      appointments
        .filter((a) => isToday(a.appointment_date) && a.status !== 'cancelled')
        .sort((a, b) => appointmentDateTime(a) - appointmentDateTime(b)),
    [appointments]
  )

  const upcomingList = useMemo(
    () =>
      appointments
        .filter((a) => isFuture(a.appointment_date) && !isToday(a.appointment_date) && a.status !== 'cancelled')
        .sort((a, b) => appointmentDateTime(a) - appointmentDateTime(b)),
    [appointments]
  )

  const historyList = useMemo(
    () =>
      [...appointments]
        .filter((a) => !isFuture(a.appointment_date) || ['completed', 'finished', 'cancelled'].includes(a.status))
        .sort((a, b) => appointmentDateTime(b) - appointmentDateTime(a)),
    [appointments]
  )

  const activeList = tab === 'today' ? todayList : tab === 'upcoming' ? upcomingList : historyList

  const nextClient = useMemo(() => {
    const nowMs = Date.now()

    return [...todayList, ...upcomingList]
      .filter((a) => appointmentDateTime(a) >= nowMs)
      .sort((a, b) => appointmentDateTime(a) - appointmentDateTime(b))[0]
  }, [todayList, upcomingList])

  const monthGoal = 2000
  const goalPercent = Math.min(100, Math.round((stats.monthEarnings / monthGoal) * 100))
  const commissionPercent = barber?.commission_percentage || 0

  if (loading) {
    return (
      <div className="barber-loading">
        <div className="spinner" />
        <p>Carregando seu painel...</p>

        <style>{`
          .barber-loading {
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #050816;
            color: #64748b;
          }

          .spinner {
            width: 36px;
            height: 36px;
            border-radius: 999px;
            border: 3px solid #1e293b;
            border-top-color: #3b82f6;
            animation: spin .8s linear infinite;
          }

          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    )
  }

  return (
    <div className="barber-shell">
      <style>{css}</style>

      <aside className="barber-sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Scissors size={27} />
          </div>

          <strong>Meu Painel</strong>
          <span>{barber?.nome}</span>
        </div>

        <nav className="barber-nav">
          <button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}>
            <CalendarDays size={17} />
            Hoje
            <b>{todayList.length}</b>
          </button>

          <button className={tab === 'upcoming' ? 'active' : ''} onClick={() => setTab('upcoming')}>
            <Clock size={17} />
            Próximos
            <b>{upcomingList.length}</b>
          </button>

          <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
            <History size={17} />
            Histórico
            <b>{historyList.length}</b>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="mini-profile">
            <div>{barber?.nome?.slice(0, 2).toUpperCase() || 'BR'}</div>

            <span>
              <strong>{barber?.nome}</strong>
              <small>{commissionPercent}% comissão</small>
            </span>
          </div>

          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      <main className="barber-main">
        <header className="top-header">
          <div>
            <p className="eyebrow">Painel do barbeiro</p>
            <h1>Olá, {barber?.nome} 👋</h1>
            <span>{now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>

          <button onClick={() => barber && fetchAppointments(barber)} className="refresh-btn" disabled={refreshing}>
            <RefreshCcw size={16} className={refreshing ? 'spinning' : ''} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
        </header>

        <section className="hero-grid">
          <div className="next-card">
            <div className="next-head">
              <span>Próximo cliente</span>
              <CalendarDays size={18} />
            </div>

            {nextClient ? (
              <>
                <h2>{nextClient.client_name}</h2>
                <p>{nextClient.service}</p>

                <div className="next-meta">
                  <span>
                    <Clock size={15} />
                    {formatTime(nextClient.appointment_time)}
                  </span>

                  <span>{formatShortDate(nextClient.appointment_date)}</span>
                </div>

                {nextClient.phone && (
                  <div className="phone-line">
                    <Phone size={15} />
                    {nextClient.phone}
                  </div>
                )}
              </>
            ) : (
              <div className="empty-next">
                <strong>Sem próximo cliente</strong>
                <span>Nenhum agendamento pendente encontrado.</span>
              </div>
            )}
          </div>

          <div className="goal-card">
            <div className="next-head">
              <span>Meta do mês</span>
              <Target size={18} />
            </div>

            <h2>{formatCurrency(stats.monthEarnings)}</h2>
            <p>de {formatCurrency(monthGoal)}</p>

            <div className="goal-bar">
              <i style={{ width: `${goalPercent}%` }} />
            </div>

            <small>{goalPercent}% da meta atingida</small>
          </div>
        </section>

        <section className="stats-grid">
          <StatCard icon={<Scissors size={22} />} label="Cortes hoje" value={String(stats.todayCount)} color="#3b82f6" />
          <StatCard icon={<Wallet size={22} />} label="Comissão esta semana" value={formatCurrency(stats.weekEarnings)} color="#10b981" />
          <StatCard icon={<TrendingUp size={22} />} label="Comissão este mês" value={formatCurrency(stats.monthEarnings)} color="#8b5cf6" />
          <StatCard icon={<Trophy size={22} />} label="Total concluídos" value={String(stats.completedTotal)} color="#f59e0b" />
        </section>

        <section className="content-card">
          <div className="section-head">
            <div>
              <h2>
                {tab === 'today'
                  ? `Agenda de hoje (${todayList.length})`
                  : tab === 'upcoming'
                    ? `Próximos horários (${upcomingList.length})`
                    : 'Histórico de atendimentos'}
              </h2>

              <p>
                {tab === 'today'
                  ? 'Atendimentos programados para hoje.'
                  : tab === 'upcoming'
                    ? 'Clientes agendados para os próximos dias.'
                    : 'Atendimentos anteriores e cancelamentos.'}
              </p>
            </div>
          </div>

          {activeList.length === 0 ? (
            <div className="empty-state">
              <CalendarDays size={44} />
              <strong>
                {tab === 'today'
                  ? 'Nenhum agendamento para hoje'
                  : tab === 'upcoming'
                    ? 'Nenhum agendamento futuro'
                    : 'Nenhum histórico ainda'}
              </strong>
              <span>A lista será atualizada quando houver registros para este barbeiro.</span>
            </div>
          ) : (
            <div className="appointments-list">
              {activeList.map((a) => (
                <AppointmentCard key={a.id} appointment={a} commissionPercent={commissionPercent} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ color, background: `${color}18`, borderColor: `${color}35` }}>
        {icon}
      </div>

      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function AppointmentCard({
  appointment,
  commissionPercent,
}: {
  appointment: Appointment
  commissionPercent: number
}) {
  const color = STATUS_COLOR[appointment.status] ?? '#64748b'
  const commissionValue = (appointment.price || 0) * ((commissionPercent || 0) / 100)

  return (
    <article className="appointment-card">
      <div className="time-box">
        <strong>{formatTime(appointment.appointment_time)}</strong>
        <span>{formatDate(appointment.appointment_date)}</span>
      </div>

      <div className="appointment-info">
        <div className="client-row">
          <div className="avatar">
            <UserRound size={18} />
          </div>

          <div>
            <h3>{appointment.client_name}</h3>
            <p>{appointment.service}</p>
          </div>
        </div>

        {appointment.phone && (
          <span className="phone-chip">
            <Phone size={13} />
            {appointment.phone}
          </span>
        )}

        {appointment.notes && <p className="notes">{appointment.notes}</p>}
      </div>

      <div className="appointment-side">
        <strong>{formatCurrency(commissionValue)}</strong>
        <small>Comissão</small>

        <span className="status-chip" style={{ color, background: `${color}18`, borderColor: `${color}35` }}>
          <CheckCircle2 size={13} />
          {STATUS_LABEL[appointment.status] ?? appointment.status}
        </span>
      </div>
    </article>
  )
}

const css = `
.barber-shell {
  min-height: 100vh;
  display: flex;
  background:
    radial-gradient(circle at 20% 0%, rgba(37,99,235,.16), transparent 28%),
    radial-gradient(circle at 100% 20%, rgba(124,58,237,.10), transparent 30%),
    #050816;
  color: #f8fafc;
  font-family: 'Inter', 'DM Sans', 'Segoe UI', sans-serif;
}

.barber-sidebar {
  width: 260px;
  min-width: 260px;
  height: 100vh;
  position: sticky;
  top: 0;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at top left, rgba(37,99,235,.18), transparent 35%),
    linear-gradient(180deg, rgba(8,15,30,.98), rgba(5,8,18,.99));
  border-right: 1px solid rgba(148,163,184,.10);
}

.brand {
  text-align: center;
  padding: 12px 6px 28px;
}

.brand-icon {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  margin: 0 auto 12px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #0ea5e9, #2563eb, #7c3aed);
  box-shadow: 0 18px 42px rgba(37,99,235,.30);
}

.brand strong {
  display: block;
  font-size: 16px;
  font-weight: 950;
}

.brand span {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #94a3b8;
}

.barber-nav {
  display: grid;
  gap: 9px;
}

.barber-nav button {
  position: relative;
  min-height: 48px;
  border: 1px solid transparent;
  border-radius: 15px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: transparent;
  color: #94a3b8;
  font-weight: 850;
  cursor: pointer;
}

.barber-nav button b {
  margin-left: auto;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(148,163,184,.10);
  color: #cbd5e1;
}

.barber-nav button.active {
  color: #fff;
  background:
    radial-gradient(circle at right, rgba(59,130,246,.24), transparent 34%),
    linear-gradient(135deg, rgba(37,99,235,.40), rgba(29,78,216,.16));
  border-color: rgba(59,130,246,.56);
  box-shadow: 0 14px 34px rgba(37,99,235,.18);
}

.sidebar-footer {
  margin-top: auto;
  display: grid;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid rgba(148,163,184,.10);
}

.mini-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 16px;
  background: rgba(15,23,42,.66);
  border: 1px solid rgba(148,163,184,.10);
}

.mini-profile > div {
  width: 36px;
  height: 36px;
  border-radius: 13px;
  display: grid;
  place-items: center;
  background: rgba(37,99,235,.20);
  color: #93c5fd;
  font-size: 13px;
  font-weight: 950;
  flex-shrink: 0;
}

.mini-profile strong {
  display: block;
  font-size: 13px;
}

.mini-profile small {
  display: block;
  margin-top: 2px;
  color: #64748b;
  font-size: 11px;
}

.logout-btn {
  min-height: 44px;
  border-radius: 14px;
  border: 1px solid rgba(239,68,68,.30);
  background: rgba(239,68,68,.045);
  color: #f87171;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 900;
  cursor: pointer;
}

.barber-main {
  flex: 1;
  min-width: 0;
  padding: 34px 42px;
}

.top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 6px;
  color: #93c5fd;
  text-transform: uppercase;
  letter-spacing: .16em;
  font-size: 12px;
  font-weight: 950;
}

.top-header h1 {
  margin: 0;
  font-size: 34px;
  font-weight: 950;
  letter-spacing: -.05em;
}

.top-header span {
  display: block;
  margin-top: 6px;
  color: #94a3b8;
  font-size: 14px;
}

.refresh-btn {
  min-height: 42px;
  border-radius: 14px;
  padding: 0 14px;
  border: 1px solid rgba(148,163,184,.14);
  background: rgba(15,23,42,.80);
  color: #cbd5e1;
  font-weight: 850;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.spinning {
  animation: spin .8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.hero-grid {
  display: grid;
  grid-template-columns: 1.4fr .9fr;
  gap: 16px;
  margin-bottom: 16px;
}

.next-card,
.goal-card,
.stat-card,
.content-card {
  border-radius: 24px;
  background:
    radial-gradient(circle at top right, rgba(59,130,246,.12), transparent 32%),
    linear-gradient(145deg, rgba(15,23,42,.94), rgba(8,13,28,.97));
  border: 1px solid rgba(148,163,184,.12);
  box-shadow: 0 24px 60px rgba(0,0,0,.20);
}

.next-card,
.goal-card {
  padding: 22px;
}

.next-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #93c5fd;
  font-size: 12px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: .12em;
}

.next-card h2,
.goal-card h2 {
  margin: 18px 0 4px;
  font-size: 28px;
  font-weight: 950;
  letter-spacing: -.05em;
}

.next-card p,
.goal-card p {
  margin: 0;
  color: #94a3b8;
}

.next-meta {
  margin-top: 18px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.next-meta span,
.phone-line,
.phone-chip {
  min-height: 32px;
  border-radius: 999px;
  padding: 0 11px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: rgba(37,99,235,.12);
  border: 1px solid rgba(59,130,246,.18);
  color: #bfdbfe;
  font-size: 12px;
  font-weight: 850;
}

.phone-line {
  margin-top: 10px;
}

.empty-next {
  margin-top: 18px;
  display: grid;
  gap: 4px;
}

.empty-next strong {
  font-size: 18px;
}

.empty-next span {
  color: #64748b;
  font-size: 13px;
}

.goal-bar {
  margin-top: 18px;
  height: 9px;
  border-radius: 999px;
  background: rgba(148,163,184,.13);
  overflow: hidden;
}

.goal-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2563eb, #7c3aed);
  box-shadow: 0 0 18px rgba(124,58,237,.55);
}

.goal-card small {
  display: block;
  margin-top: 9px;
  color: #94a3b8;
  font-size: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.stat-card {
  min-height: 130px;
  padding: 18px;
}

.stat-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  border: 1px solid;
  margin-bottom: 12px;
}

.stat-card span {
  display: block;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 800;
}

.stat-card strong {
  display: block;
  margin-top: 4px;
  font-size: 23px;
  font-weight: 950;
  letter-spacing: -.04em;
}

.content-card {
  padding: 20px;
}

.section-head {
  margin-bottom: 16px;
}

.section-head h2 {
  margin: 0;
  font-size: 19px;
  font-weight: 950;
}

.section-head p {
  margin: 5px 0 0;
  color: #94a3b8;
  font-size: 13px;
}

.appointments-list {
  display: grid;
  gap: 12px;
}

.appointment-card {
  display: grid;
  grid-template-columns: 115px 1fr auto;
  gap: 14px;
  align-items: center;
  padding: 14px;
  border-radius: 18px;
  background: rgba(2,6,23,.38);
  border: 1px solid rgba(148,163,184,.09);
}

.time-box {
  min-height: 76px;
  border-radius: 15px;
  display: grid;
  place-items: center;
  text-align: center;
  background: rgba(37,99,235,.12);
  border: 1px solid rgba(59,130,246,.18);
}

.time-box strong {
  display: block;
  font-size: 19px;
  font-weight: 950;
}

.time-box span {
  display: block;
  color: #94a3b8;
  font-size: 11px;
}

.client-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: rgba(59,130,246,.15);
  color: #93c5fd;
  flex-shrink: 0;
}

.appointment-info h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 950;
}

.appointment-info p {
  margin: 3px 0 0;
  color: #94a3b8;
  font-size: 13px;
}

.notes {
  margin-top: 10px !important;
  color: #64748b !important;
}

.phone-chip {
  margin-top: 10px;
}

.appointment-side {
  text-align: right;
}

.appointment-side strong {
  display: block;
  color: #10b981;
  font-size: 17px;
  font-weight: 950;
}

.appointment-side small {
  display: block;
  margin: 1px 0 8px;
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
}

.status-chip {
  border: 1px solid;
  border-radius: 999px;
  padding: 6px 9px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 950;
}

.empty-state {
  min-height: 280px;
  display: grid;
  place-items: center;
  text-align: center;
  color: #64748b;
}

.empty-state svg {
  color: #334155;
}

.empty-state strong {
  display: block;
  color: #cbd5e1;
  font-size: 18px;
}

.empty-state span {
  display: block;
  max-width: 360px;
  color: #64748b;
  font-size: 13px;
}

@media (max-width: 1000px) {
  .barber-shell {
    display: block;
  }

  .barber-sidebar {
    width: 100%;
    min-width: 0;
    height: auto;
    min-height: 0;
    position: sticky;
    z-index: 20;
    padding: 12px;
    border-right: 0;
    border-bottom: 1px solid rgba(148,163,184,.10);
  }

  .brand,
  .sidebar-footer {
    display: none;
  }

  .barber-nav {
    display: flex;
    overflow-x: auto;
  }

  .barber-nav button {
    min-width: 130px;
  }

  .barber-main {
    padding: 20px 14px 84px;
  }

  .top-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .top-header h1 {
    font-size: 27px;
  }

  .hero-grid {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .appointment-card {
    grid-template-columns: 1fr;
  }

  .appointment-side {
    text-align: left;
  }
}

@media (max-width: 560px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
`
