'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUnit } from '@/lib/unit-context'
import {
  MessageCircle,
  Search,
  Users,
  Clock,
  CalendarDays,
  Scissors,
  Phone,
  AlertTriangle,
  Crown,
} from 'lucide-react'

type Appointment = {
  id: string
  unit_id?: string | null
  client_name: string
  phone: string
  service: string
  barber: string
  appointment_date: string
  appointment_time?: string | null
  status: string
  price?: number | null
  tenant_id: string
}

type Tenant = {
  id: string
  slug: string
  plano?: string | null
  name?: string | null
}

type FilterDays = 30 | 45 | 60 | 90

type InactiveClient = {
  client_name: string
  phone: string
  last_service: string
  last_barber: string
  last_date: string
  days_inactive: number
  total_visits: number
  total_spent: number
}

export default function ClientesInativosPage() {
  const params = useParams()
  const slug = String(params.slug || '')

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [daysFilter, setDaysFilter] = useState<FilterDays>(30)
  const [search, setSearch] = useState('')
  const { selectedUnitId } = useUnit()

  useEffect(() => {
    if (slug) fetchData()
  }, [slug, selectedUnitId])

  async function fetchData() {
    setLoading(true)

    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()

    if (tenantError || !tenantData) {
      setTenant(null)
      setAppointments([])
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

    const { data, error } = await appointmentsQuery.order(
      'appointment_date',
      { ascending: false }
    )

    if (error) {
      console.error('Erro ao buscar clientes inativos:', error)
      setAppointments([])
    } else {
      setAppointments(data || [])
    }

    setLoading(false)
  }

  function isFinished(status: string) {
    return ['finished', 'concluido', 'concluído', 'finalizado', 'done'].includes(
      (status || '').toLowerCase()
    )
  }

  function formatDate(date: string) {
    if (!date) return '-'
    return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR')
  }

  function money(value: number) {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  function normalizePhone(phone: string) {
    return (phone || '').replace(/\D/g, '')
  }

  function openWhatsApp(client: InactiveClient) {
    const cleanPhone = normalizePhone(client.phone)

    if (!cleanPhone) {
      alert('Cliente sem telefone cadastrado.')
      return
    }

    const phone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`

    const message = encodeURIComponent(
      `Olá ${client.client_name}, tudo bem? Faz ${client.days_inactive} dias desde seu último atendimento na barbearia. Quer agendar um horário essa semana?`
    )

    window.open(`https://wa.me/${phone}?text=${message}`, '_blank')
  }

  function copyMessage(client: InactiveClient) {
    const message = `Olá ${client.client_name}, tudo bem? Faz ${client.days_inactive} dias desde seu último atendimento na barbearia. Quer agendar um horário essa semana?`

    navigator.clipboard.writeText(message)
    alert('Mensagem copiada.')
  }

  const isPremium = tenant?.plano?.toLowerCase() === 'premium'

  const inactiveClients = useMemo(() => {
    const finishedAppointments = appointments.filter((item) =>
      isFinished(item.status)
    )

    const map = new Map<string, InactiveClient>()

    finishedAppointments.forEach((item) => {
      const key = normalizePhone(item.phone) || item.client_name.trim().toLowerCase()
      const current = map.get(key)

      const itemDate = new Date(`${item.appointment_date}T00:00:00`)
      const currentDate = current
        ? new Date(`${current.last_date}T00:00:00`)
        : null

      if (!current || itemDate > currentDate!) {
        map.set(key, {
          client_name: item.client_name || 'Cliente sem nome',
          phone: item.phone || '',
          last_service: item.service || 'Não informado',
          last_barber: item.barber || 'Não informado',
          last_date: item.appointment_date,
          days_inactive: 0,
          total_visits: 1,
          total_spent: Number(item.price || 0),
        })
      } else {
        map.set(key, {
          ...current,
          total_visits: current.total_visits + 1,
          total_spent: current.total_spent + Number(item.price || 0),
        })
      }
    })

    const today = new Date()

    return Array.from(map.values())
      .map((client) => {
        const lastDate = new Date(`${client.last_date}T00:00:00`)
        const days = Math.floor(
          (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        )

        return {
          ...client,
          days_inactive: days,
        }
      })
      .filter((client) => client.days_inactive >= daysFilter)
      .sort((a, b) => b.days_inactive - a.days_inactive)
  }, [appointments, daysFilter])

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return inactiveClients

    return inactiveClients.filter((client) =>
      [
        client.client_name,
        client.phone,
        client.last_service,
        client.last_barber,
      ]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(term))
    )
  }, [inactiveClients, search])

  const totalPotentialClients = inactiveClients.length
  const clientsWithPhone = inactiveClients.filter((client) => client.phone).length
  const totalHistoricalRevenue = inactiveClients.reduce(
    (sum, client) => sum + client.total_spent,
    0
  )

  if (loading) {
    return (
      <main className="inactive-page">
        <style>{css}</style>
        <p className="loading-text">Carregando clientes inativos...</p>
      </main>
    )
  }

  if (!isPremium) {
    return (
      <main className="inactive-page">
        <style>{css}</style>

        <div className="locked-card">
          <div className="locked-icon">
            <Crown size={28} />
          </div>

          <h1>Clientes Inativos Premium</h1>

          <p>
            Este recurso identifica clientes que não retornam há 30, 45, 60 ou
            90 dias e permite acionar cada um pelo WhatsApp.
          </p>

          <button>Fazer upgrade</button>
        </div>
      </main>
    )
  }

  return (
    <main className="inactive-page">
      <style>{css}</style>

      <div className="inactive-wrap">
        <header className="page-header">
          <div>
            <div className="premium-pill">
              <Crown size={15} />
              Premium
            </div>

            <h1>Clientes Inativos</h1>

            <p>
              Recupere clientes que pararam de voltar e gere novos agendamentos
              {selectedUnitId !== 'all' ? ' na unidade selecionada.' : ' em todas as unidades.'}
            </p>
          </div>

          <div className="search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar cliente, telefone, serviço ou barbeiro..."
            />
          </div>
        </header>

        <section className="stats-grid">
          <StatCard
            icon={Users}
            label="Clientes inativos"
            value={totalPotentialClients}
            color="#3b82f6"
          />

          <StatCard
            icon={Phone}
            label="Com telefone"
            value={clientsWithPhone}
            color="#22c55e"
          />

          <StatCard
            icon={Clock}
            label="Filtro atual"
            value={`${daysFilter}+ dias`}
            color="#f59e0b"
          />

          <StatCard
            icon={DollarSignIcon}
            label="Receita histórica"
            value={money(totalHistoricalRevenue)}
            color="#8b5cf6"
          />
        </section>

        <section className="filter-card">
          <div>
            <h2>Filtro de inatividade</h2>
            <p>Selecione há quantos dias o cliente não retorna.</p>
          </div>

          <div className="filter-buttons">
            {[30, 45, 60, 90].map((days) => (
              <button
                key={days}
                onClick={() => setDaysFilter(days as FilterDays)}
                className={daysFilter === days ? 'active' : ''}
              >
                {days}+ dias
              </button>
            ))}
          </div>
        </section>

        <section className="clients-card">
          <div className="clients-head">
            <div>
              <h2>Lista de clientes</h2>
              <p>{filteredClients.length} cliente(s) encontrado(s)</p>
            </div>

            <div className="hint">
              <AlertTriangle size={16} />
              Clientes sem telefone não podem ser acionados direto no WhatsApp.
            </div>
          </div>

          {filteredClients.length === 0 ? (
            <div className="empty">
              <MessageCircle size={38} />
              <h3>Nenhum cliente inativo encontrado</h3>
              <p>Altere o filtro ou aguarde novos dados de atendimento.</p>
            </div>
          ) : (
            <div className="clients-list">
              {filteredClients.map((client) => (
                <article
                  key={`${client.client_name}-${client.phone}-${client.last_date}`}
                  className="client-row"
                >
                  <div className="client-avatar">
                    {client.client_name.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="client-main">
                    <h3>{client.client_name}</h3>

                    <div className="client-meta">
                      <span>
                        <Phone size={14} />
                        {client.phone || 'Sem telefone'}
                      </span>

                      <span>
                        <CalendarDays size={14} />
                        Último atendimento: {formatDate(client.last_date)}
                      </span>

                      <span>
                        <Scissors size={14} />
                        {client.last_service}
                      </span>
                    </div>
                  </div>

                  <div className="client-numbers">
                    <strong>{client.days_inactive} dias</strong>
                    <span>sem retornar</span>
                  </div>

                  <div className="client-numbers">
                    <strong>{client.total_visits}</strong>
                    <span>visitas</span>
                  </div>

                  <div className="client-numbers">
                    <strong>{money(client.total_spent)}</strong>
                    <span>histórico</span>
                  </div>

                  <div className="client-actions">
                    <button
                      onClick={() => openWhatsApp(client)}
                      disabled={!client.phone}
                      className="whatsapp-btn"
                    >
                      <MessageCircle size={16} />
                      WhatsApp
                    </button>

                    <button
                      onClick={() => copyMessage(client)}
                      className="copy-btn"
                    >
                      Copiar msg
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ color, background: `${color}18` }}>
        <Icon size={22} />
      </div>

      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function DollarSignIcon({ size = 22 }: { size?: number }) {
  return <span style={{ fontSize: size }}>R$</span>
}

const css = `
.inactive-page {
  min-height: 100vh;
  color: #f8fafc;
  font-family: Inter, DM Sans, Segoe UI, sans-serif;
}

.inactive-wrap {
  max-width: 1380px;
  margin: 0 auto;
  padding: 22px;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 22px;
}

.premium-pill {
  width: max-content;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px;
  border-radius: 999px;
  color: #93c5fd;
  background: rgba(37,99,235,.12);
  border: 1px solid rgba(59,130,246,.24);
  font-size: 12px;
  font-weight: 900;
  margin-bottom: 12px;
}

.page-header h1 {
  margin: 0;
  font-size: 34px;
  letter-spacing: -.05em;
  font-weight: 950;
}

.page-header p {
  margin: 7px 0 0;
  color: #94a3b8;
}

.search-box {
  width: min(520px, 100%);
  min-height: 50px;
  padding: 0 16px;
  border-radius: 17px;
  border: 1px solid rgba(148,163,184,.13);
  background: rgba(15,23,42,.78);
  display: flex;
  align-items: center;
  gap: 11px;
  color: #94a3b8;
}

.search-box input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: #f8fafc;
  font-size: 14px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.stat-card,
.filter-card,
.clients-card,
.locked-card {
  background:
    radial-gradient(circle at top right, rgba(37,99,235,.12), transparent 34%),
    linear-gradient(145deg, rgba(15,23,42,.94), rgba(8,13,28,.98));
  border: 1px solid rgba(148,163,184,.12);
  box-shadow: 0 24px 70px rgba(0,0,0,.22);
}

.stat-card {
  min-height: 132px;
  border-radius: 22px;
  padding: 19px;
}

.stat-icon {
  width: 46px;
  height: 46px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  margin-bottom: 16px;
}

.stat-card span {
  display: block;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 800;
}

.stat-card strong {
  display: block;
  margin-top: 6px;
  font-size: 26px;
  font-weight: 950;
  letter-spacing: -.04em;
}

.filter-card {
  border-radius: 22px;
  padding: 18px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.filter-card h2,
.clients-card h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 950;
}

.filter-card p,
.clients-head p {
  margin: 6px 0 0;
  color: #94a3b8;
  font-size: 13px;
}

.filter-buttons {
  display: flex;
  gap: 8px;
  padding: 6px;
  border-radius: 16px;
  background: rgba(2,6,23,.45);
  border: 1px solid rgba(148,163,184,.08);
}

.filter-buttons button {
  border: 0;
  border-radius: 12px;
  padding: 10px 16px;
  background: transparent;
  color: #94a3b8;
  font-weight: 900;
  cursor: pointer;
}

.filter-buttons button.active {
  color: white;
  background: linear-gradient(135deg,#2563eb,#1d4ed8);
  box-shadow: 0 12px 28px rgba(37,99,235,.24);
}

.clients-card {
  border-radius: 24px;
  padding: 20px;
}

.clients-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
  margin-bottom: 16px;
}

.hint {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #fbbf24;
  background: rgba(245,158,11,.08);
  border: 1px solid rgba(245,158,11,.2);
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 800;
}

.clients-list {
  display: grid;
  gap: 12px;
}

.client-row {
  display: grid;
  grid-template-columns: 52px 1fr 95px 82px 120px 190px;
  align-items: center;
  gap: 14px;
  padding: 15px;
  border-radius: 18px;
  background: rgba(15,23,42,.55);
  border: 1px solid rgba(148,163,184,.08);
}

.client-avatar {
  width: 52px;
  height: 52px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  color: #93c5fd;
  background: rgba(59,130,246,.16);
  border: 1px solid rgba(59,130,246,.26);
  font-weight: 950;
}

.client-main {
  min-width: 0;
}

.client-main h3 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 950;
}

.client-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  color: #94a3b8;
  font-size: 12px;
}

.client-meta span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.client-numbers {
  text-align: right;
}

.client-numbers strong {
  display: block;
  font-size: 16px;
  color: #f8fafc;
}

.client-numbers span {
  display: block;
  color: #94a3b8;
  font-size: 11px;
  margin-top: 3px;
}

.client-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.client-actions button {
  min-height: 39px;
  border-radius: 12px;
  padding: 0 12px;
  font-weight: 900;
  cursor: pointer;
}

.whatsapp-btn {
  border: 1px solid rgba(34,197,94,.24);
  background: rgba(34,197,94,.08);
  color: #86efac;
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.whatsapp-btn:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.copy-btn {
  border: 1px solid rgba(148,163,184,.13);
  background: rgba(15,23,42,.8);
  color: #cbd5e1;
}

.empty {
  min-height: 280px;
  display: grid;
  place-items: center;
  text-align: center;
  color: #94a3b8;
}

.empty h3 {
  margin: 12px 0 4px;
  color: #f8fafc;
}

.empty p {
  margin: 0;
}

.locked-card {
  max-width: 760px;
  margin: 60px auto;
  border-radius: 24px;
  padding: 34px;
}

.locked-icon {
  width: 58px;
  height: 58px;
  border-radius: 18px;
  background: rgba(245,158,11,.12);
  color: #facc15;
  display: grid;
  place-items: center;
  margin-bottom: 18px;
}

.locked-card h1 {
  margin: 0;
  font-size: 30px;
}

.locked-card p {
  color: #94a3b8;
  line-height: 1.6;
}

.locked-card button {
  border: 0;
  border-radius: 14px;
  padding: 13px 18px;
  background: #2563eb;
  color: white;
  font-weight: 900;
}

.loading-text {
  padding: 30px;
  color: #94a3b8;
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .client-row {
    grid-template-columns: 52px 1fr;
  }

  .client-numbers {
    text-align: left;
  }

  .client-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 768px) {
  .inactive-wrap {
    padding: 16px;
  }

  .page-header,
  .filter-card,
  .clients-head {
    flex-direction: column;
    align-items: stretch;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .filter-buttons {
    flex-wrap: wrap;
  }

  .filter-buttons button {
    flex: 1;
  }

  .client-row {
    grid-template-columns: 1fr;
  }

  .client-avatar {
    width: 48px;
    height: 48px;
  }

  .client-actions {
    flex-direction: column;
  }

  .client-actions button {
    width: 100%;
    justify-content: center;
  }
}
`