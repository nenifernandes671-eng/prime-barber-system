'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/components/theme-provider'
import {
  Plus,
  Search,
  Trash2,
  ReceiptText,
  TrendingDown,
  CalendarDays,
  WalletCards,
  Tags,
  X,
} from 'lucide-react'

type Period = 'hoje' | 'semana' | 'mes' | 'tudo'

interface Expense {
  id: string
  tenant_id: string
  type: 'entrada' | 'despesa'
  description: string
  amount: number
  payment_method: string
  entry_date: string
  category?: string | null
  created_at?: string
}

const categories = [
  'Produtos',
  'Aluguel',
  'Energia',
  'Água',
  'Internet',
  'Marketing',
  'Equipamentos',
  'Funcionários',
  'Outros',
]

const methods = ['pix', 'dinheiro', 'cartao', 'outros']

function fmt(v: number) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function localDateKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function fmtDate(date: string) {
  if (!date) return '—'
  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR')
}

function parseLocalDate(date: string) {
  return new Date(`${date}T00:00:00`)
}

function inPeriod(dateStr: string, period: Period) {
  if (period === 'tudo') return true

  const d = parseLocalDate(dateStr)
  const now = new Date()

  if (period === 'hoje') return dateStr === localDateKey(now)

  if (period === 'semana') {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    start.setHours(0, 0, 0, 0)
    return d >= start
  }

  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

export default function DespesasPage() {
  const pathname = usePathname()
  const slug = pathname.split('/').filter(Boolean)[0]
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const [tenantId, setTenantId] = useState<string | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [period, setPeriod] = useState<Period>('mes')
  const [search, setSearch] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('pix')
  const [entryDate, setEntryDate] = useState(localDateKey())
  const [category, setCategory] = useState('Outros')

  useEffect(() => {
    async function init() {
      try {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('slug', slug)
          .maybeSingle()

        if (!tenant) return

        setTenantId(tenant.id)

        const { data } = await supabase
          .from('financial_entries')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('type', 'despesa')
          .order('entry_date', { ascending: false })

        setExpenses((data ?? []) as Expense[])
      } finally {
        setLoading(false)
      }
    }

    if (slug) init()
  }, [slug])

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim()

    return expenses.filter((e) => {
      const okPeriod = inPeriod(e.entry_date, period)
      const okSearch =
        !s ||
        [e.description, e.category, e.payment_method]
          .filter(Boolean)
          .some((x) => String(x).toLowerCase().includes(s))

      return okPeriod && okSearch
    })
  }, [expenses, period, search])

  const total = filtered.reduce((sum, e) => sum + Number(e.amount || 0), 0)

  const todayTotal = expenses
    .filter((e) => e.entry_date === localDateKey())
    .reduce((sum, e) => sum + Number(e.amount || 0), 0)

  const monthTotal = expenses
    .filter((e) => inPeriod(e.entry_date, 'mes'))
    .reduce((sum, e) => sum + Number(e.amount || 0), 0)

  const topCategory = useMemo(() => {
    const map: Record<string, number> = {}

    filtered.forEach((e) => {
      const key = e.category || 'Outros'
      map[key] = (map[key] || 0) + Number(e.amount || 0)
    })

    return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
  }, [filtered])

  async function saveExpense() {
    if (!tenantId) return

    const value = Number(amount.replace(',', '.'))

    if (!description.trim()) {
      setFeedback({ type: 'error', text: 'Informe a descrição da despesa.' })
      return
    }

    if (!value || value <= 0) {
      setFeedback({ type: 'error', text: 'Informe um valor válido.' })
      return
    }

    setSaving(true)
    setFeedback(null)

    const payload = {
      tenant_id: tenantId,
      type: 'despesa',
      description: description.trim(),
      amount: value,
      payment_method: paymentMethod,
      entry_date: entryDate || localDateKey(),
      category,
    }

    const { data, error } = await supabase
      .from('financial_entries')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      setFeedback({ type: 'error', text: error.message })
      setSaving(false)
      return
    }

    setExpenses((prev) => [data as Expense, ...prev])
    setDescription('')
    setAmount('')
    setPaymentMethod('pix')
    setEntryDate(localDateKey())
    setCategory('Outros')
    setModalOpen(false)
    setFeedback({ type: 'success', text: 'Despesa registrada com sucesso.' })
    setSaving(false)
  }

  async function deleteExpense(id: string) {
    if (!tenantId) return
    if (!confirm('Excluir esta despesa?')) return

    const { error } = await supabase
      .from('financial_entries')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) {
      setFeedback({ type: 'error', text: error.message })
      return
    }

    setExpenses((prev) => prev.filter((e) => e.id !== id))
    setFeedback({ type: 'success', text: 'Despesa excluída.' })
  }

  const periodButtons: { key: Period; label: string }[] = [
    { key: 'hoje', label: 'Hoje' },
    { key: 'semana', label: 'Semana' },
    { key: 'mes', label: 'Este mês' },
    { key: 'tudo', label: 'Tudo' },
  ]

  if (loading) {
    return (
      <div className="expenses-loading">
        <div />
        <p>Carregando despesas...</p>

        <style>{`
          .expenses-loading {
            min-height: 60vh;
            display: grid;
            place-items: center;
            color: #94a3b8;
          }

          .expenses-loading div {
            width: 36px;
            height: 36px;
            border-radius: 999px;
            border: 3px solid #1e293b;
            border-top-color: #3b82f6;
            animation: spin .8s linear infinite;
          }

          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    )
  }

  return (
    <div
      className="expenses-page kb-light-root kb-expenses-page"
      style={{
        '--kb-page-bg': isLight ? '#f8fafc' : 'transparent',
        '--kb-card-bg': isLight ? '#ffffff' : 'linear-gradient(145deg, rgba(15,23,42,.94), rgba(8,13,28,.97))',
        '--kb-soft-bg': isLight ? '#f8fafc' : 'rgba(2,6,23,.50)',
        '--kb-border': isLight ? 'rgba(15,23,42,0.08)' : 'rgba(148,163,184,.12)',
        '--kb-title': isLight ? '#0f172a' : '#f8fafc',
        '--kb-text': isLight ? '#1e293b' : '#cbd5e1',
        '--kb-muted': isLight ? '#64748b' : '#94a3b8',
        '--kb-input-bg': isLight ? '#ffffff' : 'rgba(2,6,23,.54)',
        '--kb-shadow': isLight ? '0 18px 45px rgba(15,23,42,0.08)' : '0 24px 60px rgba(0,0,0,.22)',
        '--kb-header-bg': isLight
          ? 'linear-gradient(135deg, #ffffff 0%, #f8fbff 62%, #eef4ff 100%)'
          : 'radial-gradient(circle at top right, rgba(245,158,11,.16), transparent 34%), linear-gradient(135deg, rgba(15,23,42,.96), rgba(8,13,28,.88))',
        '--kb-header-border': isLight ? 'rgba(37,99,235,0.11)' : 'rgba(148,163,184,.11)',
        '--kb-header-title': isLight ? '#0f172a' : '#f8fafc',
        '--kb-header-muted': isLight ? '#52647f' : '#94a3b8',
        '--kb-table-head': isLight ? '#f6f8fc' : 'rgba(2,6,23,.50)',
        '--kb-row-hover': isLight ? '#f8fbff' : 'rgba(2,6,23,.50)',
        '--kb-category-text': isLight ? '#b45309' : '#fbbf24',
        '--kb-expense-value': isLight ? '#dc2626' : '#f87171',
      } as CSSProperties}
    >
      <style>{css}</style>

      <div className="expenses-header">
        <div>
          <p className="eyebrow">Controle financeiro</p>
          <h1>Despesas</h1>
          <span>Registre gastos, categorize saídas e acompanhe o custo real da barbearia.</span>
        </div>

        <button className="primary-btn" onClick={() => setModalOpen(true)}>
          <Plus size={18} />
          Nova despesa
        </button>
      </div>

      {feedback && (
        <div className={`feedback ${feedback.type}`}>
          <p>{feedback.text}</p>
          <button onClick={() => setFeedback(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="periods">
        {periodButtons.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={period === p.key ? 'active' : ''}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="stats-grid">
        <StatCard icon={<TrendingDown size={22} />} label="Despesas no período" value={fmt(total)} color="#f59e0b" />
        <StatCard icon={<CalendarDays size={22} />} label="Despesas hoje" value={fmt(todayTotal)} color="#ef4444" />
        <StatCard icon={<ReceiptText size={22} />} label="Despesas do mês" value={fmt(monthTotal)} color="#8b5cf6" />
        <StatCard icon={<Tags size={22} />} label="Maior categoria" value={topCategory} color="#3b82f6" />
      </div>

      <div className="content-card">
        <div className="table-head">
          <h2>Histórico de despesas</h2>

          <div className="search-box">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar descrição, categoria ou método..."
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            <div>📉</div>
            <h3>Nenhuma despesa encontrada</h3>
            <p>Registre despesas como produtos, aluguel, energia, internet ou marketing.</p>
            <button onClick={() => setModalOpen(true)}>Registrar primeira despesa</button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Categoria</th>
                  <th>Descrição</th>
                  <th>Método</th>
                  <th>Valor</th>
                  <th>Ação</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((expense) => (
                  <tr key={expense.id}>
                    <td>{fmtDate(expense.entry_date)}</td>
                    <td>
                      <span className="category-pill">{expense.category || 'Outros'}</span>
                    </td>
                    <td>
                      <strong>{expense.description}</strong>
                    </td>
                    <td>{paymentLabel(expense.payment_method)}</td>
                    <td>
                      <strong className="expense-value">{fmt(Number(expense.amount || 0))}</strong>
                    </td>
                    <td>
                      <button className="delete-btn" onClick={() => deleteExpense(expense.id)}>
                        <Trash2 size={15} />
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false)
          }}
        >
          <div className="modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Nova despesa</p>
                <h2>Registrar despesa</h2>
              </div>

              <button onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <label>
                Descrição
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Compra de produtos"
                />
              </label>

              <label>
                Valor
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ex: 150,00"
                  inputMode="decimal"
                />
              </label>

              <label>
                Categoria
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              <label>
                Método de pagamento
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  {methods.map((m) => (
                    <option key={m} value={m}>{paymentLabel(m)}</option>
                  ))}
                </select>
              </label>

              <label>
                Data
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
              </label>
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="save-btn" onClick={saveExpense} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar despesa'}
              </button>
            </div>
          </div>
        </div>
      )}
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

function paymentLabel(method?: string | null) {
  const m = (method || '').toLowerCase()
  if (m === 'pix') return 'PIX'
  if (m === 'dinheiro') return 'Dinheiro'
  if (m === 'cartao') return 'Cartão'
  return 'Outros'
}

const css=`
.expenses-page {
  min-height: 100vh;
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  background: var(--kb-page-bg);
  color: var(--kb-text);
  font-family: 'Inter', 'DM Sans', 'Segoe UI', sans-serif;
}

.expenses-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 132px;
  margin-bottom: 18px;
  padding: 24px 28px;
  border-radius: 20px;
  background: var(--kb-header-bg);
  border: 1px solid var(--kb-header-border);
  box-shadow: var(--kb-shadow);
}

.eyebrow {
  margin: 0 0 6px;
  color: #93c5fd;
  text-transform: uppercase;
  letter-spacing: .16em;
  font-size: 12px;
  font-weight: 950;
}

.expenses-header h1 {
  margin: 0;
  font-size: clamp(30px, 3vw, 36px);
  font-weight: 900;
  letter-spacing: -.045em;
  color: var(--kb-header-title);
}

.expenses-header span {
  display: block;
  margin-top: 7px;
  color: var(--kb-header-muted);
  font-size: 14px;
  line-height: 1.55;
}

.primary-btn {
  min-height: 48px;
  border: 0;
  border-radius: 16px;
  padding: 0 18px;
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  color: #fff;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 18px 34px rgba(37,99,235,.24);
  flex-shrink: 0;
  align-self: center;
  transition: transform .18s ease, box-shadow .18s ease, filter .18s ease;
}

.primary-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.04);
  box-shadow: 0 20px 40px rgba(37,99,235,.28);
}

.feedback {
  margin-bottom: 16px;
  padding: 13px 15px;
  border-radius: 15px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.feedback p {
  margin: 0;
  flex: 1;
  font-size: 13px;
  font-weight: 800;
}

.feedback button {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.feedback.success {
  color: #6ee7b7;
  background: rgba(16,185,129,.10);
  border: 1px solid rgba(16,185,129,.24);
}

.feedback.error {
  color: #fca5a5;
  background: rgba(239,68,68,.10);
  border: 1px solid rgba(239,68,68,.24);
}

.periods {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.periods button {
  border: 1px solid var(--kb-border);
  background: var(--kb-card-bg);
  color: var(--kb-muted);
  border-radius: 12px;
  padding: 9px 16px;
  font-size: 13px;
  font-weight: 850;
  cursor: pointer;
}

.periods button.active {
  color: #fff;
  background: linear-gradient(135deg,#2563eb,#1d4ed8);
  box-shadow: 0 12px 28px rgba(37,99,235,.24);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.stat-card {
  min-height: 128px;
  border-radius: 22px;
  padding: 18px;
  background: var(--kb-card-bg);
  border: 1px solid var(--kb-border);
  box-shadow: var(--kb-shadow);
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
  color: var(--kb-muted);
  font-size: 12px;
  font-weight: 800;
}

.stat-card strong {
  display: block;
  margin-top: 4px;
  font-size: 23px;
  font-weight: 950;
  letter-spacing: -.04em;
  color: var(--kb-title);
}

.content-card {
  border-radius: 20px;
  padding: 18px;
  background: var(--kb-card-bg);
  border: 1px solid var(--kb-border);
  box-shadow: var(--kb-shadow);
}

.table-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
  padding: 2px 2px 0;
}

.table-head h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 950;
  color: var(--kb-title);
}

.search-box {
  width: min(420px, 100%);
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 13px;
  background: var(--kb-input-bg);
  border: 1px solid var(--kb-border);
  color: var(--kb-muted);
}

.search-box input {
  width: 100%;
  background: transparent;
  border: 0;
  outline: 0;
  color: var(--kb-title);
  font-size: 13px;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--kb-border);
  border-radius: 14px;
}

table {
  width: 100%;
  min-width: 760px;
  border-collapse: separate;
  border-spacing: 0;
}

th {
  text-align: left;
  color: var(--kb-muted);
  font-size: 10px;
  font-weight: 950;
  letter-spacing: .08em;
  text-transform: uppercase;
  padding: 13px 14px;
  background: var(--kb-table-head);
  border-bottom: 1px solid var(--kb-border);
}

td {
  padding: 15px 14px;
  border-bottom: 1px solid var(--kb-border);
  color: var(--kb-text);
  font-size: 13px;
  background: var(--kb-card-bg);
  transition: background .16s ease;
}

tr:hover td {
  background: var(--kb-row-hover);
}

tbody tr:last-child td {
  border-bottom: 0;
}

td strong:not(.expense-value) {
  color: var(--kb-title);
  font-weight: 800;
}

.category-pill {
  display: inline-flex;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(245,158,11,.13);
  color: var(--kb-category-text);
  border: 1px solid rgba(245,158,11,.18);
  font-size: 11px;
  font-weight: 950;
}

.expense-value {
  color: var(--kb-expense-value);
  font-weight: 900;
}

.delete-btn {
  border: 1px solid rgba(239,68,68,.24);
  color: #f87171;
  background: rgba(239,68,68,.05);
  border-radius: 10px;
  min-height: 34px;
  padding: 0 11px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
  transition: background .16s ease, border-color .16s ease, transform .16s ease;
}

.delete-btn:hover {
  background: rgba(239,68,68,.11);
  border-color: rgba(239,68,68,.38);
  transform: translateY(-1px);
}

.empty {
  min-height: 300px;
  display: grid;
  place-items: center;
  text-align: center;
  color: var(--kb-muted);
}

.empty div {
  font-size: 44px;
}

.empty h3 {
  margin: 12px 0 6px;
  color: var(--kb-title);
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

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 90;
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,.68);
  backdrop-filter: blur(8px);
}

.modal {
  width: min(520px, 100%);
  border-radius: 24px;
  background: var(--kb-card-bg);
  border: 1px solid var(--kb-border);
  box-shadow: var(--kb-shadow);
}

.modal-head {
  padding: 24px 26px 0;
  display: flex;
  justify-content: space-between;
  gap: 14px;
}

.modal-head h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 950;
  letter-spacing: -.04em;
  color: var(--kb-title);
}

.modal-head button {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  border: 1px solid var(--kb-border);
  background: var(--kb-soft-bg);
  color: var(--kb-muted);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.modal-body {
  padding: 24px 26px;
  display: grid;
  gap: 14px;
}

.modal-body label {
  display: grid;
  gap: 8px;
  color: var(--kb-text);
  font-size: 13px;
  font-weight: 850;
}

.modal-body input,
.modal-body select {
  min-height: 46px;
  border-radius: 14px;
  border: 1px solid var(--kb-border);
  background: var(--kb-input-bg);
  color: var(--kb-title);
  outline: none;
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
.save-btn {
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

.save-btn {
  border: 0;
  background: linear-gradient(135deg,#2563eb,#4f46e5);
  color: white;
}

.save-btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}

@media (max-width: 1100px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .expenses-header {
    flex-direction: column;
    align-items: flex-start;
    min-height: 0;
  }

  .primary-btn {
    width: 100%;
    justify-content: center;
  }

  .table-head {
    flex-direction: column;
    align-items: stretch;
  }

  .search-box {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .expenses-header h1 {
    font-size: 30px;
  }

  .modal-footer {
    flex-direction: column;
  }

  .cancel-btn,
  .save-btn {
    width: 100%;
  }
}
`
