'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTenantId } from '@/lib/useTenantId'
import { hasFeature } from '@/lib/permissions'
import { useTenant } from '@/lib/tenant-context'

/* ── Types ── */
interface Plan {
  id: string
  nome: string
  descricao: string
  preco: number
  frequencia: 'mensal' | 'trimestral' | 'semestral' | 'anual'
  beneficios: string[]
  cor: string
  ativo: boolean
  created_at: string
}

interface Membro {
  id: string
  nome: string
  email: string
  telefone: string
  plano_id: string
  plano_nome: string
  status: 'ativo' | 'vencido' | 'cancelado'
  inicio: string
  vencimento: string
  valor_pago: number
}

interface RecurringSubscription {
  id: string
  customer_id: string
  membership_id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  plan_name: string
  value: number
  status: 'active' | 'pending' | 'overdue' | 'cancelled'
  paid_until: string | null
  next_due_date: string
  asaas_subscription_id: string | null
  billing_mode: 'manual' | 'automatic'
}

type ModalMode = 'plano' | 'membro' | 'recorrente' | 'manual' | null

const todayYmd = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

const addDaysYmd = (days: number) => {
  const base = new Date(`${todayYmd()}T12:00:00-03:00`)
  base.setDate(base.getDate() + days)
  return base.toISOString().split('T')[0]
}

const isDueSoonMembership = (date: string) => date >= todayYmd() && date <= addDaysYmd(7)

/* ── SQL (copie e rode no Supabase SQL Editor) ──────────────────────────────
CREATE TABLE IF NOT EXISTS membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  preco numeric(10,2) NOT NULL,
  frequencia text DEFAULT 'mensal',
  beneficios text[] DEFAULT '{}',
  cor text DEFAULT '#3b82f6',
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  plano_id uuid REFERENCES membership_plans(id) ON DELETE SET NULL,
  nome text NOT NULL,
  email text,
  telefone text,
  status text DEFAULT 'ativo',
  inicio date NOT NULL DEFAULT CURRENT_DATE,
  vencimento date NOT NULL,
  valor_pago numeric(10,2),
  created_at timestamptz DEFAULT now()
);
──────────────────────────────────────────────────────────────────────────── */

export default function AdminMemberships() {
  const tenantId = useTenantId()
  const { tenant, isProOrPremium } = useTenant()
  const router = useRouter()
  const [tab, setTab] = useState<'membros' | 'recorrentes' | 'planos'>('membros')
  const canUseMemberships = hasFeature(
  tenant?.plano,
  'memberships'
)

  // Plans
  const [plans, setPlans] = useState<Plan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)

  // Members
  const [membros, setMembros] = useState<Membro[]>([])
  const [loadingMembros, setLoadingMembros] = useState(true)
  const [subscriptions, setSubscriptions] = useState<RecurringSubscription[]>([])
  const [recurringAvailable, setRecurringAvailable] = useState(true)
  const [tenantAsaasConfigured, setTenantAsaasConfigured] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'todos' | 'ativo' | 'vencido' | 'cancelado'>('todos')
  const [search, setSearch] = useState('')

  // Modal
  const [modal, setModal] = useState<ModalMode>(null)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [editingMembro, setEditingMembro] = useState<Membro | null>(null)

  // Plan form
  const [planNome, setPlanNome] = useState('')
  const [planDesc, setPlanDesc] = useState('')
  const [planPreco, setPlanPreco] = useState('')
  const [planFreq, setPlanFreq] = useState<Plan['frequencia']>('mensal')
  const [planBeneficios, setPlanBeneficios] = useState('')
  const [planCor, setPlanCor] = useState('#3b82f6')
  const [planAtivo, setPlanAtivo] = useState(true)
  const [savingPlan, setSavingPlan] = useState(false)

  // Membro form
  const [memNome, setMemNome] = useState('')
  const [memEmail, setMemEmail] = useState('')
  const [memTelefone, setMemTelefone] = useState('')
  const [memPlanoId, setMemPlanoId] = useState('')
  const [memInicio, setMemInicio] = useState(new Date().toISOString().split('T')[0])
  const [memStatus, setMemStatus] = useState<Membro['status']>('ativo')
  const [savingMembro, setSavingMembro] = useState(false)

  // Membership subscription form
  const [recBillingMode, setRecBillingMode] = useState<'manual' | 'automatic'>('manual')
  const [recCustomerId, setRecCustomerId] = useState('')
  const [recPlanId, setRecPlanId] = useState('')
  const [recCpfCnpj, setRecCpfCnpj] = useState('')
  const [recValue, setRecValue] = useState('')
  const [recDueDate, setRecDueDate] = useState(addDaysYmd(1))
  const [savingRecurring, setSavingRecurring] = useState(false)
  const [manualSubscription, setManualSubscription] = useState<RecurringSubscription | null>(null)
  const [manualAmount, setManualAmount] = useState('')
  const [savingManual, setSavingManual] = useState(false)

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => { if (tenantId) fetchMembershipData() }, [tenantId])

  const getAuthToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }

  const membershipRequest = async (action: string, payload: Record<string, unknown> = {}) => {
    if (!tenantId) return
    const token = await getAuthToken()
    if (!token) throw new Error('Sessao expirada. Entre novamente.')

    const response = await fetch('/api/admin/memberships', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, tenant_id: tenantId, ...payload }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error ?? 'Erro ao salvar assinaturas.')
    return data
  }

  const fetchMembershipData = async () => {
    if (!tenantId) return
    setLoadingPlans(true)
    setLoadingMembros(true)
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Sessao expirada. Entre novamente.')

      const response = await fetch(`/api/admin/memberships?tenant_id=${encodeURIComponent(tenantId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Erro ao carregar assinaturas.')

      setPlans(data.plans ?? [])
      setMembros(data.membros ?? [])
      setSubscriptions(data.subscriptions ?? [])
      setRecurringAvailable(data.recurringAvailable !== false)
      setTenantAsaasConfigured(data.tenantAsaasConfigured === true)
    } catch (error: any) {
      setPlans([])
      setMembros([])
      setSubscriptions([])
      setTenantAsaasConfigured(false)
      setFeedback({ type: 'error', msg: error.message ?? 'Erro ao carregar assinaturas.' })
    } finally {
      setLoadingPlans(false)
      setLoadingMembros(false)
    }
  }

  const openNewPlan = () => {
    setEditingPlan(null)
    setPlanNome(''); setPlanDesc(''); setPlanPreco(''); setPlanFreq('mensal')
    setPlanBeneficios(''); setPlanCor('#3b82f6'); setPlanAtivo(true)
    setModal('plano')
  }

  const openEditPlan = (p: Plan) => {
    setEditingPlan(p)
    setPlanNome(p.nome); setPlanDesc(p.descricao); setPlanPreco(String(p.preco)); setPlanFreq(p.frequencia)
    setPlanBeneficios(p.beneficios.join('\n')); setPlanCor(p.cor); setPlanAtivo(p.ativo)
    setModal('plano')
  }

  const savePlan = async () => {
    if (!planNome || !planPreco) { setFeedback({ type: 'error', msg: 'Nome e preço são obrigatórios.' }); return }
    setSavingPlan(true); setFeedback(null)
    const payload = {
      nome: planNome.trim(), descricao: planDesc.trim(), preco: parseFloat(planPreco),
      frequencia: planFreq, beneficios: planBeneficios.split('\n').map(b => b.trim()).filter(Boolean),
      cor: planCor, ativo: planAtivo,
    }
    try {
      await membershipRequest('save_plan', { plan_id: editingPlan?.id, payload })
      setFeedback({ type: 'success', msg: editingPlan ? 'Plano atualizado!' : 'Plano criado!' })
      setModal(null)
      fetchMembershipData()
    } catch (error: any) {
      setFeedback({ type: 'error', msg: 'Erro: ' + error.message })
    }
    setSavingPlan(false)
  }

  const deletePlan = async (id: string) => {
    if (!confirm('Excluir este plano?')) return
    try {
      await membershipRequest('delete_plan', { plan_id: id })
      setFeedback({ type: 'success', msg: 'Plano excluido.' })
      fetchMembershipData()
    } catch (error: any) {
      setFeedback({ type: 'error', msg: 'Erro ao excluir: ' + error.message })
    }
  }

  const openNewMembro = () => {
    const activePlans = plans.filter(p => p.ativo)
    if (!activePlans.length) {
      setTab('planos')
      setFeedback({ type: 'error', msg: 'Crie um plano ativo antes de adicionar um membro.' })
      openNewPlan()
      return
    }
    setEditingMembro(null)
    setMemNome(''); setMemEmail(''); setMemTelefone('')
    setMemPlanoId(activePlans[0]?.id ?? ''); setMemInicio(new Date().toISOString().split('T')[0]); setMemStatus('ativo')
    setModal('membro')
  }

  const openEditMembro = (m: Membro) => {
    setEditingMembro(m)
    setMemNome(m.nome); setMemEmail(m.email); setMemTelefone(m.telefone)
    setMemPlanoId(m.plano_id); setMemInicio(m.inicio); setMemStatus(m.status)
    setModal('membro')
  }

  const calcVencimento = (inicio: string, freq: Plan['frequencia']): string => {
    const d = new Date(inicio)
    if (freq === 'mensal') d.setMonth(d.getMonth() + 1)
    else if (freq === 'trimestral') d.setMonth(d.getMonth() + 3)
    else if (freq === 'semestral') d.setMonth(d.getMonth() + 6)
    else d.setFullYear(d.getFullYear() + 1)
    return d.toISOString().split('T')[0]
  }

  const saveMembro = async () => {
    if (!memNome || !memPlanoId) { setFeedback({ type: 'error', msg: 'Nome e plano são obrigatórios.' }); return }
    setSavingMembro(true); setFeedback(null)
    const plan = plans.find(p => p.id === memPlanoId)
    const vencimento = calcVencimento(memInicio, plan?.frequencia ?? 'mensal')
    const payload = {
      nome: memNome.trim(), email: memEmail.trim(), telefone: memTelefone.trim(),
      plano_id: memPlanoId, status: memStatus, inicio: memInicio,
      vencimento, valor_pago: plan?.preco ?? 0,
    }
    try {
      await membershipRequest('save_member', { member_id: editingMembro?.id, payload })
      setFeedback({ type: 'success', msg: editingMembro ? 'Membro atualizado!' : 'Membro adicionado!' })
      setModal(null)
      fetchMembershipData()
    } catch (error: any) {
      setFeedback({ type: 'error', msg: 'Erro: ' + error.message })
    }
    setSavingMembro(false)
  }

  const deleteMembro = async (id: string) => {
    if (!confirm('Remover este membro?')) return
    try {
      await membershipRequest('delete_member', { member_id: id })
      fetchMembershipData()
    } catch (error: any) {
      setFeedback({ type: 'error', msg: 'Erro ao remover: ' + error.message })
    }
  }

  const openNewRecurring = () => {
    if (!recurringAvailable) {
      setFeedback({ type: 'error', msg: 'Execute o SQL supabase/membership_subscriptions.sql no Supabase.' })
      return
    }
    const firstMember = membros.find(member => member.status !== 'cancelado')
    const firstPlan = plans.find(plan => plan.ativo)
    if (!firstMember || !firstPlan) {
      setFeedback({ type: 'error', msg: 'Cadastre ao menos um membro e um plano ativo antes da recorrencia.' })
      return
    }
    setRecCustomerId(firstMember.id)
    setRecPlanId(firstPlan.id)
    setRecBillingMode('manual')
    setRecValue(String(firstPlan.preco))
    setRecCpfCnpj('')
    setRecDueDate(addDaysYmd(1))
    setModal('recorrente')
  }

  const saveRecurring = async () => {
    if (!recCustomerId || !recPlanId || !recValue || !recDueDate) {
      setFeedback({ type: 'error', msg: 'Preencha cliente, plano, valor e vencimento.' })
      return
    }
    if (recBillingMode === 'automatic' && !recCpfCnpj) {
      setFeedback({ type: 'error', msg: 'Informe o CPF/CNPJ para a cobranca automatica.' })
      return
    }
    if (recBillingMode === 'automatic' && !isProOrPremium) {
      setFeedback({
        type: 'error',
        msg: 'Cobranças automáticas via ASAAS estão disponíveis nos planos Pro e Premium.',
      })
      return
    }
    if (recBillingMode === 'automatic' && !tenantAsaasConfigured) {
      setFeedback({
        type: 'error',
        msg: 'Configure o ASAAS em Configuracoes > Pagamentos para ativar cobrancas automaticas.',
      })
      return
    }
    setSavingRecurring(true)
    setFeedback(null)
    try {
      const result = await membershipRequest('create_recurring_subscription', {
        customer_id: recCustomerId,
        membership_id: recPlanId,
        billing_mode: recBillingMode,
        cpf_cnpj: recCpfCnpj,
        value: Number(recValue.replace(',', '.')),
        next_due_date: recDueDate,
      })
      setModal(null)
      setFeedback({
        type: 'success',
        msg: recBillingMode === 'automatic'
          ? 'Assinatura recorrente criada no Asaas.'
          : 'Assinatura manual criada. Use Marcar como pago quando receber.',
      })
      await fetchMembershipData()
      if (result?.invoice_url) window.open(result.invoice_url, '_blank', 'noopener,noreferrer')
    } catch (error: any) {
      setFeedback({ type: 'error', msg: error.message ?? 'Erro ao criar assinatura.' })
    } finally {
      setSavingRecurring(false)
    }
  }

  const openManualPayment = (subscription: RecurringSubscription) => {
    setManualSubscription(subscription)
    setManualAmount(String(subscription.value))
    setModal('manual')
  }

  const saveManualPayment = async () => {
    const amount = Number(manualAmount.replace(',', '.'))
    if (!manualSubscription || !Number.isFinite(amount) || amount <= 0) {
      setFeedback({ type: 'error', msg: 'Informe um valor valido.' })
      return
    }
    setSavingManual(true)
    try {
      await membershipRequest('mark_recurring_paid', {
        subscription_id: manualSubscription.id,
        amount,
      })
      setModal(null)
      setManualSubscription(null)
      setFeedback({ type: 'success', msg: 'Pagamento manual registrado e acesso renovado por 30 dias.' })
      await fetchMembershipData()
    } catch (error: any) {
      setFeedback({ type: 'error', msg: error.message ?? 'Erro ao registrar pagamento.' })
    } finally {
      setSavingManual(false)
    }
  }

  const cancelRecurring = async (subscription: RecurringSubscription) => {
    if (!confirm(`Cancelar a assinatura recorrente de ${subscription.customer_name}?`)) return
    try {
      await membershipRequest('cancel_recurring_subscription', { subscription_id: subscription.id })
      setFeedback({ type: 'success', msg: 'Assinatura recorrente cancelada.' })
      await fetchMembershipData()
    } catch (error: any) {
      setFeedback({ type: 'error', msg: error.message ?? 'Erro ao cancelar assinatura.' })
    }
  }

  const filteredMembros = membros.filter(m => {
    if (filterStatus !== 'todos' && m.status !== filterStatus) return false
    if (search && !m.nome.toLowerCase().includes(search.toLowerCase()) && !m.email?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const recurringActive = subscriptions.filter(item => item.status === 'active')
  const recurringOverdue = subscriptions.filter(item => item.status === 'overdue')
  const recurringRevenue = recurringActive.reduce((sum, item) => sum + Number(item.value || 0), 0)
  const recurringRenewals = subscriptions.filter(
    item => item.status !== 'cancelled' && isDueSoonMembership(item.next_due_date),
  ).length

  const statusColor: Record<string, string> = { ativo: '#22c55e', vencido: '#f97316', cancelado: '#ef4444' }
  const statusBg: Record<string, string> = { ativo: '#22c55e15', vencido: '#f9731615', cancelado: '#ef444415' }
  const recurringStatusColor: Record<string, string> = {
    active: '#22c55e',
    pending: '#f59e0b',
    overdue: '#ef4444',
    cancelled: '#64748b',
  }
  const recurringStatusLabel: Record<string, string> = {
    active: 'Ativa',
    pending: 'Pendente',
    overdue: 'Inadimplente',
    cancelled: 'Cancelada',
  }
  const freqLabel: Record<string, string> = { mensal: '/mês', trimestral: '/trim.', semestral: '/sem.', anual: '/ano' }

  const corOptions = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4']
  const membershipTabs: Array<'membros' | 'recorrentes' | 'planos'> = [
    'membros',
    'recorrentes',
    'planos',
  ]

  if (!canUseMemberships) {
  return (
    <div style={{
      maxWidth: 700,
      margin: '40px auto',
      padding: 32,
      borderRadius: 20,
      background: 'rgba(11,18,32,0.72)',
      border: '1px solid rgba(139,92,246,0.2)',
      textAlign: 'center',
      color: '#f1f5f9',
    }}>
      <h1 style={{
        fontSize: 28,
        marginBottom: 12,
      }}>
        🔒 Recurso exclusivo Pro
      </h1>

      <p style={{
        color: '#94a3b8',
        lineHeight: 1.7,
        marginBottom: 24,
      }}>
        O sistema de assinaturas está disponível apenas
        nos planos Pro e Premium.
      </p>

      <a
        href="/pricing"
        style={{
          display: 'inline-block',
          padding: '12px 24px',
          borderRadius: 12,
          background:
            'linear-gradient(135deg,#7c3aed,#8b5cf6)',
          color: '#fff',
          textDecoration: 'none',
          fontWeight: 700,
        }}
      >
        Fazer upgrade →
      </a>
    </div>
  )
}

  return (
    <div className="memberships-page" style={s.root}>
      <style>{membershipsResponsiveCss}</style>
      {/* Header */}
      <div className="memberships-header" style={s.header}>
        <div className="memberships-header-left" style={s.headerLeft}>
          <button onClick={() => router.back()} style={s.backBtn}>← Voltar</button>
          <div>
            <h1 style={s.title}>💎 Assinaturas</h1>
            <p style={s.subtitle}>Gerencie planos e assinantes da barbearia</p>
          </div>
        </div>
        <div className="memberships-header-actions" style={{ display: 'flex', gap: 10 }}>
          {tab !== 'recorrentes' && (
            <button onClick={openNewRecurring} style={s.secondaryBtn}>
              + Nova assinatura
            </button>
          )}
          <button
            onClick={tab === 'planos' ? openNewPlan : tab === 'recorrentes' ? openNewRecurring : openNewMembro}
            style={s.primaryBtn}
          >
            + {tab === 'planos' ? 'Novo plano' : tab === 'recorrentes' ? 'Nova assinatura' : 'Novo membro'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="memberships-stats" style={s.statsRow}>
        {([
              { label: 'Assinantes ativos', value: recurringActive.length, icon: 'OK', color: '#22c55e' },
              { label: 'Inadimplentes', value: recurringOverdue.length, icon: '!', color: '#ef4444' },
              { label: 'Receita recorrente mensal', value: `R$ ${recurringRevenue.toFixed(2)}`, icon: 'R$', color: '#3b82f6' },
              { label: 'Proximas renovacoes', value: recurringRenewals, icon: '30', color: '#8b5cf6' },
            ]).map((stat, i) => (
          <div key={i} style={s.statCard}>
            <span style={{ fontSize: 22 }}>{stat.icon}</span>
            <div>
              <p style={{ ...s.statVal, color: stat.color }}>{stat.value}</p>
              <p style={s.statLabel}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {feedback && (
        <div style={{ padding: '12px 16px', borderRadius: 10, fontSize: 14, marginBottom: 16,
          backgroundColor: feedback.type === 'success' ? '#10b98112' : '#ef444412',
          border: `1px solid ${feedback.type === 'success' ? '#10b98130' : '#ef444430'}`,
          color: feedback.type === 'success' ? '#6ee7b7' : '#f87171',
        }}>
          {feedback.type === 'success' ? '✅' : '⚠️'} {feedback.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="memberships-tabs" style={s.tabBar}>
        {membershipTabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ ...s.tabBtn, ...(tab === t ? s.tabBtnActive : {}) }}>
            {t === 'membros' ? 'Membros' : t === 'recorrentes' ? 'Assinaturas' : 'Planos'}
          </button>
        ))}
      </div>

      {/* ── MEMBROS ── */}
      {tab === 'membros' && (
        <div>
          <div className="memberships-toolbar" style={s.toolbar}>
            <input className="memberships-search" style={s.searchInput} placeholder="🔍  Buscar membro..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="memberships-filters" style={s.filterRow}>
              {(['todos', 'ativo', 'vencido', 'cancelado'] as const).map(f => (
                <button key={f} onClick={() => setFilterStatus(f)} style={{ ...s.filterBtn, ...(filterStatus === f ? s.filterBtnActive : {}) }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {loadingMembros ? (
            <div style={s.emptyState}><div style={s.spinner} /></div>
          ) : filteredMembros.length === 0 ? (
            <div style={s.emptyState}>
              <p style={{ fontSize: 32 }}>👥</p>
              <p style={{ color: '#64748b', fontSize: 14 }}>Nenhum membro encontrado</p>
              <button onClick={openNewMembro} style={s.primaryBtn}>+ Adicionar primeiro membro</button>
            </div>
          ) : (
            <>
              <div className="memberships-desktop-table" style={s.table}>
                <div style={s.tableHeader}>
                  <span>Membro</span><span>Plano</span><span>Status</span><span>Vencimento</span><span>Valor</span><span></span>
                </div>
                {filteredMembros.map(m => (
                  <div key={m.id} style={s.tableRow}>
                    <div>
                      <p style={{ fontWeight: 600, color: '#f1f5f9', margin: '0 0 2px', fontSize: 14 }}>{m.nome}</p>
                      <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>{m.email || m.telefone || '—'}</p>
                    </div>
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>{m.plano_nome}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, backgroundColor: statusBg[m.status], color: statusColor[m.status] }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: statusColor[m.status] }} />
                      {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                    </span>
                    <span style={{ fontSize: 13, color: new Date(m.vencimento) < new Date() ? '#f97316' : '#94a3b8' }}>
                      {new Date(m.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>R$ {(m.valor_pago ?? 0).toFixed(2)}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEditMembro(m)} style={s.iconBtn}>✏️</button>
                      <button onClick={() => deleteMembro(m.id)} style={{ ...s.iconBtn, color: '#ef4444' }}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="memberships-mobile-list">
                {filteredMembros.map(m => (
                  <article className="membership-mobile-card" key={m.id}>
                    <div className="membership-mobile-heading">
                      <div>
                        <strong>{m.nome}</strong>
                        <small>{m.email || m.telefone || '—'}</small>
                      </div>
                      <span style={{ backgroundColor: statusBg[m.status], color: statusColor[m.status] }}>
                        {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                      </span>
                    </div>
                    <div className="membership-mobile-details">
                      <div><small>Plano</small><strong>{m.plano_nome}</strong></div>
                      <div><small>Vencimento</small><strong>{new Date(m.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</strong></div>
                      <div><small>Valor</small><strong>R$ {(m.valor_pago ?? 0).toFixed(2)}</strong></div>
                    </div>
                    <div className="membership-mobile-actions">
                      <button onClick={() => openEditMembro(m)} style={s.secondaryBtn}>Editar</button>
                      <button onClick={() => deleteMembro(m.id)} style={s.dangerBtn}>Excluir</button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'recorrentes' && (
        <div>
          {!recurringAvailable && (
            <div style={{ ...s.emptyState, padding: 28 }}>
              <p style={{ color: '#f59e0b', margin: 0 }}>
                Execute o arquivo supabase/membership_subscriptions.sql no Supabase para ativar a recorrencia.
              </p>
            </div>
          )}
          {recurringAvailable && subscriptions.length === 0 ? (
            <div style={s.emptyState}>
              <p style={{ fontSize: 32 }}>AS</p>
              <p style={{ color: '#64748b', fontSize: 14 }}>Nenhuma assinatura criada</p>
              <button onClick={openNewRecurring} style={s.primaryBtn}>+ Nova assinatura</button>
            </div>
          ) : recurringAvailable ? (
            <>
            <div className="memberships-desktop-table" style={s.table}>
              <div style={{ ...s.tableHeader, gridTemplateColumns: '1.4fr 1.1fr .75fr .85fr .85fr 1fr 1fr 210px' }}>
                <span>Cliente</span><span>Plano</span><span>Valor</span><span>Cobranca</span><span>Status</span>
                <span>Pago ate</span><span>Proxima cobranca</span><span>Acoes</span>
              </div>
              {subscriptions.map(subscription => {
                return (
                  <div
                    key={subscription.id}
                    style={{ ...s.tableRow, gridTemplateColumns: '1.4fr 1.1fr .75fr .85fr .85fr 1fr 1fr 210px' }}
                  >
                    <div>
                      <p style={{ fontWeight: 600, color: '#f1f5f9', margin: '0 0 2px', fontSize: 14 }}>
                        {subscription.customer_name}
                      </p>
                      <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>
                        {subscription.customer_email || subscription.customer_phone || '-'}
                      </p>
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>{subscription.plan_name}</span>
                    <strong style={{ color: '#10b981', fontSize: 13 }}>
                      R$ {Number(subscription.value).toFixed(2)}
                    </strong>
                    <span
                      style={{
                        width: 'fit-content',
                        padding: '4px 9px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        color: subscription.billing_mode === 'automatic' ? '#60a5fa' : '#a78bfa',
                        backgroundColor: subscription.billing_mode === 'automatic' ? '#3b82f620' : '#8b5cf620',
                      }}
                    >
                      {subscription.billing_mode === 'automatic' ? 'Automatico' : 'Manual'}
                    </span>
                    <span style={{ color: recurringStatusColor[subscription.status], fontWeight: 700, fontSize: 12 }}>
                      {recurringStatusLabel[subscription.status]}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>
                      {subscription.paid_until
                        ? new Date(`${subscription.paid_until}T00:00:00`).toLocaleDateString('pt-BR')
                        : '-'}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>
                      {new Date(`${subscription.next_due_date}T00:00:00`).toLocaleDateString('pt-BR')}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {subscription.status !== 'cancelled' && (
                        <>
                          <button onClick={() => openManualPayment(subscription)} style={s.secondaryBtn}>
                            {subscription.billing_mode === 'automatic'
                              ? 'Marcar pago (emergencia)'
                              : 'Marcar como pago'}
                          </button>
                          <button onClick={() => cancelRecurring(subscription)} style={s.dangerBtn}>
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="memberships-mobile-list">
              {subscriptions.map(subscription => (
                <article className="membership-mobile-card" key={subscription.id}>
                  <div className="membership-mobile-heading">
                    <div>
                      <strong>{subscription.customer_name}</strong>
                      <small>{subscription.customer_email || subscription.customer_phone || '-'}</small>
                    </div>
                    <span style={{ color: recurringStatusColor[subscription.status] }}>
                      {recurringStatusLabel[subscription.status]}
                    </span>
                  </div>
                  <div className="membership-mobile-details">
                    <div><small>Plano</small><strong>{subscription.plan_name}</strong></div>
                    <div>
                      <small>Vencimento</small>
                      <strong>{new Date(`${subscription.next_due_date}T00:00:00`).toLocaleDateString('pt-BR')}</strong>
                    </div>
                    <div><small>Valor</small><strong>R$ {Number(subscription.value).toFixed(2)}</strong></div>
                  </div>
                  <div className="membership-mobile-actions">
                    {subscription.status !== 'cancelled' && (
                      <>
                        <button onClick={() => openManualPayment(subscription)} style={s.secondaryBtn}>
                          {subscription.billing_mode === 'automatic' ? 'Marcar pago' : 'Marcar como pago'}
                        </button>
                        <button onClick={() => cancelRecurring(subscription)} style={s.dangerBtn}>
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── PLANOS ── */}
      {tab === 'planos' && (
        <div>
          {loadingPlans ? (
            <div style={s.emptyState}><div style={s.spinner} /></div>
          ) : plans.length === 0 ? (
            <div style={s.emptyState}>
              <p style={{ fontSize: 32 }}>📋</p>
              <p style={{ color: '#64748b', fontSize: 14 }}>Nenhum plano criado ainda</p>
              <button onClick={openNewPlan} style={s.primaryBtn}>+ Criar primeiro plano</button>
            </div>
          ) : (
            <div className="memberships-plans-grid" style={s.plansGrid}>
              {plans.map(p => (
                <div key={p.id} style={{ ...s.planCard, borderTopColor: p.cor, opacity: p.ativo ? 1 : 0.5 }}>
                  <div style={s.planCardHeader}>
                    <div style={{ ...s.planDot, backgroundColor: p.cor }} />
                    <p style={s.planNome}>{p.nome}</p>
                    {!p.ativo && <span style={s.inactiveBadge}>Inativo</span>}
                  </div>
                  <p style={s.planPreco}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: p.cor }}>R$ {p.preco.toFixed(2)}</span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{freqLabel[p.frequencia]}</span>
                  </p>
                  {p.descricao && <p style={s.planDesc}>{p.descricao}</p>}
                  <ul style={s.benefList}>
                    {p.beneficios.map((b, i) => <li key={i} style={s.benefItem}><span style={{ color: p.cor }}>✓</span> {b}</li>)}
                  </ul>
                  <div style={s.planActions}>
                    <button onClick={() => openEditPlan(p)} style={s.secondaryBtn}>Editar</button>
                    <button onClick={() => deletePlan(p.id)} style={s.dangerBtn}>Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL PLANO ── */}
      {modal === 'plano' && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="memberships-modal" style={s.modalBox}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>{editingPlan ? 'Editar plano' : 'Novo plano'}</h2>
              <button onClick={() => setModal(null)} style={s.closeBtn}>✕</button>
            </div>
            <div style={s.modalBody}>
              <ModalField label="Nome do plano *">
                <input style={s.modalInput} value={planNome} onChange={e => setPlanNome(e.target.value)} placeholder="Ex: Plano Gold" />
              </ModalField>
              <ModalField label="Descrição">
                <input style={s.modalInput} value={planDesc} onChange={e => setPlanDesc(e.target.value)} placeholder="Breve descrição do plano" />
              </ModalField>
              <div className="memberships-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <ModalField label="Preço (R$) *">
                  <input style={s.modalInput} type="number" step="0.01" min="0" value={planPreco} onChange={e => setPlanPreco(e.target.value)} placeholder="0.00" />
                </ModalField>
                <ModalField label="Frequência">
                  <select style={s.modalInput} value={planFreq} onChange={e => setPlanFreq(e.target.value as Plan['frequencia'])}>
                    <option value="mensal">Mensal</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="semestral">Semestral</option>
                    <option value="anual">Anual</option>
                  </select>
                </ModalField>
              </div>
              <ModalField label="Benefícios (um por linha)">
                <textarea style={{ ...s.modalInput, minHeight: 90, resize: 'vertical' as const }} value={planBeneficios} onChange={e => setPlanBeneficios(e.target.value)} placeholder={"Corte grátis\nDesconto em produtos\nAtendimento prioritário"} />
              </ModalField>
              <ModalField label="Cor do plano">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                  {corOptions.map(c => (
                    <button key={c} onClick={() => setPlanCor(c)} style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: c, border: planCor === c ? '3px solid #fff' : '2px solid transparent', cursor: 'pointer' }} />
                  ))}
                </div>
              </ModalField>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setPlanAtivo(v => !v)} style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', backgroundColor: planAtivo ? '#3b82f6' : '#1e2535', position: 'relative' }}>
                  <span style={{ position: 'absolute', top: 2, left: planAtivo ? 20 : 2, width: 18, height: 18, borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.2s' }} />
                </button>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>Plano {planAtivo ? 'ativo' : 'inativo'}</span>
              </div>
            </div>
            <div className="memberships-modal-footer" style={s.modalFooter}>
              <button onClick={() => setModal(null)} style={s.cancelBtn}>Cancelar</button>
              <button onClick={savePlan} disabled={savingPlan} style={{ ...s.primaryBtn, opacity: savingPlan ? 0.7 : 1 }}>
                {savingPlan ? 'Salvando...' : editingPlan ? 'Salvar alterações' : 'Criar plano'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL MEMBRO ── */}
      {modal === 'membro' && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="memberships-modal" style={s.modalBox}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>{editingMembro ? 'Editar membro' : 'Novo membro'}</h2>
              <button onClick={() => setModal(null)} style={s.closeBtn}>✕</button>
            </div>
            <div style={s.modalBody}>
              <ModalField label="Nome *">
                <input style={s.modalInput} value={memNome} onChange={e => setMemNome(e.target.value)} placeholder="Nome completo" />
              </ModalField>
              <div className="memberships-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <ModalField label="E-mail">
                  <input style={s.modalInput} type="email" value={memEmail} onChange={e => setMemEmail(e.target.value)} placeholder="email@exemplo.com" />
                </ModalField>
                <ModalField label="Telefone">
                  <input style={s.modalInput} value={memTelefone} onChange={e => setMemTelefone(e.target.value)} placeholder="(47) 99999-9999" />
                </ModalField>
              </div>
              <ModalField label="Plano *">
                <select style={s.modalInput} value={memPlanoId} onChange={e => setMemPlanoId(e.target.value)}>
                  <option value="">{plans.some(p => p.ativo) ? 'Selecione um plano' : 'Nenhum plano ativo cadastrado'}</option>
                  {plans.filter(p => p.ativo).map(p => (
                    <option key={p.id} value={p.id}>{p.nome} — R$ {p.preco.toFixed(2)}{freqLabel[p.frequencia]}</option>
                  ))}
                </select>
              </ModalField>
              <div style={{ padding: '10px 14px', backgroundColor: '#0a0d14', borderRadius: 8, border: '1px solid #1e2535', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                Dica: cadastre o e-mail e telefone do cliente para usar avisos de vencimento por e-mail e WhatsApp quando a automacao estiver ativa.
              </div>
              <div className="memberships-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <ModalField label="Início da assinatura">
                  <input style={s.modalInput} type="date" value={memInicio} onChange={e => setMemInicio(e.target.value)} />
                </ModalField>
                <ModalField label="Status">
                  <select style={s.modalInput} value={memStatus} onChange={e => setMemStatus(e.target.value as Membro['status'])}>
                    <option value="ativo">Ativo</option>
                    <option value="vencido">Vencido</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </ModalField>
              </div>
              {memPlanoId && memInicio && (
                <div style={{ padding: '10px 14px', backgroundColor: '#0a0d14', borderRadius: 8, border: '1px solid #1e2535', fontSize: 13, color: '#94a3b8' }}>
                  Vencimento calculado: <strong style={{ color: '#60a5fa' }}>
                    {new Date(calcVencimento(memInicio, plans.find(p => p.id === memPlanoId)?.frequencia ?? 'mensal') + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </strong>
                </div>
              )}
            </div>
            <div className="memberships-modal-footer" style={s.modalFooter}>
              <button onClick={() => setModal(null)} style={s.cancelBtn}>Cancelar</button>
              <button onClick={saveMembro} disabled={savingMembro} style={{ ...s.primaryBtn, opacity: savingMembro ? 0.7 : 1 }}>
                {savingMembro ? 'Salvando...' : editingMembro ? 'Salvar alterações' : 'Adicionar membro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'recorrente' && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="memberships-modal" style={s.modalBox}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Nova assinatura</h2>
              <button onClick={() => setModal(null)} style={s.closeBtn}>x</button>
            </div>
            <div style={s.modalBody}>
              <ModalField label="Tipo de cobranca *">
                <div className="memberships-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {(['manual', 'automatic'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setRecBillingMode(mode)}
                      style={{
                        ...s.secondaryBtn,
                        padding: '12px 10px',
                        borderColor: recBillingMode === mode ? '#3b82f6' : '#2d3748',
                        backgroundColor: recBillingMode === mode ? '#13213a' : 'transparent',
                        color: recBillingMode === mode ? '#60a5fa' : '#94a3b8',
                        fontWeight: recBillingMode === mode ? 700 : 500,
                      }}
                    >
                      {mode === 'manual' ? 'Manual' : 'Automatico via ASAAS'}
                    </button>
                  ))}
                </div>
              </ModalField>
              {recBillingMode === 'automatic' && (!isProOrPremium || !tenantAsaasConfigured) && (
                <div
                  style={{
                    padding: '11px 14px',
                    borderRadius: 8,
                    border: '1px solid #f59e0b55',
                    backgroundColor: '#f59e0b12',
                    color: '#fbbf24',
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  {!isProOrPremium
                    ? 'Cobranças automáticas via ASAAS estão disponíveis nos planos Pro e Premium.'
                    : 'Configure o ASAAS em Configuracoes > Pagamentos para ativar cobrancas automaticas.'}
                </div>
              )}
              <ModalField label="Cliente *">
                <select style={s.modalInput} value={recCustomerId} onChange={e => setRecCustomerId(e.target.value)}>
                  {membros.filter(member => member.status !== 'cancelado').map(member => (
                    <option key={member.id} value={member.id}>
                      {member.nome}{member.email ? ` - ${member.email}` : ''}
                    </option>
                  ))}
                </select>
              </ModalField>
              <ModalField label="Plano *">
                <select
                  style={s.modalInput}
                  value={recPlanId}
                  onChange={e => {
                    setRecPlanId(e.target.value)
                    const selectedPlan = plans.find(plan => plan.id === e.target.value)
                    if (selectedPlan) setRecValue(String(selectedPlan.preco))
                  }}
                >
                  {plans.filter(plan => plan.ativo).map(plan => (
                    <option key={plan.id} value={plan.id}>{plan.nome} - R$ {plan.preco.toFixed(2)}</option>
                  ))}
                </select>
              </ModalField>
              {recBillingMode === 'automatic' && (
                <ModalField label="CPF ou CNPJ do cliente *">
                  <input
                    style={s.modalInput}
                    inputMode="numeric"
                    value={recCpfCnpj}
                    onChange={e => setRecCpfCnpj(e.target.value)}
                    placeholder="Somente numeros"
                  />
                </ModalField>
              )}
              <div className="memberships-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <ModalField label="Valor mensal (R$) *">
                  <input
                    style={s.modalInput}
                    inputMode="decimal"
                    value={recValue}
                    onChange={e => setRecValue(e.target.value)}
                    placeholder="89,90"
                  />
                </ModalField>
                <ModalField label="Primeiro vencimento *">
                  <input style={s.modalInput} type="date" value={recDueDate} onChange={e => setRecDueDate(e.target.value)} />
                </ModalField>
              </div>
              <div style={{ padding: '10px 14px', backgroundColor: '#0a0d14', borderRadius: 8, border: '1px solid #1e2535', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                {recBillingMode === 'automatic'
                  ? 'O ASAAS criara uma cobranca mensal. Pagamentos confirmados pelo webhook renovam automaticamente o acesso por 30 dias.'
                  : 'Nenhuma cobranca sera criada no ASAAS. Ao receber, use o botao Marcar como pago para renovar o acesso por 30 dias.'}
              </div>
            </div>
            <div className="memberships-modal-footer" style={s.modalFooter}>
              <button onClick={() => setModal(null)} style={s.cancelBtn}>Cancelar</button>
              <button
                onClick={saveRecurring}
                disabled={
                  savingRecurring ||
                  (recBillingMode === 'automatic' && (!isProOrPremium || !tenantAsaasConfigured))
                }
                style={{
                  ...s.primaryBtn,
                  opacity:
                    savingRecurring ||
                    (recBillingMode === 'automatic' && (!isProOrPremium || !tenantAsaasConfigured))
                      ? 0.55
                      : 1,
                }}
              >
                {savingRecurring
                  ? recBillingMode === 'automatic' ? 'Criando no ASAAS...' : 'Criando...'
                  : 'Criar assinatura'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'manual' && manualSubscription && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="memberships-modal" style={{ ...s.modalBox, maxWidth: 440 }}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>
                  {manualSubscription.billing_mode === 'automatic'
                    ? 'Marcar como pago manualmente'
                    : 'Marcar como pago'}
                </h2>
                <p style={{ ...s.subtitle, marginTop: 4 }}>{manualSubscription.customer_name}</p>
              </div>
              <button onClick={() => setModal(null)} style={s.closeBtn}>x</button>
            </div>
            <div style={s.modalBody}>
              <ModalField label="Valor recebido (R$) *">
                <input
                  style={s.modalInput}
                  inputMode="decimal"
                  value={manualAmount}
                  onChange={e => setManualAmount(e.target.value)}
                />
              </ModalField>
              <p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                {manualSubscription.billing_mode === 'automatic'
                  ? 'Use somente como emergencia. O acesso sera renovado por 30 dias e o pagamento sera registrado como manual.'
                  : 'O acesso sera renovado por 30 dias e o pagamento sera registrado no historico.'}
              </p>
            </div>
            <div className="memberships-modal-footer" style={s.modalFooter}>
              <button onClick={() => setModal(null)} style={s.cancelBtn}>Cancelar</button>
              <button onClick={saveManualPayment} disabled={savingManual} style={{ ...s.primaryBtn, opacity: savingManual ? 0.7 : 1 }}>
                {savingManual ? 'Salvando...' : 'Confirmar pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em' }}>{label}</label>
      {children}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', backgroundColor: '#0a0d14', color: '#e2e8f0', fontFamily: "'DM Sans','Segoe UI',sans-serif", padding: '36px 48px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  backBtn: { padding: '8px 14px', borderRadius: 8, border: '1px solid #1e2535', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer' },
  title: { fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: '0 0 3px' },
  subtitle: { fontSize: 13, color: '#64748b', margin: 0 },
  primaryBtn: { padding: '10px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 16px #3b82f640' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 },
  statCard: { display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', backgroundColor: '#111827', borderRadius: 12, border: '1px solid #1e2535' },
  statVal: { fontSize: 22, fontWeight: 800, margin: '0 0 2px', letterSpacing: '-0.02em' },
  statLabel: { fontSize: 12, color: '#64748b', margin: 0 },
  tabBar: { display: 'flex', gap: 4, marginBottom: 20, backgroundColor: '#0f1117', borderRadius: 10, padding: 4, width: 'fit-content' },
  tabBtn: { padding: '8px 18px', borderRadius: 8, border: 'none', background: 'transparent', color: '#64748b', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  tabBtnActive: { backgroundColor: '#1e2d45', color: '#60a5fa', fontWeight: 700 },
  toolbar: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' as const },
  searchInput: { padding: '9px 14px', backgroundColor: '#111827', border: '1px solid #1e2535', borderRadius: 10, color: '#f1f5f9', fontSize: 14, outline: 'none', width: 240 },
  filterRow: { display: 'flex', gap: 6 },
  filterBtn: { padding: '7px 14px', borderRadius: 8, border: '1px solid #1e2535', background: 'transparent', color: '#64748b', fontSize: 13, cursor: 'pointer' },
  filterBtnActive: { backgroundColor: '#13213a', borderColor: '#3b82f6', color: '#60a5fa', fontWeight: 600 },
  table: { backgroundColor: '#111827', borderRadius: 12, border: '1px solid #1e2535', overflow: 'hidden' },
  tableHeader: { display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 80px', gap: 12, padding: '12px 20px', backgroundColor: '#0f1117', fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' as const },
  tableRow: { display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 80px', gap: 12, padding: '14px 20px', borderTop: '1px solid #1e2535', alignItems: 'center' },
  iconBtn: { width: 32, height: 32, borderRadius: 8, border: '1px solid #1e2535', background: 'transparent', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '64px 0' },
  spinner: { width: 32, height: 32, borderRadius: '50%', border: '3px solid #1e2535', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite' },
  plansGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 },
  planCard: { backgroundColor: '#111827', borderRadius: 12, border: '1px solid #1e2535', borderTopWidth: 3, padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 },
  planCardHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  planDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  planNome: { fontSize: 15, fontWeight: 700, color: '#f1f5f9', margin: 0, flex: 1 },
  inactiveBadge: { fontSize: 10, color: '#64748b', backgroundColor: '#1e2535', padding: '2px 8px', borderRadius: 999, fontWeight: 600 },
  planPreco: { display: 'flex', alignItems: 'baseline', gap: 4, margin: 0 },
  planDesc: { fontSize: 12, color: '#64748b', margin: 0 },
  benefList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 5, flex: 1 },
  benefItem: { fontSize: 13, color: '#94a3b8', display: 'flex', gap: 6 },
  planActions: { display: 'flex', gap: 8, marginTop: 4 },
  secondaryBtn: { flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #2d3748', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer' },
  dangerBtn: { flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #ef444430', background: 'transparent', color: '#f87171', fontSize: 13, cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(4px)' },
  modalBox: { backgroundColor: '#111827', border: '1px solid #1e2535', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #1e2535' },
  modalTitle: { fontSize: 16, fontWeight: 700, color: '#f1f5f9', margin: 0 },
  closeBtn: { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, lineHeight: 1 },
  modalBody: { padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 },
  modalFooter: { display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid #1e2535' },
  modalInput: { padding: '10px 13px', backgroundColor: '#0a0d14', border: '1px solid #2d3748', borderRadius: 10, color: '#f1f5f9', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  cancelBtn: { padding: '10px 20px', borderRadius: 10, border: '1px solid #2d3748', background: 'transparent', color: '#94a3b8', fontSize: 14, cursor: 'pointer' },
}

const membershipsResponsiveCss = `
  .memberships-mobile-list {
    display: none;
  }

  @media (max-width: 767px) {
    .memberships-page {
      box-sizing: border-box;
      padding: 24px 16px 56px !important;
      width: 100%;
    }

    .memberships-header {
      align-items: stretch !important;
      flex-direction: column !important;
      gap: 16px;
      margin-bottom: 20px !important;
    }

    .memberships-header-left {
      align-items: flex-start !important;
      flex-direction: column !important;
      gap: 12px !important;
    }

    .memberships-header-left h1,
    .memberships-header-left p {
      overflow-wrap: anywhere;
    }

    .memberships-header-actions {
      display: grid !important;
      gap: 12px !important;
      grid-template-columns: minmax(0, 1fr) !important;
      width: 100%;
    }

    .memberships-header-actions button {
      min-height: 44px;
      width: 100%;
    }

    .memberships-stats {
      grid-template-columns: minmax(0, 1fr) !important;
      gap: 12px !important;
      margin-bottom: 20px !important;
    }

    .memberships-stats > div {
      box-sizing: border-box;
      min-width: 0;
      width: 100%;
    }

    .memberships-tabs {
      box-sizing: border-box;
      display: grid !important;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      width: 100% !important;
    }

    .memberships-tabs button {
      min-height: 44px;
      min-width: 0;
      padding-left: 8px !important;
      padding-right: 8px !important;
    }

    .memberships-toolbar {
      align-items: stretch !important;
      flex-direction: column !important;
      gap: 12px !important;
      width: 100%;
    }

    .memberships-search {
      box-sizing: border-box;
      min-height: 48px;
      width: 100% !important;
    }

    .memberships-filters {
      display: grid !important;
      gap: 8px !important;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      width: 100%;
    }

    .memberships-filters button {
      min-height: 44px;
      min-width: 0;
      width: 100%;
    }

    .memberships-desktop-table {
      display: none !important;
    }

    .memberships-mobile-list {
      display: grid;
      gap: 14px;
      grid-template-columns: minmax(0, 1fr);
      width: 100%;
    }

    .membership-mobile-card {
      background: #111827;
      border: 1px solid #1e2535;
      border-radius: 14px;
      box-sizing: border-box;
      color: #e2e8f0;
      display: grid;
      gap: 16px;
      min-width: 0;
      padding: 18px;
      width: 100%;
    }

    .membership-mobile-heading {
      align-items: flex-start;
      display: flex;
      gap: 12px;
      justify-content: space-between;
      min-width: 0;
    }

    .membership-mobile-heading > div {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .membership-mobile-heading strong,
    .membership-mobile-heading small {
      overflow-wrap: anywhere;
    }

    .membership-mobile-heading small,
    .membership-mobile-details small {
      color: #64748b;
      font-size: 12px;
    }

    .membership-mobile-heading > span {
      border-radius: 999px;
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 700;
      padding: 5px 9px;
    }

    .membership-mobile-details {
      display: grid;
      gap: 12px;
      grid-template-columns: minmax(0, 1fr);
    }

    .membership-mobile-details > div {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .membership-mobile-details strong {
      font-size: 14px;
      overflow-wrap: anywhere;
    }

    .membership-mobile-actions {
      display: grid;
      gap: 10px;
      grid-template-columns: minmax(0, 1fr);
    }

    .membership-mobile-actions button {
      box-sizing: border-box;
      min-height: 44px;
      width: 100%;
    }

    .memberships-plans-grid {
      grid-template-columns: minmax(0, 1fr) !important;
      gap: 14px !important;
    }

    .memberships-plans-grid > div {
      box-sizing: border-box;
      min-width: 0;
      width: 100%;
    }

    .memberships-modal {
      max-height: calc(100vh - 32px) !important;
      max-width: calc(100vw - 32px) !important;
    }

    .memberships-modal-grid {
      grid-template-columns: minmax(0, 1fr) !important;
    }

    .memberships-modal-footer {
      align-items: stretch !important;
      flex-direction: column-reverse !important;
      padding: 16px 20px 20px !important;
    }

    .memberships-modal-footer button {
      min-height: 44px;
      width: 100%;
    }
  }

  [data-theme="light"] .membership-mobile-card {
    background: #ffffff;
    border-color: #e2e8f0;
    color: #0f172a;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
  }

  [data-theme="light"] .membership-mobile-heading strong,
  [data-theme="light"] .membership-mobile-details strong {
    color: #0f172a;
  }

  [data-theme="light"] .membership-mobile-heading small,
  [data-theme="light"] .membership-mobile-details small {
    color: #64748b;
  }
`
