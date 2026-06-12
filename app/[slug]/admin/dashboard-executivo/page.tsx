'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUnit } from '@/lib/unit-context'
import {
  calculateBarberCompensation,
  getBarberCompensation,
  type BarberCompensationSource,
} from '@/lib/barber-compensation'
import {
  BarChart3,
  CalendarDays,
  DollarSign,
  Target,
  Users,
  Scissors,
  Trophy,
  MessageCircle,
  Lock,
  Download,
  Bell,
  Crown,
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  RefreshCcw,
  TrendingUp,
  UserPlus,
} from 'lucide-react'

type Appointment = {
  id: string
  unit_id?: string | null
  client_name: string
  phone: string
  service: string
  barber: string
  appointment_date: string
  status: string
  price?: number | null
  payment_method?: string | null
  payment_status?: string | null
  tenant_id: string
}

type Tenant = {
  id: string
  slug: string
  plano?: string | null
  monthly_goal?: number | null
  name?: string | null
}

type BarberAsset = {
  nome: string
  avatar_url?: string | null
}

type BarberCompensation = BarberCompensationSource & {
  id: string
  nome: string
  unit_id?: string | null
}

type FinancialEntry = {
  id: string
  unit_id?: string | null
  tenant_id: string
  type: 'entrada' | 'despesa'
  description: string
  amount: number
  payment_method?: string | null
  entry_date: string
  created_at?: string | null
}

type Period = '7days' | '30days' | 'month' | 'all'



function nameKey(name?: string | null) {
  return (name || '').trim().toLowerCase()
}

function localDate(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDate(date: string) {
  return new Date(`${date}T00:00:00`)
}

function paymentKey(method?: string | null) {
  const m = (method || '').toLowerCase()
  if (m.includes('pix')) return 'pix'
  if (m.includes('cart') || m.includes('card') || m.includes('credito') || m.includes('debito')) return 'cartao'
  if (m.includes('din') || m.includes('cash')) return 'dinheiro'
  return 'outros'
}

function formatShortDate(date: string) {
  if (!date) return '—'
  const d = parseDate(date)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function DashboardExecutivoPage() {
  const params = useParams()
  const slug = String(params.slug || '')
  const { selectedUnitId, selectedUnit } = useUnit()

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [financialEntries, setFinancialEntries] = useState<FinancialEntry[]>([])
  const [barberCompensations, setBarberCompensations] = useState<BarberCompensation[]>([])
  const [barberPhotos, setBarberPhotos] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('30days')
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    if (slug) fetchData()
  }, [slug, selectedUnitId])

  async function fetchData() {
    setLoading(true)

    const { data: tenantData } = await supabase
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()

    if (!tenantData) {
      setTenant(null)
      setAppointments([])
      setFinancialEntries([])
      setBarberCompensations([])
      setBarberPhotos({})
      setLoading(false)
      return
    }

    setTenant(tenantData)

    let appointmentsQuery = supabase
      .from('appointments')
      .select('*')
      .eq('tenant_id', tenantData.id)

    if (selectedUnitId !== 'all') {
      appointmentsQuery = appointmentsQuery.eq('unit_id', selectedUnitId)
    }

    const { data: appointmentsData, error: appointmentsError } =
      await appointmentsQuery.order('appointment_date', { ascending: false })

    if (appointmentsError) {
      console.error('Erro ao buscar agendamentos:', appointmentsError)
      setAppointments([])
    } else {
      setAppointments((appointmentsData || []) as Appointment[])
    }

    let barbersQuery = supabase
      .from('barbeiros')
      .select('id,nome,unit_id,compensation_type,commission_percentage,fixed_salary_amount,chair_rental_amount')
      .eq('tenant_id', tenantData.id)
      .eq('ativo', true)

    if (selectedUnitId !== 'all') {
      barbersQuery = barbersQuery.eq('unit_id', selectedUnitId)
    }

    const { data: compensationData, error: compensationError } = await barbersQuery
    if (compensationError) {
      console.error('Erro ao buscar remuneracoes:', compensationError)
      setBarberCompensations([])
    } else {
      setBarberCompensations((compensationData || []) as BarberCompensation[])
    }

    let entriesQuery = supabase
      .from('financial_entries')
      .select('*')
      .eq('tenant_id', tenantData.id)

    if (selectedUnitId !== 'all') {
      entriesQuery = entriesQuery.eq('unit_id', selectedUnitId)
    }

    const { data: entriesData, error: entriesError } =
      await entriesQuery.order('entry_date', { ascending: false })

    if (entriesError) {
      console.error('Erro ao buscar entradas financeiras:', entriesError)
      setFinancialEntries([])
    } else {
      setFinancialEntries((entriesData || []) as FinancialEntry[])
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (token) {
        const response = await fetch(
          `/api/admin/settings-assets?tenant_id=${encodeURIComponent(tenantData.id)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )

        const assets = await response.json().catch(() => ({}))
        const barberRows: BarberAsset[] = response.ok ? assets.barbers ?? [] : []

        setBarberPhotos(
          Object.fromEntries(
            barberRows
              .filter((barber) => barber.nome && barber.avatar_url)
              .map((barber) => [nameKey(barber.nome), barber.avatar_url as string])
          )
        )
      }
    } catch {
      setBarberPhotos({})
    }

    setLoading(false)
  }

  const isPremium = tenant?.plano?.toLowerCase() === 'premium'
  const monthlyGoal = Number(tenant?.monthly_goal || 10000)

  function isFinished(status: string) {
    return ['finished', 'concluido', 'concluído', 'finalizado', 'done'].includes(
      (status || '').toLowerCase()
    )
  }

  function money(value: number) {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  const filtered = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return appointments.filter((item) => {
      if (period === 'all') return true

      const date = parseDate(item.appointment_date)

      if (period === '7days') {
        const start = new Date(today)
        start.setDate(today.getDate() - 6)
        return date >= start && date <= today
      }

      if (period === '30days') {
        const start = new Date(today)
        start.setDate(today.getDate() - 29)
        return date >= start && date <= today
      }

      if (period === 'month') {
        return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()
      }

      return true
    })
  }, [appointments, period])

  const previousPeriod = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let days = 30
    if (period === '7days') days = 7
    if (period === 'month') days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    if (period === 'all') return []

    const currentStart = new Date(today)
    currentStart.setDate(today.getDate() - days + 1)

    const previousEnd = new Date(currentStart)
    previousEnd.setDate(currentStart.getDate() - 1)

    const previousStart = new Date(previousEnd)
    previousStart.setDate(previousEnd.getDate() - days + 1)

    return appointments.filter((item) => {
      const date = parseDate(item.appointment_date)
      return date >= previousStart && date <= previousEnd
    })
  }, [appointments, period])

  const finished = filtered.filter((item) => isFinished(item.status))
  const previousFinished = previousPeriod.filter((item) => isFinished(item.status))

  function selectedPeriodRange() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const end = localDate(today)
    const start = new Date(today)

    if (period === '7days') {
      start.setDate(today.getDate() - 6)
    } else if (period === '30days') {
      start.setDate(today.getDate() - 29)
    } else if (period === 'month') {
      start.setDate(1)
    }

    return { start: localDate(start), end }
  }

  function summarizeCompensation(
    items: Appointment[],
    explicitRange?: { start: string; end: string }
  ) {
    const dates = items.map((item) => item.appointment_date).filter(Boolean).sort()
    const start = explicitRange?.start || dates[0] || localDate()
    const end = explicitRange?.end || dates[dates.length - 1] || localDate()
    const knownNames = new Set(barberCompensations.map((barber) => nameKey(barber.nome)))
    const summaries = barberCompensations.map((barber) => {
      const serviceRevenue = items
        .filter((item) => nameKey(item.barber) === nameKey(barber.nome))
        .reduce((sum, item) => sum + Number(item.price || 0), 0)

      return calculateBarberCompensation({
        settings: getBarberCompensation(barber),
        serviceRevenue,
        periodStart: start,
        periodEnd: end,
      })
    })
    const unassignedRevenue = items
      .filter((item) => !knownNames.has(nameKey(item.barber)))
      .reduce((sum, item) => sum + Number(item.price || 0), 0)

    return {
      revenue: summaries.reduce(
        (sum, item) => sum + item.barbershopServiceRevenue + item.chairRentalRevenue,
        unassignedRevenue
      ),
      laborCost: summaries.reduce((sum, item) => sum + item.laborCost, 0),
    }
  }

  const currentCompensation = summarizeCompensation(
    finished,
    period === 'all' ? undefined : selectedPeriodRange()
  )
  const previousCompensation = summarizeCompensation(previousFinished)
  const revenue = currentCompensation.revenue
  const previousRevenue = previousCompensation.revenue
  const growth = previousRevenue > 0 ? Math.round(((revenue - previousRevenue) / previousRevenue) * 100) : revenue > 0 ? 100 : 0

  const averageTicket = finished.length > 0 ? revenue / finished.length : 0

  const uniqueClients = new Set(filtered.map((item) => item.phone || item.client_name)).size
  const allClients = new Set(appointments.map((item) => item.phone || item.client_name)).size
  const returnRate = allClients > 0 ? Math.round((uniqueClients / allClients) * 100) : 0

  const appointmentsGrowth =
    previousPeriod.length > 0
      ? Math.round(((filtered.length - previousPeriod.length) / previousPeriod.length) * 100)
      : filtered.length > 0
        ? 100
        : 0

  const previousUniqueClients = new Set(
    previousPeriod.map((item) => item.phone || item.client_name)
  ).size

  const clientsGrowth =
    previousUniqueClients > 0
      ? Math.round(((uniqueClients - previousUniqueClients) / previousUniqueClients) * 100)
      : uniqueClients > 0
        ? 100
        : 0

  const previousAllClients = new Set(
    previousPeriod.map((item) => item.phone || item.client_name)
  ).size

  const previousReturnRate =
    previousAllClients > 0
      ? Math.round((previousUniqueClients / previousAllClients) * 100)
      : 0

  const returnRateGrowth =
    previousReturnRate > 0
      ? Math.round(((returnRate - previousReturnRate) / previousReturnRate) * 100)
      : returnRate > 0
        ? 100
        : 0

  const filteredEntries = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return financialEntries.filter((entry) => {
      if (period === 'all') return true

      const date = parseDate(entry.entry_date)

      if (period === '7days') {
        const start = new Date(today)
        start.setDate(today.getDate() - 6)
        return date >= start && date <= today
      }

      if (period === '30days') {
        const start = new Date(today)
        start.setDate(today.getDate() - 29)
        return date >= start && date <= today
      }

      if (period === 'month') {
        return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()
      }

      return true
    })
  }, [financialEntries, period])

  const manualIncome = filteredEntries
    .filter((entry) => entry.type === 'entrada')
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)

  const expenses = filteredEntries
    .filter(
      (entry) =>
        entry.type === 'despesa' &&
        !String(entry.description || '').toLowerCase().includes('comiss')
    )
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
    + currentCompensation.laborCost

  const totalIncome = revenue + manualIncome
  const netProfit = totalIncome - expenses

  const chartData = useMemo(() => {
    const days = period === '7days' ? 7 : period === 'month' ? new Date().getDate() : 30
    const today = new Date()
    const map: Record<string, { revenue: number; expenses: number }> = {}

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      map[localDate(date)] = { revenue: 0, expenses: 0 }
    }

    finished.forEach((item) => {
      if (map[item.appointment_date]) {
        map[item.appointment_date].revenue += Number(item.price || 0)
      }
    })

    filteredEntries.forEach((entry) => {
      if (!map[entry.entry_date]) return

      if (entry.type === 'entrada') {
        map[entry.entry_date].revenue += Number(entry.amount || 0)
      }

      if (entry.type === 'despesa') {
        map[entry.entry_date].expenses += Number(entry.amount || 0)
      }
    })

    return Object.entries(map).map(([date, values]) => ({
      date,
      label: formatShortDate(date),
      revenue: values.revenue,
      expenses: values.expenses,
      net: values.revenue - values.expenses,
    }))
  }, [finished, filteredEntries, period])

  const chartMax = Math.max(...chartData.map((item) => Math.max(item.revenue, item.expenses)), 1)

  const paymentData = useMemo(() => {
    const grouped: Record<string, number> = {
      pix: 0,
      cartao: 0,
      dinheiro: 0,
      outros: 0,
    }

    finished.forEach((item) => {
      grouped[paymentKey(item.payment_method)] += Number(item.price || 0)
    })

    filteredEntries
      .filter((entry) => entry.type === 'entrada')
      .forEach((entry) => {
        grouped[paymentKey(entry.payment_method)] += Number(entry.amount || 0)
      })

    const total = Object.values(grouped).reduce((sum, value) => sum + value, 0)

    return Object.entries(grouped)
      .map(([key, value]) => ({
        key,
        value,
        percentage: total > 0 ? Math.round((value / total) * 100) : 0,
      }))
      .filter((item) => item.value > 0)
  }, [finished, filteredEntries])

  const topServices = Object.entries(
    finished.reduce((acc: Record<string, { count: number; revenue: number }>, item) => {
      const service = item.service || 'Serviço não informado'
      if (!acc[service]) acc[service] = { count: 0, revenue: 0 }
      acc[service].count += 1
      acc[service].revenue += Number(item.price || 0)
      return acc
    }, {})
  )
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  const topServiceMax = Math.max(...topServices.map((item) => item.count), 1)

  const barberRanking = Object.entries(
    finished.reduce((acc: Record<string, { count: number; revenue: number }>, item) => {
      const barber = item.barber || 'Barbeiro não informado'
      if (!acc[barber]) acc[barber] = { count: 0, revenue: 0 }
      acc[barber].count += 1
      acc[barber].revenue += Number(item.price || 0)
      return acc
    }, {})
  )
    .map(([name, data]) => ({
      name,
      ...data,
      avatar: barberPhotos[nameKey(name)] || null,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  const inactiveClients = useMemo(() => {
    const map = new Map<string, Appointment>()

    appointments.forEach((item) => {
      const key = item.phone || item.client_name
      const current = map.get(key)
      if (!current || item.appointment_date > current.appointment_date) {
        map.set(key, item)
      }
    })

    const today = new Date()

    return Array.from(map.values())
      .map((item) => {
        const lastDate = parseDate(item.appointment_date)
        const days = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
        return { ...item, days }
      })
      .filter((item) => item.days >= 30)
      .sort((a, b) => b.days - a.days)
      .slice(0, 5)
  }, [appointments])

  const goalPercent = Math.min(Math.round((totalIncome / monthlyGoal) * 100), 100)

  const pendingPayments = filtered.filter((item) => {
    const status = (item.payment_status || '').toLowerCase()
    return isFinished(item.status) && status !== 'paid' && status !== 'pago'
  })

  const notifications = useMemo(() => {
    const list: {
      id: string
      title: string
      text: string
      type: 'warning' | 'success' | 'info'
      action?: () => void
    }[] = []

    if (pendingPayments.length > 0) {
      list.push({
        id: 'pending-payments',
        title: `${pendingPayments.length} pagamento${pendingPayments.length > 1 ? 's' : ''} pendente${pendingPayments.length > 1 ? 's' : ''}`,
        text: 'Existem atendimentos concluídos sem pagamento confirmado.',
        type: 'warning',
      })
    }

    if (inactiveClients.length > 0) {
      list.push({
        id: 'inactive-clients',
        title: `${inactiveClients.length} cliente${inactiveClients.length > 1 ? 's' : ''} inativo${inactiveClients.length > 1 ? 's' : ''}`,
        text: 'Clientes sem retorno há 30 dias ou mais. Acione pelo WhatsApp.',
        type: 'warning',
      })
    }

    if (goalPercent >= 100) {
      list.push({
        id: 'goal-reached',
        title: 'Meta mensal atingida',
        text: `A barbearia já bateu a meta de ${money(monthlyGoal)}.`,
        type: 'success',
      })
    } else {
      list.push({
        id: 'goal-progress',
        title: `Meta mensal em ${goalPercent}%`,
        text: `Faltam ${money(Math.max(monthlyGoal - totalIncome, 0))} para bater a meta.`,
        type: 'info',
      })
    }

    if (expenses > totalIncome * 0.35 && totalIncome > 0) {
      list.push({
        id: 'high-expenses',
        title: 'Despesas acima do ideal',
        text: 'As despesas estão acima de 35% das entradas no período.',
        type: 'warning',
      })
    }

    if (list.length === 0) {
      list.push({
        id: 'no-alerts',
        title: 'Tudo em ordem',
        text: 'Nenhum alerta operacional importante no momento.',
        type: 'success',
      })
    }

    return list
  }, [pendingPayments.length, inactiveClients.length, goalPercent, totalIncome, expenses])

  function exportExecutiveReport() {
    const rows = [
      ['Unidade', selectedUnitId === 'all' ? 'Todas as unidades' : selectedUnit?.name || 'Unidade selecionada'],
      [],
      ['Indicador', 'Valor'],
      ['Receita total', money(totalIncome)],
      ['Receita por agendamentos', money(revenue)],
      ['Entradas manuais', money(manualIncome)],
      ['Despesas', money(expenses)],
      ['Lucro líquido', money(netProfit)],
      ['Agendamentos', String(filtered.length)],
      ['Clientes', String(uniqueClients)],
      ['Ticket médio', money(averageTicket)],
      ['Taxa de retorno', `${returnRate}%`],
      ['Meta mensal', money(monthlyGoal)],
      ['Meta atingida', `${goalPercent}%`],
      [],
      ['Top serviços', 'Agendamentos', 'Receita'],
      ...topServices.map((item) => [item.name, String(item.count), money(item.revenue)]),
      [],
      ['Ranking de barbeiros', 'Atendimentos', 'Receita'],
      ...barberRanking.map((item) => [item.name, String(item.count), money(item.revenue)]),
      [],
      ['Clientes inativos', 'Telefone', 'Dias sem voltar'],
      ...inactiveClients.map((item) => [item.client_name, item.phone || '-', `${item.days} dias`]),
      [],
      ['Notificações', 'Descrição'],
      ...notifications.map((item) => [item.title, item.text]),
    ]

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
          .join(';')
      )
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `dashboard-executivo-${slug}-${localDate()}.csv`
    link.click()

    URL.revokeObjectURL(url)
  }

  function openWhatsApp(client: Appointment & { days?: number }) {
    const cleanPhone = (client.phone || '').replace(/\D/g, '')

    if (!cleanPhone) {
      alert('Este cliente não possui telefone cadastrado.')
      return
    }

    const phone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`

    const message = encodeURIComponent(
      `Olá ${client.client_name}, tudo bem? Sentimos sua falta na barbearia. Faz ${client.days ?? 30} dias desde seu último corte. Quer agendar um horário essa semana?`
    )

    window.open(`https://wa.me/${phone}?text=${message}`, '_blank')
  }

  if (loading) {
    return <main className="executive-page"><style>{css}</style><p>Carregando dashboard executivo...</p></main>
  }

  if (!isPremium) {
    return (
      <main className="executive-page">
        <style>{css}</style>
        <div className="locked-card">
          <div className="lock-icon"><Lock size={26} /></div>
          <h1>Dashboard Executivo Premium</h1>
          <p>Este painel é exclusivo do plano Premium. Ele mostra visão executiva, ranking de barbeiros, clientes inativos e indicadores avançados.</p>
          <button>Fazer upgrade</button>
        </div>
      </main>
    )
  }

  return (
    <main className="executive-page">
      <style>{css}</style>

      <div className="executive-wrap">
        <header className="executive-header">
          <div>
            <h1>Bom dia, {tenant?.name || 'João'}! 👋</h1>
            <p>
              Aqui está o resumo da sua barbearia hoje
              {selectedUnitId !== 'all' ? ` · ${selectedUnit?.name || 'Unidade selecionada'}` : ' · Todas as unidades'}.
            </p>
          </div>

          <div className="header-actions">
            <div className="date-filter">
              <CalendarDays size={18} />
              <span>
                {period === '30days' ? 'Últimos 30 dias' : period === '7days' ? 'Últimos 7 dias' : period === 'month' ? 'Mês atual' : 'Todo período'}
                {' · '}
                {selectedUnitId === 'all' ? 'Todas as unidades' : selectedUnit?.name || 'Unidade'}
              </span>
            </div>

            <div className="notification-wrap">
              <button
                className="icon-action"
                type="button"
                onClick={() => setShowNotifications((value) => !value)}
                title="Ver notificações"
              >
                <Bell size={19} />
                {notifications.length > 0 && <i>{notifications.length}</i>}
              </button>

              {showNotifications && (
                <div className="notification-menu">
                  <div className="notification-head">
                    <strong>Notificações</strong>
                    <button type="button" onClick={() => setShowNotifications(false)}>×</button>
                  </div>

                  {notifications.map((item) => (
                    <div key={item.id} className={`notification-item ${item.type}`}>
                      <strong>{item.title}</strong>
                      <p>{item.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button className="export-action" type="button" onClick={exportExecutiveReport}>
              <Download size={18} />
              Exportar relatório
            </button>
          </div>
        </header>

        <div className="badge-row">
          <div className="premium-badge">
            <Crown size={16} />
            Plano Premium
          </div>

          <div className="unit-badge">
            {selectedUnitId === 'all' ? 'Todas as unidades' : selectedUnit?.name || 'Unidade selecionada'}
          </div>
        </div>

        <div className="period-tabs">
          <Filter active={period === '7days'} onClick={() => setPeriod('7days')}>7 dias</Filter>
          <Filter active={period === '30days'} onClick={() => setPeriod('30days')}>30 dias</Filter>
          <Filter active={period === 'month'} onClick={() => setPeriod('month')}>Mês atual</Filter>
          <Filter active={period === 'all'} onClick={() => setPeriod('all')}>Tudo</Filter>
        </div>

        <section className="metric-grid">
          <Metric title="Receita total" value={money(totalIncome)} icon={DollarSign} color="#2563eb" growth={growth} />
          <Metric title="Agendamentos" value={filtered.length} icon={CalendarDays} color="#7c3aed" growth={appointmentsGrowth} />
          <Metric title="Clientes novos" value={uniqueClients} icon={UserPlus} color="#65a30d" growth={clientsGrowth} />
          <Metric title="Ticket médio" value={money(averageTicket)} icon={TrendingUp} color="#ea580c" growth={12} />
          <Metric title="Taxa de retorno" value={`${returnRate}%`} icon={RefreshCcw} color="#0284c7" growth={returnRateGrowth} />
        </section>

        <section className="main-grid">
          <Panel className="chart-panel" title="Entradas x despesas no período">
            <div className="chart-legend">
              <span><i className="income-dot" /> Entradas</span>
              <span><i className="expense-dot" /> Despesas</span>
              <strong>Lucro: {money(netProfit)}</strong>
            </div>

            <div className="chart-box">
              <div className="chart-scale">
                <span>R$ 10k</span>
                <span>R$ 8k</span>
                <span>R$ 6k</span>
                <span>R$ 4k</span>
                <span>R$ 2k</span>
                <span>R$ 0</span>
              </div>

              <div className="line-chart">
                {chartData.map((item, index) => {
                  const revenueHeight = Math.max(4, (item.revenue / chartMax) * 100)
                  const expenseHeight = Math.max(0, (item.expenses / chartMax) * 100)
                  const hasValue = item.revenue > 0 || item.expenses > 0

                  return (
                    <div key={item.date} className="line-point-wrap">
                      <div className="line-column">
                        <span
                          className="line-bar revenue"
                          style={{ height: `${revenueHeight}%`, opacity: item.revenue > 0 ? 1 : .25 }}
                          title={`${item.label} | Entradas: ${money(item.revenue)}`}
                        />

                        {item.expenses > 0 && (
                          <span
                            className="line-bar expense"
                            style={{ height: `${expenseHeight}%` }}
                            title={`${item.label} | Despesas: ${money(item.expenses)}`}
                          />
                        )}

                        {item.revenue > 0 && (
                          <span className="line-dot" style={{ bottom: `${revenueHeight}%` }} />
                        )}
                      </div>

                      {(index === 0 || index === chartData.length - 1 || hasValue || index % 5 === 0) && (
                        <small>{item.label}</small>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </Panel>

          <Panel title="Receita por método de pagamento">
            <div className="payment-layout">
              <div className="donut">
                <div>
                  <strong>{money(totalIncome)}</strong>
                  <span>Total</span>
                </div>
              </div>

              <div className="payment-list">
                {paymentData.length === 0 ? (
                  <p className="muted">Sem dados.</p>
                ) : (
                  paymentData.map((item) => (
                    <PaymentRow key={item.key} item={item} money={money} />
                  ))
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Meta mensal">
            <div className="goal-box">
              <div className="goal-ring" style={{ background: `conic-gradient(#22c55e ${goalPercent * 3.6}deg, rgba(30,41,59,.95) 0deg)` }}>
                <div>
                  <span>Meta</span>
                  <strong>{goalPercent}%</strong>
                  <small>atingida</small>
                </div>
              </div>

              <p>{money(totalIncome)} / {money(monthlyGoal)}</p>
            </div>
          </Panel>
        </section>

        <section className="lower-grid">
          <Panel title="Top 5 - Serviços mais vendidos">
            {topServices.length === 0 ? <Empty /> : topServices.map((item) => (
              <div key={item.name} className="service-row">
                <Scissors size={16} />
                <div>
                  <div className="service-head">
                    <strong>{item.name}</strong>
                    <span>{item.count}</span>
                    <b>{money(item.revenue)}</b>
                  </div>
                  <div className="progress"><span style={{ width: `${(item.count / topServiceMax) * 100}%` }} /></div>
                </div>
              </div>
            ))}
          </Panel>

          <Panel title="Ranking de barbeiros (por receita)">
            {barberRanking.length === 0 ? <Empty /> : barberRanking.map((item, index) => (
              <div key={item.name} className="ranking-row">
                <span className="rank-number">{index + 1}</span>
                {item.avatar ? <img src={item.avatar} alt={item.name} /> : <div className="avatar-fallback">{item.name.slice(0, 2).toUpperCase()}</div>}
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.count} atendimentos</small>
                </div>
                <b>{money(item.revenue)}</b>
                {index < 3 && <Trophy size={18} className={`trophy-${index}`} />}
              </div>
            ))}
          </Panel>

          <Panel title="Clientes inativos">
            {inactiveClients.length === 0 ? <Empty /> : inactiveClients.map((item) => (
              <div key={`${item.client_name}-${item.phone}`} className="inactive-row">
                <div className="avatar-fallback">{item.client_name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <strong>{item.client_name}</strong>
                  <small>Não corta há {item.days} dias</small>
                </div>
                <button type="button" onClick={() => openWhatsApp(item)}><MessageCircle size={15} /> Enviar WhatsApp</button>
              </div>
            ))}
          </Panel>
        </section>

        <section className="footer-grid">
          <Panel title="Fluxo de caixa">
            <div className="cash-grid">
              <Cash label="Entradas" value={money(totalIncome)} color="#10b981" />
              <Cash label="Despesas" value={money(expenses)} color="#ef4444" />
              <Cash label="Lucro líquido" value={money(netProfit)} color="#22c55e" />
            </div>
          </Panel>

          <Panel title="Crescimento">
            <div className="growth-grid">
              <Growth
                icon={DollarSign}
                label="Receita"
                current={money(totalIncome)}
                previous={money(previousRevenue)}
                growth={growth}
              />
              <Growth
                icon={CalendarDays}
                label="Agendamentos"
                current={filtered.length}
                previous={previousPeriod.length}
                growth={appointmentsGrowth}
              />
              <Growth
                icon={UserPlus}
                label="Clientes"
                current={uniqueClients}
                previous={previousUniqueClients}
                growth={clientsGrowth}
              />
              <Growth
                icon={RefreshCcw}
                label="Retorno"
                current={`${returnRate}%`}
                previous={`${previousReturnRate}%`}
                growth={returnRateGrowth}
              />
            </div>
          </Panel>
        </section>
      </div>
    </main>
  )
}

function Filter({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`period-btn ${active ? 'active' : ''}`}>
      {children}
    </button>
  )
}

function Metric({ title, value, icon: Icon, color, growth }: { title: string; value: string | number; icon: React.ElementType; color: string; growth: number }) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{title}</span>
        <div style={{ background: `${color}25`, color }}><Icon size={24} /></div>
      </div>
      <strong>{value}</strong>
      <p className={growth >= 0 ? 'positive' : 'negative'}>
        {growth >= 0 ? '↑' : '↓'} {Math.abs(growth)}% <span>vs período anterior</span>
      </p>
    </div>
  )
}

function Panel({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`panel ${className}`}>
      <h2>{title}</h2>
      {children}
    </div>
  )
}

function PaymentRow({ item, money }: { item: { key: string; value: number; percentage: number }; money: (n: number) => string }) {
  const label: Record<string, string> = { pix: 'PIX', cartao: 'Cartão', dinheiro: 'Dinheiro', outros: 'Outros' }
  const icons: Record<string, React.ElementType> = { pix: Smartphone, cartao: CreditCard, dinheiro: Banknote, outros: Wallet }
  const colors: Record<string, string> = { pix: '#3b82f6', cartao: '#10b981', dinheiro: '#f59e0b', outros: '#8b5cf6' }
  const Icon = icons[item.key] || Wallet

  return (
    <div className="payment-row">
      <span style={{ background: colors[item.key] }} />
      <Icon size={16} />
      <strong>{label[item.key]}</strong>
      <small>{item.percentage}%</small>
      <b>{money(item.value)}</b>
    </div>
  )
}

function Cash({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
    </div>
  )
}

function Growth({
  icon: Icon,
  label,
  current,
  previous,
  growth,
}: {
  icon: React.ElementType
  label: string
  current: string | number
  previous: string | number
  growth: number
}) {
  const positive = growth >= 0

  return (
    <div className="growth-item">
      <div><Icon size={20} /></div>

      <span>{label}</span>

      <strong className={positive ? 'positive' : 'negative'}>
        {positive ? '↑' : '↓'} {Math.abs(growth)}%
      </strong>

      <small>
        Atual: <b>{current}</b>
      </small>

      <small>
        Anterior: <b>{previous}</b>
      </small>
    </div>
  )
}

function Empty() {
  return <p className="muted">Sem dados nesse período.</p>
}

const css = `
.executive-page {
  min-height: 100vh;
  color: #0f172a;
  font-family: Inter, DM Sans, Segoe UI, sans-serif;
}

.executive-header h1 {
  color: #0f172a !important;
}

.executive-header p {
  color: #475569 !important;
}

.executive-wrap {
  max-width: 1480px;
  margin: 0 auto;
  padding: 20px 22px 28px;
}

.executive-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
  margin-bottom: 18px;
}

.executive-header h1 {
  margin: 0;
  font-size: 27px;
  font-weight: 850;
  letter-spacing: -0.025em;
}

.executive-header p {
  margin: 6px 0 0;
  color: #94a3b8;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.date-filter,
.icon-action,
.export-action {
  min-height: 44px;
  border-radius: 14px;
  border: 1px solid rgba(148,163,184,.13);
  background: rgba(15,23,42,.72);
  color: #e2e8f0;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  font-weight: 800;
}

.notification-wrap {
  position: relative;
}

.icon-action {
  width: 44px;
  justify-content: center;
  position: relative;
  padding: 0;
  cursor: pointer;
}

.icon-action i {
  position: absolute;
  top: -7px;
  right: -6px;
  min-width: 19px;
  height: 19px;
  padding: 0 5px;
  border-radius: 99px;
  background: #ef4444;
  display: grid;
  place-items: center;
  font-size: 10px;
  font-style: normal;
}

.notification-menu {
  position: absolute;
  top: 54px;
  right: 0;
  width: 340px;
  z-index: 80;
  border-radius: 18px;
  padding: 12px;
  background: rgba(8,13,28,.98);
  border: 1px solid rgba(148,163,184,.16);
  box-shadow: 0 24px 70px rgba(0,0,0,.45);
}

.notification-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 10px;
}

.notification-head strong {
  color: #f8fafc;
}

.notification-head button {
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 8px;
  background: rgba(148,163,184,.10);
  color: #94a3b8;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}

.notification-item {
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(148,163,184,.10);
  background: rgba(15,23,42,.72);
  margin-top: 8px;
}

.notification-item strong {
  display: block;
  font-size: 13px;
}

.notification-item p {
  margin: 5px 0 0;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.45;
}

.notification-item.warning {
  border-color: rgba(245,158,11,.26);
}

.notification-item.success {
  border-color: rgba(34,197,94,.26);
}

.notification-item.info {
  border-color: rgba(59,130,246,.26);
}

.export-action {
  cursor: pointer;
}

.badge-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.premium-badge,
.unit-badge {
  width: max-content;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(37,99,235,.12);
  border: 1px solid rgba(59,130,246,.22);
  color: #93c5fd;
  border-radius: 999px;
  padding: 7px 12px;
  font-weight: 850;
  font-size: 12px;
}

.unit-badge {
  background: rgba(15,23,42,.74);
  border-color: rgba(148,163,184,.14);
  color: #cbd5e1;
}

.period-tabs {
  background: rgba(24,34,53,.78);
  border: 1px solid rgba(148,163,184,.12);
  border-radius: 14px;
  padding: 5px;
  width: max-content;
  margin: -48px 0 24px auto;
  display: flex;
  gap: 8px;
}

.period-btn {
  border: 0;
  border-radius: 12px;
  padding: 9px 16px;
  color: #b5c1d1;
  background: transparent;
  font-weight: 800;
  cursor: pointer;
}

.period-btn.active {
  background: linear-gradient(135deg,#2563eb,#1d4ed8);
  color: white;
  box-shadow: 0 8px 20px rgba(37,99,235,.20);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.metric-card,
.panel,
.locked-card {
  background: radial-gradient(circle at top right, rgba(59,130,246,.08), transparent 38%), linear-gradient(145deg, rgba(27,38,59,.97), rgba(17,25,40,.98));
  border: 1px solid rgba(148,163,184,.11);
  box-shadow: 0 12px 30px rgba(15,23,42,.13);
  color: #f8fafc;
}

.metric-card {
  min-height: 108px;
  border-radius: 18px;
  padding: 16px 17px;
}

.metric-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.metric-top span {
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 650;
}

.metric-top div {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
}

.metric-card strong {
  display: block;
  margin-top: 11px;
  font-size: 23px;
  letter-spacing: -.025em;
  font-weight: 850;
}

.metric-card p {
  margin: 6px 0 0;
  font-size: 12px;
  font-weight: 800;
}

.metric-card p.positive {
  color: #22c55e;
}

.metric-card p.negative {
  color: #ef4444;
}

.metric-card p span {
  color: #94a3b8;
  font-weight: 700;
}

.main-grid {
  display: grid;
  grid-template-columns: 1.28fr 1.12fr .9fr;
  gap: 14px;
  margin-bottom: 14px;
}

.lower-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1.2fr;
  gap: 14px;
  margin-bottom: 14px;
}

.footer-grid {
  display: grid;
  grid-template-columns: .9fr 1.2fr;
  gap: 14px;
}

.panel {
  border-radius: 19px;
  padding: 18px;
  min-height: 220px;
}

.panel h2 {
  margin: 0 0 15px;
  font-size: 15px;
  font-weight: 820;
  letter-spacing: -.015em;
  color: #f8fafc;
}

.chart-panel { min-height: 280px; }

.chart-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: -2px 0 10px;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 700;
  flex-wrap: wrap;
}

.chart-legend span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.chart-legend i {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  display: inline-block;
}

.income-dot {
  background: #3b82f6;
}

.expense-dot {
  background: #ef4444;
}

.chart-legend strong {
  margin-left: auto;
  color: #22c55e;
}

.chart-box {
  height: 205px;
  display: grid;
  grid-template-columns: 50px 1fr;
  gap: 8px;
}

.chart-scale {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: #94a3b8;
  font-size: 12px;
  padding: 2px 0 24px;
}

.line-chart {
  display: flex;
  align-items: stretch;
  gap: 6px;
  min-width: 0;
  padding: 7px 7px 0;
  background:
    linear-gradient(rgba(148,163,184,.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148,163,184,.04) 1px, transparent 1px);
  background-size: 100% 20%, 10% 100%;
  border-radius: 13px;
  overflow: hidden;
}

.line-point-wrap {
  flex: 1;
  position: relative;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.line-column { position: relative; height: 166px; }

.line-bar {
  position: absolute;
  bottom: 0;
  width: 34%;
  max-width: 11px;
  border-radius: 999px 999px 3px 3px;
  transition: .18s ease;
}

.line-bar.revenue {
  left: 50%;
  transform: translateX(-80%);
  background: linear-gradient(180deg,#93c5fd,#2563eb);
  box-shadow: 0 4px 12px rgba(37,99,235,.20);
}

.line-bar.expense {
  left: 50%;
  transform: translateX(15%);
  background: linear-gradient(180deg,#fb7185,#dc2626);
  box-shadow: 0 4px 10px rgba(220,38,38,.16);
}

.line-column:hover .line-bar {
  filter: brightness(1.14);
}

.line-dot {
  position: absolute;
  left: 50%;
  width: 5px;
  height: 5px;
  transform: translate(-80%, 50%);
  border-radius: 999px;
  background: #bfdbfe;
  box-shadow: 0 0 8px rgba(37,99,235,.55);
}

.line-point-wrap small {
  height: 18px;
  margin-top: 7px;
  color: #64748b;
  font-size: 10px;
  white-space: nowrap;
}

.payment-layout {
  display: grid;
  grid-template-columns: 130px 1fr;
  gap: 18px;
  align-items: center;
}

.donut {
  width: 130px;
  height: 130px;
  border-radius: 999px;
  background: conic-gradient(#3b82f6 0 45%, #10b981 45% 80%, #f59e0b 80% 95%, #8b5cf6 95% 100%);
  display: grid;
  place-items: center;
}

.donut > div {
  width: 80px;
  height: 80px;
  border-radius: 999px;
  background: #071020;
  display: grid;
  place-items: center;
  text-align: center;
}

.donut strong,
.goal-ring strong { font-size: 18px; font-weight: 850; }
.donut span,
.goal-ring span,
.goal-ring small { display: block; color: #94a3b8; font-size: 11px; }

.payment-list { display: grid; gap: 12px; }

.payment-row {
  display: grid;
  grid-template-columns: 10px 18px 1fr 45px 88px;
  align-items: center;
  gap: 9px;
  color: #cbd5e1;
  font-size: 12px;
}

.payment-row > span { width: 10px; height: 10px; border-radius: 999px; }
.payment-row small { color: #94a3b8; }
.payment-row b { text-align: right; }

.goal-box { display: grid; place-items: center; gap: 18px; }

.goal-ring {
  width: 160px;
  height: 160px;
  border-radius: 999px;
  display: grid;
  place-items: center;
}

.goal-ring div {
  width: 112px;
  height: 112px;
  border-radius: 999px;
  background: #071020;
  display: grid;
  place-items: center;
  text-align: center;
}

.goal-box p { margin: 0; color: #cbd5e1; }

.service-row {
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: 12px;
  align-items: center;
  margin-bottom: 15px;
}

.service-row svg { color: #60a5fa; }

.service-head {
  display: grid;
  grid-template-columns: 1fr 38px 92px;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}

.service-head span { color: #cbd5e1; text-align: right; }
.service-head b { text-align: right; }

.progress {
  height: 6px;
  background: rgba(148,163,184,.12);
  border-radius: 999px;
  margin-top: 8px;
  overflow: hidden;
}

.progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #3b82f6;
}

.ranking-row,
.inactive-row {
  display: grid;
  grid-template-columns: 28px 40px 1fr auto 22px;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(148,163,184,.08);
}

.inactive-row { grid-template-columns: 42px 1fr auto; }

.ranking-row img,
.avatar-fallback {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  object-fit: cover;
  border: 1px solid rgba(59,130,246,.3);
}

.avatar-fallback {
  display: grid;
  place-items: center;
  background: rgba(59,130,246,.16);
  color: #93c5fd;
  font-weight: 950;
  font-size: 12px;
}

.rank-number { color: #cbd5e1; font-weight: 950; text-align: center; }
.ranking-row small,
.inactive-row small { display: block; color: #94a3b8; margin-top: 2px; font-size: 12px; }
.ranking-row b { color: #22c55e; }
.trophy-0 { color: #fbbf24; }
.trophy-1 { color: #94a3b8; }
.trophy-2 { color: #fb923c; }

.inactive-row button {
  border: 1px solid rgba(34,197,94,.25);
  background: rgba(34,197,94,.08);
  color: #86efac;
  border-radius: 12px;
  padding: 9px 12px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-weight: 850;
  cursor: pointer;
}

.cash-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  align-items: stretch;
  min-height: 120px;
}

.cash-grid > div {
  padding: 15px;
  border-radius: 15px;
  background: rgba(15,23,42,.55);
  border: 1px solid rgba(148,163,184,.09);
}

.cash-grid span {
  color: #94a3b8;
  display: block;
  margin-bottom: 10px;
  font-size: 13px;
}

.cash-grid strong {
  font-size: 22px;
  font-weight: 850;
  letter-spacing: -.025em;
}

.growth-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.growth-item {
  display: grid;
  gap: 7px;
  padding: 13px;
  border-radius: 15px;
  background: rgba(15,23,42,.55);
  border: 1px solid rgba(148,163,184,.09);
}

.growth-item div {
  width: 39px;
  height: 39px;
  border-radius: 13px;
  display: grid;
  place-items: center;
  background: rgba(37,99,235,.16);
  color: #60a5fa;
}

.growth-item span {
  color: #cbd5e1;
  font-weight: 850;
}

.growth-item strong {
  font-size: 20px;
  font-weight: 850;
}

.growth-item strong.positive {
  color: #22c55e;
}

.growth-item strong.negative {
  color: #ef4444;
}

.growth-item small {
  color: #94a3b8;
  line-height: 1.35;
}

.growth-item small b {
  color: #e2e8f0;
  font-weight: 850;
}

.locked-card { max-width: 760px; margin: 60px auto; border-radius: 24px; padding: 34px; }
.lock-icon { width: 58px; height: 58px; border-radius: 18px; background: rgba(245,158,11,.12); color: #facc15; display: grid; place-items: center; margin-bottom: 18px; }
.locked-card h1 { margin: 0; font-size: 30px; }
.locked-card p { color: #94a3b8; line-height: 1.6; }
.locked-card button { border: 0; border-radius: 14px; padding: 13px 18px; background: #2563eb; color: white; font-weight: 900; }
.muted { color: #94a3b8; }

/*
 * Executive cards intentionally remain dark in both admin themes.
 * Keep their content explicit so light-theme rules cannot reduce contrast.
 */
.executive-page .metric-card,
.executive-page .panel,
.executive-page .locked-card,
.executive-page .notification-menu,
.executive-page .notification-item {
  color: #f8fafc !important;
}

.executive-page .metric-card strong,
.executive-page .panel h2,
.executive-page .panel strong,
.executive-page .panel b,
.executive-page .notification-head strong,
.executive-page .notification-item strong,
.executive-page .locked-card h1 {
  color: #f8fafc;
}

.executive-page .metric-top span,
.executive-page .chart-legend,
.executive-page .chart-scale,
.executive-page .line-point-wrap small,
.executive-page .donut span,
.executive-page .goal-ring span,
.executive-page .goal-ring small,
.executive-page .payment-row small,
.executive-page .ranking-row small,
.executive-page .inactive-row small,
.executive-page .cash-grid span,
.executive-page .growth-item small,
.executive-page .notification-item p,
.executive-page .locked-card p,
.executive-page .muted {
  color: #aebdd0 !important;
}

.executive-page .metric-card p span {
  color: #b8c5d6 !important;
}

.executive-page .payment-row,
.executive-page .goal-box p,
.executive-page .service-head span,
.executive-page .rank-number,
.executive-page .growth-item span {
  color: #dbe5f1 !important;
}

.executive-page .growth-item small b {
  color: #f1f5f9 !important;
}

.executive-page .donut > div,
.executive-page .goal-ring div {
  color: #f8fafc;
}

.executive-page .metric-card p.positive,
.executive-page .growth-item strong.positive,
.executive-page .ranking-row b,
.executive-page .chart-legend strong {
  color: #4ade80 !important;
}

.executive-page .metric-card p.negative,
.executive-page .growth-item strong.negative {
  color: #fb7185 !important;
}



/* Superfícies executivas locais: suaves, legíveis e independentes do tema global. */
.executive-page .metric-card,
.executive-page .panel,
.executive-page .locked-card {
  background: radial-gradient(circle at top right, rgba(59,130,246,.08), transparent 38%), linear-gradient(145deg, rgba(27,38,59,.97), rgba(17,25,40,.98)) !important;
  border: 1px solid rgba(148,163,184,.11) !important;
  box-shadow: 0 12px 30px rgba(15,23,42,.13) !important;
  color: #f8fafc !important;
}

.executive-page .panel *,
.executive-page .metric-card *,
.executive-page .locked-card * {
  text-shadow: none;
}

.executive-page .panel h2,
.executive-page .metric-card strong,
.executive-page .panel strong,
.executive-page .panel b,
.executive-page .locked-card h1 {
  color: #f8fafc !important;
}

.executive-page .metric-top span,
.executive-page .chart-legend,
.executive-page .chart-scale,
.executive-page .line-point-wrap small,
.executive-page .donut span,
.executive-page .goal-ring span,
.executive-page .goal-ring small,
.executive-page .payment-row small,
.executive-page .ranking-row small,
.executive-page .inactive-row small,
.executive-page .cash-grid span,
.executive-page .growth-item small,
.executive-page .notification-item p,
.executive-page .locked-card p,
.executive-page .muted {
  color: #cbd5e1 !important;
}

.executive-page .payment-row,
.executive-page .goal-box p,
.executive-page .service-head,
.executive-page .service-head span,
.executive-page .rank-number,
.executive-page .growth-item span,
.executive-page .cash-grid strong,
.executive-page .growth-item small b {
  color: #e2e8f0 !important;
}

.executive-page .donut > div,
.executive-page .goal-ring div {
  background: #071020 !important;
  color: #f8fafc !important;
}

.executive-page .cash-grid > div,
.executive-page .growth-item {
  background: rgba(35,47,68,.64) !important;
  border: 1px solid rgba(148,163,184,.10) !important;
}

.executive-page .line-chart {
  background:
    linear-gradient(rgba(148,163,184,.09) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148,163,184,.045) 1px, transparent 1px) !important;
  background-size: 100% 20%, 10% 100% !important;
}

.executive-page .metric-card p.positive,
.executive-page .growth-item strong.positive,
.executive-page .ranking-row b,
.executive-page .chart-legend strong {
  color: #4ade80 !important;
}

.executive-page .metric-card p.negative,
.executive-page .growth-item strong.negative {
  color: #fb7185 !important;
}

@media (max-width: 1300px) {
  .metric-grid { grid-template-columns: repeat(2, 1fr); }
  .main-grid, .lower-grid, .footer-grid { grid-template-columns: 1fr; }
  .period-tabs { margin: 0 0 20px; }
}

@media (max-width: 760px) {
  .executive-wrap { padding: 16px; }
  .executive-header, .header-actions { flex-direction: column; align-items: stretch; }
  .notification-menu { left: 0; right: auto; width: min(340px, 86vw); }
  .metric-grid, .cash-grid, .growth-grid { grid-template-columns: 1fr; }
  .payment-layout { grid-template-columns: 1fr; }
  .inactive-row { grid-template-columns: 42px 1fr; }
  .inactive-row button { grid-column: 1 / -1; justify-content: center; }
}
`
