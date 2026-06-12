'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useIsMobile } from '@/lib/useIsMobile'
import {
  calculateBarberCompensation,
  getBarberCompensation,
} from '@/lib/barber-compensation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, AreaChart, Area,
} from 'recharts'
import {
  Bell, Settings, Calendar, Eye, XCircle,
  User, Lock, LogOut, Palette, ChevronRight, Check,
} from 'lucide-react'

type ChartPeriod = 'este-ano' | 'este-mes' | 'esta-semana'
type DateMode = 'day' | 'month'

const AVATAR_COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#f97316']

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
function getInitial(name: string) { return (name ?? '?')[0].toUpperCase() }
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `${mins}min atrás`
  if (hours < 24) return `${hours}h atrás`
  return `${days}d atrás`
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function localMonthKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function formatSelectedDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatSelectedMonth(month: string) {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

export default function AdminPage() {
  const router = useRouter()
  const pathname = usePathname()
  const slug = pathname.split('/').filter(Boolean)[0]
  const isMobile = useIsMobile()

  const [loading, setLoading] = useState(true)
  const [appointments, setAppointments] = useState<any[]>([])
  const [barbers, setBarbers] = useState<any[]>([])
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [dateMode, setDateMode] = useState<DateMode>('day')
  const [selectedDate, setSelectedDate] = useState(localDateKey())
  const [selectedMonth, setSelectedMonth] = useState(localMonthKey())
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('este-ano')
  const [chartDropdown, setChartDropdown] = useState(false)
  const [tenantId, setTenantId] = useState<string | null>(null)
const [tenantPlan, setTenantPlan] = useState<string | null>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const [recentAppointments, setRecentAppointments] = useState<any[]>([])
  const notifRef = useRef<HTMLDivElement>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  const itemsPerPage = 8

  useEffect(() => {
    async function init() {
      const { data: tenant } = await supabase.from('tenants').select('id, plano').eq('slug', slug).maybeSingle()
      if (!tenant) return

setTenantId(tenant.id)
setTenantPlan(tenant.plano || null)
      
    }
    if (slug) init()
  }, [slug])

  useEffect(() => {
  if (tenantId) {
    fetchAll(tenantId)
  }
}, [tenantId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchAll(currentTenantId: string) {
    const [{ data: appts, error }, { data: barberData }, { data: commissionRows }] = await Promise.all([
      supabase.from('appointments').select('*').eq('tenant_id', currentTenantId).order('appointment_date', { ascending: false }),
      supabase.from('barbeiros').select('nome, email, tenant_id, compensation_type, commission_percentage, fixed_salary_amount, chair_rental_amount').eq('tenant_id', currentTenantId).eq('ativo', true),
      supabase.from('barbers').select('name, email, tenant_id, commission_percentage, commission_type').eq('tenant_id', currentTenantId),
    ])
    if (error) { console.log(error); return }
    const mergedBarbers = (barberData || []).map((barber: any) => {
      const match = (commissionRows || []).find((row: any) => {
        const sameEmail = row.email && barber.email && row.email.toLowerCase() === barber.email.toLowerCase()
        const sameName = row.name && barber.nome && row.name.toLowerCase() === barber.nome.toLowerCase()
        return row.tenant_id === barber.tenant_id && (sameEmail || sameName)
      })
      return {
        ...barber,
        compensation: getBarberCompensation(barber, match),
      }
    })
    setAppointments(appts || [])
    setBarbers(mergedBarbers)
    generateMonthlyData(appts || [], 'este-ano')
    setRecentAppointments((appts || []).slice(0, 5))
    setLoading(false)
  }

  // ✅ CORRIGIDO: este-mes agora pré-popula os dias do mês atual
  function generateMonthlyData(data: any[], period: ChartPeriod) {
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    const now = new Date()
    const grouped: any = {}

    if (period === 'este-ano') {
      months.forEach(m => { grouped[m] = { month: m, revenue: 0 } })
    } else if (period === 'esta-semana') {
      const days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
      days.forEach(d => { grouped[d] = { month: d, revenue: 0 } })
    } else if (period === 'este-mes') {
      // ✅ pré-popula todos os dias do mês atual
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      for (let d = 1; d <= daysInMonth; d++) {
        const key = `${String(d).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}`
        grouped[key] = { month: key, revenue: 0 }
      }
    }

    data.forEach((item) => {
      if (!item.appointment_date || item.status === 'cancelled') return
      const d = new Date(item.appointment_date)

      if (period === 'este-ano' && d.getFullYear() !== now.getFullYear()) return
      if (period === 'este-mes' && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return
      if (period === 'esta-semana') {
        const startOfWeek = new Date(now)
        startOfWeek.setDate(now.getDate() - now.getDay())
        startOfWeek.setHours(0, 0, 0, 0)
        if (d < startOfWeek) return
      }

      const key = period === 'este-ano'
        ? months[d.getMonth()]
        : period === 'este-mes'
          ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
          : ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getDay()]

      if (!grouped[key]) grouped[key] = { month: key, revenue: 0 }
      grouped[key].revenue += item.price || 0
    })

    setMonthlyData(Object.values(grouped))
  }

  async function finishAppointment(appointment: any) {
    if (!tenantId) return
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'finished', payment_status: 'paid' })
      .eq('id', appointment.id)
      .eq('tenant_id', tenantId)
    if (error) {
      alert(`Erro ao finalizar: ${error.message}`)
      return
    }
    if (tenantId) fetchAll(tenantId)
  }

  async function cancelAppointment(id: number) {
    await supabase.from('appointments').update({ status: 'cancelled', canceled_at: new Date() }).eq('id', id).eq('tenant_id', tenantId)
    if (tenantId) fetchAll(tenantId)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push(`/${slug}/login`)
  }

  const periodAppointments = appointments.filter(a => {
    if (dateMode === 'month') return String(a.appointment_date ?? '').startsWith(selectedMonth)
    return a.appointment_date === selectedDate
  })
  const allActive = periodAppointments.filter(a => a.status !== 'cancelled')
  const finished = periodAppointments.filter(a => a.status === 'finished' || a.status === 'completed')
  const cancelled = periodAppointments.filter(a => a.status === 'cancelled')
  const compensationPeriodStart = dateMode === 'month' ? `${selectedMonth}-01` : selectedDate
  const compensationPeriodEnd = dateMode === 'month'
    ? (() => {
        const [year, month] = selectedMonth.split('-').map(Number)
        return `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`
      })()
    : selectedDate
  const compensationSummary = barbers.map((barber) => {
    const serviceRevenue = allActive
      .filter((appointment) => appointment.barber === barber.nome)
      .reduce((sum, appointment) => sum + Number(appointment.price || 0), 0)
    return calculateBarberCompensation({
      settings: barber.compensation,
      serviceRevenue,
      periodStart: compensationPeriodStart,
      periodEnd: compensationPeriodEnd,
    })
  })
  const totalRevenue =
    compensationSummary.reduce((sum, item) => sum + item.barbershopServiceRevenue + item.chairRentalRevenue, 0) +
    allActive
      .filter((appointment) => !barbers.some((barber) => barber.nome === appointment.barber))
      .reduce((sum, appointment) => sum + Number(appointment.price || 0), 0)
  const totalCommissions = compensationSummary.reduce((sum, item) => sum + item.laborCost, 0)
  const totalProfit = totalRevenue - totalCommissions
  const avgTicket = allActive.length > 0 ? totalRevenue / allActive.length : 0
  const cancelRate = periodAppointments.length > 0 ? ((cancelled.length / periodAppointments.length) * 100).toFixed(1) : '0.0'
  const todayCount = periodAppointments.filter(a => a.status !== 'cancelled').length

  const filtered = periodAppointments.filter(a => {
    const matchSearch = (a.client_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (a.service ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (a.barber ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || a.status === statusFilter
    return matchSearch && matchStatus
  })

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  function fmt(v: number) { return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
  function fmtDateTime(date: string, time?: string) {
    if (!date) return '—'
    const dateStr = new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const timeStr = time ? time.slice(0, 5) : ''
    return timeStr ? `${dateStr} ${timeStr}` : dateStr
  }

  const PERIOD_LABEL: Record<ChartPeriod, string> = {
    'este-ano': 'Este ano',
    'este-mes': 'Este mês',
    'esta-semana': 'Esta semana',
  }

  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    finished:  { label: 'Finalizado', color: '#10b981' },
    completed: { label: 'Concluído',  color: '#10b981' },
    cancelled: { label: 'Cancelado',  color: '#ef4444' },
    scheduled: { label: 'Agendado',   color: '#f59e0b' },
    pending:   { label: 'Pendente',   color: '#f59e0b' },
  }

  const newAppointments = recentAppointments.filter(a => a.status === 'scheduled' || a.status === 'pending')
  const dateLabel = dateMode === 'month' ? formatSelectedMonth(selectedMonth) : formatSelectedDate(selectedDate)
  const chartData = dateMode === 'month'
    ? (() => {
        const [year, month] = selectedMonth.split('-').map(Number)
        const daysInMonth = new Date(year, month, 0).getDate()
        const grouped: Record<string, { month: string; revenue: number }> = {}
        for (let day = 1; day <= daysInMonth; day++) {
          const key = String(day).padStart(2, '0')
          grouped[key] = { month: key, revenue: 0 }
        }
        allActive.forEach((a) => {
          const day = String(new Date(`${a.appointment_date}T12:00:00`).getDate()).padStart(2, '0')
          if (grouped[day]) grouped[day].revenue += a.price || 0
        })
        return Object.values(grouped)
      })()
    : [{ month: formatSelectedDate(selectedDate).split(',')[0], revenue: totalRevenue }]

  const DatePeriodControl = ({ mobile = false }: { mobile?: boolean }) => (
    <div style={{ ...S.dateControl, width: mobile ? '100%' : undefined }}>
      <div style={S.dateModeGroup}>
        {(['day', 'month'] as DateMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => {
              setDateMode(mode)
              setCurrentPage(1)
            }}
            style={{
              ...S.dateModeBtn,
              ...(dateMode === mode ? S.dateModeBtnActive : {}),
            }}
          >
            {mode === 'day' ? 'Dia' : 'Mês'}
          </button>
        ))}
      </div>

      <label title={dateMode === 'day' ? 'Escolher dia' : 'Escolher mês'} style={{ ...S.dateChip, flex: 1 }}>
        <Calendar size={14} style={{ color: '#64748b', flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {dateLabel}
        </span>
        <input
          type={dateMode === 'day' ? 'date' : 'month'}
          value={dateMode === 'day' ? selectedDate : selectedMonth}
          onChange={(e) => {
            if (dateMode === 'day') setSelectedDate(e.target.value)
            else setSelectedMonth(e.target.value)
            setCurrentPage(1)
          }}
          style={S.dateInput}
        />
      </label>
    </div>
  )

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={S.spinner} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div className="kb-light-root kb-dashboard-page" style={S.root}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: repeat(2,1fr) !important; gap: 12px !important; }
          .charts-row { grid-template-columns: 1fr !important; }
          .table-header { flex-direction: column !important; align-items: flex-start !important; }
          .table-filters { flex-direction: column !important; width: 100%; }
          .table-filters input, .table-filters select { min-width: unset !important; width: 100% !important; }
          .col-hide { display: none !important; }
          .header-right { display: none !important; }
        }
        @media (max-width: 480px) { .stats-grid { grid-template-columns: 1fr !important; } }
        .tr-hover:hover { background: rgba(255,255,255,0.03) !important; }
        .action-btn:hover { transform: scale(1.1); }
        .settings-item:hover { background: rgba(255,255,255,0.05) !important; }
        .notif-item:hover { background: rgba(255,255,255,0.04) !important; }
        .dropdown-item:hover { background: rgba(59,130,246,0.1) !important; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ ...S.header, ...(isMobile ? S.mobileHeader : {}) }}>
        <div>
          <p style={S.headerSub}>Bem-vindo de volta, Administrador 👋</p>
          <h1 style={{ ...S.headerTitle, fontSize: isMobile ? 28 : S.headerTitle.fontSize }}>Dashboard</h1>
          <p style={{ fontSize: isMobile ? 13 : 14, color: '#3b82f6', margin: '4px 0 0', fontWeight: 500 }}>
            Acompanhe o desempenho da sua barbearia em tempo real.
          </p>
        </div>

        <div style={{ display: isMobile ? 'none' : 'flex', alignItems: 'center', gap: 12 }} className="header-right">
          <DatePeriodControl />

          {/* Notificações */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button style={S.iconBtn} onClick={() => { setNotifOpen(v => !v); setSettingsOpen(false) }}>
              <Bell size={18} style={{ color: '#94a3b8' }} />
              {newAppointments.length > 0 && (
                <span style={S.notifBadge}>{newAppointments.length}</span>
              )}
            </button>
            {notifOpen && (
              <div style={S.notifPanel}>
                <div style={S.notifHeader}>
                  <p style={S.notifTitle}>Notificações</p>
                  <span style={S.notifCount}>{recentAppointments.length} recentes</span>
                </div>
                <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                  {recentAppointments.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#475569', padding: '20px', fontSize: 13 }}>Nenhuma notificação</p>
                  ) : recentAppointments.map(a => {
                    const st = STATUS_MAP[a.status] ?? { label: a.status, color: '#64748b' }
                    const avatarColor = getAvatarColor(a.client_name ?? '')
                    return (
                      <div key={a.id} className="notif-item" style={S.notifItem}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: avatarColor + '22', border: `1px solid ${avatarColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: avatarColor, flexShrink: 0 }}>
                          {getInitial(a.client_name)}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.client_name}</p>
                          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{a.service} · {a.barber || '—'}</p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, backgroundColor: st.color + '18', color: st.color }}>{st.label}</span>
                          <p style={{ fontSize: 11, color: '#475569', margin: '4px 0 0' }}>{timeAgo(a.created_at ?? a.appointment_date)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={S.notifFooter}>
                  <button onClick={() => { router.push(`/${slug}/admin/agendamentos`); setNotifOpen(false) }} style={S.notifFooterBtn}>
                    Ver todos os agendamentos →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Configurações */}
          <div ref={settingsRef} style={{ position: 'relative' }}>
            <button style={S.iconBtn} onClick={() => { setSettingsOpen(v => !v); setNotifOpen(false) }}>
              <Settings size={18} style={{ color: '#94a3b8' }} />
            </button>
            {settingsOpen && (
              <div style={S.settingsPanel}>
                <p style={S.settingsSectionLabel}>Conta</p>
                {[
                  { icon: <User size={15} />, color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', title: 'Meu Perfil', sub: 'Editar nome e e-mail' },
                  { icon: <Lock size={15} />, color: '#a78bfa', bg: 'rgba(139,92,246,0.12)', title: 'Senha', sub: 'Alterar senha de acesso' },
                ].map(item => (
                  <button key={item.title} className="settings-item" onClick={() => { router.push(`/${slug}/admin/configuracoes`); setSettingsOpen(false) }} style={S.settingsItem}>
                    <div style={{ ...S.settingsIcon, background: item.bg, color: item.color }}>{item.icon}</div>
                    <div style={{ flex: 1 }}>
                      <p style={S.settingsItemTitle}>{item.title}</p>
                      <p style={S.settingsItemSub}>{item.sub}</p>
                    </div>
                    <ChevronRight size={14} style={{ color: '#475569' }} />
                  </button>
                ))}
                <div style={S.settingsDivider} />
                <p style={S.settingsSectionLabel}>Sistema</p>
                <button className="settings-item" onClick={() => { router.push(`/${slug}/admin/configuracoes`); setSettingsOpen(false) }} style={S.settingsItem}>
                  <div style={{ ...S.settingsIcon, background: 'rgba(16,185,129,0.12)', color: '#34d399' }}><Palette size={15} /></div>
                  <div style={{ flex: 1 }}>
                    <p style={S.settingsItemTitle}>Configurações</p>
                    <p style={S.settingsItemSub}>Nome da barbearia, horários</p>
                  </div>
                  <ChevronRight size={14} style={{ color: '#475569' }} />
                </button>
                <div style={S.settingsDivider} />
                <button className="settings-item" onClick={handleLogout} style={S.settingsItem}>
                  <div style={{ ...S.settingsIcon, background: 'rgba(239,68,68,0.12)', color: '#f87171' }}><LogOut size={15} /></div>
                  <div style={{ flex: 1 }}>
                    <p style={{ ...S.settingsItemTitle, color: '#f87171' }}>Sair da conta</p>
                    <p style={S.settingsItemSub}>Encerrar sessão</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      {isMobile && (
        <div style={{ marginBottom: 16 }}>
          <DatePeriodControl mobile />
        </div>
      )}

      <div style={{ ...S.statsGrid, gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : S.statsGrid.gridTemplateColumns, gap: isMobile ? 10 : S.statsGrid.gap }} className="stats-grid">
        <StatCard icon="💵" label="Receita Total" value={fmt(totalRevenue)} color="#22c55e" sub={`${allActive.length} atendimentos`} percent="+12,5%" />
        <StatCard icon="📈" label="Lucro Líquido" value={fmt(totalProfit)} color="#3b82f6" sub="apos remuneracao" percent="+8,2%" />
        <StatCard icon="✂️" label="Agendamentos no período" value={String(todayCount)} color="#a855f7" sub="agendamentos" percent="+25%" />
        <StatCard icon="🎯" label="Ticket Médio" value={fmt(avgTicket)} color="#f59e0b" sub="por atendimento" percent="+5,7%" />
      </div>

      {/* ── Charts Row ── */}
      <div style={{ ...S.chartsRow, gridTemplateColumns: isMobile ? '1fr' : S.chartsRow.gridTemplateColumns }} className="charts-row">
        <div style={{ ...S.chartCard, padding: isMobile ? 16 : S.chartCard.padding, borderRadius: isMobile ? 16 : S.chartCard.borderRadius }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={S.cardTitle}><span style={{ marginRight: 8 }}>📊</span>Receita</h2>
            <div style={{ position: 'relative' }}>
              <button type="button" style={{ ...S.periodBtn, cursor: 'default' }}>
                {dateMode === 'day' ? 'Dia selecionado' : 'Mês selecionado'}
              </button>
              {chartDropdown && (
                <div style={S.dropdown}>
                  {(Object.entries(PERIOD_LABEL) as [ChartPeriod, string][]).map(([key, label]) => (
                    <button key={key} className="dropdown-item" onClick={() => {
                      setChartPeriod(key)
                      generateMonthlyData(appointments, key)
                      setChartDropdown(false)
                    }} style={{
                      ...S.dropdownItem,
                      backgroundColor: chartPeriod === key ? 'rgba(59,130,246,0.15)' : 'transparent',
                      color: chartPeriod === key ? '#60a5fa' : '#94a3b8',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {chartPeriod === key && <Check size={12} />}
                        {label}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={{ height: isMobile ? 200 : 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={dateMode === 'month' ? 18 : 42}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="month" stroke="#334155" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} />
                <YAxis stroke="#334155" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `R$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#f1f5f9', fontSize: 13 }}
                  formatter={(v: any) => [fmt(v), 'Receita']}
                  cursor={{ fill: 'rgba(59,130,246,0.08)' }}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ ...S.summaryCard, padding: isMobile ? 16 : S.summaryCard.padding, borderRadius: isMobile ? 16 : S.summaryCard.borderRadius }}>
          <h2 style={S.cardTitle}><span style={{ marginRight: 8 }}>📋</span>Resumo</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            <SummaryItem label="Total de agendamentos" value={String(periodAppointments.length)} color="#60a5fa" />
            <SummaryItem label="Finalizados" value={String(finished.length)} color="#10b981" />
            <SummaryItem label="Cancelados" value={String(cancelled.length)} color="#ef4444" />
            <SummaryItem label="Taxa de cancelamento" value={`${cancelRate}%`} color="#f59e0b" />
            <SummaryItem label="Custos da equipe" value={fmt(totalCommissions)} color="#8b5cf6" />
          </div>
        </div>
      </div>

      {/* ── Tabela ── */}
      <div style={{ ...S.tableCard, borderRadius: isMobile ? 16 : S.tableCard.borderRadius }}>
        <div style={{ ...S.tableHeader, padding: isMobile ? '16px' : S.tableHeader.padding }} className="table-header">
          <h2 style={S.cardTitle}><span style={{ marginRight: 8 }}>📅</span>Agendamentos</h2>
          <div style={S.tableFilters} className="table-filters">
            <div style={S.searchWrap}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: 14 }}>🔍</span>
              <input placeholder="Buscar cliente, serviço..." value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1) }} style={S.searchInput} />
            </div>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1) }} style={S.select}>
              <option value="all">Todos</option>
              <option value="scheduled">Agendados</option>
              <option value="finished">Finalizados</option>
              <option value="completed">Concluídos</option>
              <option value="cancelled">Cancelados</option>
            </select>
          </div>
        </div>

        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 12px 12px' }}>
            {paginated.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '34px 12px', color: '#475569', fontSize: 14 }}>Nenhum agendamento encontrado.</div>
            ) : paginated.map((a) => {
              const st = STATUS_MAP[a.status] ?? { label: a.status, color: '#64748b' }
              const avatarColor = getAvatarColor(a.client_name ?? '')
              return (
                <div key={a.id} style={S.mobileAppointmentCard}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: avatarColor + '22', border: `1px solid ${avatarColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: avatarColor, flexShrink: 0 }}>
                      {getInitial(a.client_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, color: '#f1f5f9', margin: '0 0 3px', fontSize: 14 }}>{a.client_name}</p>
                      <p style={{ color: '#64748b', margin: '0 0 3px', fontSize: 12 }}>{a.service} - {a.barber || '-'}</p>
                      <p style={{ color: '#475569', margin: 0, fontSize: 12 }}>{fmtDateTime(a.appointment_date, a.appointment_time)}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ color: '#10b981', fontWeight: 800, margin: '0 0 6px', fontSize: 13 }}>{fmt(a.price || 0)}</p>
                      <span style={{ ...S.badge, backgroundColor: st.color + '18', color: st.color, border: `1px solid ${st.color}33`, padding: '3px 8px' }}>{st.label}</span>
                    </div>
                  </div>
                  {a.status !== 'finished' && a.status !== 'completed' && a.status !== 'cancelled' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={() => finishAppointment(a)} style={{ ...S.mobileActionBtn, color: '#34d399', borderColor: 'rgba(16,185,129,0.25)', backgroundColor: 'rgba(16,185,129,0.08)' }}>Finalizar</button>
                      <button onClick={() => cancelAppointment(a.id)} style={{ ...S.mobileActionBtn, color: '#f87171', borderColor: 'rgba(239,68,68,0.25)', backgroundColor: 'rgba(239,68,68,0.08)' }}>Cancelar</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Cliente</th>
                <th style={S.th} className="col-hide">Serviço</th>
                <th style={S.th} className="col-hide">Barbeiro</th>
                <th style={S.th}>Valor</th>
                <th style={S.th} className="col-hide">Data</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>Nenhum agendamento encontrado.</td></tr>
              ) : paginated.map((a) => {
                const st = STATUS_MAP[a.status] ?? { label: a.status, color: '#64748b' }
                const avatarColor = getAvatarColor(a.client_name ?? '')
                return (
                  <tr key={a.id} style={S.tr} className="tr-hover">
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: avatarColor + '22', border: `1px solid ${avatarColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: avatarColor, flexShrink: 0 }}>
                          {getInitial(a.client_name)}
                        </div>
                        <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{a.client_name}</span>
                      </div>
                    </td>
                    <td style={S.td} className="col-hide">{a.service}</td>
                    <td style={S.td} className="col-hide">{a.barber || '—'}</td>
                    <td style={{ ...S.td, color: '#10b981', fontWeight: 700 }}>{fmt(a.price || 0)}</td>
                    <td style={S.td} className="col-hide">{fmtDateTime(a.appointment_date, a.appointment_time)}</td>
                    <td style={S.td}>
                      <span style={{ ...S.badge, backgroundColor: st.color + '18', color: st.color, border: `1px solid ${st.color}33` }}>{st.label}</span>
                    </td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button title="Ver detalhes" className="action-btn" onClick={() => router.push(`/${slug}/admin/agendamentos`)} style={{ ...S.actionBtn, color: '#60a5fa', borderColor: 'rgba(59,130,246,0.2)', backgroundColor: 'rgba(59,130,246,0.08)' }}>
                          <Eye size={15} />
                        </button>
                        {a.status !== 'finished' && a.status !== 'completed' && a.status !== 'cancelled' && (
                          <>
                            <button title="Finalizar" className="action-btn" onClick={() => finishAppointment(a)} style={{ ...S.actionBtn, color: '#34d399', borderColor: 'rgba(16,185,129,0.2)', backgroundColor: 'rgba(16,185,129,0.08)', fontSize: 13, fontWeight: 700 }}>✓</button>
                            <button title="Cancelar" className="action-btn" onClick={() => cancelAppointment(a.id)} style={{ ...S.actionBtn, color: '#f87171', borderColor: 'rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.08)' }}>
                              <XCircle size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        )}

        {totalPages > 1 && (
          <div style={S.pagination}>
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={{ ...S.pageBtn, opacity: currentPage === 1 ? 0.4 : 1 }}>&lt; Anterior</button>
            <div style={{ display: 'flex', gap: 6 }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setCurrentPage(p)} style={{ ...S.pageBtn, backgroundColor: currentPage === p ? '#3b82f6' : 'rgba(255,255,255,0.03)', color: currentPage === p ? '#fff' : '#cbd5e1', borderColor: currentPage === p ? '#3b82f6' : 'rgba(255,255,255,0.06)', minWidth: 36 }}>{p}</button>
              ))}
            </div>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} style={{ ...S.pageBtn, opacity: currentPage === totalPages ? 0.4 : 1 }}>Próxima &gt;</button>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color, sub, percent }: { icon: string; label: string; value: string; color: string; sub: string; percent: string }) {
  return (
    <div style={{ background: 'rgba(11,18,32,0.78)', borderRadius: 24, padding: '22px', border: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', position: 'relative', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.35)' }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at top right, ${color}22, transparent 60%)` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2, marginBottom: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{icon}</div>
        <div style={{ padding: '4px 10px', borderRadius: 999, background: `${color}15`, color, fontSize: 12, fontWeight: 700 }}>{percent} ↗</div>
      </div>
      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 6px', position: 'relative', zIndex: 2 }}>{label}</p>
      <h2 style={{ fontSize: 'clamp(18px,2.5vw,28px)', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.5px', position: 'relative', zIndex: 2 }}>{value}</h2>
      <p style={{ fontSize: 12, color: '#475569', marginTop: 4, position: 'relative', zIndex: 2 }}>{sub}</p>
      <div style={{ width: '100%', height: 40, marginTop: 14, position: 'relative', zIndex: 2 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={[{v:4},{v:8},{v:6},{v:12},{v:10},{v:15},{v:13},{v:18}]}>
            <Area type="monotone" dataKey="v" stroke={color} fill={color} fillOpacity={0.12} strokeWidth={2.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function SummaryItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 16px' }}>
      <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 700, color, margin: 0 }}>{value}</p>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  root: { width: '100%', overflowX: 'hidden', minHeight: '100dvh', fontFamily: "'DM Sans','Segoe UI',sans-serif", color: '#e2e8f0' },
  spinner: { width: 38, height: 38, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.08)', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 20, flexWrap: 'wrap' as const },
  mobileHeader: { marginBottom: 16, display: 'block' },
  headerSub: { fontSize: 12, color: '#64748b', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: 1.4, fontWeight: 700 },
  headerTitle: { fontSize: 'clamp(24px,4vw,36px)', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-1px' },
  dateControl: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 310 },
  dateModeGroup: { display: 'flex', padding: 4, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' },
  dateModeBtn: { border: 'none', borderRadius: 9, padding: '8px 11px', background: 'transparent', color: '#64748b', fontSize: 12, fontWeight: 800, cursor: 'pointer' },
  dateModeBtnActive: { background: 'rgba(37,99,235,0.9)', color: '#fff', boxShadow: '0 8px 20px rgba(37,99,235,0.22)' },
  dateChip: { minHeight: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)', cursor: 'pointer', position: 'relative' },
  dateInput: { position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' },
  iconBtn: { position: 'relative', width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', backdropFilter: 'blur(10px)' },
  notifBadge: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', backgroundColor: '#3b82f6', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  notifPanel: { position: 'absolute', top: '110%', right: 0, zIndex: 100, width: 340, background: '#0d1424', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', overflow: 'hidden' },
  notifHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  notifTitle: { fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: 0 },
  notifCount: { fontSize: 12, color: '#475569' },
  notifItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.15s' },
  notifFooter: { padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.06)' },
  notifFooterBtn: { width: '100%', padding: '9px', borderRadius: 10, border: '1px solid rgba(59,130,246,0.2)', background: 'rgba(59,130,246,0.08)', color: '#60a5fa', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  settingsPanel: { position: 'absolute', top: '110%', right: 0, zIndex: 100, width: 260, background: '#0d1424', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', padding: '8px', overflow: 'hidden' },
  settingsSectionLabel: { fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: 1, margin: '6px 8px 4px', padding: '0 4px' },
  settingsItem: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px', borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', transition: 'background 0.15s', textAlign: 'left' as const },
  settingsIcon: { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  settingsItemTitle: { fontSize: 13, fontWeight: 600, color: '#f1f5f9', margin: 0 },
  settingsItemSub: { fontSize: 11, color: '#475569', margin: '2px 0 0' },
  settingsDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', margin: '6px 0' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 20 },
  chartsRow: { display: 'grid', gridTemplateColumns: '1.7fr 0.7fr', gap: 14, marginBottom: 20, alignItems: 'stretch' },
  chartCard: { background: 'rgba(11,18,32,0.72)', borderRadius: 22, padding: '24px', border: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(18px)', boxShadow: '0 12px 40px rgba(0,0,0,0.35)' },
  summaryCard: { background: 'rgba(11,18,32,0.72)', borderRadius: 22, padding: '24px', border: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(18px)', boxShadow: '0 12px 40px rgba(0,0,0,0.35)' },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#ffffff', margin: 0 },
  periodBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  dropdown: { position: 'absolute', top: '110%', right: 0, zIndex: 10, background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 6, minWidth: 160, boxShadow: '0 16px 40px rgba(0,0,0,0.5)' },
  dropdownItem: { display: 'block', width: '100%', padding: '9px 14px', borderRadius: 8, border: 'none', fontSize: 13, cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s' },
  tableCard: { background: 'rgba(11,18,32,0.72)', borderRadius: 22, border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden', backdropFilter: 'blur(18px)', boxShadow: '0 12px 40px rgba(0,0,0,0.35)' },
  tableHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap' as const, gap: 14 },
  tableFilters: { display: 'flex', gap: 10, flexWrap: 'wrap' as const },
  searchWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchInput: { padding: '10px 14px 10px 36px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, color: '#f8fafc', fontSize: 14, outline: 'none', minWidth: 220 },
  select: { padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, color: '#f8fafc', fontSize: 14, outline: 'none' },
  table: { width: '100%', minWidth: 600, borderCollapse: 'collapse' as const },
  th: { padding: '14px 18px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: 1, backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' },
  td: { padding: '16px 18px', fontSize: 14, color: '#94a3b8', verticalAlign: 'middle' as const },
  badge: { display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 999 },
  actionBtn: { width: 32, height: 32, borderRadius: 8, border: '1px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.15s', flexShrink: 0 },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px', borderTop: '1px solid rgba(255,255,255,0.05)' },
  pageBtn: { padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', color: '#cbd5e1', fontSize: 13, cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' },
  mobileAppointmentCard: { background: 'rgba(15,23,42,0.82)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 12 },
  mobileActionBtn: { flex: 1, padding: '9px 10px', borderRadius: 10, border: '1px solid', fontSize: 12, fontWeight: 800, cursor: 'pointer' },
}
