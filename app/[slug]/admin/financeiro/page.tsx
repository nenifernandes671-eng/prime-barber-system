'use client'

import { useEffect, useState, useMemo, type ElementType } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { exportFinancePdf } from "@/lib/exportFinancePdf"
import { useTenant } from '@/lib/tenant-context'
import {
  calculateBarberCompensation,
  getBarberCompensation,
} from '@/lib/barber-compensation'
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Download,
  FileText,
  Hourglass,
  Smartphone,
  Target,
  Users,
  WalletCards,
  XCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  X,
} from 'lucide-react'

interface Appointment {
  id: number
  client_name: string
  service: string
  barber: string
  appointment_date: string
  price: number
  payment_method: string
  payment_status: string
  status: string
  unit_id?: string | null
}

interface BarberPhoto {
  nome: string
  avatar_url?: string | null
}

interface FinancialEntry {
  id: string
  tenant_id: string
  unit_id?: string | null
  type: 'entrada' | 'despesa'
  description: string
  amount: number
  payment_method: string
  entry_date: string
  category?: string | null
  created_at?: string
}

interface CommissionPayment {
  id: string
  tenant_id: string
  unit_id?: string | null
  barber_name: string
  amount: number
  payment_method: string
  status: string
  paid_at: string
  created_at?: string
}

interface BarberCommissionSetting {
  id?: string
  name?: string
  nome?: string
  email?: string | null
  tenant_id?: string
  unit_id?: string | null
  commission_percent?: number | null
  commission_percentage?: number | null
  commission_type?: string | null
  compensation_type?: string | null
  fixed_salary_amount?: number | null
  chair_rental_amount?: number | null
  ativo?: boolean | null
}

interface Unit { id: string; tenant_id: string; name: string; active: boolean }

type OperationModal = 'closed' | 'entrada' | 'despesa' | 'comissao'

type Period = 'hoje' | 'semana' | 'mes' | 'tudo'

function fmt(v: number) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseLocalDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`)
}

function isRevenue(a: Appointment) {
  return a.status !== 'cancelled' && a.status !== 'canceled'
}

function inPeriod(dateStr: string, period: Period) {
  if (period === 'tudo') return true

  const d = parseLocalDate(dateStr)
  const now = new Date()

  if (period === 'hoje') return dateStr === localDateKey(now)

  if (period === 'semana') {
    const s = new Date(now)
    s.setDate(now.getDate() - now.getDay())
    s.setHours(0, 0, 0, 0)
    return d >= s
  }

  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

const PIE_COLORS: Record<string, string> = {
  pix: '#3b82f6',
  cartao: '#10b981',
  dinheiro: '#f59e0b',
  outros: '#8b5cf6',
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro',
  outros: 'Outros',
}

const PAYMENT_ICONS: Record<string, ElementType> = {
  pix: Smartphone,
  cartao: CreditCard,
  dinheiro: Banknote,
  outros: WalletCards,
}

function nameKey(name?: string | null) {
  return (name || '').trim().toLowerCase()
}

function normalizePaymentMethod(method?: string | null) {
  const raw = (method || '').toLowerCase()
  if (raw.includes('pix')) return 'pix'
  if (raw.includes('cart') || raw.includes('card') || raw.includes('credito') || raw.includes('debito')) return 'cartao'
  if (raw.includes('din') || raw.includes('cash')) return 'dinheiro'
  return 'outros'
}

function parseMoney(value: string) {
  const normalized = value
    .trim()
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')

  return Number(normalized)
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function isCommissionEntry(entry: FinancialEntry) {
  const category = (entry.category || '').toLowerCase()
  const description = (entry.description || '').toLowerCase()

  return category.includes('comiss') || description.startsWith('pagamento de comiss')
}

function useIsMobile() {
  const [m, setM] = useState(false)

  useEffect(() => {
    const fn = () => setM(window.innerWidth < 768)
    fn()
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  return m
}

function PaymentMethodSelect({
  value,
  onChange,
  compact = false,
}: {
  value?: string | null
  onChange: (value: string) => void
  compact?: boolean
}) {
  return (
    <select
      value={normalizePaymentMethod(value)}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.value)}
      className="finance-select"
      style={{
        width: compact ? 118 : 132,
        padding: compact ? '6px 8px' : '8px 10px',
        fontSize: compact ? 11 : 12,
      }}
    >
      <option value="outros">Outros</option>
      <option value="pix">PIX</option>
      <option value="cartao">Cartão</option>
      <option value="dinheiro">Dinheiro</option>
    </select>
  )
}

function MiniSpark({ color }: { color: string }) {
  return (
    <div className="mini-spark">
      {[22, 36, 31, 48, 41, 54, 46, 61].map((h, i) => (
        <span key={i} style={{ height: `${h}%`, background: color }} />
      ))}
    </div>
  )
}

export default function FinanceiroPage() {
  const pathname = usePathname()
  const router = useRouter()
  const slug = pathname.split('/').filter(Boolean)[0]
  const isMobile = useIsMobile()
  const { isPremium, isProOrPremium } = useTenant()

  const [appts, setAppts] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('mes')
  const [search, setSearch] = useState('')
  const [chartMode, setChartMode] = useState<'diario' | 'mensal'>('diario')
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [barberPhotos, setBarberPhotos] = useState<Record<string, string>>({})
  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [commissionPayments, setCommissionPayments] = useState<CommissionPayment[]>([])
  const [commissionSettings, setCommissionSettings] = useState<BarberCommissionSetting[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [selectedUnitId, setSelectedUnitId] = useState('all')
  const [operationModal, setOperationModal] = useState<OperationModal>('closed')
  const [operationLoading, setOperationLoading] = useState(false)
  const [operationMsg, setOperationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [entryDescription, setEntryDescription] = useState('')
  const [entryAmount, setEntryAmount] = useState('')
  const [entryMethod, setEntryMethod] = useState('pix')
  const [entryDate, setEntryDate] = useState(localDateKey())
  const [commissionBarber, setCommissionBarber] = useState('')
  const [commissionAmount, setCommissionAmount] = useState('')
  const [commissionMethod, setCommissionMethod] = useState('pix')
  const [entryUnitId, setEntryUnitId] = useState('')
  const [commissionUnitId, setCommissionUnitId] = useState('')
  const activeUnitId = isPremium ? selectedUnitId : 'all'

  useEffect(() => {
    async function init() {
      try {
        const { data: t } = await supabase.from('tenants').select('id').eq('slug', slug).maybeSingle()
        if (!t) return

        setTenantId(t.id)

        const { data } = await supabase
          .from('appointments')
          .select('*')
          .eq('tenant_id', t.id)
          .order('appointment_date', { ascending: false })

        const { data: entryRows } = await supabase
          .from('financial_entries')
          .select('*')
          .eq('tenant_id', t.id)
          .order('entry_date', { ascending: false })

        const { data: commissionRows } = await supabase
          .from('commission_payments')
          .select('*')
          .eq('tenant_id', t.id)
          .order('paid_at', { ascending: false })

        const { data: commissionSettingRows } = await supabase
          .from('barbeiros')
          .select('id,nome,email,tenant_id,unit_id,commission_percentage,compensation_type,fixed_salary_amount,chair_rental_amount,ativo')
          .eq('tenant_id', t.id)

        const { data: unitRows } = isPremium
          ? await supabase
              .from('units')
              .select('id, tenant_id, name, active')
              .eq('tenant_id', t.id)
              .eq('active', true)
              .order('created_at', { ascending: true })
          : { data: [] }

        let barberRows: BarberPhoto[] = []

        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token

        if (token) {
          const response = await fetch(`/api/admin/settings-assets?tenant_id=${encodeURIComponent(t.id)}`, {
            headers: { Authorization: `Bearer ${token}` },
          })

          const assets = await response.json().catch(() => ({}))
          if (response.ok) barberRows = assets.barbers ?? []
        }

        setAppts(data ?? [])
        setEntries((entryRows ?? []) as FinancialEntry[])
        setCommissionPayments((commissionRows ?? []) as CommissionPayment[])
        setCommissionSettings((commissionSettingRows ?? []) as BarberCommissionSetting[])
        setUnits(isPremium ? (unitRows ?? []) as Unit[] : [])
        setBarberPhotos(
          Object.fromEntries(
            barberRows
              .filter((barber) => barber.avatar_url)
              .map((barber) => [nameKey(barber.nome), barber.avatar_url as string])
          )
        )
      } finally {
        setLoading(false)
      }
    }

    if (slug) init()
  }, [slug, isPremium])

  async function markPaid(id: number, method = 'outros') {
    if (!tenantId) return

    const paymentMethod = normalizePaymentMethod(method)

    await supabase
      .from('appointments')
      .update({ payment_status: 'paid', payment_method: paymentMethod })
      .eq('id', id)
      .eq('tenant_id', tenantId)

    setAppts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, payment_status: 'paid', payment_method: paymentMethod } : a
      )
    )
  }

  async function updatePaymentMethod(id: number, method: string) {
    if (!tenantId) return

    const paymentMethod = normalizePaymentMethod(method)

    await supabase
      .from('appointments')
      .update({ payment_method: paymentMethod })
      .eq('id', id)
      .eq('tenant_id', tenantId)

    setAppts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, payment_method: paymentMethod } : a))
    )
  }

  function openOperationModal(type: OperationModal) {
    const defaultCommission = commissionBalances.find((barber) => barber.pending > 0) || commissionBalances[0]

    setOperationMsg(null)
    setEntryDescription('')
    setEntryAmount('')
    setEntryMethod('pix')
    setEntryDate(localDateKey())
    setEntryUnitId(activeUnitId !== 'all' ? activeUnitId : '')
    setCommissionBarber(defaultCommission?.name ?? '')
    setCommissionAmount(defaultCommission?.pending ? String(defaultCommission.pending.toFixed(2)).replace('.', ',') : '')
    setCommissionMethod('pix')
    setCommissionUnitId(activeUnitId !== 'all' ? activeUnitId : '')
    setOperationModal(type)
  }

  async function saveFinancialEntry(type: 'entrada' | 'despesa') {
    if (!tenantId) return

    const amount = parseMoney(entryAmount)

    if (!entryDescription.trim()) {
      setOperationMsg({ type: 'error', text: 'Informe uma descrição.' })
      return
    }

    if (!amount || amount <= 0) {
      setOperationMsg({ type: 'error', text: 'Informe um valor válido.' })
      return
    }

    setOperationLoading(true)
    setOperationMsg(null)

    const payload = {
      tenant_id: tenantId,
      unit_id: isPremium ? entryUnitId || null : null,
      type,
      description: entryDescription.trim(),
      amount,
      payment_method: normalizePaymentMethod(entryMethod),
      entry_date: entryDate || localDateKey(),
    }

    const { data, error } = await supabase
      .from('financial_entries')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      setOperationMsg({ type: 'error', text: 'Erro ao registrar. Verifique as policies/RLS da tabela financial_entries.' })
      setOperationLoading(false)
      return
    }

    setEntries(prev => [data as FinancialEntry, ...prev])
    setOperationMsg({ type: 'success', text: type === 'entrada' ? 'Entrada registrada.' : 'Despesa registrada.' })
    setTimeout(() => setOperationModal('closed'), 650)
    setOperationLoading(false)
  }

  async function saveCommissionPayment() {
    if (!tenantId) return

    const amount = roundMoney(parseMoney(commissionAmount))
    const selectedBalance = commissionBalances.find((barber) => barber.name === commissionBarber)

    if (!commissionBarber.trim()) {
      setOperationMsg({ type: 'error', text: 'Selecione um barbeiro.' })
      return
    }

    if (!selectedBalance) {
      setOperationMsg({ type: 'error', text: 'Nao encontrei comissao pendente para este barbeiro.' })
      return
    }

    if (!amount || amount <= 0) {
      setOperationMsg({ type: 'error', text: 'Informe um valor valido.' })
      return
    }

    if (!commissionMethod) {
      setOperationMsg({ type: 'error', text: 'Selecione o metodo de pagamento.' })
      return
    }

    if (amount > selectedBalance.pending + 0.009) {
      setOperationMsg({ type: 'error', text: `O valor maximo pendente para ${commissionBarber} e ${fmt(selectedBalance.pending)}.` })
      return
    }

    setOperationLoading(true)
    setOperationMsg(null)

    const paymentMethod = normalizePaymentMethod(commissionMethod)
    const unitId = isPremium ? commissionUnitId || null : null
    const paidAt = new Date().toISOString()
    const description = `Pagamento de comissao - ${commissionBarber}`

    const commissionPayload = {
      tenant_id: tenantId,
      unit_id: unitId,
      barber_name: commissionBarber,
      amount,
      payment_method: paymentMethod,
      status: 'paid',
      paid_at: paidAt,
    }

    const { data: commissionData, error: commissionError } = await supabase
      .from('commission_payments')
      .insert(commissionPayload)
      .select('*')
      .single()

    if (commissionError) {
      setOperationMsg({ type: 'error', text: commissionError.message || 'Erro ao registrar pagamento de comissao.' })
      setOperationLoading(false)
      return
    }

    const entryPayload = {
      tenant_id: tenantId,
      unit_id: unitId,
      type: 'despesa',
      description,
      amount,
      payment_method: paymentMethod,
      entry_date: localDateKey(),
      category: 'comissao',
    }

    const { data: entryData, error: entryError } = await supabase
      .from('financial_entries')
      .insert(entryPayload)
      .select('*')
      .single()

    if (entryError) {
      if (commissionData?.id) {
        await supabase
          .from('commission_payments')
          .delete()
          .eq('id', commissionData.id)
          .eq('tenant_id', tenantId)
      }

      setOperationMsg({ type: 'error', text: entryError.message || 'Erro ao registrar a saida financeira da comissao.' })
      setOperationLoading(false)
      return
    }

    const [{ data: refreshedEntries }, { data: refreshedCommissions }] = await Promise.all([
      supabase
        .from('financial_entries')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('entry_date', { ascending: false }),
      supabase
        .from('commission_payments')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('paid_at', { ascending: false }),
    ])

    setEntries((refreshedEntries ?? [entryData]) as FinancialEntry[])
    setCommissionPayments((refreshedCommissions ?? [commissionData]) as CommissionPayment[])
    setCommissionAmount('')
    setCommissionMethod('pix')
    setOperationMsg({ type: 'success', text: 'Pagamento de comissao registrado com sucesso.' })
    setTimeout(() => setOperationModal('closed'), 650)
    setOperationLoading(false)
  }

  const filtered = useMemo(
    () =>
      appts.filter((a) => {
        const ok = inPeriod(a.appointment_date, period)
        const s = search.toLowerCase()
        const match =
          !s ||
          [a.client_name, a.service, a.barber].some((f) =>
            (f ?? '').toLowerCase().includes(s)
          )

        const unitOk = activeUnitId === 'all' || !a.unit_id || a.unit_id === activeUnitId
        return ok && match && unitOk
      }),
    [appts, period, search, activeUnitId]
  )

  const filteredEntries = useMemo(() => {
    if (!isProOrPremium) return []

    return entries.filter((entry) => {
      const unitOk = activeUnitId === 'all' || !entry.unit_id || entry.unit_id === activeUnitId
      return inPeriod(entry.entry_date, period) && unitOk
    })
  }, [entries, period, activeUnitId, isProOrPremium])

  const filteredCommissionPayments = useMemo(() => {
    if (!isProOrPremium) return []

    return commissionPayments.filter((payment) => {
      const date = payment.paid_at ? payment.paid_at.slice(0, 10) : localDateKey()
      const unitOk = activeUnitId === 'all' || !payment.unit_id || payment.unit_id === activeUnitId
      return inPeriod(date, period) && unitOk
    })
  }, [commissionPayments, period, activeUnitId, isProOrPremium])

  const rev = filtered.filter(isRevenue)
  const appointmentRevenue = rev.reduce((s, a) => s + (a.price || 0), 0)
  const compensationDates = [
    ...rev.map((item) => item.appointment_date),
    ...filteredEntries.map((item) => item.entry_date),
  ].filter(Boolean).sort()
  const compensationToday = new Date()
  const compensationEnd = localDateKey(compensationToday)
  let compensationStart = compensationDates[0] || compensationEnd

  if (period === 'hoje') {
    compensationStart = compensationEnd
  } else if (period === 'semana') {
    const startOfWeek = new Date(compensationToday)
    startOfWeek.setDate(compensationToday.getDate() - compensationToday.getDay())
    compensationStart = localDateKey(startOfWeek)
  } else if (period === 'mes') {
    compensationStart = localDateKey(
      new Date(compensationToday.getFullYear(), compensationToday.getMonth(), 1)
    )
  }

  const effectiveCompensationEnd =
    period === 'tudo'
      ? compensationDates[compensationDates.length - 1] || compensationEnd
      : compensationEnd
  const compensationSummary = commissionSettings.map((barber) => {
    const serviceRevenue = rev
      .filter((appointment) => nameKey(appointment.barber) === nameKey(barber.nome || barber.name))
      .reduce((sum, appointment) => sum + Number(appointment.price || 0), 0)

    return calculateBarberCompensation({
      settings: getBarberCompensation(barber),
      serviceRevenue,
      periodStart: compensationStart,
      periodEnd: effectiveCompensationEnd,
    })
  })
  const knownBarberNames = new Set(
    commissionSettings.map((barber) => nameKey(barber.nome || barber.name))
  )
  const unassignedRevenue = rev
    .filter((appointment) => !knownBarberNames.has(nameKey(appointment.barber)))
    .reduce((sum, appointment) => sum + Number(appointment.price || 0), 0)
  const recognizedServiceRevenue = compensationSummary.reduce(
    (sum, item) => sum + item.barbershopServiceRevenue,
    unassignedRevenue
  )
  const chairRentalRevenue = compensationSummary.reduce(
    (sum, item) => sum + item.chairRentalRevenue,
    0
  )
  const accruedLaborCost = compensationSummary.reduce(
    (sum, item) => sum + item.laborCost,
    0
  )
  const manualIncome = filteredEntries
    .filter((entry) => entry.type === 'entrada')
    .reduce((s, entry) => s + Number(entry.amount || 0), 0)
  const manualExpenses = filteredEntries
    .filter((entry) => entry.type === 'despesa' && !isCommissionEntry(entry))
    .reduce((s, entry) => s + Number(entry.amount || 0), 0)
  const commissionPaidTotal = filteredCommissionPayments.reduce((s, p) => s + Number(p.amount || 0), 0)
  const totalRev = recognizedServiceRevenue + chairRentalRevenue + manualIncome
  const totalPaidService = filtered
    .filter((a) => a.payment_status === 'paid')
    .reduce((s, a) => {
      const barber = commissionSettings.find(
        (item) => nameKey(item.nome || item.name) === nameKey(a.barber)
      )
      return s + (getBarberCompensation(barber).type === 'chair_rental' ? 0 : Number(a.price || 0))
    }, 0)
  const totalPaid = totalPaidService + chairRentalRevenue + manualIncome
  const totalPend = rev
    .filter((a) => a.payment_status !== 'paid')
    .reduce((s, a) => s + (a.price || 0), 0)
  const netCash = totalRev - manualExpenses - accruedLaborCost
  const avgTicket = rev.length > 0 ? appointmentRevenue / rev.length : 0
  const cancelled = filtered.filter((a) => a.status === 'cancelled' || a.status === 'canceled').length

  const chartData = useMemo(() => {
    const g: Record<string, number> = {}
    const now = new Date()

    if (chartMode === 'mensal') {
      MONTHS.forEach((m) => {
        g[m] = 0
      })
    } else if (period === 'mes') {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      for (let d = 1; d <= daysInMonth; d++) {
        g[`${String(d).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`] = 0
      }
    } else if (period === 'semana') {
      const start = new Date(now)
      start.setDate(now.getDate() - now.getDay())

      for (let i = 0; i < 7; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        g[`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`] = 0
      }
    } else if (period === 'hoje') {
      g[`${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`] = 0
    }

    rev.forEach((a) => {
      const d = parseLocalDate(a.appointment_date)
      const key =
        chartMode === 'diario'
          ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
          : MONTHS[d.getMonth()]

      g[key] = (g[key] || 0) + (a.price || 0)
    })

    filteredEntries
      .filter((entry) => entry.type === 'entrada')
      .forEach((entry) => {
        const d = parseLocalDate(entry.entry_date)
        const key =
          chartMode === 'diario'
            ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
            : MONTHS[d.getMonth()]

        g[key] = (g[key] || 0) + Number(entry.amount || 0)
      })

    return Object.entries(g).map(([label, value]) => ({ label, value }))
  }, [rev, filteredEntries, chartMode, period])

  const pieData = useMemo(() => {
    const g: Record<string, number> = {}

    rev.forEach((a) => {
      const key = normalizePaymentMethod(a.payment_method)
      g[key] = (g[key] || 0) + (a.price || 0)
    })

    filteredEntries
      .filter((entry) => entry.type === 'entrada')
      .forEach((entry) => {
        const key = normalizePaymentMethod(entry.payment_method)
        g[key] = (g[key] || 0) + Number(entry.amount || 0)
      })

    return Object.entries(g).map(([key, value]) => ({
      key,
      value,
      name: PAYMENT_LABELS[key] || 'Outros',
    }))
  }, [rev, filteredEntries])

  const barberData = useMemo(() => {
    const g: Record<string, { n: number; r: number }> = {}

    rev.forEach((a) => {
      const b = a.barber || '—'
      if (!g[b]) g[b] = { n: 0, r: 0 }
      g[b].n++
      g[b].r += a.price || 0
    })

    return Object.entries(g)
      .map(([name, v]) => ({
        name,
        ...v,
        avatar_url: barberPhotos[nameKey(name)] || null,
      }))
      .sort((a, b) => b.r - a.r)
  }, [rev, barberPhotos])

  function getCommissionPercent(barberName: string) {
    const match = commissionSettings.find((row) => nameKey(row.nome || row.name) === nameKey(barberName))
    const type = getBarberCompensation(match).type
    if (type !== 'commission' && type !== 'salary_plus_commission') return 0
    return Number(match?.commission_percent ?? match?.commission_percentage ?? 0)
  }

  const commissionBalances = useMemo(() => {
    const balances: Record<string, { name: string; earned: number; paid: number; pending: number; percent: number }> = {}

    rev.forEach((appointment) => {
      const name = appointment.barber || '—'
      const percent = getCommissionPercent(name)
      const amount = roundMoney(Number(appointment.price || 0) * (percent / 100))

      if (!balances[name]) {
        balances[name] = { name, earned: 0, paid: 0, pending: 0, percent }
      }

      balances[name].earned = roundMoney(balances[name].earned + amount)
      balances[name].percent = percent
    })

    filteredCommissionPayments.forEach((payment) => {
      const name = payment.barber_name || '—'

      if (!balances[name]) {
        balances[name] = { name, earned: 0, paid: 0, pending: 0, percent: getCommissionPercent(name) }
      }

      balances[name].paid = roundMoney(balances[name].paid + Number(payment.amount || 0))
    })

    return Object.values(balances)
      .map((balance) => ({
        ...balance,
        pending: Math.max(0, roundMoney(balance.earned - balance.paid)),
      }))
      .sort((a, b) => b.pending - a.pending || b.earned - a.earned)
  }, [rev, filteredCommissionPayments, commissionSettings])

  const selectedCommissionBalance = commissionBalances.find((barber) => barber.name === commissionBarber)

  const recentTransactions = useMemo(() => {
    return filtered.slice(0, 5)
  }, [filtered])

  const chartMax = Math.max(...chartData.map((item) => item.value), 1)
  const pieTotal = pieData.reduce((sum, item) => sum + item.value, 0)

  function getUnitName(unitId?: string | null) {
    if (!unitId) return 'Sem unidade'
    return units.find((unit) => unit.id === unitId)?.name || 'Unidade removida'
  }

  const unitRanking = useMemo(() => {
    return units.map((unit) => {
      const unitAppointments = appts.filter((a) => a.unit_id === unit.id && inPeriod(a.appointment_date, period)).filter(isRevenue)
      const appointmentRevenue = unitAppointments.reduce((sum, a) => sum + Number(a.price || 0), 0)
      const unitEntries = entries.filter((entry) => entry.unit_id === unit.id && inPeriod(entry.entry_date, period))
      const manualIncome = unitEntries.filter((entry) => entry.type === 'entrada').reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
      const expenses = unitEntries.filter((entry) => entry.type === 'despesa').reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
      const revenue = appointmentRevenue + manualIncome
      return { id: unit.id, name: unit.name, appointments: unitAppointments.length, revenue, expenses, profit: revenue - expenses }
    }).sort((a, b) => b.revenue - a.revenue)
  }, [units, appts, entries, period])

  const periods: { key: Period; label: string }[] = [
    { key: 'hoje', label: 'Hoje' },
    { key: 'semana', label: 'Semana' },
    { key: 'mes', label: 'Este mês' },
    { key: 'tudo', label: 'Tudo' },
  ]

  const kpis = [
    {
      icon: CircleDollarSign,
      label: 'Receita Total',
      value: fmt(totalRev),
      color: '#3b82f6',
      sub: '+18,4% em relação ao mês passado',
    },
    {
      icon: CheckCircle2,
      label: 'Recebido',
      value: fmt(totalPaid),
      color: '#10b981',
      sub: '+12,6% em relação ao mês passado',
    },
    {
      icon: Hourglass,
      label: 'Pendente',
      value: fmt(totalPend),
      color: '#f59e0b',
      sub: totalPend > 0 ? 'Existem valores pendentes' : 'Nenhum valor pendente',
    },
    {
      icon: Target,
      label: 'Lucro Líquido',
      value: fmt(netCash),
      color: '#8b5cf6',
      sub: 'Recebido - despesas - comissões',
    },
  ]

  function exportCSV() {
    const header = [...(isPremium ? ['Unidade'] : []), 'Cliente', 'Servico', 'Barbeiro', 'Valor', 'Data', 'Pagamento', 'Status']
    const rows = filtered.map((a) => [
      ...(isPremium ? [getUnitName(a.unit_id)] : []),
      a.client_name,
      a.service,
      a.barber,
      String(a.price || 0).replace('.', ','),
      fmtDate(a.appointment_date),
      PAYMENT_LABELS[normalizePaymentMethod(a.payment_method)] || 'Outros',
      a.status,
    ])

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `financeiro-${slug}-${localDateKey()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="finance-loading">
        <div className="loader" />
        <p>Carregando financeiro...</p>

        <style>{`
          .finance-loading {
            min-height: 60vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            color: #64748b;
          }

          .loader {
            width: 36px;
            height: 36px;
            border-radius: 999px;
            border: 3px solid #1e2535;
            border-top-color: #3b82f6;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="finance-page">
      <style>{`
        .finance-page {
          min-height: 100vh;
          color: #f8fafc;
          font-family: 'Inter', 'DM Sans', 'Segoe UI', sans-serif;
        }

        .finance-header {
          margin-bottom: 18px;
          padding: 22px;
          border-radius: 22px;
          background:
            radial-gradient(circle at top right, rgba(37, 99, 235, 0.16), transparent 35%),
            linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(15, 23, 42, 0.72));
          border: 1px solid rgba(148, 163, 184, 0.1);
        }

        .finance-header h1 {
          margin: 0;
          font-size: 30px;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .finance-header p {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 13px;
        }

        .finance-filters {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .periods {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .unit-filter {
          min-height: 42px;
          border-radius: 12px;
          border: 1px solid rgba(148,163,184,.14);
          background: rgba(15,23,42,.82);
          color: #f8fafc;
          font-weight: 850;
          padding: 0 13px;
          outline: none;
        }

        .period-btn {
          border: 1px solid rgba(148, 163, 184, 0.08);
          cursor: pointer;
          font-weight: 800;
          font-size: 13px;
          padding: 9px 16px;
          border-radius: 12px;
          transition: .18s ease;
        }

        .period-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(59, 130, 246, .45);
        }

        .grid-kpi {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .premium-card {
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(circle at top right, rgba(59, 130, 246, 0.12), transparent 30%),
            linear-gradient(145deg, rgba(15, 23, 42, .94), rgba(8, 13, 28, .96));
          border: 1px solid rgba(148, 163, 184, .11);
          border-radius: 20px;
          box-shadow: 0 24px 60px rgba(0, 0, 0, .23);
        }

        .kpi-card {
  min-height: 156px;
  padding: 22px 20px 34px;
}

        .kpi-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .kpi-icon {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,255,255,.12);
          box-shadow: 0 0 28px rgba(59,130,246,.15);
        }

        .kpi-card p {
          margin: 10px 0 4px;
          color: #94a3b8;
          font-size: 12px;
          font-weight: 700;
        }

        .kpi-card h3 {
  margin: 0;
  font-size: 23px;
  font-weight: 950;
  letter-spacing: -0.04em;
  position: relative;
  z-index: 2;
}

        .kpi-sub {
  display: block;
  margin-top: 9px;
  font-size: 11px;
  font-weight: 800;
  position: relative;
  z-index: 2;
}

        .mini-spark {
  position: absolute;
  left: 20px;
  right: 20px;
  bottom: 14px;
  height: 22px;
  display: flex;
  align-items: end;
  gap: 6px;
  opacity: .38;
  z-index: 1;
  pointer-events: none;
}

        .mini-spark span {
  flex: 1;
  border-radius: 999px 999px 0 0;
  opacity: .6;
  box-shadow: none;
}

        .main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.7fr) minmax(280px, .9fr) minmax(240px, .68fr);
          gap: 16px;
          margin-bottom: 16px;
        }

        .chart-card {
          padding: 20px;
        }

        .card-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }

        .eyebrow {
          margin: 0;
          color: #60a5fa;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .big-value {
          margin: 5px 0 0;
          font-size: 30px;
          font-weight: 950;
          letter-spacing: -.05em;
        }

        .mode-toggle {
          display: flex;
          padding: 4px;
          border-radius: 12px;
          background: rgba(2, 6, 23, .6);
          border: 1px solid rgba(148, 163, 184, .12);
        }

        .mode-toggle button {
          border: 0;
          cursor: pointer;
          border-radius: 9px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 800;
          color: #94a3b8;
          background: transparent;
        }

        .mode-toggle button.active {
          color: #fff;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          box-shadow: 0 10px 26px rgba(37, 99, 235, .25);
        }

        .bar-chart {
          height: 220px;
          display: flex;
          align-items: stretch;
          gap: 8px;
          padding: 12px 8px 0;
          border-radius: 18px;
          background:
            linear-gradient(rgba(148,163,184,.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,.035) 1px, transparent 1px);
          background-size: 100% 25%, 8% 100%;
        }

        .bar-item {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          align-items: center;
          gap: 7px;
        }

        .bar-wrap {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: flex-end;
        }

        .bar {
          width: 100%;
          border-radius: 10px 10px 3px 3px;
          background: linear-gradient(180deg, #93c5fd, #2563eb);
          box-shadow: 0 0 28px rgba(37, 99, 235, .42);
          transition: .18s ease;
        }

        .bar:hover {
          filter: brightness(1.18);
          transform: translateY(-2px);
        }

        .bar-label {
          min-height: 12px;
          font-size: 10px;
          line-height: 12px;
          color: #64748b;
          white-space: nowrap;
        }

        .summary-card {
          padding: 20px;
        }

        .summary-title,
        .quick-title,
        .section-title {
          margin: 0 0 16px;
          font-size: 16px;
          font-weight: 950;
          letter-spacing: -0.03em;
        }

        .donut-wrap {
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .donut {
          width: 150px;
          height: 150px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: conic-gradient(#10b981 0 50%, #f59e0b 50% 100%, #ef4444 100% 100%);
          box-shadow: 0 0 44px rgba(16,185,129,.12);
          flex-shrink: 0;
        }

        .donut-inner {
          width: 92px;
          height: 92px;
          border-radius: 999px;
          background: #071022;
          display: grid;
          place-items: center;
          text-align: center;
          border: 1px solid rgba(148,163,184,.12);
        }

        .donut-inner strong {
          display: block;
          font-size: 18px;
          font-weight: 950;
        }

        .donut-inner span {
          font-size: 11px;
          color: #94a3b8;
        }

        .legend {
          flex: 1;
          display: grid;
          gap: 12px;
        }

        .legend-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: #cbd5e1;
          font-size: 12px;
        }

        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          flex-shrink: 0;
        }

        .quick-card {
          padding: 18px;
        }

        .quick-list {
          display: grid;
          gap: 10px;
        }

        .quick-btn {
          width: 100%;
          border: 1px solid rgba(148,163,184,.1);
          background: rgba(15,23,42,.68);
          color: #f8fafc;
          border-radius: 14px;
          padding: 13px;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          text-align: left;
          transition: .18s ease;
        }

        .quick-btn:hover {
          transform: translateX(2px);
          border-color: rgba(59,130,246,.45);
          background: rgba(30,41,59,.82);
        }

        .quick-icon {
          width: 34px;
          height: 34px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .quick-btn strong {
          display: block;
          font-size: 13px;
        }

        .quick-btn span {
          display: block;
          margin-top: 2px;
          font-size: 11px;
          color: #94a3b8;
        }

        .lower-grid {
          display: grid;
          grid-template-columns: .95fr .95fr 1fr 1.25fr;
          gap: 16px;
          margin-bottom: 16px;
        }

        .box-card {
          padding: 18px;
        }

        .payment-row,
        .barber-row,
        .transaction-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid rgba(148,163,184,.08);
        }

        .payment-row:last-child,
        .barber-row:last-child,
        .transaction-row:last-child {
          border-bottom: 0;
        }

        .payment-progress {
          height: 7px;
          width: 100%;
          border-radius: 999px;
          background: rgba(148,163,184,.12);
          overflow: hidden;
          margin-top: 7px;
        }

        .payment-progress span {
          display: block;
          height: 100%;
          border-radius: inherit;
        }

        .avatar {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          object-fit: cover;
          flex-shrink: 0;
          border: 1px solid rgba(59,130,246,.26);
        }

        .avatar-fallback {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: rgba(59,130,246,.16);
          border: 1px solid rgba(59,130,246,.24);
          color: #93c5fd;
          display: grid;
          place-items: center;
          font-size: 12px;
          font-weight: 950;
          flex-shrink: 0;
        }

        .grow {
          flex: 1;
          min-width: 0;
        }

        .truncate {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .muted {
          color: #94a3b8;
          font-size: 12px;
        }

        .green {
          color: #10b981;
        }

        .red {
          color: #ef4444;
        }

        .yellow {
          color: #f59e0b;
        }

        .blue {
          color: #3b82f6;
        }

        .table-card {
          padding: 18px;
        }

        .table-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }

        .finance-input {
          background: rgba(2,6,23,.52);
          border: 1px solid rgba(148,163,184,.11);
          border-radius: 12px;
          padding: 10px 12px;
          color: #f8fafc;
          font-size: 13px;
          outline: none;
          width: 220px;
        }

        .finance-select {
          max-width: 100%;
          background: rgba(15,23,42,.9);
          border: 1px solid rgba(148,163,184,.18);
          border-radius: 9px;
          color: #cbd5e1;
          font-weight: 800;
          outline: none;
        }

        .export-btn {
          border: 1px solid rgba(59,130,246,.35);
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: white;
          border-radius: 12px;
          padding: 10px 13px;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .status-pill {
          padding: 5px 10px;
          border-radius: 9px;
          font-size: 11px;
          font-weight: 900;
          display: inline-flex;
        }

        .pay-btn {
          border: 0;
          border-radius: 9px;
          padding: 7px 13px;
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .transactions-table {
          width: 100%;
          min-width: 760px;
          border-collapse: collapse;
        }

        .transactions-table th {
          text-align: left;
          padding: 11px 12px;
          color: #64748b;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: .08em;
          text-transform: uppercase;
          border-bottom: 1px solid rgba(148,163,184,.1);
        }

        .transactions-table td {
          padding: 13px 12px;
          border-bottom: 1px solid rgba(148,163,184,.06);
          font-size: 13px;
        }

        .transactions-table tr:hover td {
          background: rgba(255,255,255,.018);
        }


        .operation-overlay {
          position: fixed;
          inset: 0;
          z-index: 90;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(0,0,0,.66);
          backdrop-filter: blur(8px);
        }

        .operation-modal {
          width: min(520px, 100%);
          border-radius: 24px;
          background:
            radial-gradient(circle at top right, rgba(37,99,235,.18), transparent 38%),
            linear-gradient(145deg, rgba(15,23,42,.98), rgba(8,13,28,.99));
          border: 1px solid rgba(148,163,184,.14);
          box-shadow: 0 30px 90px rgba(0,0,0,.55);
          overflow: hidden;
        }

        .operation-head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 24px 26px 0;
        }

        .operation-head h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 950;
          letter-spacing: -.04em;
        }

        .operation-close {
          width: 40px;
          height: 40px;
          border-radius: 14px;
          border: 1px solid rgba(148,163,184,.14);
          background: rgba(15,23,42,.82);
          color: #94a3b8;
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .operation-msg {
          margin: 18px 26px 0;
          padding: 12px 14px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 800;
        }

        .operation-msg.success {
          color: #6ee7b7;
          border: 1px solid rgba(16,185,129,.24);
          background: rgba(16,185,129,.1);
        }

        .operation-msg.error {
          color: #fca5a5;
          border: 1px solid rgba(239,68,68,.24);
          background: rgba(239,68,68,.1);
        }

        .operation-body {
          padding: 22px 26px;
          display: grid;
          gap: 14px;
        }

        .operation-body label {
          display: grid;
          gap: 8px;
          color: #cbd5e1;
          font-size: 13px;
          font-weight: 850;
        }

        .commission-pending-box {
          display: grid;
          gap: 4px;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid rgba(139, 92, 246, 0.24);
          background: rgba(139, 92, 246, 0.1);
        }

        .commission-pending-box span {
          color: #94a3b8;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .06em;
          text-transform: uppercase;
        }

        .commission-pending-box strong {
          color: #f8fafc;
          font-size: 22px;
          font-weight: 950;
        }

        .commission-pending-box small {
          color: #94a3b8;
          font-size: 12px;
          line-height: 1.35;
        }

        .operation-body input,
        .operation-body select {
          min-height: 46px;
          border-radius: 14px;
          border: 1px solid rgba(148,163,184,.14);
          background: rgba(2,6,23,.54);
          color: #f8fafc;
          outline: none;
          padding: 0 14px;
          font-size: 14px;
        }

        .operation-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 0 26px 26px;
        }

        .operation-cancel,
        .operation-confirm {
          min-height: 44px;
          border-radius: 14px;
          padding: 0 18px;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
        }

        .operation-cancel {
          border: 1px solid rgba(148,163,184,.16);
          background: transparent;
          color: #94a3b8;
        }

        .operation-confirm {
          border: 0;
          background: linear-gradient(135deg,#2563eb,#4f46e5);
          color: white;
        }

        .operation-confirm:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        @media (max-width: 1200px) {
          .main-grid {
            grid-template-columns: 1fr 1fr;
          }

          .quick-card {
            grid-column: 1 / -1;
          }

          .lower-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .finance-header {
            background: transparent;
            border: 0;
            padding: 0;
            border-radius: 0;
          }

          .finance-header h1 {
            font-size: 24px;
          }

          .grid-kpi {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .kpi-card {
            padding: 15px;
            min-height: 128px;
          }

          .kpi-card h3 {
            font-size: 17px;
          }

          .kpi-sub {
            font-size: 10px;
          }

          .main-grid,
          .lower-grid {
            grid-template-columns: 1fr;
          }

          .bar-chart {
            height: 180px;
            gap: 5px;
          }

          .donut-wrap {
            flex-direction: column;
            align-items: flex-start;
          }

          .donut {
            width: 132px;
            height: 132px;
          }

          .donut-inner {
            width: 82px;
            height: 82px;
          }

          .finance-input {
            width: 100%;
          }

          .mobile-card {
            background: rgba(255,255,255,.025);
            border: 1px solid rgba(148,163,184,.08);
            border-radius: 14px;
            padding: 14px;
          }
        }
      `}</style>

      <div className="finance-header">
        <h1>Financeiro</h1>
        <p>Acompanhe todas as receitas, pagamentos e comissões da sua barbearia.</p>
      </div>

      <div className="finance-filters">
        <div className="periods">
        {periods.map((p) => (
          <button
            key={p.key}
            className="period-btn"
            onClick={() => setPeriod(p.key)}
            style={{
              background:
                period === p.key
                  ? 'linear-gradient(135deg,#2563eb,#1d4ed8)'
                  : 'rgba(15,23,42,.8)',
              color: period === p.key ? '#fff' : '#94a3b8',
              boxShadow: period === p.key ? '0 12px 28px rgba(37,99,235,.25)' : 'none',
            }}
          >
            {p.label}
          </button>
        ))}
        </div>

        {isPremium && (
          <select className="unit-filter" value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)}>
            <option value="all">Todas as unidades</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid-kpi">
        {kpis.map((k) => {
          const Icon = k.icon

          return (
            <div key={k.label} className="premium-card kpi-card">
              <div className="kpi-row">
                <div>
                  <div className="kpi-icon" style={{ background: `${k.color}18`, color: k.color }}>
                    <Icon size={21} strokeWidth={2.5} />
                  </div>

                  <p>{k.label}</p>
                  <h3>{k.value}</h3>
                  <span className="kpi-sub" style={{ color: k.label === 'Pendente' && totalPend > 0 ? '#f59e0b' : '#10b981' }}>
                    {k.sub}
                  </span>
                </div>
              </div>

              <MiniSpark color={k.color} />
            </div>
          )
        })}
      </div>

      <div className="main-grid">
        <div className="premium-card chart-card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Receita no período</p>
              <h2 className="big-value">{fmt(totalRev)}</h2>
            </div>

            <div className="mode-toggle">
              {(['diario', 'mensal'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setChartMode(m)}
                  className={chartMode === m ? 'active' : ''}
                >
                  {m === 'diario' ? 'Diário' : 'Mensal'}
                </button>
              ))}
            </div>
          </div>

          <div className="bar-chart">
            {chartData.length === 0 ? (
              <div style={{ width: '100%', display: 'grid', placeItems: 'center', color: '#64748b' }}>
                Sem dados no período
              </div>
            ) : (
              chartData.map((item, index) => {
                const hasValue = item.value > 0
                const height = hasValue ? Math.max(8, (item.value / chartMax) * 100) : 4
                const showLabel =
                  chartData.length <= 12 ||
                  index === 0 ||
                  index === chartData.length - 1 ||
                  hasValue ||
                  (!isMobile && index % 2 === 0)

                return (
                  <div key={`${item.label}-${index}`} className="bar-item">
                    <div className="bar-wrap">
                      <div
                        title={`${item.label}: ${fmt(item.value)}`}
                        className="bar"
                        style={{
                          height: `${height}%`,
                          opacity: hasValue ? 1 : 0.35,
                        }}
                      />
                    </div>

                    <span className="bar-label" style={{ color: showLabel ? '#64748b' : 'transparent' }}>
                      {item.label}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="premium-card summary-card">
          <h3 className="summary-title">Resumo financeiro</h3>

          <div className="donut-wrap">
            <div className="donut">
              <div className="donut-inner">
                <div>
                  <strong>{fmt(totalRev)}</strong>
                  <span>Total</span>
                </div>
              </div>
            </div>

            <div className="legend">
              <div className="legend-row">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="legend-dot" style={{ background: '#10b981' }} />
                  Recebido
                </span>
                <strong>{fmt(totalPaid)}</strong>
              </div>

              <div className="legend-row">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="legend-dot" style={{ background: '#f59e0b' }} />
                  Pendente
                </span>
                <strong>{fmt(totalPend)}</strong>
              </div>

              <div className="legend-row">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="legend-dot" style={{ background: '#ef4444' }} />
                  Cancelado
                </span>
                <strong>{cancelled}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="premium-card quick-card">
          <h3 className="quick-title">Central de Operações</h3>

          <div className="quick-list">
            <button className="quick-btn" onClick={() => router.push(`/${slug}/admin/agendamentos`)}>
              <span className="quick-icon" style={{ background: 'rgba(37,99,235,.18)', color: '#3b82f6' }}>
                <CalendarDays size={18} />
              </span>
              <span>
                <strong>Novo agendamento</strong>
                <span>Abrir agenda da barbearia</span>
              </span>
            </button>

            {isProOrPremium && (
              <>
                <button className="quick-btn" onClick={() => openOperationModal('entrada')}>
                  <span className="quick-icon" style={{ background: 'rgba(16,185,129,.18)', color: '#10b981' }}>
                    <ArrowUpCircle size={18} />
                  </span>
                  <span>
                    <strong>Registrar entrada</strong>
                    <span>Venda avulsa, produto ou ajuste</span>
                  </span>
                </button>

                <button className="quick-btn" onClick={() => openOperationModal('despesa')}>
                  <span className="quick-icon" style={{ background: 'rgba(245,158,11,.18)', color: '#f59e0b' }}>
                    <ArrowDownCircle size={18} />
                  </span>
                  <span>
                    <strong>Registrar despesa</strong>
                    <span>Aluguel, produtos, água ou luz</span>
                  </span>
                </button>

                <button className="quick-btn" onClick={() => openOperationModal('comissao')}>
                  <span className="quick-icon" style={{ background: 'rgba(139,92,246,.18)', color: '#8b5cf6' }}>
                    <Users size={18} />
                  </span>
                  <span>
                    <strong>Pagar comissão</strong>
                    <span>Registrar repasse ao barbeiro</span>
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="lower-grid">
        {isPremium && (
          <div className="premium-card box-card">
            <h3 className="section-title">Ranking de unidades</h3>
            {unitRanking.length === 0 ? (
              <p className="muted">Sem unidades cadastradas.</p>
            ) : (
              unitRanking.slice(0, 5).map((unit, index) => (
                <div key={unit.id} className="barber-row">
                  <div className="avatar-fallback">{index + 1}</div>
                  <div className="grow">
                    <strong className="truncate">{unit.name}</strong>
                    <div className="muted">{unit.appointments} agendamentos · lucro {fmt(unit.profit)}</div>
                  </div>
                  <strong className="green">{fmt(unit.revenue)}</strong>
                </div>
              ))
            )}
          </div>
        )}

        <div className="premium-card box-card">
          <h3 className="section-title">Métodos de pagamento</h3>

          {pieData.length === 0 ? (
            <p className="muted">Sem dados</p>
          ) : (
            pieData.map((p) => {
              const Icon = PAYMENT_ICONS[p.key] || WalletCards
              const pct = pieTotal > 0 ? Math.round((p.value / pieTotal) * 100) : 0
              const color = PIE_COLORS[p.key] || '#94a3b8'

              return (
                <div key={p.key} className="payment-row">
                  <Icon size={22} color={color} strokeWidth={2.4} />

                  <div className="grow">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <strong>{p.name}</strong>
                      <strong>{fmt(p.value)}</strong>
                    </div>

                    <div className="payment-progress">
                      <span style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                </div>
              )
            })
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontWeight: 950 }}>
            <span>Total</span>
            <span>{fmt(totalRev)}</span>
          </div>
        </div>

        <div className="premium-card box-card">
          <h3 className="section-title">Receita por barbeiro</h3>

          {barberData.length === 0 ? (
            <p className="muted">Sem dados</p>
          ) : (
            barberData.slice(0, 5).map((b) => (
              <div key={b.name} className="barber-row">
                {b.avatar_url ? (
                  <img src={b.avatar_url} alt={b.name} className="avatar" />
                ) : (
                  <div className="avatar-fallback">{(b.name || '?').slice(0, 2).toUpperCase()}</div>
                )}

                <div className="grow">
                  <strong className="truncate">{b.name}</strong>
                  <div className="muted">{b.n} atendimentos</div>
                </div>

                <strong className="green">{fmt(b.r)}</strong>
              </div>
            ))
          )}
        </div>

        <div className="premium-card box-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <h3 className="section-title">Transações recentes</h3>
            <button className="export-btn" onClick={exportCSV}>
              <FileText size={15} />
              Exportar
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <p className="muted">Sem transações no período.</p>
          ) : (
            recentTransactions.map((a) => {
              const paid = a.payment_status === 'paid'
              const canceled = a.status === 'cancelled' || a.status === 'canceled'
              const valueColor = canceled ? '#ef4444' : paid ? '#10b981' : '#f59e0b'

              return (
                <div key={a.id} className="transaction-row">
                  <span
                    className="quick-icon"
                    style={{
                      background: `${valueColor}18`,
                      color: valueColor,
                      width: 34,
                      height: 34,
                    }}
                  >
                    {paid ? <CheckCircle2 size={17} /> : canceled ? <XCircle size={17} /> : <Hourglass size={17} />}
                  </span>

                  <div className="grow">
                    <strong className="truncate">{a.service || 'Atendimento'}</strong>
                    <div className="muted">
                      {isPremium ? `${getUnitName(a.unit_id)} · ` : ''}{a.client_name} · {fmtDate(a.appointment_date)}
                    </div>
                  </div>

                  <strong style={{ color: valueColor }}>{fmt(a.price)}</strong>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="premium-card table-card">
        <div className="table-head">
          <h3 className="section-title" style={{ margin: 0 }}>Transações</h3>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              className="finance-input"
              placeholder="Buscar cliente, serviço ou barbeiro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button className="export-btn"
  onClick={() =>
    exportFinancePdf({
      businessName: "KorteBarber",
      period: "01/06/2026 a 30/06/2026",
      totalRevenue: 40,
      received: 0,
      pending: 40,
      canceled: 0,
      transactions: [
        {
          client: "Mateus",
          service: "Corte Barba",
          barber: "Thiago",
          value: 40,
          date: "01/06/2026",
          paymentMethod: "PIX",
          status: "Pendente",
        },
      ],
    })
  }
>
  Exportar PDF
</button>
          </div>
        </div>

        {isMobile ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {filtered.length === 0 ? (
              <p className="muted">Nenhum resultado</p>
            ) : (
              filtered.map((a) => {
                const isPaid = a.payment_status === 'paid'
                const isCancelled = a.status === 'cancelled' || a.status === 'canceled'

                return (
                  <div key={a.id} className="mobile-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <strong>{a.client_name}</strong>
                        <div className="muted">{isPremium ? `${getUnitName(a.unit_id)} · ` : ''}{a.service} · {a.barber}</div>
                      </div>

                      <strong className="green">{fmt(a.price)}</strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                      <span className="muted">{fmtDate(a.appointment_date)}</span>

                      <span
                        className="status-pill"
                        style={{
                          background: isCancelled
                            ? 'rgba(239,68,68,.12)'
                            : isPaid
                              ? 'rgba(16,185,129,.12)'
                              : 'rgba(245,158,11,.12)',
                          color: isCancelled ? '#ef4444' : isPaid ? '#10b981' : '#f59e0b',
                        }}
                      >
                        {isCancelled ? 'Cancelado' : isPaid ? 'Pago' : 'Pendente'}
                      </span>

                      {!isCancelled && (
                        <PaymentMethodSelect
                          value={a.payment_method}
                          onChange={(method) => updatePaymentMethod(a.id, method)}
                          compact
                        />
                      )}

                      {!isPaid && !isCancelled && (
                        <button className="pay-btn" onClick={() => markPaid(a.id, a.payment_method)}>
                          Pago
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="transactions-table">
              <thead>
                <tr>
                  {[...(isPremium ? ['Unidade'] : []), 'Cliente', 'Serviço', 'Barbeiro', 'Valor', 'Data', 'Pagamento', 'Status', 'Ação'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={isPremium ? 9 : 8} style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>
                      Nenhum resultado
                    </td>
                  </tr>
                ) : (
                  filtered.map((a) => {
                    const isPaid = a.payment_status === 'paid'
                    const isCancelled = a.status === 'cancelled' || a.status === 'canceled'

                    return (
                      <tr key={a.id}>
                        {isPremium && <td className="muted">{getUnitName(a.unit_id)}</td>}
                        <td>
                          <strong>{a.client_name}</strong>
                        </td>
                        <td className="muted">{a.service}</td>
                        <td className="muted">{a.barber}</td>
                        <td>
                          <strong className="green">{fmt(a.price)}</strong>
                        </td>
                        <td className="muted">{fmtDate(a.appointment_date)}</td>
                        <td>
                          {!isCancelled ? (
                            <PaymentMethodSelect
                              value={a.payment_method}
                              onChange={(method) => updatePaymentMethod(a.id, method)}
                            />
                          ) : (
                            <span className="muted">-</span>
                          )}
                        </td>
                        <td>
                          <span
                            className="status-pill"
                            style={{
                              background: isCancelled
                                ? 'rgba(239,68,68,.12)'
                                : isPaid
                                  ? 'rgba(16,185,129,.12)'
                                  : 'rgba(245,158,11,.12)',
                              color: isCancelled ? '#ef4444' : isPaid ? '#10b981' : '#f59e0b',
                            }}
                          >
                            {isCancelled ? 'Cancelado' : isPaid ? 'Pago' : 'Pendente'}
                          </span>
                        </td>
                        <td>
                          {!isPaid && !isCancelled && (
                            <button className="pay-btn" onClick={() => markPaid(a.id, a.payment_method)}>
                              Marcar pago
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPend > 0 && (
          <div
            style={{
              marginTop: 16,
              padding: '13px 16px',
              borderRadius: 14,
              background: 'rgba(245,158,11,.08)',
              border: '1px solid rgba(245,158,11,.22)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900 }}>
              <Hourglass size={16} color="#f59e0b" />
              Total pendente
            </span>

            <strong className="yellow" style={{ fontSize: 18 }}>{fmt(totalPend)}</strong>
          </div>
        )}
      </div>

      {operationModal !== 'closed' && (
        <div className="operation-overlay" onClick={(event) => {
          if (event.target === event.currentTarget) setOperationModal('closed')
        }}>
          <div className="operation-modal">
            <div className="operation-head">
              <div>
                <p className="eyebrow">
                  {operationModal === 'entrada' ? 'Nova entrada' : operationModal === 'despesa' ? 'Nova despesa' : 'Comissão'}
                </p>
                <h2>
                  {operationModal === 'entrada'
                    ? 'Registrar entrada'
                    : operationModal === 'despesa'
                      ? 'Registrar despesa'
                      : 'Pagar comissão'}
                </h2>
              </div>
              <button className="operation-close" onClick={() => setOperationModal('closed')}>
                <X size={18} />
              </button>
            </div>

            {operationMsg && (
              <div className={`operation-msg ${operationMsg.type}`}>
                {operationMsg.text}
              </div>
            )}

            {operationModal === 'comissao' ? (
              <div className="operation-body">
                <label>
                  Barbeiro
                  <select
                    value={commissionBarber}
                    onChange={(event) => {
                      const name = event.target.value
                      const balance = commissionBalances.find((barber) => barber.name === name)
                      setCommissionBarber(name)
                      setCommissionAmount(balance?.pending ? String(balance.pending.toFixed(2)).replace('.', ',') : '')
                    }}
                  >
                    <option value="">Selecione</option>
                    {commissionBalances.map((barber) => (
                      <option key={barber.name} value={barber.name}>
                        {barber.name} - pendente {fmt(barber.pending)}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedCommissionBalance && (
                  <div className="commission-pending-box">
                    <span>Comissão pendente</span>
                    <strong>{fmt(selectedCommissionBalance.pending)}</strong>
                    <small>
                      Gerado: {fmt(selectedCommissionBalance.earned)} · Pago: {fmt(selectedCommissionBalance.paid)} · {selectedCommissionBalance.percent}% de comissão
                    </small>
                  </div>
                )}

                <label>
                  Valor pago
                  <input
                    value={commissionAmount}
                    onChange={(event) => setCommissionAmount(event.target.value)}
                    placeholder="Ex: 89,40"
                    inputMode="decimal"
                  />
                </label>

                {isPremium && (
                  <label>
                    Unidade
                    <select value={commissionUnitId} onChange={(event) => setCommissionUnitId(event.target.value)}>
                      <option value="">Sem unidade definida</option>
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>{unit.name}</option>
                      ))}
                    </select>
                  </label>
                )}

                <label>
                  Método de pagamento
                  <select value={commissionMethod} onChange={(event) => setCommissionMethod(event.target.value)}>
                    <option value="pix">PIX</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cartao">Cartão</option>
                    <option value="outros">Outros</option>
                  </select>
                </label>
              </div>
            ) : (
              <div className="operation-body">
                <label>
                  Descrição
                  <input
                    value={entryDescription}
                    onChange={(event) => setEntryDescription(event.target.value)}
                    placeholder={operationModal === 'entrada' ? 'Ex: Venda de pomada' : 'Ex: Compra de produtos'}
                  />
                </label>

                <label>
                  Valor
                  <input
                    value={entryAmount}
                    onChange={(event) => setEntryAmount(event.target.value)}
                    placeholder="Ex: 150,00"
                    inputMode="decimal"
                  />
                </label>

                {isPremium && (
                  <label>
                    Unidade
                    <select value={entryUnitId} onChange={(event) => setEntryUnitId(event.target.value)}>
                      <option value="">Sem unidade definida</option>
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>{unit.name}</option>
                      ))}
                    </select>
                  </label>
                )}

                <label>
                  Método de pagamento
                  <select value={entryMethod} onChange={(event) => setEntryMethod(event.target.value)}>
                    <option value="pix">PIX</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cartao">Cartão</option>
                    <option value="outros">Outros</option>
                  </select>
                </label>

                <label>
                  Data
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(event) => setEntryDate(event.target.value)}
                  />
                </label>
              </div>
            )}

            <div className="operation-footer">
              <button className="operation-cancel" onClick={() => setOperationModal('closed')}>Cancelar</button>
              <button
                className="operation-confirm"
                disabled={operationLoading}
                onClick={() => {
                  if (operationModal === 'entrada') saveFinancialEntry('entrada')
                  if (operationModal === 'despesa') saveFinancialEntry('despesa')
                  if (operationModal === 'comissao') saveCommissionPayment()
                }}
              >
                {operationLoading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
