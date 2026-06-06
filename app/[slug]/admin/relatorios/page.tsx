'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUnit } from '@/lib/unit-context'
import { useTenant } from '@/lib/tenant-context'
import { useTheme } from '@/components/theme-provider'
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock,
  DollarSign,
  Filter,
  Scissors,
  Users,
} from 'lucide-react'

type Appointment = {
  id: string
  unit_id?: string | null
  client_name: string
  phone: string
  service: string
  barber: string
  appointment_date: string
  appointment_time: string
  status: string
  price?: number | null
  tenant_id?: string | null
  barbershop_id?: string | null
}

type Service = {
  id: string
  unit_id?: string | null
  name?: string
  title?: string
  price?: number | null
  value?: number | null
  tenant_id?: string | null
  barbershop_id?: string | null
}

type TenantContext = {
  tenantId: string | null
  barbershopId: string | null
}

type PeriodFilter = 'today' | '7days' | '30days' | 'month' | 'all'

export default function RelatoriosPage() {
  const params = useParams()
  const slug = String(params.slug || '')
  const { isPremium } = useTenant()
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const { selectedUnitId, selectedUnit } = useUnit()
  const activeUnitId = isPremium ? selectedUnitId : 'all'

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<PeriodFilter>('30days')

  useEffect(() => {
    if (slug) {
      fetchData()
    }
  }, [slug, activeUnitId])

  async function getTenantContext(): Promise<TenantContext> {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    const tenantId = tenant?.id || null

    const { data: barbershop } = await supabase
      .from('barbershops')
      .select('id, tenant_id')
      .or(`slug.eq.${slug}${tenantId ? `,tenant_id.eq.${tenantId}` : ''}`)
      .maybeSingle()

    return {
      tenantId: tenantId || barbershop?.tenant_id || null,
      barbershopId: barbershop?.id || null,
    }
  }

  async function fetchData() {
    setLoading(true)

    const { tenantId, barbershopId } = await getTenantContext()

    if (!tenantId && !barbershopId) {
      setAppointments([])
      setServices([])
      setLoading(false)
      return
    }

    const tenantFilter = [
      tenantId ? `tenant_id.eq.${tenantId}` : '',
      barbershopId ? `barbershop_id.eq.${barbershopId}` : '',
    ]
      .filter(Boolean)
      .join(',')

    let appointmentsQuery = supabase
      .from('appointments')
      .select('*')
      .or(tenantFilter)

    let servicesQuery = supabase
      .from('services')
      .select('*')
      .or(tenantFilter)

    if (activeUnitId !== 'all') {
      appointmentsQuery = appointmentsQuery.eq('unit_id', activeUnitId)
      servicesQuery = servicesQuery.or(`unit_id.eq.${activeUnitId},unit_id.is.null`)
    }

    const [appointmentsResponse, servicesResponse] = await Promise.all([
      appointmentsQuery
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false }),

      servicesQuery,
    ])

    if (appointmentsResponse.error) {
      console.error('Erro ao buscar agendamentos:', appointmentsResponse.error)
      setAppointments([])
    } else {
      setAppointments(appointmentsResponse.data || [])
    }

    if (servicesResponse.error) {
      console.error('Erro ao buscar serviços:', servicesResponse.error)
      setServices([])
    } else {
      setServices(servicesResponse.data || [])
    }

    setLoading(false)
  }

  function normalizeText(text: string) {
    return text
      ?.toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }

  function isFinished(status: string) {
    return ['finished', 'concluido', 'concluído', 'finalizado', 'done'].includes(
      normalizeText(status)
    )
  }

  function getAppointmentPrice(item: Appointment) {
    const directPrice = Number(item.price || 0)

    if (directPrice > 0) return directPrice

    const matchedService = services.find((service) => {
      const sameService =
        normalizeText(service.name || service.title || '') ===
        normalizeText(item.service || '')

      const sameTenant =
        !item.tenant_id || !service.tenant_id || item.tenant_id === service.tenant_id

      const sameBarbershop =
        !item.barbershop_id ||
        !service.barbershop_id ||
        item.barbershop_id === service.barbershop_id

      const sameUnit =
        activeUnitId === 'all' ||
        !service.unit_id ||
        service.unit_id === activeUnitId

      return sameService && sameTenant && sameBarbershop && sameUnit
    })

    return Number(matchedService?.price || matchedService?.value || 0)
  }

  function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  function formatDate(date: string) {
    if (!date) return '-'
    return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR')
  }

  function formatTime(time: string) {
    if (!time) return '-'
    return time.slice(0, 5)
  }

  const filteredAppointments = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return appointments.filter((item) => {
      if (period === 'all') return true

      const appointmentDate = new Date(`${item.appointment_date}T00:00:00`)

      if (period === 'today') {
        return appointmentDate.getTime() === today.getTime()
      }

      if (period === '7days') {
        const startDate = new Date(today)
        startDate.setDate(today.getDate() - 6)
        return appointmentDate >= startDate && appointmentDate <= today
      }

      if (period === '30days') {
        const startDate = new Date(today)
        startDate.setDate(today.getDate() - 29)
        return appointmentDate >= startDate && appointmentDate <= today
      }

      if (period === 'month') {
        return (
          appointmentDate.getMonth() === today.getMonth() &&
          appointmentDate.getFullYear() === today.getFullYear()
        )
      }

      return true
    })
  }, [appointments, period])

  const concluidos = filteredAppointments.filter((item) =>
    isFinished(item.status)
  )

  const pendentes = filteredAppointments.filter(
    (item) => !isFinished(item.status)
  )

  const faturamentoTotal = concluidos.reduce((total, item) => {
    return total + getAppointmentPrice(item)
  }, 0)

  const ticketMedio =
    concluidos.length > 0 ? faturamentoTotal / concluidos.length : 0

  const clientesUnicos = new Set(
    filteredAppointments.map((item) => item.phone || item.client_name)
  ).size

  const servicosMaisVendidos = Object.entries(
    filteredAppointments.reduce((acc: Record<string, number>, item) => {
      const serviceName = item.service || 'Serviço não informado'
      acc[serviceName] = (acc[serviceName] || 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  const receitaPorBarbeiro = Object.entries(
    concluidos.reduce((acc: Record<string, number>, item) => {
      const barberName = item.barber || 'Barbeiro não informado'
      acc[barberName] = (acc[barberName] || 0) + getAppointmentPrice(item)
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  if (loading) {
    return (
      <main className={`kb-light-root kb-reports-page min-h-screen p-6 ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#020617] text-white'}`}>
        <div className="max-w-7xl mx-auto">
          <div className={isLight ? 'bg-white border border-slate-200 rounded-3xl p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]' : 'bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6'}>
            <p className="text-zinc-400">Carregando relatórios...</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className={`kb-light-root kb-reports-page min-h-screen p-6 ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#020617] text-white'}`}>
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm mb-3">
              <BarChart3 size={16} />
              Análise de desempenho
            </div>

            {isPremium && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800/70 border border-zinc-700 text-zinc-300 text-sm mb-3 ml-0 sm:ml-2">
                {activeUnitId === 'all' ? 'Todas as unidades' : selectedUnit?.name || 'Unidade selecionada'}
              </div>
            )}

            <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>

            <p className="text-zinc-400 mt-2">
              Dados filtrados da barbearia atual
              {isPremium && activeUnitId !== 'all' ? ` · ${selectedUnit?.name || 'Unidade selecionada'}` : ''}.
            </p>
          </div>

          <div className={isLight ? 'bg-white border border-slate-200 rounded-2xl p-2 flex flex-wrap gap-2 shadow-[0_10px_24px_rgba(15,23,42,0.06)]' : 'bg-zinc-900/80 border border-zinc-800 rounded-2xl p-2 flex flex-wrap gap-2'}>
            <div className="hidden sm:flex items-center px-2 text-zinc-400">
              <Filter size={18} />
            </div>

            <FilterButton active={period === 'today'} onClick={() => setPeriod('today')}>
              Hoje
            </FilterButton>

            <FilterButton active={period === '7days'} onClick={() => setPeriod('7days')}>
              7 dias
            </FilterButton>

            <FilterButton active={period === '30days'} onClick={() => setPeriod('30days')}>
              30 dias
            </FilterButton>

            <FilterButton active={period === 'month'} onClick={() => setPeriod('month')}>
              Mês atual
            </FilterButton>

            <FilterButton active={period === 'all'} onClick={() => setPeriod('all')}>
              Tudo
            </FilterButton>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
          <MetricCard title="Faturamento" value={formatCurrency(faturamentoTotal)} icon={DollarSign} />
          <MetricCard title="Agendamentos" value={filteredAppointments.length} icon={CalendarDays} />
          <MetricCard title="Concluídos" value={concluidos.length} icon={CheckCircle2} />
          <MetricCard title="Pendentes" value={pendentes.length} icon={Clock} />
          <MetricCard title="Clientes" value={clientesUnicos} icon={Users} />
          <MetricCard title="Ticket médio" value={formatCurrency(ticketMedio)} icon={BarChart3} />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Panel title="Serviços mais vendidos" icon={Scissors}>
            <div className="space-y-3">
              {servicosMaisVendidos.length === 0 && (
                <EmptyText>Nenhum serviço encontrado nesse período.</EmptyText>
              )}

              {servicosMaisVendidos.map(([servico, total]) => (
                <div key={servico} className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div>
                    <p className="font-medium">{servico}</p>
                    <p className="text-sm text-zinc-500">
                      {total === 1 ? '1 agendamento' : `${total} agendamentos`}
                    </p>
                  </div>

                  <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 text-sm">
                    {total}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Receita por barbeiro" icon={DollarSign}>
            <div className="space-y-3">
              {receitaPorBarbeiro.length === 0 && (
                <EmptyText>Nenhuma receita concluída nesse período.</EmptyText>
              )}

              {receitaPorBarbeiro.map(([barbeiro, total]) => (
                <div key={barbeiro} className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div>
                    <p className="font-medium">{barbeiro}</p>
                    <p className="text-sm text-zinc-500">Receita de atendimentos concluídos</p>
                  </div>

                  <span className="text-emerald-400 font-semibold">
                    {formatCurrency(total)}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className={isLight ? 'bg-white border border-slate-200 rounded-3xl p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]' : 'bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 shadow-2xl shadow-black/20'}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
            <div>
              <h2 className="text-xl font-semibold">Últimos agendamentos</h2>
              <p className="text-sm text-zinc-500 mt-1">
                Listagem baseada no período selecionado.
              </p>
            </div>

            <span className="text-sm text-zinc-500">
              {filteredAppointments.length} registros
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
              <thead>
                <tr className="text-zinc-400 border-b border-zinc-800">
                  <th className="py-3 font-medium">Cliente</th>
                  <th className="font-medium">Serviço</th>
                  <th className="font-medium">Barbeiro</th>
                  <th className="font-medium">Data</th>
                  <th className="font-medium">Horário</th>
                  <th className="font-medium">Valor</th>
                  <th className="font-medium">Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredAppointments.slice(0, 15).map((item) => {
                  const price = getAppointmentPrice(item)

                  return (
                    <tr key={item.id} className="border-b border-zinc-800/70 hover:bg-zinc-800/40 transition">
                      <td className="py-4 font-medium">{item.client_name}</td>
                      <td>{item.service}</td>
                      <td>{item.barber}</td>
                      <td>{formatDate(item.appointment_date)}</td>
                      <td>{formatTime(item.appointment_time)}</td>
                      <td>{formatCurrency(price)}</td>
                      <td>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            isFinished(item.status)
                              ? 'bg-emerald-500/10 text-emerald-300'
                              : 'bg-yellow-500/10 text-yellow-300'
                          }`}
                        >
                          {isFinished(item.status) ? 'Concluído' : item.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {filteredAppointments.length === 0 && (
              <p className="text-zinc-500 py-8 text-center">
                Nenhum agendamento encontrado nesse período.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const { isLight } = useTheme()

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
        active
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
          : isLight
          ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
      }`}
    >
      {children}
    </button>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: string | number
  icon: React.ElementType
}) {
  const { isLight } = useTheme()

  return (
    <div className={isLight ? 'bg-white border border-slate-200 rounded-3xl p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] hover:border-blue-300 transition' : 'bg-zinc-900/80 border border-zinc-800 rounded-3xl p-5 shadow-2xl shadow-black/20 hover:border-blue-500/30 transition'}>
      <div className="flex items-center justify-between">
        <p className={isLight ? 'text-slate-500 text-sm' : 'text-zinc-400 text-sm'}>{title}</p>

        <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
          <Icon size={20} className={isLight ? 'text-blue-600' : 'text-blue-400'} />
        </div>
      </div>

      <h2 className={isLight ? 'text-2xl font-bold mt-4 text-slate-900' : 'text-2xl font-bold mt-4'}>{value}</h2>
    </div>
  )
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  const { isLight } = useTheme()

  return (
    <div className={isLight ? 'bg-white border border-slate-200 rounded-3xl p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]' : 'bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 shadow-2xl shadow-black/20'}>
      <div className="flex items-center justify-between mb-5">
        <h2 className={isLight ? 'text-xl font-semibold text-slate-900' : 'text-xl font-semibold'}>{title}</h2>
        <Icon size={20} className={isLight ? 'text-blue-600' : 'text-blue-400'} />
      </div>

      {children}
    </div>
  )
}

function EmptyText({ children }: { children: React.ReactNode }) {
  const { isLight } = useTheme()

  return <p className={isLight ? 'text-slate-500' : 'text-zinc-500'}>{children}</p>
}
