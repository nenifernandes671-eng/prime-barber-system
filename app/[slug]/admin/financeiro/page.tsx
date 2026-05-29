'use client'

import { useEffect, useState, useMemo, type ElementType } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Banknote,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Hourglass,
  Smartphone,
  Target,
  Users,
  WalletCards,
  XCircle,
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
}
interface BarberPhoto {
  nome: string
  avatar_url?: string | null
}

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
  const d = parseLocalDate(dateStr), now = new Date()
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
  pix: '#3b82f6', cartao: '#10b981', dinheiro: '#f59e0b', outros: '#8b5cf6',
}
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
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

function useIsMobile() {
  const [m, setM] = useState(false)
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 768)
    fn(); window.addEventListener('resize', fn)
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
      style={{
        width: compact ? 118 : 132,
        maxWidth: '100%',
        background: 'rgba(15,23,42,0.9)',
        border: '1px solid rgba(148,163,184,0.18)',
        borderRadius: 8,
        color: '#cbd5e1',
        padding: compact ? '5px 8px' : '7px 10px',
        fontSize: compact ? 11 : 12,
        fontWeight: 700,
        outline: 'none',
      }}
    >
      <option value="outros">Outros</option>
      <option value="pix">PIX</option>
      <option value="cartao">Cartão</option>
      <option value="dinheiro">Dinheiro</option>
    </select>
  )
}

export default function FinanceiroPage() {
  const pathname = usePathname()
  const slug = pathname.split('/').filter(Boolean)[0]
  const isMobile = useIsMobile()

  const [appts, setAppts] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('mes')
  const [search, setSearch] = useState('')
  const [chartMode, setChartMode] = useState<'diario' | 'mensal'>('diario')
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [barberPhotos, setBarberPhotos] = useState<Record<string, string>>({})

  useEffect(() => {
    async function init() {
      try {
        const { data: t } = await supabase.from('tenants').select('id').eq('slug', slug).maybeSingle()
        if (!t) return
        setTenantId(t.id)

        const { data } = await supabase
          .from('appointments').select('*')
          .eq('tenant_id', t.id)
          .order('appointment_date', { ascending: false })

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
        setBarberPhotos(Object.fromEntries(
          barberRows
            .filter(barber => barber.avatar_url)
            .map(barber => [nameKey(barber.nome), barber.avatar_url as string])
        ))
      } finally {
        setLoading(false)
      }
    }
    if (slug) init()
  }, [slug])

  async function markPaid(id: number, method = 'outros') {
    const paymentMethod = normalizePaymentMethod(method)
    await supabase
      .from('appointments')
      .update({ payment_status: 'paid', payment_method: paymentMethod })
      .eq('id', id)
      .eq('tenant_id', tenantId)
    setAppts(prev => prev.map(a => a.id === id ? { ...a, payment_status: 'paid', payment_method: paymentMethod } : a))
  }

  async function updatePaymentMethod(id: number, method: string) {
    const paymentMethod = normalizePaymentMethod(method)
    await supabase
      .from('appointments')
      .update({ payment_method: paymentMethod })
      .eq('id', id)
      .eq('tenant_id', tenantId)
    setAppts(prev => prev.map(a => a.id === id ? { ...a, payment_method: paymentMethod } : a))
  }

  const filtered = useMemo(() => appts.filter(a => {
    const ok = inPeriod(a.appointment_date, period)
    const s = search.toLowerCase()
    const match = !s || [a.client_name, a.service, a.barber].some(f => (f ?? '').toLowerCase().includes(s))
    return ok && match
  }), [appts, period, search])

  const rev = filtered.filter(isRevenue)
  const totalRev = rev.reduce((s, a) => s + (a.price || 0), 0)
  const totalPaid = filtered.filter(a => a.payment_status === 'paid').reduce((s, a) => s + (a.price || 0), 0)
  const totalPend = rev.filter(a => a.payment_status !== 'paid').reduce((s, a) => s + (a.price || 0), 0)
  const avgTicket = rev.length > 0 ? totalRev / rev.length : 0
  const cancelled = filtered.filter(a => a.status === 'cancelled' || a.status === 'canceled').length

  const chartData = useMemo(() => {
    const g: Record<string, number> = {}

    const now = new Date()
    if (chartMode === 'mensal') {
      MONTHS.forEach(m => { g[m] = 0 })
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

    rev.forEach(a => {
      const d = parseLocalDate(a.appointment_date)
      const key = chartMode === 'diario'
        ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
        : MONTHS[d.getMonth()]
      g[key] = (g[key] || 0) + (a.price || 0)
    })
    return Object.entries(g).map(([label, value]) => ({ label, value }))
  }, [rev, chartMode, period])

  const pieData = useMemo(() => {
    const g: Record<string, number> = {}
    rev.forEach(a => {
      const key = normalizePaymentMethod(a.payment_method)
      g[key] = (g[key] || 0) + (a.price || 0)
    })
    return Object.entries(g).map(([key, value]) => ({
      key, value,
      name: PAYMENT_LABELS[key] || 'Outros'
    }))
  }, [rev])

  const barberData = useMemo(() => {
    const g: Record<string, { n: number; r: number }> = {}
    rev.forEach(a => {
      const b = a.barber || '—'
      if (!g[b]) g[b] = { n: 0, r: 0 }
      g[b].n++; g[b].r += a.price || 0
    })
    return Object.entries(g)
      .map(([name, v]) => ({ name, ...v, avatar_url: barberPhotos[nameKey(name)] || null }))
      .sort((a, b) => b.r - a.r)
  }, [rev, barberPhotos])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #1e2535', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Carregando financeiro...</p>
    </div>
  )

  const card: React.CSSProperties = {
    background: isMobile ? '#0f172a' : 'rgba(15,23,42,0.8)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: isMobile ? '16px' : '22px',
  }

  const periods: { key: Period; label: string }[] = [
    { key: 'hoje', label: 'Hoje' },
    { key: 'semana', label: 'Semana' },
    { key: 'mes', label: 'Este mês' },
    { key: 'tudo', label: 'Tudo' },
  ]

  const kpis = [
    { icon: CircleDollarSign, label: 'Receita Total', value: fmt(totalRev), color: '#3b82f6' },
    { icon: CheckCircle2, label: 'Recebido', value: fmt(totalPaid), color: '#10b981' },
    { icon: Hourglass, label: 'Pendente', value: fmt(totalPend), color: '#f59e0b' },
    { icon: Target, label: 'Ticket Médio', value: fmt(avgTicket), color: '#8b5cf6' },
  ]

  const miniStats = [
    { icon: CalendarDays, v: rev.length, l: 'Atendimentos' },
    { icon: XCircle, v: cancelled, l: 'Cancelamentos' },
    { icon: Users, v: new Set(filtered.map(a => a.client_name)).size, l: 'Clientes únicos' },
    { icon: BarChart3, v: filtered.length > 0 ? `${((cancelled / filtered.length) * 100).toFixed(1)}%` : '0%', l: 'Taxa cancelamento' },
  ]
  const chartMax = Math.max(...chartData.map(item => item.value), 1)
  const pieTotal = pieData.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="finance-page" style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", color: '#f1f5f9', background: '#020617' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .pay-btn:hover { opacity: 0.85; }
        .period-btn { transition: all 0.15s; }
        .row-hover:hover { background: rgba(255,255,255,0.02) !important; }
        @media (max-width: 768px) {
          .finance-page {
            background: #020617;
          }
          .finance-page * {
            box-shadow: none !important;
            text-shadow: none !important;
          }
        }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ marginBottom: 18, padding: isMobile ? 0 : '20px 22px', borderRadius: isMobile ? 0 : 22, background: isMobile ? 'transparent' : 'linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.70))', border: isMobile ? 'none' : '1px solid rgba(148,163,184,0.08)' }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 28, fontWeight: 800, color: '#f1f5f9' }}>Financeiro</h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>Receitas, pagamentos e desempenho</p>
      </div>

      {/* ── PERIOD PILLS ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {periods.map(p => (
          <button key={p.key} className="period-btn" onClick={() => setPeriod(p.key)} style={{
            padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            background: period === p.key ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : 'rgba(15,23,42,0.8)',
            color: period === p.key ? '#fff' : '#64748b',
            boxShadow: period === p.key ? '0 4px 16px rgba(37,99,235,0.3)' : 'none',
          }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* ── KPI CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {kpis.map(k => {
          const Icon = k.icon
          return (
          <div key={k.label} style={{ ...card, position: 'relative', overflow: 'hidden' }}>
            {!isMobile && <div style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', background: k.color, filter: 'blur(60px)', opacity: 0.15, top: -40, right: -20, pointerEvents: 'none' }} />}
            <div style={{ width: 36, height: 36, borderRadius: 10, background: k.color + '20', border: `1px solid ${k.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 10 }}>
              <Icon size={18} strokeWidth={2.4} color={k.color} />
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.label}</p>
            <h3 style={{ margin: 0, fontSize: isMobile ? 16 : 22, fontWeight: 900, color: '#f1f5f9' }}>{k.value}</h3>
          </div>
        )})}
      </div>

      {/* ── CHART ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 11, color: '#334155', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>Receita no período</p>
            <h2 style={{ margin: 0, fontSize: isMobile ? 22 : 30, fontWeight: 900, color: '#f1f5f9' }}>{fmt(totalRev)}</h2>
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 3 }}>
            {(['diario', 'mensal'] as const).map(m => (
              <button key={m} onClick={() => setChartMode(m)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: chartMode === m ? '#1e3a8a' : 'transparent', color: chartMode === m ? '#93c5fd' : '#475569' }}>
                {m === 'diario' ? 'Diário' : 'Mensal'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ height: isMobile ? 180 : 240 }}>
          {chartData.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#334155', fontSize: 14 }}>Sem dados no período</p>
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'stretch', gap: isMobile ? 5 : 8, padding: isMobile ? '8px 2px 0' : '8px 8px 0', overflow: 'hidden' }}>
              {chartData.map((item, index) => {
                const hasValue = item.value > 0
                const height = hasValue ? Math.max(8, (item.value / chartMax) * 100) : 4
                const showLabel = chartData.length <= 12 || index === 0 || index === chartData.length - 1 || hasValue || (!isMobile && index % 2 === 0)
                return (
                  <div key={`${item.label}-${index}`} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                    <div style={{ width: '100%', minWidth: 4, maxWidth: isMobile ? 18 : 34, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                      <div title={`${item.label}: ${fmt(item.value)}`} style={{ width: '100%', height: `${height}%`, borderRadius: '6px 6px 2px 2px', background: hasValue ? '#3b82f6' : 'rgba(59,130,246,0.22)' }} />
                    </div>
                    <span style={{ minHeight: 12, fontSize: isMobile ? 9 : 10, lineHeight: '12px', color: showLabel ? '#475569' : 'transparent', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── GRID: PIE + BARBEIROS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* PIE */}
        <div style={card}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>Métodos de pagamento</h3>
          {pieData.length === 0 ? (
            <p style={{ color: '#475569', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>Sem dados</p>
          ) : (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pieData.map(p => {
                const Icon = PAYMENT_ICONS[p.key] || WalletCards
                const pct = pieTotal > 0 ? Math.round((p.value / pieTotal) * 100) : 0
                const color = PIE_COLORS[p.key] || '#94a3b8'
                return (
                  <div key={p.key} style={{ display: 'grid', gap: 7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <Icon size={18} color={color} strokeWidth={2.4} />
                        <span style={{ fontSize: isMobile ? 14 : 13, color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                      </div>
                      <span style={{ fontSize: isMobile ? 14 : 13, color: '#f1f5f9', fontWeight: 800, flexShrink: 0 }}>{fmt(p.value)}</span>
                    </div>
                    <div style={{ height: 8, width: '100%', borderRadius: 999, background: 'rgba(148,163,184,0.12)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* BARBEIROS */}
        <div style={card}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>Por barbeiro</h3>
          {barberData.length === 0 ? (
            <p style={{ color: '#475569', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>Sem dados</p>
          ) : barberData.map((b, i) => (
            <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, paddingBottom: 12, borderBottom: i < barberData.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              {b.avatar_url ? (
                <img src={b.avatar_url} alt={b.name} style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(59,130,246,0.25)' }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#93c5fd', flexShrink: 0 }}>
                  {(b.name || '?').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>{b.n} atendimentos</p>
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#10b981', flexShrink: 0 }}>{fmt(b.r)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── STATS MINI ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 20 }}>
        {miniStats.map((s, i) => {
          const Icon = s.icon
          return (
          <div key={i} style={{ ...card, textAlign: 'center', padding: '14px 10px' }}>
            <Icon size={20} color="#93c5fd" strokeWidth={2.4} />
            <p style={{ margin: '6px 0 2px', fontSize: 20, fontWeight: 900, color: '#f1f5f9' }}>{s.v}</p>
            <p style={{ margin: 0, fontSize: 11, color: '#475569' }}>{s.l}</p>
          </div>
        )})}
      </div>

      {/* ── TABELA ── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>Transações</h3>
          <input
            placeholder="🔍 Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 12px', color: '#f1f5f9', fontSize: 13, outline: 'none', width: isMobile ? '100%' : 200, boxSizing: 'border-box' }}
          />
        </div>

        {isMobile ? (
          /* Mobile: cards */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#475569', padding: '24px 0', fontSize: 13 }}>Nenhum resultado</p>
            ) : filtered.map(a => {
              const isPaid = a.payment_status === 'paid'
              const isCancelled = a.status === 'cancelled' || a.status === 'canceled'
              return (
                <div key={a.id} className="row-hover" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{a.client_name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>{a.service} · {a.barber}</p>
                    </div>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#10b981' }}>{fmt(a.price)}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#475569' }}>{fmtDate(a.appointment_date)}</span>
                      <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: isCancelled ? 'rgba(239,68,68,0.12)' : isPaid ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: isCancelled ? '#ef4444' : isPaid ? '#10b981' : '#f59e0b' }}>
                        {isCancelled ? 'Cancelado' : isPaid ? 'Pago' : 'Pendente'}
                      </span>
                    </div>
                    {!isCancelled && (
                      <PaymentMethodSelect value={a.payment_method} onChange={(method) => updatePaymentMethod(a.id, method)} compact />
                    )}
                    {!isPaid && !isCancelled && (
                      <button className="pay-btn" onClick={() => markPaid(a.id, a.payment_method)} style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        ✓ Pago
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Desktop: tabela */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Cliente','Serviço','Barbeiro','Valor','Data','Pagamento','Status',''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#334155', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '32px 0', textAlign: 'center', color: '#475569', fontSize: 13 }}>Nenhum resultado</td></tr>
                ) : filtered.map(a => {
                  const isPaid = a.payment_status === 'paid'
                  const isCancelled = a.status === 'cancelled' || a.status === 'canceled'
                  return (
                    <tr key={a.id} className="row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '13px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#93c5fd', flexShrink: 0 }}>
                            {(a.client_name || '?')[0].toUpperCase()}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{a.client_name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '13px 12px', fontSize: 13, color: '#94a3b8' }}>{a.service}</td>
                      <td style={{ padding: '13px 12px', fontSize: 13, color: '#94a3b8' }}>{a.barber}</td>
                      <td style={{ padding: '13px 12px', fontSize: 14, fontWeight: 800, color: '#10b981' }}>{fmt(a.price)}</td>
                      <td style={{ padding: '13px 12px', fontSize: 13, color: '#64748b' }}>{fmtDate(a.appointment_date)}</td>
                      <td style={{ padding: '13px 12px' }}>
                        {!isCancelled ? (
                          <PaymentMethodSelect value={a.payment_method} onChange={(method) => updatePaymentMethod(a.id, method)} />
                        ) : (
                          <span style={{ fontSize: 12, color: '#475569' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '13px 12px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: isCancelled ? 'rgba(239,68,68,0.12)' : isPaid ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: isCancelled ? '#ef4444' : isPaid ? '#10b981' : '#f59e0b' }}>
                          {isCancelled ? 'Cancelado' : isPaid ? 'Pago' : 'Pendente'}
                        </span>
                      </td>
                      <td style={{ padding: '13px 12px' }}>
                        {!isPaid && !isCancelled && (
                          <button className="pay-btn" onClick={() => markPaid(a.id, a.payment_method)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            ✓ Pago
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* CONTAS A RECEBER */}
        {totalPend > 0 && (
          <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>
              <Hourglass size={16} color="#f59e0b" strokeWidth={2.4} />
              Total pendente
            </span>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#f59e0b' }}>{fmt(totalPend)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
