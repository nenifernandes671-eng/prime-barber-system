'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantId } from '@/lib/useTenantId'
import { useTenant } from '@/lib/tenant-context'
import { getMaxBarbers } from '@/lib/permissions'
import {
  calculateBarberCompensation,
  COMPENSATION_LABELS,
  getBarberCompensation,
  type BarberCompensationType,
} from '@/lib/barber-compensation'
import {
  Plus,
  Search,
  Scissors,
  Users,
  UserCheck,
  UserX,
  Mail,
  Phone,
  ShieldCheck,
  KeyRound,
  Power,
  RotateCcw,
  X,
  DollarSign,
  Target,
  Percent,
  TrendingUp,
  Building2,
} from 'lucide-react'

interface Barber {
  id: string
  nome: string
  email: string
  telefone?: string
  ativo: boolean
  created_at: string
  user_id: string
  unit_id?: string | null
  photo_url?: string | null
  avatar_url?: string | null
  image_url?: string | null
  foto_url?: string | null
  compensation_type?: BarberCompensationType | null
  commission_percentage?: number | null
  fixed_salary_amount?: number | null
  chair_rental_amount?: number | null
}

interface BarberAsset {
  nome: string
  avatar_url?: string | null
}

interface Appointment {
  id: string
  client_name?: string | null
  barber?: string | null
  appointment_date: string
  status?: string | null
  price?: number | null
  tenant_id: string
  unit_id?: string | null
}

interface Unit {
  id: string
  tenant_id: string
  name: string
  active: boolean
}

interface CommissionRow {
  id?: string
  tenant_id: string
  name?: string | null
  email?: string | null
  commission_percent?: number | null
  commission_percentage?: number | null
  monthly_goal?: number | null
  commission_type?: string | null
}

interface BarberPerformance {
  compensationType: BarberCompensationType
  commissionPercent: number
  fixedSalaryAmount: number
  chairRentalAmount: number
  monthlyGoal: number
  revenue: number
  appointments: number
  commissionValue: number
  remunerationValue: number
  chairRentalRevenue: number
  progress: number
}

function nameKey(name?: string | null) {
  return (name || '').trim().toLowerCase()
}

type ModalState = 'closed' | 'create' | 'confirm-deactivate' | 'edit-access' | 'edit-performance' | 'edit-unit'

export default function AdminBarbeiros() {
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>('closed')
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [search, setSearch] = useState('')
  const [barberPhotos, setBarberPhotos] = useState<Record<string, string>>({})
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [commissionRows, setCommissionRows] = useState<CommissionRow[]>([])
  const [units, setUnits] = useState<Unit[]>([])

  const tenantId = useTenantId()
  const { tenant, isPremium, isProOrPremium } = useTenant()
  const maxBarbers = getMaxBarbers(tenant?.plano)
  const reachedLimit = barbers.length >= maxBarbers

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [senha, setSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [compensationType, setCompensationType] = useState<BarberCompensationType>('commission')
  const [commissionPercentage, setCommissionPercentage] = useState(50)
  const [fixedSalaryAmount, setFixedSalaryAmount] = useState(0)
  const [chairRentalAmount, setChairRentalAmount] = useState(0)

  const [accessEmail, setAccessEmail] = useState('')
  const [accessPassword, setAccessPassword] = useState('')
  const [showAccessPassword, setShowAccessPassword] = useState(false)

  const [editCommissionPercent, setEditCommissionPercent] = useState(50)
  const [editCompensationType, setEditCompensationType] =
    useState<BarberCompensationType>('commission')
  const [editFixedSalaryAmount, setEditFixedSalaryAmount] = useState(0)
  const [editChairRentalAmount, setEditChairRentalAmount] = useState(0)
  const [editMonthlyGoal, setEditMonthlyGoal] = useState(3000)
  const [editUnitId, setEditUnitId] = useState('')

  useEffect(() => {
    if (tenantId) fetchBarbers()
  }, [tenantId])

  const fetchBarbers = async () => {
    if (!tenantId) return

    setLoading(true)

    const unitsRequest = isPremium
      ? supabase
          .from('units')
          .select('id, tenant_id, name, active')
          .eq('tenant_id', tenantId)
          .eq('active', true)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null })

    const [
      { data, error },
      { data: appointmentsData, error: appointmentsError },
      { data: commissionData, error: commissionError },
      { data: unitsData, error: unitsError },
    ] = await Promise.all([
      supabase
        .from('barbeiros')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),

      supabase
        .from('appointments')
        .select('id, client_name, barber, appointment_date, status, price, tenant_id, unit_id')
        .eq('tenant_id', tenantId),

      supabase
        .from('barbers')
        .select('*')
        .eq('tenant_id', tenantId),

      unitsRequest,
    ])

    if (error) {
      console.error('Erro ao buscar barbeiros:', error)
      setBarbers([])
      setAppointments([])
      setCommissionRows([])
      setUnits([])
      setBarberPhotos({})
      setLoading(false)
      return
    }

    if (appointmentsError) {
      console.error('Erro ao buscar agendamentos dos barbeiros:', appointmentsError)
      setAppointments([])
    } else {
      setAppointments((appointmentsData || []) as Appointment[])
    }

    if (commissionError) {
      console.error('Erro ao buscar metas/comissões dos barbeiros:', commissionError)
      setCommissionRows([])
    } else {
      setCommissionRows((commissionData || []) as CommissionRow[])
    }

    if (unitsError) {
      console.error('Erro ao buscar unidades:', unitsError)
      setUnits([])
    } else {
      setUnits((unitsData || []) as Unit[])
    }

    setBarbers(data ?? [])

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        setBarberPhotos({})
        setLoading(false)
        return
      }

      const response = await fetch(
        `/api/admin/settings-assets?tenant_id=${encodeURIComponent(tenantId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
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
    } catch (error) {
      console.error('Erro ao buscar fotos dos barbeiros:', error)
      setBarberPhotos({})
    }

    setLoading(false)
  }

  const handleCreate = async () => {
    if (!nome.trim() || !email.trim() || !senha.trim()) {
      setFeedback({ type: 'error', msg: 'Nome, e-mail e senha são obrigatórios.' })
      return
    }

    if (senha.length < 6) {
      setFeedback({ type: 'error', msg: 'A senha deve ter ao menos 6 caracteres.' })
      return
    }

    if (reachedLimit) {
      setFeedback({ type: 'error', msg: 'Limite do plano atingido. Faça upgrade para adicionar mais barbeiros.' })
      return
    }

    setSubmitting(true)
    setFeedback(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        setFeedback({ type: 'error', msg: 'Sessão expirada. Entre novamente.' })
        setSubmitting(false)
        return
      }

      const res = await fetch('/api/admin/criar-barbeiro', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim(),
          senha,
          telefone: telefone.trim(),
          tenant_id: tenantId,
          unit_id: isPremium ? selectedUnitId || null : null,
          compensation_type: isProOrPremium ? compensationType : 'commission',
          commission_percentage: isProOrPremium ? commissionPercentage : 50,
          fixed_salary_amount: isProOrPremium ? fixedSalaryAmount : 0,
          chair_rental_amount: isProOrPremium ? chairRentalAmount : 0,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setFeedback({ type: 'error', msg: json.error ?? 'Erro ao criar barbeiro.' })
        setSubmitting(false)
        return
      }

      if (isPremium && selectedUnitId) {
        await supabase
          .from('barbeiros')
          .update({ unit_id: selectedUnitId })
          .eq('tenant_id', tenantId)
          .eq('email', email.trim())
      }

      setFeedback({ type: 'success', msg: `Barbeiro "${nome}" criado com sucesso.` })
      resetForm()
      setModal('closed')
      await fetchBarbers()
    } catch {
      setFeedback({ type: 'error', msg: 'Erro de conexão. Tente novamente.' })
    }

    setSubmitting(false)
  }

  const handleToggleActive = async (barber: Barber) => {
    if (barber.ativo) {
      setSelectedBarber(barber)
      setModal('confirm-deactivate')
      return
    }

    await supabase
      .from('barbeiros')
      .update({ ativo: true })
      .eq('id', barber.id)
      .eq('tenant_id', tenantId)

    setFeedback({ type: 'success', msg: `${barber.nome} reativado.` })
    await fetchBarbers()
  }

  const confirmDeactivate = async () => {
    if (!selectedBarber) return

    setSubmitting(true)

    await supabase
      .from('barbeiros')
      .update({ ativo: false })
      .eq('id', selectedBarber.id)
      .eq('tenant_id', tenantId)

    setFeedback({ type: 'success', msg: `${selectedBarber.nome} desativado.` })
    setModal('closed')
    setSelectedBarber(null)
    setSubmitting(false)
    await fetchBarbers()
  }

  const openEditAccess = (barber: Barber) => {
    setFeedback(null)
    setSelectedBarber(barber)
    setAccessEmail(barber.email || '')
    setAccessPassword('')
    setShowAccessPassword(false)
    setModal('edit-access')
  }

  const handleSaveAccess = async () => {
    if (!selectedBarber || !tenantId) return

    if (!accessEmail.trim()) {
      setFeedback({ type: 'error', msg: 'Informe o e-mail de acesso do barbeiro.' })
      return
    }

    if (accessPassword && accessPassword.length < 6) {
      setFeedback({ type: 'error', msg: 'A nova senha deve ter ao menos 6 caracteres.' })
      return
    }

    setSubmitting(true)
    setFeedback(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        setFeedback({ type: 'error', msg: 'Sessão expirada. Entre novamente.' })
        setSubmitting(false)
        return
      }

      const res = await fetch('/api/admin/atualizar-barbeiro', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          barber_id: selectedBarber.id,
          tenant_id: tenantId,
          email: accessEmail.trim(),
          password: accessPassword,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setFeedback({ type: 'error', msg: json.error ?? 'Erro ao atualizar acesso.' })
        setSubmitting(false)
        return
      }

      setFeedback({ type: 'success', msg: `Acesso de ${selectedBarber.nome} atualizado.` })
      setModal('closed')
      setSelectedBarber(null)
      setAccessPassword('')
      await fetchBarbers()
    } catch {
      setFeedback({ type: 'error', msg: 'Erro de conexão. Tente novamente.' })
    }

    setSubmitting(false)
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

  function getCurrentMonthRange() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)

    return { start, end }
  }

  function getCommissionSettings(barber: Barber) {
    const row = commissionRows.find((item) => {
      const sameEmail =
        item.email &&
        barber.email &&
        item.email.toLowerCase() === barber.email.toLowerCase()

      const sameName =
        item.name &&
        barber.nome &&
        item.name.toLowerCase() === barber.nome.toLowerCase()

      return item.tenant_id === tenantId && (sameEmail || sameName)
    })

    const compensation = getBarberCompensation(barber, row)
    const commissionPercent = Number(
      compensation.commissionPercentage ||
      row?.commission_percent ||
      row?.commission_percentage ||
      50
    )

    const monthlyGoal = Number(row?.monthly_goal ?? 3000)

    return {
      row,
      compensation: {
        ...compensation,
        commissionPercentage: commissionPercent,
      },
      commissionPercent,
      monthlyGoal,
    }
  }

  function getBarberPerformance(barber: Barber): BarberPerformance {
    const { start, end } = getCurrentMonthRange()
    const settings = getCommissionSettings(barber)

    const barberAppointments = appointments.filter((appointment) => {
      if (!appointment.appointment_date) return false

      const sameBarber =
        nameKey(appointment.barber) === nameKey(barber.nome)

      const date = new Date(`${appointment.appointment_date}T00:00:00`)

      return sameBarber && isFinished(appointment.status) && date >= start && date <= end
    })

    const revenue = barberAppointments.reduce(
      (sum, appointment) => sum + Number(appointment.price || 0),
      0
    )

    const compensation = calculateBarberCompensation({
      settings: settings.compensation,
      serviceRevenue: revenue,
      periodStart: start,
      periodEnd: end,
    })
    const progress = settings.monthlyGoal > 0
      ? Math.min(Math.round((revenue / settings.monthlyGoal) * 100), 100)
      : 0

    return {
      compensationType: settings.compensation.type,
      commissionPercent: settings.commissionPercent,
      fixedSalaryAmount: settings.compensation.fixedSalaryAmount,
      chairRentalAmount: settings.compensation.chairRentalAmount,
      monthlyGoal: settings.monthlyGoal,
      revenue,
      appointments: barberAppointments.length,
      commissionValue: compensation.commissionCost,
      remunerationValue: compensation.barberRemuneration,
      chairRentalRevenue: compensation.chairRentalRevenue,
      progress,
    }
  }

  function openEditPerformance(barber: Barber) {
    const settings = getCommissionSettings(barber)

    setFeedback(null)
    setSelectedBarber(barber)
    setEditCompensationType(settings.compensation.type)
    setEditCommissionPercent(settings.commissionPercent)
    setEditFixedSalaryAmount(settings.compensation.fixedSalaryAmount)
    setEditChairRentalAmount(settings.compensation.chairRentalAmount)
    setEditMonthlyGoal(settings.monthlyGoal)
    setModal('edit-performance')
  }

  function getUnitName(unitId?: string | null) {
    if (!unitId) return 'Sem unidade'
    return units.find((unit) => unit.id === unitId)?.name || 'Unidade removida'
  }

  function openEditUnit(barber: Barber) {
    setFeedback(null)
    setSelectedBarber(barber)
    setEditUnitId(barber.unit_id || '')
    setModal('edit-unit')
  }

  async function handleSaveUnit() {
    if (!selectedBarber || !tenantId) return

    setSubmitting(true)
    setFeedback(null)

    const { error } = await supabase
      .from('barbeiros')
      .update({ unit_id: editUnitId || null })
      .eq('id', selectedBarber.id)
      .eq('tenant_id', tenantId)

    setSubmitting(false)

    if (error) {
      setFeedback({ type: 'error', msg: `Erro ao salvar unidade: ${error.message}` })
      return
    }

    setFeedback({ type: 'success', msg: `Unidade de ${selectedBarber.nome} atualizada.` })
    setModal('closed')
    setSelectedBarber(null)
    await fetchBarbers()
  }

  async function handleSavePerformance() {
    if (!selectedBarber || !tenantId) return

    const commission = Number(editCommissionPercent)
    const fixedSalary = Math.max(0, Number(editFixedSalaryAmount))
    const chairRental = Math.max(0, Number(editChairRentalAmount))
    const goal = Number(editMonthlyGoal)

    if (commission < 0 || commission > 100) {
      setFeedback({ type: 'error', msg: 'A comissão precisa estar entre 0% e 100%.' })
      return
    }

    if (goal < 0) {
      setFeedback({ type: 'error', msg: 'A meta mensal não pode ser negativa.' })
      return
    }

    setSubmitting(true)
    setFeedback(null)

    const existing = getCommissionSettings(selectedBarber).row

    const payload = {
      tenant_id: tenantId,
      name: selectedBarber.nome,
      email: selectedBarber.email,
      commission_percent: commission,
      commission_percentage: commission,
      commission_type: 'percentage',
      monthly_goal: goal,
    }

    const result = existing?.id
      ? await supabase
          .from('barbers')
          .update(payload)
          .eq('id', existing.id)
          .eq('tenant_id', tenantId)
      : await supabase
          .from('barbers')
          .insert(payload)

    const canonicalResult = await supabase
      .from('barbeiros')
      .update({
        compensation_type: isProOrPremium ? editCompensationType : 'commission',
        commission_percentage: commission,
        fixed_salary_amount: isProOrPremium ? fixedSalary : 0,
        chair_rental_amount: isProOrPremium ? chairRental : 0,
      })
      .eq('id', selectedBarber.id)
      .eq('tenant_id', tenantId)

    setSubmitting(false)

    if (result.error || canonicalResult.error) {
      setFeedback({
        type: 'error',
        msg: `Erro ao salvar remuneração/meta: ${
          canonicalResult.error?.message || result.error?.message || 'erro desconhecido'
        }`,
      })
      return
    }

    setFeedback({ type: 'success', msg: `Remuneração e meta de ${selectedBarber.nome} atualizadas.` })
    setModal('closed')
    setSelectedBarber(null)
    await fetchBarbers()
  }

  const resetForm = () => {
    setNome('')
    setEmail('')
    setSenha('')
    setTelefone('')
    setShowSenha(false)
    setSelectedUnitId('')
    setCompensationType('commission')
    setCommissionPercentage(50)
    setFixedSalaryAmount(0)
    setChairRentalAmount(0)
    setFeedback(null)
  }

  const openCreate = () => {
    resetForm()
    setModal('create')
  }

  const active = barbers.filter((b) => b.ativo)
  const inactive = barbers.filter((b) => !b.ativo)

  const filteredBarbers = useMemo(() => {
    const s = search.toLowerCase().trim()

    if (!s) return barbers

    return barbers.filter((b) =>
      [b.nome, b.email, b.telefone]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(s))
    )
  }, [barbers, search])

  const totalTeamRevenue = barbers.reduce(
    (sum, barber) => sum + getBarberPerformance(barber).revenue,
    0
  )

  const totalTeamCommission = barbers.reduce(
    (sum, barber) => sum + getBarberPerformance(barber).remunerationValue,
    0
  )

  const averageTeamGoalProgress = barbers.length > 0
    ? Math.round(
        barbers.reduce((sum, barber) => sum + getBarberPerformance(barber).progress, 0) /
          barbers.length
      )
    : 0

  return (
    <div className="barbers-page">
      <style>{css}</style>

      <div className="topbar">
        <div className="search-box">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar barbeiro, e-mail ou telefone..."
          />
        </div>

        <button
          onClick={openCreate}
          disabled={reachedLimit}
          className="create-btn"
          title={reachedLimit ? 'Limite do plano atingido' : 'Adicionar barbeiro'}
        >
          <Plus size={18} />
          Novo barbeiro
        </button>
      </div>

      <section className="hero">
        <div className="hero-icon">
          <Scissors size={30} />
        </div>

        <div>
          <p className="eyebrow">Equipe</p>
          <h1>Barbeiros</h1>
          <span>Gerencie acesso, status e colaboradores da sua barbearia.</span>
        </div>
      </section>

      {reachedLimit && (
        <div className="limit-alert">
          <strong>Limite do plano atingido.</strong>
          <span>Seu plano permite {maxBarbers} barbeiro{maxBarbers !== 1 ? 's' : ''}. Faça upgrade para adicionar mais.</span>
        </div>
      )}

      {feedback && (
        <div className={`feedback ${feedback.type}`}>
          <span>{feedback.type === 'success' ? '✅' : '⚠️'}</span>
          <p>{feedback.msg}</p>
          <button onClick={() => setFeedback(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="stats-grid">
        <StatCard icon={<Users size={22} />} label="Total" value={barbers.length} color="#3b82f6" />
        <StatCard icon={<UserCheck size={22} />} label="Ativos" value={active.length} color="#10b981" />
        <StatCard icon={<DollarSign size={22} />} label="Receita da equipe" value={money(totalTeamRevenue)} color="#22c55e" />
        <StatCard icon={<Target size={22} />} label="Média das metas" value={`${averageTeamGoalProgress}%`} color="#f59e0b" />
        <StatCard icon={<Percent size={22} />} label="Comissões" value={money(totalTeamCommission)} color="#8b5cf6" />
        <StatCard icon={<CrownIcon />} label="Limite do plano" value={`${barbers.length}/${maxBarbers}`} color="#06b6d4" />
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          <p>Carregando barbeiros...</p>
        </div>
      ) : filteredBarbers.length === 0 ? (
        <div className="empty">
          <div>✂️</div>
          <h3>Nenhum barbeiro encontrado</h3>
          <p>{search ? 'Tente buscar por outro nome, e-mail ou telefone.' : 'Cadastre o primeiro barbeiro para começar.'}</p>
          {!search && (
            <button onClick={openCreate} disabled={reachedLimit}>
              Criar primeiro barbeiro
            </button>
          )}
        </div>
      ) : (
        <div className="barbers-grid">
          {filteredBarbers.map((barber) => (
            <BarberCard
              key={barber.id}
              barber={barber}
              avatarUrl={barberPhotos[nameKey(barber.nome)] || null}
              performance={getBarberPerformance(barber)}
              unitName={getUnitName(barber.unit_id)}
              showUnitControls={isPremium}
              onToggle={handleToggleActive}
              onEditAccess={openEditAccess}
              onEditPerformance={openEditPerformance}
              onEditUnit={openEditUnit}
            />
          ))}
        </div>
      )}

      {modal === 'create' && (
        <Overlay onClose={() => setModal('closed')}>
          <div className="modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Novo acesso</p>
                <h2>Novo barbeiro</h2>
              </div>
              <button onClick={() => setModal('closed')} className="icon-close">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <Field label="Nome completo" icon="👤">
                <input placeholder="Ex: João Silva" value={nome} onChange={(e) => setNome(e.target.value)} />
              </Field>

              <Field label="E-mail" icon="✉">
                <input type="email" placeholder="joao@barbearia.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>

              <Field label="Telefone (opcional)" icon="📱">
                <input placeholder="(47) 99999-9999" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              </Field>

              {isPremium && (
                <Field label="Unidade" icon="🏢">
                  <select value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)}>
                    <option value="">Sem unidade definida</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {isProOrPremium && (
                <>
                  <Field label="Tipo de remuneracao" icon="R$">
                    <select
                      value={compensationType}
                      onChange={(e) => setCompensationType(e.target.value as BarberCompensationType)}
                    >
                      {Object.entries(COMPENSATION_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </Field>

                  {(compensationType === 'commission' ||
                    compensationType === 'salary_plus_commission') && (
                    <Field label="Comissao sobre receita (%)" icon="%">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={commissionPercentage}
                        onChange={(e) => setCommissionPercentage(Number(e.target.value))}
                      />
                    </Field>
                  )}

                  {(compensationType === 'fixed_salary' ||
                    compensationType === 'salary_plus_commission') && (
                    <Field label="Salario fixo mensal (R$)" icon="R$">
                      <input
                        type="number"
                        min={0}
                        step={50}
                        value={fixedSalaryAmount}
                        onChange={(e) => setFixedSalaryAmount(Number(e.target.value))}
                      />
                    </Field>
                  )}

                  {compensationType === 'chair_rental' && (
                    <Field label="Aluguel mensal da cadeira (R$)" icon="R$">
                      <input
                        type="number"
                        min={0}
                        step={50}
                        value={chairRentalAmount}
                        onChange={(e) => setChairRentalAmount(Number(e.target.value))}
                      />
                    </Field>
                  )}
                </>
              )}

              <Field label="Senha de acesso" icon="🔒">
                <div className="password-wrap">
                  <input
                    type={showSenha ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowSenha((v) => !v)}>
                    {showSenha ? '🙈' : '👁'}
                  </button>
                </div>
              </Field>

              <div className="modal-hint">
                O barbeiro usará este e-mail e senha para acessar o painel em <strong>/barber/login</strong>.
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setModal('closed')} className="cancel-btn">Cancelar</button>
              <button onClick={handleCreate} disabled={submitting || reachedLimit} className="confirm-btn">
                {submitting ? 'Criando...' : 'Criar barbeiro'}
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {modal === 'confirm-deactivate' && selectedBarber && (
        <Overlay onClose={() => setModal('closed')}>
          <div className="modal small">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Confirmação</p>
                <h2>Desativar barbeiro?</h2>
              </div>
              <button onClick={() => setModal('closed')} className="icon-close">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p className="confirm-text">
                <strong>{selectedBarber.nome}</strong> não conseguirá mais fazer login até ser reativado.
              </p>
              <p className="muted">Os agendamentos dele continuarão registrados normalmente.</p>
            </div>

            <div className="modal-footer">
              <button onClick={() => setModal('closed')} className="cancel-btn">Cancelar</button>
              <button onClick={confirmDeactivate} disabled={submitting} className="danger-btn">
                {submitting ? 'Desativando...' : 'Sim, desativar'}
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {modal === 'edit-access' && selectedBarber && (
        <Overlay onClose={() => setModal('closed')}>
          <div className="modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Segurança</p>
                <h2>Acesso do barbeiro</h2>
              </div>
              <button onClick={() => setModal('closed')} className="icon-close">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p className="confirm-text">
                Atualize o e-mail ou defina uma nova senha para <strong>{selectedBarber.nome}</strong>.
              </p>

              <Field label="E-mail de login" icon="✉">
                <input
                  type="email"
                  placeholder="barbeiro@email.com"
                  value={accessEmail}
                  onChange={(e) => setAccessEmail(e.target.value)}
                />
              </Field>

              <Field label="Nova senha (opcional)" icon="🔒">
                <div className="password-wrap">
                  <input
                    type={showAccessPassword ? 'text' : 'password'}
                    placeholder="Deixe em branco para manter a atual"
                    value={accessPassword}
                    onChange={(e) => setAccessPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowAccessPassword((v) => !v)}>
                    {showAccessPassword ? '🙈' : '👁'}
                  </button>
                </div>
              </Field>

              <div className="modal-hint">
                Se ele esqueceu a senha, defina uma nova aqui e envie para acessar em <strong>/barber/login</strong>.
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setModal('closed')} className="cancel-btn">Cancelar</button>
              <button onClick={handleSaveAccess} disabled={submitting} className="confirm-btn">
                {submitting ? 'Salvando...' : 'Salvar acesso'}
              </button>
            </div>
          </div>
        </Overlay>
      )}
      {modal === 'edit-performance' && selectedBarber && (
        <Overlay onClose={() => setModal('closed')}>
          <div className="modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Performance</p>
                <h2>Comissão e meta</h2>
              </div>
              <button onClick={() => setModal('closed')} className="icon-close">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {isProOrPremium && (
                <Field label="Tipo de remuneracao" icon="R$">
                  <select
                    value={editCompensationType}
                    onChange={(e) => setEditCompensationType(e.target.value as BarberCompensationType)}
                  >
                    {Object.entries(COMPENSATION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </Field>
              )}
              <p className="confirm-text">
                Configure a comissão individual e a meta mensal de <strong>{selectedBarber.nome}</strong>.
              </p>

              <Field label="Comissão sobre receita (%)" icon="💰">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={editCommissionPercent}
                  onChange={(e) => setEditCommissionPercent(Number(e.target.value))}
                />
              </Field>

              {isProOrPremium &&
                (editCompensationType === 'fixed_salary' ||
                  editCompensationType === 'salary_plus_commission') && (
                  <Field label="Salario fixo mensal (R$)" icon="R$">
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={editFixedSalaryAmount}
                      onChange={(e) => setEditFixedSalaryAmount(Number(e.target.value))}
                    />
                  </Field>
                )}

              {isProOrPremium && editCompensationType === 'chair_rental' && (
                <Field label="Aluguel mensal da cadeira (R$)" icon="R$">
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={editChairRentalAmount}
                    onChange={(e) => setEditChairRentalAmount(Number(e.target.value))}
                  />
                </Field>
              )}

              <Field label="Meta mensal de receita (R$)" icon="🎯">
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={editMonthlyGoal}
                  onChange={(e) => setEditMonthlyGoal(Number(e.target.value))}
                />
              </Field>

              <div className="modal-hint">
                A comissão é calculada sobre os atendimentos finalizados do mês atual.
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setModal('closed')} className="cancel-btn">Cancelar</button>
              <button onClick={handleSavePerformance} disabled={submitting} className="confirm-btn">
                {submitting ? 'Salvando...' : 'Salvar comissão e meta'}
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {isPremium && modal === 'edit-unit' && selectedBarber && (
        <Overlay onClose={() => setModal('closed')}>
          <div className="modal small">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Multiunidade</p>
                <h2>Unidade do barbeiro</h2>
              </div>
              <button onClick={() => setModal('closed')} className="icon-close">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p className="confirm-text">
                Defina em qual unidade <strong>{selectedBarber.nome}</strong> trabalha.
              </p>

              <Field label="Unidade" icon="🏢">
                <select value={editUnitId} onChange={(e) => setEditUnitId(e.target.value)}>
                  <option value="">Sem unidade definida</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="modal-hint">
                Isso será usado para separar agendamentos, faturamento e relatórios por filial.
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setModal('closed')} className="cancel-btn">Cancelar</button>
              <button onClick={handleSaveUnit} disabled={submitting} className="confirm-btn">
                {submitting ? 'Salvando...' : 'Salvar unidade'}
              </button>
            </div>
          </div>
        </Overlay>
      )}

    </div>
  )
}

function BarberCard({
  barber,
  avatarUrl,
  performance,
  unitName,
  showUnitControls,
  onToggle,
  onEditAccess,
  onEditPerformance,
  onEditUnit,
}: {
  barber: Barber
  avatarUrl: string | null
  performance: BarberPerformance
  unitName: string
  showUnitControls: boolean
  onToggle: (b: Barber) => void
  onEditAccess: (b: Barber) => void
  onEditPerformance: (b: Barber) => void
  onEditUnit: (b: Barber) => void
}) {
  const initials = barber.nome
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  const barberPhoto =
    avatarUrl ||
    barber.photo_url ||
    barber.avatar_url ||
    barber.image_url ||
    barber.foto_url ||
    null

  const since = new Date(barber.created_at).toLocaleDateString('pt-BR', {
    month: 'short',
    year: 'numeric',
  })

  const formatMoney = (value: number) =>
    Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })

  return (
    <article className={`barber-card ${!barber.ativo ? 'inactive' : ''}`}>
      <div className="card-top">
        {barberPhoto ? (
          <img
            src={barberPhoto}
            alt={barber.nome}
            className="barber-avatar-img"
          />
        ) : (
          <div className="barber-avatar">{initials || 'BR'}</div>
        )}
        <span className={`status ${barber.ativo ? 'active' : 'inactive'}`}>
          {barber.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      <div className="barber-info">
        <h3>{barber.nome}</h3>
        <span className="compensation-badge">
          {COMPENSATION_LABELS[performance.compensationType]}
        </span>

        <p>
          <Mail size={14} />
          {barber.email}
        </p>

        {barber.telefone && (
          <p>
            <Phone size={14} />
            {barber.telefone}
          </p>
        )}

        <p>
          <ShieldCheck size={14} />
          Desde {since}
        </p>

        {showUnitControls && (
          <p>
            <Building2 size={14} />
            {unitName}
          </p>
        )}
      </div>

      <div className="performance-box">
        <div className="performance-head">
          <span>Meta mensal</span>
          <strong>{performance.progress}%</strong>
        </div>

        <div className="progress-track">
          <span style={{ width: `${performance.progress}%` }} />
        </div>

        <div className="performance-grid">
          <div>
            <small>Receita</small>
            <b>{formatMoney(performance.revenue)}</b>
          </div>

          <div>
            <small>Meta</small>
            <b>{formatMoney(performance.monthlyGoal)}</b>
          </div>

          <div>
            <small>Comissão</small>
            <b>{performance.commissionPercent}%</b>
          </div>

          <div>
            <small>Ganhos</small>
            <b>
              {formatMoney(
                performance.compensationType === 'chair_rental'
                  ? performance.chairRentalRevenue
                  : performance.remunerationValue
              )}
            </b>
          </div>
        </div>
      </div>

      <div className="card-actions">
        {showUnitControls && (
          <button onClick={() => onEditUnit(barber)} className="unit-btn">
            <Building2 size={15} />
            Unidade
          </button>
        )}

        <button onClick={() => onEditPerformance(barber)} className="performance-btn">
          <TrendingUp size={15} />
          Comissão
        </button>

        <button onClick={() => onEditAccess(barber)} className="access-btn">
          <KeyRound size={15} />
          Acesso
        </button>

        <button
          onClick={() => onToggle(barber)}
          className={barber.ativo ? 'deactivate-btn' : 'activate-btn'}
        >
          {barber.ativo ? <Power size={15} /> : <RotateCcw size={15} />}
          {barber.ativo ? 'Desativar' : 'Reativar'}
        </button>
      </div>
    </article>
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
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
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

function CrownIcon() {
  return <span style={{ fontSize: 20 }}>👑</span>
}

const css = `
.barbers-page {
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

.field select option {
  background: #020617;
  color: #f8fafc;
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

.create-btn:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.hero {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 22px;
}

.hero-icon {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
  color: #fff;
  box-shadow: 0 18px 42px rgba(37,99,235,.25);
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

.limit-alert {
  margin-bottom: 18px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid rgba(245,158,11,.25);
  background: rgba(245,158,11,.08);
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.limit-alert strong {
  color: #fbbf24;
}

.limit-alert span {
  color: #fcd34d;
  font-size: 13px;
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
  grid-template-columns: repeat(6, minmax(0, 1fr));
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

.barbers-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.barber-card {
  min-height: 420px;
  border-radius: 24px;
  padding: 22px;
  background:
    radial-gradient(circle at top right, rgba(37,99,235,.13), transparent 32%),
    linear-gradient(145deg, rgba(15,23,42,.95), rgba(8,13,28,.97));
  border: 1px solid rgba(148,163,184,.13);
  box-shadow: 0 28px 70px rgba(0,0,0,.22);
  transition: .18s ease;
}

.barber-card:hover {
  transform: translateY(-3px);
  border-color: rgba(59,130,246,.34);
}

.barber-card.inactive {
  opacity: .58;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.barber-avatar {
  width: 62px;
  height: 62px;
  border-radius: 22px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #0ea5e9, #2563eb, #7c3aed);
  color: white;
  font-size: 18px;
  font-weight: 950;
  box-shadow: 0 18px 38px rgba(37,99,235,.28);
}

.barber-avatar-img {
  width: 62px;
  height: 62px;
  border-radius: 22px;
  object-fit: cover;
  border: 1px solid rgba(59,130,246,.35);
  box-shadow: 0 18px 38px rgba(37,99,235,.22);
  background: rgba(15,23,42,.8);
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

.barber-info {
  margin-top: 22px;
  display: grid;
  gap: 9px;
}

.barber-info h3 {
  margin: 0 0 6px;
  font-size: 19px;
  font-weight: 950;
  letter-spacing: -0.03em;
}

.barber-info p {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #94a3b8;
  font-size: 13px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.barber-info svg {
  color: #93c5fd;
  flex-shrink: 0;
}

.performance-box {
  margin-top: 18px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(2,6,23,.34);
  border: 1px solid rgba(148,163,184,.10);
}

.performance-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 9px;
}

.performance-head span {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 850;
}

.performance-head strong {
  color: #f8fafc;
  font-size: 14px;
  font-weight: 950;
}

.progress-track {
  height: 8px;
  border-radius: 999px;
  background: rgba(148,163,184,.12);
  overflow: hidden;
  margin-bottom: 13px;
}

.progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg,#2563eb,#22c55e);
}

.performance-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.performance-grid div {
  min-width: 0;
}

.performance-grid small {
  display: block;
  color: #64748b;
  font-size: 11px;
  font-weight: 850;
  margin-bottom: 3px;
}

.performance-grid b {
  display: block;
  color: #f8fafc;
  font-size: 13px;
  font-weight: 950;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 18px;
}

.card-actions button {
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

.card-actions .unit-btn {
  color: #38bdf8;
  border-color: rgba(56,189,248,.24);
}

.card-actions .performance-btn {
  color: #22c55e;
  border-color: rgba(34,197,94,.24);
}

.card-actions .access-btn {
  color: #93c5fd;
}

.card-actions .deactivate-btn {
  color: #f87171;
  border-color: rgba(239,68,68,.26);
}

.card-actions .activate-btn {
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

.empty div {
  font-size: 44px;
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

.field input,
.field select,
.password-wrap input {
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

.password-wrap {
  position: relative;
}

.password-wrap input {
  padding-right: 48px;
}

.password-wrap button {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
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

.modal-hint strong {
  color: #93c5fd;
}

.confirm-text {
  margin: 0;
  color: #cbd5e1;
  line-height: 1.6;
}

.confirm-text strong {
  color: #fff;
}

.muted {
  margin: 0;
  color: #94a3b8;
  font-size: 13px;
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

.confirm-btn:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.danger-btn {
  border: 0;
  background: linear-gradient(135deg,#dc2626,#ef4444);
  color: white;
}

.compensation-badge {
  width: fit-content;
  padding: 5px 9px;
  border-radius: 999px;
  color: #93c5fd;
  background: rgba(37,99,235,.12);
  border: 1px solid rgba(59,130,246,.22);
  font-size: 11px;
  font-weight: 850;
}

[data-theme="light"] .barbers-page .search-box {
  background: #ffffff;
  border-color: #dbe4f0;
  color: #64748b;
  box-shadow: 0 10px 28px rgba(15, 23, 42, .06);
}

[data-theme="light"] .barbers-page .search-box input {
  color: #0f172a;
}

[data-theme="light"] .barbers-page .search-box input::placeholder {
  color: #64748b;
  opacity: 1;
}

[data-theme="light"] .barbers-page .performance-box {
  background: #f8fafc;
  border-color: #dbe4f0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .8);
}

[data-theme="light"] .barbers-page .performance-head span,
[data-theme="light"] .barbers-page .performance-grid small {
  color: #64748b;
}

[data-theme="light"] .barbers-page .performance-head strong,
[data-theme="light"] .barbers-page .performance-grid b {
  color: #0f172a;
}

[data-theme="light"] .barbers-page .progress-track {
  background: #dbe4f0;
}

[data-theme="light"] .barbers-page .card-actions button {
  background: #ffffff;
  border-color: #dbe4f0;
  color: #334155;
  box-shadow: 0 6px 16px rgba(15, 23, 42, .05);
}

[data-theme="light"] .barbers-page .card-actions button:hover {
  background: #f8fafc;
  border-color: #bfdbfe;
}

[data-theme="light"] .barbers-page .card-actions .unit-btn {
  background: #f0f9ff;
  border-color: #bae6fd;
  color: #0369a1;
}

[data-theme="light"] .barbers-page .card-actions .performance-btn {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #15803d;
}

[data-theme="light"] .barbers-page .card-actions .access-btn {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

[data-theme="light"] .barbers-page .card-actions .deactivate-btn {
  background: #fff7f7;
  border-color: #fecaca;
  color: #dc2626;
}

[data-theme="light"] .barbers-page .card-actions .activate-btn {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #15803d;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 1200px) {
  .barbers-grid {
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

  .barbers-grid {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .card-actions {
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
