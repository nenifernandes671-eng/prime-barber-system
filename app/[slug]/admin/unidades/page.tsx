'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantId } from '@/lib/useTenantId'
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Phone,
  DollarSign,
  CalendarDays,
  Scissors,
  Power,
  RotateCcw,
  Pencil,
  X,
} from 'lucide-react'

type Unit = {
  id: string
  tenant_id: string
  name: string
  slug?: string | null
  address?: string | null
  phone?: string | null
  active: boolean
  created_at: string
}

type Appointment = {
  id: string
  tenant_id: string
  unit_id?: string | null
  barber?: string | null
  appointment_date: string
  status?: string | null
  price?: number | null
}

type Barber = {
  id: string
  tenant_id: string
  unit_id?: string | null
  ativo?: boolean | null
}

type FinancialEntry = {
  id: string
  tenant_id: string
  unit_id?: string | null
  type: 'entrada' | 'despesa'
  amount: number
  entry_date: string
}

type ModalState = 'closed' | 'create' | 'edit' | 'toggle'

export default function UnidadesPage() {
  const tenantId = useTenantId()

  const [units, setUnits] = useState<Unit[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [financialEntries, setFinancialEntries] = useState<FinancialEntry[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>('closed')
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (tenantId) fetchData()
  }, [tenantId])

  async function fetchData() {
    if (!tenantId) return

    setLoading(true)

    const [
      { data: unitsData, error: unitsError },
      { data: appointmentsData },
      { data: barbersData },
      { data: entriesData },
    ] = await Promise.all([
      supabase
        .from('units')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true }),

      supabase
        .from('appointments')
        .select('id, tenant_id, unit_id, barber, appointment_date, status, price')
        .eq('tenant_id', tenantId),

      supabase
        .from('barbeiros')
        .select('id, tenant_id, unit_id, ativo')
        .eq('tenant_id', tenantId),

      supabase
        .from('financial_entries')
        .select('id, tenant_id, unit_id, type, amount, entry_date')
        .eq('tenant_id', tenantId),
    ])

    if (unitsError) {
      console.error('Erro ao buscar unidades:', unitsError)
      setUnits([])
    } else {
      setUnits((unitsData || []) as Unit[])
    }

    setAppointments((appointmentsData || []) as Appointment[])
    setBarbers((barbersData || []) as Barber[])
    setFinancialEntries((entriesData || []) as FinancialEntry[])
    setLoading(false)
  }

  function resetForm() {
    setName('')
    setSlug('')
    setAddress('')
    setPhone('')
    setSelectedUnit(null)
    setFeedback(null)
  }

  function openCreate() {
    resetForm()
    setModal('create')
  }

  function openEdit(unit: Unit) {
    setSelectedUnit(unit)
    setName(unit.name || '')
    setSlug(unit.slug || '')
    setAddress(unit.address || '')
    setPhone(unit.phone || '')
    setFeedback(null)
    setModal('edit')
  }

  function openToggle(unit: Unit) {
    setSelectedUnit(unit)
    setModal('toggle')
  }

  function slugify(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  function isFinished(status?: string | null) {
    return ['finished', 'completed', 'concluido', 'concluído', 'finalizado', 'done'].includes(
      (status || '').toLowerCase()
    )
  }

  function money(value: number) {
    return Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  function getMonthRange() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)

    return { start, end }
  }

  function getUnitStats(unit: Unit) {
    const { start, end } = getMonthRange()

    const unitAppointments = appointments.filter((appointment) => {
      const date = new Date(`${appointment.appointment_date}T00:00:00`)
      return appointment.unit_id === unit.id && date >= start && date <= end
    })

    const finishedAppointments = unitAppointments.filter((item) =>
      isFinished(item.status)
    )

    const appointmentRevenue = finishedAppointments.reduce(
      (sum, item) => sum + Number(item.price || 0),
      0
    )

    const unitEntries = financialEntries.filter((entry) => {
      const date = new Date(`${entry.entry_date}T00:00:00`)
      return entry.unit_id === unit.id && date >= start && date <= end
    })

    const manualIncome = unitEntries
      .filter((entry) => entry.type === 'entrada')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)

    const expenses = unitEntries
      .filter((entry) => entry.type === 'despesa')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)

    const revenue = appointmentRevenue + manualIncome
    const profit = revenue - expenses

    const unitBarbers = barbers.filter(
      (barber) => barber.unit_id === unit.id && barber.ativo !== false
    )

    return {
      appointments: unitAppointments.length,
      revenue,
      expenses,
      profit,
      barbers: unitBarbers.length,
    }
  }

  async function saveUnit() {
    if (!tenantId) return

    if (!name.trim()) {
      setFeedback({ type: 'error', msg: 'Informe o nome da unidade.' })
      return
    }

    setSubmitting(true)
    setFeedback(null)

    const payload = {
      tenant_id: tenantId,
      name: name.trim(),
      slug: slug.trim() || slugify(name),
      address: address.trim() || null,
      phone: phone.trim() || null,
    }

    const result =
      modal === 'edit' && selectedUnit
        ? await supabase
            .from('units')
            .update(payload)
            .eq('id', selectedUnit.id)
            .eq('tenant_id', tenantId)
        : await supabase.from('units').insert(payload)

    setSubmitting(false)

    if (result.error) {
      setFeedback({ type: 'error', msg: result.error.message })
      return
    }

    setFeedback({
      type: 'success',
      msg: modal === 'edit' ? 'Unidade atualizada.' : 'Unidade criada.',
    })

    setModal('closed')
    resetForm()
    await fetchData()
  }

  async function toggleUnit() {
    if (!selectedUnit || !tenantId) return

    setSubmitting(true)

    const { error } = await supabase
      .from('units')
      .update({ active: !selectedUnit.active })
      .eq('id', selectedUnit.id)
      .eq('tenant_id', tenantId)

    setSubmitting(false)

    if (error) {
      setFeedback({ type: 'error', msg: error.message })
      return
    }

    setFeedback({
      type: 'success',
      msg: selectedUnit.active ? 'Unidade desativada.' : 'Unidade reativada.',
    })

    setModal('closed')
    setSelectedUnit(null)
    await fetchData()
  }

  const filteredUnits = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return units

    return units.filter((unit) =>
      [unit.name, unit.slug, unit.address, unit.phone]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    )
  }, [units, search])

  const totals = units.reduce(
    (acc, unit) => {
      const stats = getUnitStats(unit)
      acc.revenue += stats.revenue
      acc.expenses += stats.expenses
      acc.profit += stats.profit
      acc.appointments += stats.appointments
      return acc
    },
    { revenue: 0, expenses: 0, profit: 0, appointments: 0 }
  )

  return (
    <main className="units-page">
      <style>{css}</style>

      <div className="topbar">
        <div className="search-box">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar unidade, slug, endereço ou telefone..."
          />
        </div>

        <button onClick={openCreate} className="create-btn">
          <Plus size={18} />
          Nova unidade
        </button>
      </div>

      <section className="hero">
        <div className="hero-icon">
          <Building2 size={30} />
        </div>

        <div>
          <p className="eyebrow">Premium</p>
          <h1>Unidades</h1>
          <span>Gerencie filiais, equipes e desempenho por unidade.</span>
        </div>
      </section>

      {feedback && (
        <div className={`feedback ${feedback.type}`}>
          <span>{feedback.type === 'success' ? '✅' : '⚠️'}</span>
          <p>{feedback.msg}</p>
          <button onClick={() => setFeedback(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      <section className="stats-grid">
        <StatCard icon={<Building2 size={22} />} label="Unidades" value={units.length} color="#3b82f6" />
        <StatCard icon={<DollarSign size={22} />} label="Receita do mês" value={money(totals.revenue)} color="#22c55e" />
        <StatCard icon={<CalendarDays size={22} />} label="Agendamentos" value={totals.appointments} color="#8b5cf6" />
        <StatCard icon={<Scissors size={22} />} label="Barbeiros ativos" value={barbers.filter((b) => b.ativo !== false).length} color="#f59e0b" />
      </section>

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          <p>Carregando unidades...</p>
        </div>
      ) : filteredUnits.length === 0 ? (
        <div className="empty">
          <Building2 size={42} />
          <h3>Nenhuma unidade encontrada</h3>
          <p>Cadastre uma nova unidade para começar a separar os dados da rede.</p>
          <button onClick={openCreate}>Criar unidade</button>
        </div>
      ) : (
        <section className="units-grid">
          {filteredUnits.map((unit) => {
            const stats = getUnitStats(unit)

            return (
              <article key={unit.id} className={`unit-card ${!unit.active ? 'inactive' : ''}`}>
                <div className="unit-top">
                  <div className="unit-icon">
                    <Building2 size={24} />
                  </div>

                  <span className={`status ${unit.active ? 'active' : 'inactive'}`}>
                    {unit.active ? 'Ativa' : 'Inativa'}
                  </span>
                </div>

                <div className="unit-info">
                  <h3>{unit.name}</h3>

                  <p>
                    <MapPin size={14} />
                    {unit.address || 'Endereço não informado'}
                  </p>

                  <p>
                    <Phone size={14} />
                    {unit.phone || 'Telefone não informado'}
                  </p>
                </div>

                <div className="unit-stats">
                  <div>
                    <small>Receita</small>
                    <strong>{money(stats.revenue)}</strong>
                  </div>

                  <div>
                    <small>Lucro</small>
                    <strong>{money(stats.profit)}</strong>
                  </div>

                  <div>
                    <small>Agendamentos</small>
                    <strong>{stats.appointments}</strong>
                  </div>

                  <div>
                    <small>Barbeiros</small>
                    <strong>{stats.barbers}</strong>
                  </div>
                </div>

                <div className="unit-actions">
                  <button onClick={() => openEdit(unit)} className="edit-btn">
                    <Pencil size={15} />
                    Editar
                  </button>

                  <button
                    onClick={() => openToggle(unit)}
                    className={unit.active ? 'deactivate-btn' : 'activate-btn'}
                  >
                    {unit.active ? <Power size={15} /> : <RotateCcw size={15} />}
                    {unit.active ? 'Desativar' : 'Reativar'}
                  </button>
                </div>
              </article>
            )
          })}
        </section>
      )}

      {(modal === 'create' || modal === 'edit') && (
        <Overlay onClose={() => setModal('closed')}>
          <div className="modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">{modal === 'edit' ? 'Editar unidade' : 'Nova unidade'}</p>
                <h2>{modal === 'edit' ? 'Atualizar unidade' : 'Criar unidade'}</h2>
              </div>

              <button onClick={() => setModal('closed')} className="icon-close">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <Field label="Nome da unidade" icon="🏪">
                <input
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    if (modal === 'create') setSlug(slugify(event.target.value))
                  }}
                  placeholder="Ex: Unidade Centro"
                />
              </Field>

              <Field label="Slug da unidade" icon="🔗">
                <input
                  value={slug}
                  onChange={(event) => setSlug(slugify(event.target.value))}
                  placeholder="unidade-centro"
                />
              </Field>

              <Field label="Endereço" icon="📍">
                <input
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Rua, número, bairro"
                />
              </Field>

              <Field label="Telefone / WhatsApp" icon="📱">
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="(47) 99999-9999"
                />
              </Field>

              <div className="modal-hint">
                No próximo passo, cada agendamento, barbeiro, serviço e lançamento financeiro poderá ser vinculado a uma unidade.
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setModal('closed')} className="cancel-btn">Cancelar</button>
              <button onClick={saveUnit} disabled={submitting} className="confirm-btn">
                {submitting ? 'Salvando...' : modal === 'edit' ? 'Salvar unidade' : 'Criar unidade'}
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {modal === 'toggle' && selectedUnit && (
        <Overlay onClose={() => setModal('closed')}>
          <div className="modal small">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Confirmação</p>
                <h2>{selectedUnit.active ? 'Desativar unidade?' : 'Reativar unidade?'}</h2>
              </div>

              <button onClick={() => setModal('closed')} className="icon-close">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p className="confirm-text">
                {selectedUnit.active
                  ? `A unidade ${selectedUnit.name} deixará de aparecer como ativa.`
                  : `A unidade ${selectedUnit.name} voltará a ficar ativa.`}
              </p>
            </div>

            <div className="modal-footer">
              <button onClick={() => setModal('closed')} className="cancel-btn">Cancelar</button>
              <button onClick={toggleUnit} disabled={submitting} className={selectedUnit.active ? 'danger-btn' : 'confirm-btn'}>
                {submitting ? 'Salvando...' : selectedUnit.active ? 'Desativar' : 'Reativar'}
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </main>
  )
}

function Field({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{icon} {label}</label>
      {children}
    </div>
  )
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      {children}
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
  value: string | number
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

const css = `
.units-page {
  min-height: 100vh;
  color: #f8fafc;
  font-family: 'Inter', 'DM Sans', 'Segoe UI', sans-serif;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  margin-bottom: 28px;
}

.search-box {
  width: min(520px, 100%);
  height: 50px;
  border-radius: 17px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: rgba(15, 23, 42, .76);
  border: 1px solid rgba(148, 163, 184, .12);
  color: #94a3b8;
}

.search-box input {
  width: 100%;
  background: transparent;
  border: 0;
  outline: 0;
  color: #f8fafc;
  font-size: 14px;
}

.create-btn {
  height: 50px;
  border: 0;
  border-radius: 16px;
  padding: 0 18px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  color: white;
  font-size: 14px;
  font-weight: 900;
  box-shadow: 0 18px 34px rgba(37,99,235,.24);
}

.hero {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 22px;
}

.hero-icon,
.unit-icon {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
  color: #fff;
  box-shadow: 0 18px 42px rgba(37,99,235,.25);
}

.unit-icon {
  width: 52px;
  height: 52px;
  border-radius: 17px;
}

.eyebrow {
  margin: 0 0 5px;
  color: #93c5fd;
  text-transform: uppercase;
  letter-spacing: .16em;
  font-size: 12px;
  font-weight: 950;
}

.hero h1 {
  margin: 0;
  font-size: 42px;
  line-height: 1;
  letter-spacing: -0.06em;
  font-weight: 950;
}

.hero span {
  display: block;
  margin-top: 7px;
  color: #94a3b8;
  font-size: 15px;
}

.feedback {
  margin-bottom: 18px;
  padding: 13px 16px;
  border-radius: 15px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.feedback p {
  margin: 0;
  flex: 1;
  font-size: 14px;
  font-weight: 700;
}

.feedback button {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.feedback.success {
  background: rgba(16,185,129,.10);
  border: 1px solid rgba(16,185,129,.24);
  color: #6ee7b7;
}

.feedback.error {
  background: rgba(239,68,68,.10);
  border: 1px solid rgba(239,68,68,.24);
  color: #fca5a5;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}

.stat-card {
  position: relative;
  overflow: hidden;
  padding: 18px;
  min-height: 116px;
  border-radius: 22px;
  background:
    radial-gradient(circle at top right, rgba(59,130,246,.12), transparent 35%),
    linear-gradient(145deg, rgba(15,23,42,.94), rgba(8,13,28,.97));
  border: 1px solid rgba(148,163,184,.12);
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
  font-size: 25px;
  font-weight: 950;
  letter-spacing: -0.04em;
}

.units-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.unit-card {
  min-height: 340px;
  border-radius: 24px;
  padding: 22px;
  background:
    radial-gradient(circle at top right, rgba(37,99,235,.13), transparent 32%),
    linear-gradient(145deg, rgba(15,23,42,.95), rgba(8,13,28,.97));
  border: 1px solid rgba(148,163,184,.13);
  box-shadow: 0 28px 70px rgba(0,0,0,.22);
  transition: .18s ease;
}

.unit-card:hover {
  transform: translateY(-3px);
  border-color: rgba(59,130,246,.34);
}

.unit-card.inactive {
  opacity: .58;
}

.unit-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.status {
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 950;
}

.status.active {
  background: rgba(16,185,129,.14);
  color: #34d399;
}

.status.inactive {
  background: rgba(148,163,184,.14);
  color: #94a3b8;
}

.unit-info {
  margin-top: 20px;
  display: grid;
  gap: 9px;
}

.unit-info h3 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 950;
  letter-spacing: -0.03em;
}

.unit-info p {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #94a3b8;
  font-size: 13px;
}

.unit-info svg {
  color: #93c5fd;
  flex-shrink: 0;
}

.unit-stats {
  margin-top: 18px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(2,6,23,.34);
  border: 1px solid rgba(148,163,184,.10);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.unit-stats small {
  display: block;
  color: #64748b;
  font-size: 11px;
  font-weight: 850;
  margin-bottom: 4px;
}

.unit-stats strong {
  display: block;
  color: #f8fafc;
  font-size: 14px;
  font-weight: 950;
}

.unit-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.unit-actions button {
  flex: 1;
  min-height: 42px;
  border-radius: 13px;
  border: 1px solid rgba(148,163,184,.14);
  background: rgba(15,23,42,.78);
  color: #f8fafc;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
}

.unit-actions .edit-btn {
  color: #93c5fd;
}

.unit-actions .deactivate-btn {
  color: #f87171;
  border-color: rgba(239,68,68,.26);
}

.unit-actions .activate-btn {
  color: #34d399;
  border-color: rgba(16,185,129,.26);
}

.loading,
.empty {
  min-height: 320px;
  border-radius: 24px;
  display: grid;
  place-items: center;
  text-align: center;
  background: rgba(15,23,42,.62);
  border: 1px solid rgba(148,163,184,.10);
  color: #94a3b8;
}

.spinner {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 3px solid #1e293b;
  border-top-color: #3b82f6;
  animation: spin .8s linear infinite;
  margin: 0 auto 14px;
}

.empty h3 {
  margin: 14px 0 6px;
  color: #f8fafc;
  font-size: 20px;
}

.empty p {
  margin: 0 0 18px;
}

.empty button {
  border: 0;
  border-radius: 14px;
  padding: 12px 18px;
  background: linear-gradient(135deg,#2563eb,#4f46e5);
  color: white;
  font-weight: 900;
  cursor: pointer;
}

.overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,.68);
  backdrop-filter: blur(8px);
}

.modal {
  width: 100%;
  max-width: 520px;
  border-radius: 24px;
  background:
    radial-gradient(circle at top right, rgba(37,99,235,.18), transparent 36%),
    linear-gradient(145deg, rgba(15,23,42,.98), rgba(8,13,28,.99));
  border: 1px solid rgba(148,163,184,.14);
  box-shadow: 0 30px 90px rgba(0,0,0,.55);
}

.modal.small {
  max-width: 420px;
}

.modal-head {
  padding: 24px 26px 0;
  display: flex;
  justify-content: space-between;
  gap: 14px;
}

.modal-head h2 {
  margin: 0;
  font-size: 23px;
  font-weight: 950;
  letter-spacing: -0.04em;
}

.icon-close {
  width: 38px;
  height: 38px;
  border-radius: 13px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(148,163,184,.12);
  background: rgba(15,23,42,.82);
  color: #94a3b8;
  cursor: pointer;
}

.modal-body {
  padding: 24px 26px;
  display: grid;
  gap: 16px;
}

.field {
  display: grid;
  gap: 8px;
}

.field label {
  color: #cbd5e1;
  font-size: 13px;
  font-weight: 850;
}

.field input {
  width: 100%;
  min-height: 46px;
  border-radius: 14px;
  border: 1px solid rgba(148,163,184,.14);
  background: rgba(2,6,23,.54);
  outline: 0;
  color: #f8fafc;
  padding: 0 14px;
  font-size: 14px;
}

.modal-hint {
  border-radius: 16px;
  padding: 13px 14px;
  border: 1px solid rgba(59,130,246,.20);
  background: rgba(37,99,235,.08);
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.55;
}

.confirm-text {
  margin: 0;
  color: #cbd5e1;
  line-height: 1.6;
}

.modal-footer {
  padding: 0 26px 26px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.cancel-btn,
.confirm-btn,
.danger-btn {
  min-height: 44px;
  border-radius: 14px;
  padding: 0 18px;
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
}

.cancel-btn {
  border: 1px solid rgba(148,163,184,.16);
  background: transparent;
  color: #94a3b8;
}

.confirm-btn {
  border: 0;
  background: linear-gradient(135deg,#2563eb,#4f46e5);
  color: white;
}

.danger-btn {
  border: 0;
  background: linear-gradient(135deg,#dc2626,#ef4444);
  color: white;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 1200px) {
  .units-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .topbar {
    flex-direction: column;
    align-items: stretch;
  }

  .create-btn {
    width: 100%;
    justify-content: center;
  }

  .hero h1 {
    font-size: 34px;
  }

  .hero-icon {
    width: 56px;
    height: 56px;
  }

  .units-grid {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .unit-actions {
    flex-direction: column;
  }

  .modal-footer {
    flex-direction: column;
  }

  .cancel-btn,
  .confirm-btn,
  .danger-btn {
    width: 100%;
  }
}
`