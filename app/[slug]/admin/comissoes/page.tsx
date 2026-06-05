'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantId } from '@/lib/useTenantId'
import { useIsMobile } from '@/lib/useIsMobile'
import { useUnit } from '@/lib/unit-context'
import { useTenant } from '@/lib/tenant-context'
import {
  DollarSign,
  Scissors,
  Wallet,
  TrendingUp,
  CalendarDays,
  Pencil,
  Save,
  X,
} from 'lucide-react'

interface Barber {
  id: string
  unit_id?: string | null
  nome: string
  email: string
  tenant_id?: string | null
  commission_percentage?: number | null
  commission_type?: 'percentage' | null
  commissionSourceId?: string | null
  ativo: boolean
}

interface Appointment {
  id: string
  unit_id?: string | null
  barber: string
  price: number
  status: string
  appointment_date: string
}

type Period = 'mes' | 'semana' | 'tudo'

function formatCurrency(v: number) {
  return (v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function calcCommission(
  barber: Barber,
  appointments: Appointment[],
  period: Period
) {
  const now = new Date()

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  const filtered = appointments.filter((a) => {
    if (a.barber !== barber.nome) return false
    if (a.status === 'cancelled') return false

    const d = new Date(a.appointment_date)

    if (period === 'mes') return d >= startOfMonth
    if (period === 'semana') return d >= startOfWeek

    return true
  })

  const totalRevenue = filtered.reduce((s, a) => s + (a.price || 0), 0)
  const totalServices = filtered.length

  let commission = 0

  commission = totalRevenue * ((barber.commission_percentage || 0) / 100)

  return {
    commission,
    totalRevenue,
    totalServices,
  }
}

export default function AdminComissoes() {
  const tenantId = useTenantId()
  const isMobile = useIsMobile()
  const { isPremium } = useTenant()
  const { selectedUnitId, selectedUnit } = useUnit()
  const activeUnitId = isPremium ? selectedUnitId : 'all'
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  const [period, setPeriod] = useState<Period>('mes')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [editForm, setEditForm] = useState({
    type: 'percentage',
    percentage: '',
  })

  const fetchAll = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    let barbersQuery = supabase
      .from('barbeiros')
      .select('id,nome,email,telefone,ativo,tenant_id,unit_id')
      .eq('tenant_id', tenantId)
      .eq('ativo', true)

    let appointmentsQuery = supabase
      .from('appointments')
      .select('id, unit_id, barber, price, status, appointment_date')
      .eq('tenant_id', tenantId)

    let commissionRowsQuery = supabase
      .from('barbers')
      .select('id,name,email,tenant_id,unit_id,commission_percentage,commission_type,ativo')
      .eq('tenant_id', tenantId)

    if (activeUnitId !== 'all') {
      barbersQuery = barbersQuery.eq('unit_id', activeUnitId)
      appointmentsQuery = appointmentsQuery.eq('unit_id', activeUnitId)
      commissionRowsQuery = commissionRowsQuery.eq('unit_id', activeUnitId)
    }

    const [{ data: barbs, error: barbsError }, { data: appts, error: apptsError }, { data: commissionRows, error: commissionsError }] = await Promise.all([
      barbersQuery.order('nome'),
      appointmentsQuery,
      commissionRowsQuery,
    ])

    if (barbsError || apptsError || commissionsError) {
      setFeedback({ type: 'error', message: barbsError?.message || apptsError?.message || commissionsError?.message || 'Erro ao carregar comissões.' })
    }

    const merged = (barbs ?? []).map((barber: any) => {
      const matchingRows = (commissionRows ?? []).filter((row: any) => {
        const sameEmail = row.email && barber.email && row.email.toLowerCase() === barber.email.toLowerCase()
        const sameName = row.name && barber.nome && row.name.toLowerCase() === barber.nome.toLowerCase()
        return row.tenant_id === barber.tenant_id && (sameEmail || sameName)
      })
      const match = matchingRows.reduce((best: any, row: any) => {
        if (!best) return row
        return (row.commission_percentage || 0) > (best.commission_percentage || 0) ? row : best
      }, null)

      return {
        ...barber,
        commission_percentage: match?.commission_percentage ?? 0,
        commission_type: 'percentage',
        commissionSourceId: match?.id ?? null,
      }
    })

    setBarbers(merged as Barber[])
    setAppointments(appts ?? [])

    setLoading(false)
  }, [tenantId, activeUnitId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll()
  }, [fetchAll])

  const openEdit = (b: Barber) => {
    setFeedback(null)
    setEditingId(b.id)

    setEditForm({
      type: 'percentage',
      percentage: String(b.commission_percentage ?? 0),
    })
  }

  const saveCommission = async (barberId: string) => {
    if (!tenantId) {
      setFeedback({ type: 'error', message: 'Tenant não carregado. Recarregue a página e tente novamente.' })
      return
    }

    const barber = barbers.find((b) => b.id === barberId)
    if (!barber) {
      setFeedback({ type: 'error', message: 'Barbeiro não encontrado para salvar comissão.' })
      return
    }

    const percentage = Math.max(0, Math.min(100, parseFloat(editForm.percentage) || 0))
    const payload = {
      name: barber.nome,
      email: barber.email || null,
      tenant_id: tenantId,
      unit_id: isPremium ? (activeUnitId !== 'all' ? activeUnitId : barber.unit_id || null) : null,
      ativo: true,
      commission_type: 'percentage',
      commission_percentage: percentage,
    }

    setSavingId(barberId)
    setFeedback(null)

    const updateMatches = supabase
      .from('barbers')
      .update(payload)
      .eq('tenant_id', tenantId)
      .or(`email.eq.${barber.email},name.eq.${barber.nome}`)
      .select('id,commission_percentage,commission_type')

    const query = barber.commissionSourceId
      ? updateMatches
      : supabase.from('barbers').insert(payload).select('id,commission_percentage,commission_type').single()

    const { data, error } = await query
    const savedRow = Array.isArray(data) ? data[0] : data

    setSavingId(null)

    if (error) {
      setFeedback({ type: 'error', message: `Não consegui salvar a comissão: ${error.message}` })
      return
    }

    setEditingId(null)
    setBarbers(prev => prev.map(b => b.id === barberId ? {
      ...b,
      commission_percentage: savedRow?.commission_percentage ?? percentage,
      commission_type: 'percentage',
      commissionSourceId: savedRow?.id ?? b.commissionSourceId,
    } : b))
    setFeedback({ type: 'success', message: 'Comissão salva e recalculada.' })
  }

  const totalCommissions = barbers.reduce((s, b) => {
    return s + calcCommission(b, appointments, period).commission
  }, 0)

  const totalRevenue = barbers.reduce((s, b) => {
    return s + calcCommission(b, appointments, period).totalRevenue
  }, 0)

  const totalServices = barbers.reduce((s, b) => {
    return s + calcCommission(b, appointments, period).totalServices
  }, 0)

  if (loading) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.spinner} />
      </div>
    )
  }

  return (
    <div style={styles.root}>

      {/* HEADER */}

      <div style={{ ...styles.header, ...(isMobile ? styles.mobileHeader : {}) }}>

        <div>
          <p style={styles.overline}>
            CONTROLE FINANCEIRO 💰
          </p>

          <h1 style={{ ...styles.title, fontSize: isMobile ? 34 : styles.title.fontSize }}>
            Comissões
          </h1>

          <p style={styles.subtitle}>
            Gerencie pagamentos e comissões dos barbeiros
            {isPremium && activeUnitId !== 'all' ? ` · ${selectedUnit?.name || 'Unidade selecionada'}` : ''}
          </p>
        </div>

        <div style={{ ...styles.headerRight, width: isMobile ? '100%' : undefined }}>

          {(['semana', 'mes', 'tudo'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                ...styles.periodBtn,
                ...(period === p ? styles.periodBtnActive : {}),
              }}
            >
              {p === 'semana'
                ? 'Semana'
                : p === 'mes'
                ? 'Mês'
                : 'Tudo'}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div
          style={{
            ...styles.feedback,
            ...(feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess),
          }}
        >
          {feedback.message}
        </div>
      )}

      {/* STATS */}

      <div style={{ ...styles.statsGrid, gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : styles.statsGrid.gridTemplateColumns, gap: isMobile ? 10 : styles.statsGrid.gap }}>

        <StatCard
          icon={<DollarSign size={18} />}
          color="#22c55e"
          value={formatCurrency(totalRevenue)}
          label="Receita Total"
        />

        <StatCard
          icon={<Wallet size={18} />}
          color="#f59e0b"
          value={formatCurrency(totalCommissions)}
          label="Total Comissões"
        />

        <StatCard
          icon={<Scissors size={18} />}
          color="#8b5cf6"
          value={String(totalServices)}
          label="Atendimentos"
        />

        <StatCard
          icon={<TrendingUp size={18} />}
          color="#3b82f6"
          value={String(barbers.length)}
          label="Barbeiros"
        />
      </div>

      {/* GRID */}

      <div style={{ ...styles.mainGrid, gridTemplateColumns: isMobile ? '1fr' : styles.mainGrid.gridTemplateColumns }}>

        {/* LISTA */}

        <div style={styles.left}>

          <div style={{ ...styles.tableCard, borderRadius: isMobile ? 16 : styles.tableCard.borderRadius }}>

            <div style={{ ...styles.tableHeader, padding: isMobile ? 18 : styles.tableHeader.padding }}>
              <div>
                <h2 style={styles.cardTitle}>
                  Comissões dos Barbeiros
                </h2>

                <p style={styles.cardSubtitle}>
                  Controle individual
                </p>
              </div>
            </div>

            <div style={styles.barberList}>

              {barbers.map((b) => {
                const {
                  commission,
                  totalRevenue: rev,
                  totalServices,
                } = calcCommission(b, appointments, period)

                const isEditing = editingId === b.id
                const commissionPercentage = b.commission_percentage ?? 0

                return (
                  <div
                    key={b.id}
                    style={{ ...styles.barberCard, padding: isMobile ? 16 : styles.barberCard.padding }}
                  >

                    <div style={{ ...styles.barberTop, alignItems: isMobile ? 'flex-start' : styles.barberTop.alignItems, flexWrap: 'wrap' }}>

                      <div style={styles.avatar}>
                        {b.nome.slice(0, 2).toUpperCase()}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={styles.barberName}>
                          {b.nome}
                        </p>

                        <p style={styles.barberEmail}>
                          {b.email}
                        </p>
                      </div>

                      <div style={{ ...styles.badge, maxWidth: isMobile ? '100%' : undefined, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {commissionPercentage}%
                      </div>
                    </div>

                    <div style={{ ...styles.metrics, gridTemplateColumns: isMobile ? '1fr' : styles.metrics.gridTemplateColumns }}>

                      <div style={styles.metric}>
                        <span style={styles.metricLabel}>
                          Receita
                        </span>

                        <strong style={styles.metricValue}>
                          {formatCurrency(rev)}
                        </strong>
                      </div>

                      <div style={styles.metric}>
                        <span style={styles.metricLabel}>
                          Serviços
                        </span>

                        <strong style={styles.metricValue}>
                          {totalServices}
                        </strong>
                      </div>

                      <div style={styles.metric}>
                        <span style={styles.metricLabel}>
                          Comissão
                        </span>

                        <strong
                          style={{
                            ...styles.metricValue,
                            color: '#f59e0b',
                          }}
                        >
                          {formatCurrency(commission)}
                        </strong>
                      </div>
                    </div>

                    {isEditing ? (
                      <div style={{ ...styles.editBox, flexDirection: isMobile ? 'column' : 'row' }}>

                        <div style={{ ...styles.input, display: 'flex', alignItems: 'center', color: '#94a3b8' }}>
                          Percentual
                        </div>

                        <input
                          style={styles.input}
                          placeholder="40"
                          type="number"
                          min="0"
                          max="100"
                          value={editForm.percentage}
                          onChange={(e) =>
                            setEditForm((p) => ({
                              ...p,
                              percentage: e.target.value,
                            }))
                          }
                        />

                        <div style={styles.actions}>

                          <button
                            onClick={() => setEditingId(null)}
                            disabled={savingId === b.id}
                            style={styles.cancelBtn}
                          >
                            <X size={16} />
                          </button>

                          <button
                            onClick={() => saveCommission(b.id)}
                            disabled={savingId === b.id}
                            style={{
                              ...styles.saveBtn,
                              opacity: savingId === b.id ? 0.65 : 1,
                              cursor: savingId === b.id ? 'wait' : 'pointer',
                            }}
                          >
                            {savingId === b.id ? '...' : <Save size={16} />}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => openEdit(b)}
                        style={styles.editBtn}
                      >
                        <Pencil size={15} />
                        Editar comissão
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* RESUMO */}

        <div style={styles.right}>

          <div style={{ ...styles.summaryCard, position: isMobile ? 'relative' : styles.summaryCard.position, top: isMobile ? 0 : styles.summaryCard.top, borderRadius: isMobile ? 16 : styles.summaryCard.borderRadius }}>

            <div style={styles.summaryHeader}>
              <CalendarDays size={18} />
              <span>Resumo</span>
            </div>

            <div style={styles.summaryList}>

              {isPremium && (
                <SummaryRow
                  label="Unidade"
                  value={activeUnitId === 'all' ? 'Todas' : selectedUnit?.name || 'Selecionada'}
                  color="#60a5fa"
                />
              )}

              <SummaryRow
                label="Total barbeiros"
                value={String(barbers.length)}
                color="#60a5fa"
              />

              <SummaryRow
                label="Atendimentos"
                value={String(totalServices)}
                color="#22c55e"
              />

              <SummaryRow
                label="Receita"
                value={formatCurrency(totalRevenue)}
                color="#ffffff"
              />

              <SummaryRow
                label="Comissões"
                value={formatCurrency(totalCommissions)}
                color="#f59e0b"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div style={styles.summaryRow}>
      <span style={styles.summaryLabel}>
        {label}
      </span>

      <strong style={{ color }}>
        {value}
      </strong>
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
    <div
      style={{
        ...styles.statCard,
        background: `linear-gradient(135deg, ${color}15, transparent 70%)`,
      }}
    >
      <div
        style={{
          ...styles.statIcon,
          background: `${color}20`,
          color,
        }}
      >
        {icon}
      </div>

      <div
        style={{
          ...styles.percentBadge,
          color,
        }}
      >
        +8%
      </div>

      <p style={styles.statLabel}>
        {label}
      </p>

      <h3 style={styles.statValue}>
        {value}
      </h3>

      <div style={styles.graph} />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {

  root: {
    color: '#fff',
    width: '100%',
  },

  loadingWrap: {
    display: 'flex',
    justifyContent: 'center',
    padding: 100,
  },

  spinner: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.08)',
    borderTopColor: '#3b82f6',
    animation: 'spin 0.8s linear infinite',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
    gap: 20,
    flexWrap: 'wrap',
  },

  mobileHeader: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 16,
    marginBottom: 20,
  },

  overline: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1.4,
    margin: '0 0 8px',
  },

  title: {
    fontSize: 48,
    fontWeight: 800,
    margin: 0,
    letterSpacing: '-2px',
  },

  subtitle: {
    marginTop: 10,
    color: '#3b82f6',
    fontSize: 15,
  },

  headerRight: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },

  periodBtn: {
    border: '1px solid rgba(255,255,255,0.06)',
    background: '#111827',
    color: '#94a3b8',
    padding: '12px 18px',
    borderRadius: 14,
    cursor: 'pointer',
    fontWeight: 600,
  },

  periodBtnActive: {
    background: '#1d4ed8',
    color: '#fff',
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
    gap: 18,
    marginBottom: 24,
  },

  statCard: {
    position: 'relative',
    borderRadius: 24,
    padding: 22,
    border: '1px solid rgba(255,255,255,0.06)',
    backgroundColor: '#081120',
    overflow: 'hidden',
    minHeight: 180,
  },

  statIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },

  percentBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    fontSize: 13,
    fontWeight: 700,
  },

  statLabel: {
    color: '#64748b',
    fontSize: 14,
    marginBottom: 10,
  },

  statValue: {
    fontSize: 24,
    fontWeight: 800,
    margin: 0,
  },

  graph: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 18,
    height: 40,
    borderBottom: '3px solid rgba(59,130,246,0.9)',
    borderRadius: 999,
    opacity: 0.4,
  },

  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 0.5fr',
    gap: 20,
    alignItems: 'start',
  },

  left: {
    minWidth: 0,
  },

  right: {
    minWidth: 0,
  },

  tableCard: {
    background: '#081120',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 26,
    overflow: 'hidden',
  },

  tableHeader: {
    padding: 24,
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },

  cardTitle: {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
  },

  cardSubtitle: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 6,
  },

  barberList: {
    display: 'flex',
    flexDirection: 'column',
  },

  barberCard: {
    padding: 24,
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },

  barberTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    background: '#13233f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    color: '#60a5fa',
    flexShrink: 0,
  },

  barberName: {
    margin: 0,
    fontWeight: 700,
    fontSize: 16,
  },

  barberEmail: {
    margin: '4px 0 0',
    fontSize: 13,
    color: '#64748b',
  },

  badge: {
    background: '#1d4ed8',
    padding: '8px 14px',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 700,
  },

  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3,1fr)',
    gap: 12,
    marginBottom: 18,
  },

  metric: {
    background: '#0d1729',
    borderRadius: 16,
    padding: 16,
  },

  metricLabel: {
    display: 'block',
    color: '#64748b',
    fontSize: 12,
    marginBottom: 8,
  },

  metricValue: {
    fontSize: 16,
  },

  editBtn: {
    border: '1px solid rgba(255,255,255,0.08)',
    background: '#0d1729',
    color: '#cbd5e1',
    borderRadius: 14,
    padding: '12px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
  },

  editBox: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },

  feedback: {
    borderRadius: 14,
    padding: '12px 14px',
    marginBottom: 18,
    fontSize: 13,
    fontWeight: 700,
    border: '1px solid',
  },

  feedbackSuccess: {
    background: 'rgba(16,185,129,0.1)',
    borderColor: 'rgba(16,185,129,0.25)',
    color: '#34d399',
  },

  feedbackError: {
    background: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.25)',
    color: '#fca5a5',
  },

  input: {
    background: '#0d1729',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#fff',
    borderRadius: 14,
    padding: '12px 14px',
    outline: 'none',
    flex: 1,
    minWidth: 120,
  },

  actions: {
    display: 'flex',
    gap: 8,
  },

  cancelBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    border: 'none',
    background: '#1e293b',
    color: '#fff',
    cursor: 'pointer',
  },

  saveBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    cursor: 'pointer',
  },

  summaryCard: {
    background: '#081120',
    borderRadius: 26,
    border: '1px solid rgba(255,255,255,0.06)',
    padding: 22,
    position: 'sticky',
    top: 20,
  },

  summaryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontWeight: 700,
    marginBottom: 20,
  },

  summaryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  summaryRow: {
    background: '#0d1729',
    borderRadius: 16,
    padding: '16px 18px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  summaryLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
}
