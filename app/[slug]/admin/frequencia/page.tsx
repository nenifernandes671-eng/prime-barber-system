'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantId } from '@/lib/useTenantId'
import { useTenant } from '@/lib/tenant-context'
import {
  COMPENSATION_LABELS,
  type BarberCompensationType,
} from '@/lib/barber-compensation'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Users,
  UserX,
  DollarSign,
  Info,
  X,
} from 'lucide-react'

// ----------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------

type FrequenciaStatus = 'presente' | 'falta' | 'folga' | 'atestado' | 'ferias'

interface Barber {
  id: string
  nome: string
  ativo: boolean
  compensation_type?: BarberCompensationType | null
  fixed_salary_amount?: number | null
}

interface FrequenciaRecord {
  id?: string
  tenant_id: string
  barber_id: string
  data: string // 'YYYY-MM-DD'
  status: FrequenciaStatus
  observacao?: string | null
}

interface BarberSummary {
  barber: Barber
  diasUteis: number
  presentes: number
  faltas: number
  folgas: number
  atestados: number
  ferias: number
  valorDia: number
  desconto: number
  salarioBase: number
  salarioAPagar: number
}

// ----------------------------------------------------------------
// Configuração visual dos status
// ----------------------------------------------------------------

const STATUS_ORDER: FrequenciaStatus[] = ['presente', 'falta', 'folga', 'atestado', 'ferias']

const STATUS_CONFIG: Record<FrequenciaStatus, { label: string; emoji: string; color: string }> = {
  presente: { label: 'Presente', emoji: '✔', color: '#22c55e' },
  falta: { label: 'Falta', emoji: '❌', color: '#ef4444' },
  folga: { label: 'Folga', emoji: '🟡', color: '#f59e0b' },
  atestado: { label: 'Atestado', emoji: '🟢', color: '#06b6d4' },
  ferias: { label: 'Férias', emoji: '🔵', color: '#3b82f6' },
}

const RELEVANT_TYPES: BarberCompensationType[] = ['fixed_salary', 'salary_plus_commission']

// ----------------------------------------------------------------
// Helpers de data
// ----------------------------------------------------------------

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toISODate(year: number, month0: number, day: number) {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`
}

function getDaysInMonth(year: number, month0: number) {
  return new Date(year, month0 + 1, 0).getDate()
}

// Dias úteis = todos os dias do mês exceto domingo.
// Simplificação inicial: pode evoluir para configurável por barbearia.
function getDiasUteis(year: number, month0: number) {
  const total = getDaysInMonth(year, month0)
  let count = 0
  for (let d = 1; d <= total; d++) {
    const weekday = new Date(year, month0, d).getDay()
    if (weekday !== 0) count++
  }
  return count
}

function money(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function monthLabel(year: number, month0: number) {
  return new Date(year, month0, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^./, (c) => c.toUpperCase())
}

export default function AdminFrequencia() {
  const tenantId = useTenantId()
  const { isProOrPremium } = useTenant()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month0, setMonth0] = useState(now.getMonth())

  const [barbers, setBarbers] = useState<Barber[]>([])
  const [records, setRecords] = useState<FrequenciaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const [noteModal, setNoteModal] = useState<{ barberId: string; data: string; status: FrequenciaStatus } | null>(null)
  const [noteText, setNoteText] = useState('')

  useEffect(() => {
    if (tenantId) fetchData()
  }, [tenantId, year, month0])

  async function fetchData() {
    if (!tenantId) return
    setLoading(true)

    const start = toISODate(year, month0, 1)
    const end = toISODate(year, month0, getDaysInMonth(year, month0))

    const [{ data: barbersData, error: barbersError }, { data: recordsData, error: recordsError }] =
      await Promise.all([
        supabase
          .from('barbeiros')
          .select('id, nome, ativo, compensation_type, fixed_salary_amount')
          .eq('tenant_id', tenantId)
          .eq('ativo', true)
          .in('compensation_type', RELEVANT_TYPES)
          .order('nome', { ascending: true }),

        supabase
          .from('frequencia')
          .select('*')
          .eq('tenant_id', tenantId)
          .gte('data', start)
          .lte('data', end),
      ])

    if (barbersError) {
      console.error('Erro ao buscar barbeiros:', barbersError)
      setBarbers([])
    } else {
      setBarbers((barbersData || []) as Barber[])
    }

    if (recordsError) {
      console.error('Erro ao buscar frequência:', recordsError)
      setRecords([])
    } else {
      setRecords((recordsData || []) as FrequenciaRecord[])
    }

    setLoading(false)
  }

  function getRecord(barberId: string, data: string) {
    return records.find((r) => r.barber_id === barberId && r.data === data)
  }

  async function persistStatus(barberId: string, data: string, status: FrequenciaStatus | null, observacao?: string | null) {
    if (!tenantId) return

    const key = `${barberId}-${data}`
    setSaving(key)
    setFeedback(null)

    const existing = getRecord(barberId, data)

    if (status === null) {
      // remover marcação (volta pro vazio)
      if (existing?.id) {
        const { error } = await supabase.from('frequencia').delete().eq('id', existing.id)
        if (error) {
          setFeedback({ type: 'error', msg: `Erro ao limpar dia: ${error.message}` })
          setSaving(null)
          return
        }
        setRecords((prev) => prev.filter((r) => r.id !== existing.id))
      }
      setSaving(null)
      return
    }

    const payload: FrequenciaRecord = {
      tenant_id: tenantId,
      barber_id: barberId,
      data,
      status,
      observacao: observacao ?? null,
    }

    const result = existing?.id
      ? await supabase.from('frequencia').update(payload).eq('id', existing.id).select().single()
      : await supabase.from('frequencia').insert(payload).select().single()

    setSaving(null)

    if (result.error) {
      setFeedback({ type: 'error', msg: `Erro ao salvar: ${result.error.message}` })
      return
    }

    const saved = result.data as FrequenciaRecord

    setRecords((prev) => {
      const withoutOld = prev.filter((r) => !(r.barber_id === barberId && r.data === data))
      return [...withoutOld, saved]
    })
  }

  function handleCellClick(barberId: string, data: string) {
    const existing = getRecord(barberId, data)
    const currentIndex = existing ? STATUS_ORDER.indexOf(existing.status) : -1
    const nextStatus = STATUS_ORDER[currentIndex + 1] ?? null

    if (nextStatus === 'atestado' || nextStatus === 'ferias') {
      setNoteText(existing?.observacao || '')
      setNoteModal({ barberId, data, status: nextStatus })
      return
    }

    persistStatus(barberId, data, nextStatus)
  }

  async function confirmNote() {
    if (!noteModal) return
    await persistStatus(noteModal.barberId, noteModal.data, noteModal.status, noteText.trim() || null)
    setNoteModal(null)
    setNoteText('')
  }

  const daysInMonth = getDaysInMonth(year, month0)
  const diasUteisMes = getDiasUteis(year, month0)
  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth]
  )

  function getSummary(barber: Barber): BarberSummary {
    const barberRecords = records.filter((r) => r.barber_id === barber.id)

    const presentes = barberRecords.filter((r) => r.status === 'presente').length
    const faltas = barberRecords.filter((r) => r.status === 'falta').length
    const folgas = barberRecords.filter((r) => r.status === 'folga').length
    const atestados = barberRecords.filter((r) => r.status === 'atestado').length
    const ferias = barberRecords.filter((r) => r.status === 'ferias').length

    const salarioBase = Number(barber.fixed_salary_amount || 0)
    const valorDia = diasUteisMes > 0 ? salarioBase / diasUteisMes : 0
    const desconto = faltas * valorDia
    const salarioAPagar = Math.max(0, salarioBase - desconto)

    return {
      barber,
      diasUteis: diasUteisMes,
      presentes,
      faltas,
      folgas,
      atestados,
      ferias,
      valorDia,
      desconto,
      salarioBase,
      salarioAPagar,
    }
  }

  const summaries = barbers.map(getSummary)

  const totalFaltas = summaries.reduce((sum, s) => sum + s.faltas, 0)
  const totalDesconto = summaries.reduce((sum, s) => sum + s.desconto, 0)
  const totalAPagar = summaries.reduce((sum, s) => sum + s.salarioAPagar, 0)

  function goToPreviousMonth() {
    if (month0 === 0) {
      setMonth0(11)
      setYear((y) => y - 1)
    } else {
      setMonth0((m) => m - 1)
    }
  }

  function goToNextMonth() {
    if (month0 === 11) {
      setMonth0(0)
      setYear((y) => y + 1)
    } else {
      setMonth0((m) => m + 1)
    }
  }

  return (
    <div className="frequencia-page">
      <style>{css}</style>

      <section className="hero">
        <div className="hero-icon">
          <CalendarDays size={30} />
        </div>

        <div>
          <p className="eyebrow">Equipe</p>
          <h1>Frequência</h1>
          <span>Controle de presença para barbeiros com salário fixo ou salário + comissão.</span>
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

      <div className="month-bar">
        <button onClick={goToPreviousMonth} className="month-nav">
          <ChevronLeft size={18} />
        </button>
        <strong>{monthLabel(year, month0)}</strong>
        <button onClick={goToNextMonth} className="month-nav">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="stats-grid">
        <StatCard icon={<Users size={20} />} label="Colaboradores considerados" value={barbers.length} color="#3b82f6" />
        <StatCard icon={<UserX size={20} />} label="Faltas no mês" value={totalFaltas} color="#ef4444" />
        <StatCard icon={<DollarSign size={20} />} label="Desconto estimado" value={money(totalDesconto)} color="#f59e0b" />
        <StatCard icon={<DollarSign size={20} />} label="Total a pagar (fixo)" value={money(totalAPagar)} color="#22c55e" />
      </div>

      <div className="info-box">
        <Info size={16} />
        <p>
          Dias úteis considerados neste mês: <strong>{diasUteisMes}</strong> (todos os dias exceto domingo).
          Faltas descontam proporcionalmente do salário fixo. Folga, atestado e férias não geram desconto.
        </p>
      </div>

      <div className="legend">
        {STATUS_ORDER.map((status) => (
          <span key={status} className="legend-item">
            <i style={{ background: STATUS_CONFIG[status].color }} />
            {STATUS_CONFIG[status].emoji} {STATUS_CONFIG[status].label}
          </span>
        ))}
        <span className="legend-item muted">Clique na célula para alternar o status</span>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          <p>Carregando frequência...</p>
        </div>
      ) : barbers.length === 0 ? (
        <div className="empty">
          <div>📅</div>
          <h3>Nenhum barbeiro elegível</h3>
          <p>
            Este módulo se aplica a barbeiros com <strong>salário fixo</strong> ou{' '}
            <strong>salário + comissão</strong>. Configure o tipo de remuneração na página de Barbeiros.
          </p>
        </div>
      ) : (
        <div className="cards-list">
          {summaries.map((summary) => (
            <BarberFrequenciaCard
              key={summary.barber.id}
              summary={summary}
              days={days}
              year={year}
              month0={month0}
              getRecord={getRecord}
              onCellClick={handleCellClick}
              savingKey={saving}
            />
          ))}
        </div>
      )}

      {noteModal && (
        <Overlay onClose={() => setNoteModal(null)}>
          <div className="modal small">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Observação</p>
                <h2>{STATUS_CONFIG[noteModal.status].emoji} {STATUS_CONFIG[noteModal.status].label}</h2>
              </div>
              <button onClick={() => setNoteModal(null)} className="icon-close">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <Field label="Observação (opcional)" icon="📝">
                <input
                  placeholder="Ex: atestado médico, viagem, etc."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
              </Field>
            </div>

            <div className="modal-footer">
              <button onClick={() => setNoteModal(null)} className="cancel-btn">Cancelar</button>
              <button onClick={confirmNote} className="confirm-btn">Salvar</button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Card de frequência por barbeiro
// ----------------------------------------------------------------

function BarberFrequenciaCard({
  summary,
  days,
  year,
  month0,
  getRecord,
  onCellClick,
  savingKey,
}: {
  summary: BarberSummary
  days: number[]
  year: number
  month0: number
  getRecord: (barberId: string, data: string) => FrequenciaRecord | undefined
  onCellClick: (barberId: string, data: string) => void
  savingKey: string | null
}) {
  const { barber } = summary

  return (
    <article className="freq-card">
      <div className="freq-head">
        <div>
          <h3>{barber.nome}</h3>
          <span className="compensation-badge">
            {barber.compensation_type ? COMPENSATION_LABELS[barber.compensation_type] : ''}
          </span>
        </div>

        <div className="freq-summary">
          <div>
            <small>Faltas</small>
            <b className="danger">{summary.faltas}</b>
          </div>
          <div>
            <small>Desconto</small>
            <b className="danger">{money(summary.desconto)}</b>
          </div>
          <div>
            <small>Salário base</small>
            <b>{money(summary.salarioBase)}</b>
          </div>
          <div>
            <small>A pagar</small>
            <b className="success">{money(summary.salarioAPagar)}</b>
          </div>
        </div>
      </div>

      <div className="calendar-grid">
        {days.map((day) => {
          const data = toISODate(year, month0, day)
          const record = getRecord(barber.id, data)
          const key = `${barber.id}-${data}`
          const isSaving = savingKey === key
          const weekday = new Date(year, month0, day).getDay()
          const isSunday = weekday === 0

          return (
            <button
              key={day}
              onClick={() => onCellClick(barber.id, data)}
              disabled={isSaving}
              className={`day-cell ${isSunday ? 'sunday' : ''}`}
              style={
                record
                  ? { background: `${STATUS_CONFIG[record.status].color}22`, borderColor: `${STATUS_CONFIG[record.status].color}55` }
                  : undefined
              }
              title={record ? `${STATUS_CONFIG[record.status].label}${record.observacao ? ' — ' + record.observacao : ''}` : 'Sem registro'}
            >
              <span className="day-number">{day}</span>
              {record && <span className="day-emoji">{STATUS_CONFIG[record.status].emoji}</span>}
            </button>
          )
        })}
      </div>
    </article>
  )
}

// ----------------------------------------------------------------
// Componentes utilitários (mesmo padrão de barbeiros/page.tsx)
// ----------------------------------------------------------------

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

// ----------------------------------------------------------------
// CSS
// ----------------------------------------------------------------

const css = `
.frequencia-page {
  min-height: 100vh;
  color: #f8fafc;
  font-family: 'Inter', 'DM Sans', 'Segoe UI', sans-serif;
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

.month-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin-bottom: 20px;
}

.month-bar strong {
  font-size: 17px;
  font-weight: 950;
  min-width: 200px;
  text-align: center;
  text-transform: capitalize;
}

.month-nav {
  width: 40px;
  height: 40px;
  border-radius: 13px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(148,163,184,.14);
  background: rgba(15,23,42,.78);
  color: #f8fafc;
  cursor: pointer;
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
  min-height: 108px;
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
  font-size: 22px;
  font-weight: 950;
  letter-spacing: -0.04em;
}

.info-box {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 13px 16px;
  border-radius: 16px;
  border: 1px solid rgba(59,130,246,.20);
  background: rgba(37,99,235,.08);
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.55;
  margin-bottom: 18px;
}

.info-box svg {
  color: #93c5fd;
  flex-shrink: 0;
  margin-top: 2px;
}

.info-box strong {
  color: #93c5fd;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 20px;
  align-items: center;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 800;
  color: #cbd5e1;
}

.legend-item i {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  display: inline-block;
}

.legend-item.muted {
  color: #64748b;
  font-weight: 700;
}

.cards-list {
  display: grid;
  gap: 16px;
}

.freq-card {
  border-radius: 22px;
  padding: 20px;
  background:
    radial-gradient(circle at top right, rgba(37,99,235,.10), transparent 32%),
    linear-gradient(145deg, rgba(15,23,42,.95), rgba(8,13,28,.97));
  border: 1px solid rgba(148,163,184,.13);
}

.freq-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}

.freq-head h3 {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 950;
  letter-spacing: -0.03em;
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

.freq-summary {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.freq-summary div {
  min-width: 90px;
}

.freq-summary small {
  display: block;
  color: #64748b;
  font-size: 11px;
  font-weight: 850;
  margin-bottom: 3px;
}

.freq-summary b {
  display: block;
  font-size: 15px;
  font-weight: 950;
  color: #f8fafc;
}

.freq-summary b.danger {
  color: #f87171;
}

.freq-summary b.success {
  color: #34d399;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(42px, 1fr));
  gap: 6px;
}

.day-cell {
  height: 50px;
  border-radius: 12px;
  border: 1px solid rgba(148,163,184,.14);
  background: rgba(2,6,23,.4);
  color: #cbd5e1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
  transition: .12s ease;
}

.day-cell:hover {
  border-color: rgba(59,130,246,.4);
}

.day-cell:disabled {
  opacity: .5;
  cursor: wait;
}

.day-cell.sunday {
  opacity: .55;
}

.day-number {
  font-size: 11px;
  color: #94a3b8;
}

.day-emoji {
  font-size: 13px;
}

.loading,
.empty {
  min-height: 260px;
  border-radius: 24px;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 24px;
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
  margin: 0;
  max-width: 420px;
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
  max-width: 420px;
  border-radius: 24px;
  background:
    radial-gradient(circle at top right, rgba(37,99,235,.18), transparent 36%),
    linear-gradient(145deg, rgba(15,23,42,.98), rgba(8,13,28,.99));
  border: 1px solid rgba(148,163,184,.14);
  box-shadow: 0 30px 90px rgba(0,0,0,.55);
}

.modal-head {
  padding: 24px 26px 0;
  display: flex;
  justify-content: space-between;
  gap: 14px;
}

.modal-head h2 {
  margin: 0;
  font-size: 20px;
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

.modal-footer {
  padding: 0 26px 26px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.cancel-btn,
.confirm-btn {
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


[data-theme="light"] .frequencia-page .freq-card h3 {
  color: #0f172a;
}

[data-theme="light"] .frequencia-page .freq-summary b {
  color: #0f172a;
}

[data-theme="light"] .frequencia-page .freq-summary small {
  color: #64748b;
}

[data-theme="light"] .frequencia-page .legend-item {
  color: #334155;
}

[data-theme="light"] .frequencia-page .legend-item.muted {
  color: #94a3b8;
}

[data-theme="light"] .frequencia-page .month-nav {
  background: #ffffff;
  border-color: #dbe4f0;
  color: #0f172a;
}

[data-theme="light"] .frequencia-page .info-box {
  background: #eff6ff;
}

[data-theme="light"] .frequencia-page .freq-card {
  background: #ffffff;
  border-color: #dbe4f0;
  box-shadow: 0 10px 28px rgba(15, 23, 42, .05);
}

[data-theme="light"] .frequencia-page .day-cell {
  background: #f8fafc;
  border-color: #dbe4f0;
  color: #334155;
}

[data-theme="light"] .frequencia-page .day-number {
  color: #64748b;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .hero h1 {
    font-size: 34px;
  }

  .hero-icon {
    width: 56px;
    height: 56px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .freq-head {
    flex-direction: column;
  }

  .calendar-grid {
    grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
  }

  .day-cell {
    height: 44px;
  }
}
`