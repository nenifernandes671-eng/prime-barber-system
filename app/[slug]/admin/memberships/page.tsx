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

type ModalMode = 'plano' | 'membro' | null

type DefaultMembershipPlan = Omit<Plan, 'id' | 'created_at'>

const DEFAULT_MEMBERSHIP_PLANS: DefaultMembershipPlan[] = [
  {
    nome: 'Mensal Corte',
    descricao: 'Plano mensal para manter o cliente recorrente.',
    preco: 79.9,
    frequencia: 'mensal',
    beneficios: ['1 corte por mes', 'Prioridade no agendamento', 'Aviso de vencimento'],
    cor: '#3b82f6',
    ativo: true,
  },
  {
    nome: 'Mensal Premium',
    descricao: 'Plano mensal com corte e barba.',
    preco: 119.9,
    frequencia: 'mensal',
    beneficios: ['1 corte por mes', '1 barba por mes', 'Atendimento prioritario'],
    cor: '#f59e0b',
    ativo: true,
  },
  {
    nome: 'Mensal VIP',
    descricao: 'Plano mensal para clientes VIP.',
    preco: 169.9,
    frequencia: 'mensal',
    beneficios: ['Corte e barba', 'Produtos com desconto', 'Horario preferencial'],
    cor: '#8b5cf6',
    ativo: true,
  },
]

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

const isExpiredMembership = (date: string) => date < todayYmd()
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
  const { tenant } = useTenant()
  const router = useRouter()
  const [tab, setTab] = useState<'membros' | 'planos'>('membros')
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

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => { if (tenantId) { fetchPlans(); fetchMembros() } }, [tenantId])

  const fetchPlans = async () => {
    if (!tenantId) return
    setLoadingPlans(true)
    const { data, error } = await supabase.from('membership_plans').select('*')
      .eq('tenant_id', tenantId).order('preco')

    if (!error && data) {
      if (data.length > 0) {
        setPlans(data)
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('membership_plans')
          .insert(DEFAULT_MEMBERSHIP_PLANS.map(plan => ({ ...plan, tenant_id: tenantId })))
          .select('*')

        if (!insertError && inserted) {
          setPlans(inserted.sort((a, b) => Number(a.preco) - Number(b.preco)))
          setFeedback({ type: 'success', msg: 'Criei planos mensais padrao para voce comecar.' })
        } else {
          setPlans([])
        }
      }
    } else {
      setPlans([])
    }
    setLoadingPlans(false)
  }

  const fetchMembros = async () => {
    if (!tenantId) return
    setLoadingMembros(true)
    const { data } = await supabase.from('memberships')
      .select('*, membership_plans(nome)')
      .eq('tenant_id', tenantId)
      .order('vencimento')

    if (data) {
      const mapped = data.map((m: any) => ({
        ...m,
        plano_nome: m.membership_plans?.nome ?? '-',
        status: m.status === 'ativo' && isExpiredMembership(m.vencimento) ? 'vencido' : m.status,
      }))

      const expiredIds = mapped
        .filter((m: any) => m.status === 'vencido' && data.find((item: any) => item.id === m.id)?.status === 'ativo')
        .map((m: any) => m.id)

      if (expiredIds.length) {
        await supabase
          .from('memberships')
          .update({ status: 'vencido' })
          .in('id', expiredIds)
          .eq('tenant_id', tenantId)
      }

      setMembros(mapped)
    } else {
      setMembros([])
    }
    setLoadingMembros(false)
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
      tenant_id: tenantId,
      nome: planNome.trim(), descricao: planDesc.trim(), preco: parseFloat(planPreco),
      frequencia: planFreq, beneficios: planBeneficios.split('\n').map(b => b.trim()).filter(Boolean),
      cor: planCor, ativo: planAtivo,
    }
    const { error } = editingPlan
      ? await supabase.from('membership_plans').update(payload).eq('id', editingPlan.id).eq('tenant_id', tenantId)
      : await supabase.from('membership_plans').insert(payload)
    if (error) setFeedback({ type: 'error', msg: 'Erro: ' + error.message })
    else { setFeedback({ type: 'success', msg: editingPlan ? 'Plano atualizado!' : 'Plano criado!' }); setModal(null); fetchPlans() }
    setSavingPlan(false)
  }

  const deletePlan = async (id: string) => {
    if (!confirm('Excluir este plano?')) return
    const { error } = await supabase.from('membership_plans').delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) setFeedback({ type: 'error', msg: 'Erro ao excluir: ' + error.message })
    else { setFeedback({ type: 'success', msg: 'Plano excluído.' }); fetchPlans() }
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
      tenant_id: tenantId,
      plano_id: memPlanoId, status: memStatus, inicio: memInicio,
      vencimento, valor_pago: plan?.preco ?? 0,
    }
    const { error } = editingMembro
      ? await supabase.from('memberships').update(payload).eq('id', editingMembro.id).eq('tenant_id', tenantId)
      : await supabase.from('memberships').insert(payload)
    if (error) setFeedback({ type: 'error', msg: 'Erro: ' + error.message })
    else { setFeedback({ type: 'success', msg: editingMembro ? 'Membro atualizado!' : 'Membro adicionado!' }); setModal(null); fetchMembros() }
    setSavingMembro(false)
  }

  const deleteMembro = async (id: string) => {
    if (!confirm('Remover este membro?')) return
    await supabase.from('memberships').delete().eq('id', id).eq('tenant_id', tenantId)
    fetchMembros()
  }

  const filteredMembros = membros.filter(m => {
    if (filterStatus !== 'todos' && m.status !== filterStatus) return false
    if (search && !m.nome.toLowerCase().includes(search.toLowerCase()) && !m.email?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const statsAtivos = membros.filter(m => m.status === 'ativo').length
  const statsAVencer = membros.filter(m => m.status === 'ativo' && isDueSoonMembership(m.vencimento)).length
  const statsReceita = membros.filter(m => m.status === 'ativo').reduce((sum, m) => sum + (m.valor_pago ?? 0), 0)

  const statusColor: Record<string, string> = { ativo: '#22c55e', vencido: '#f97316', cancelado: '#ef4444' }
  const statusBg: Record<string, string> = { ativo: '#22c55e15', vencido: '#f9731615', cancelado: '#ef444415' }
  const freqLabel: Record<string, string> = { mensal: '/mês', trimestral: '/trim.', semestral: '/sem.', anual: '/ano' }

  const corOptions = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4']

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
        O sistema de memberships está disponível apenas
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
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <button onClick={() => router.back()} style={s.backBtn}>← Voltar</button>
          <div>
            <h1 style={s.title}>💎 Memberships</h1>
            <p style={s.subtitle}>Gerencie planos e assinantes da barbearia</p>
          </div>
        </div>
        <button onClick={tab === 'membros' ? openNewMembro : openNewPlan} style={s.primaryBtn}>
          + {tab === 'membros' ? 'Novo membro' : 'Novo plano'}
        </button>
      </div>

      {/* Stats */}
      <div style={s.statsRow}>
        {[
          { label: 'Membros ativos', value: statsAtivos, icon: '✅', color: '#22c55e' },
          { label: 'A vencer em 7 dias', value: statsAVencer, icon: '⏰', color: '#f97316' },
          { label: 'Receita mensal', value: `R$ ${statsReceita.toFixed(2)}`, icon: '💰', color: '#3b82f6' },
          { label: 'Planos disponíveis', value: plans.filter(p => p.ativo).length, icon: '📋', color: '#8b5cf6' },
        ].map((stat, i) => (
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
      <div style={s.tabBar}>
        {(['membros', 'planos'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ ...s.tabBtn, ...(tab === t ? s.tabBtnActive : {}) }}>
            {t === 'membros' ? '👥 Membros' : '📋 Planos'}
          </button>
        ))}
      </div>

      {/* ── MEMBROS ── */}
      {tab === 'membros' && (
        <div>
          <div style={s.toolbar}>
            <input style={s.searchInput} placeholder="🔍  Buscar membro..." value={search} onChange={e => setSearch(e.target.value)} />
            <div style={s.filterRow}>
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
            <div style={s.table}>
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
          )}
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
            <div style={s.plansGrid}>
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
          <div style={s.modalBox}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
            <div style={s.modalFooter}>
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
          <div style={s.modalBox}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>{editingMembro ? 'Editar membro' : 'Novo membro'}</h2>
              <button onClick={() => setModal(null)} style={s.closeBtn}>✕</button>
            </div>
            <div style={s.modalBody}>
              <ModalField label="Nome *">
                <input style={s.modalInput} value={memNome} onChange={e => setMemNome(e.target.value)} placeholder="Nome completo" />
              </ModalField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
            <div style={s.modalFooter}>
              <button onClick={() => setModal(null)} style={s.cancelBtn}>Cancelar</button>
              <button onClick={saveMembro} disabled={savingMembro} style={{ ...s.primaryBtn, opacity: savingMembro ? 0.7 : 1 }}>
                {savingMembro ? 'Salvando...' : editingMembro ? 'Salvar alterações' : 'Adicionar membro'}
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
