'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantId } from '@/lib/useTenantId'
import { useUnit } from '@/lib/unit-context'
import { useTenant } from '@/lib/tenant-context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Cliente {
  id: string
  unit_id?: string | null
  nome: string
  telefone: string
  email: string
  nascimento: string
  observacoes: string
  created_at: string
}

interface Agendamento {
  id: string
  unit_id?: string | null
  service: string
  price: number
  appointment_date: string
  appointment_time: string
  status: string
}

type ModalState = 'closed' | 'create' | 'edit' | 'view'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function getInitials(nome: string) {
  return nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#3b82f6', completed: '#10b981', cancelled: '#ef4444',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente', confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado',
}

const emptyForm = () => ({ nome: '', telefone: '', email: '', nascimento: '', observacoes: '' })

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>('closed')
  const [selected, setSelected] = useState<Cliente | null>(null)
  const [historico, setHistorico] = useState<Agendamento[]>([])
  const [form, setForm] = useState(emptyForm())
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const tenantId = useTenantId()
  const { isPremium } = useTenant()
  const { selectedUnitId } = useUnit()
  const activeUnitId = isPremium ? selectedUnitId : 'all'

  useEffect(() => { if (tenantId) fetchClientes() }, [tenantId, activeUnitId])

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchClientes = async () => {
    if (!tenantId) return

    setLoading(true)

    let query = supabase
      .from('clientes')
      .select('*')
      .eq('tenant_id', tenantId)

    if (activeUnitId !== 'all') {
      query = query.eq('unit_id', activeUnitId)
    }

    const { data, error } = await query.order('nome')

    if (error) {
      console.error('Erro ao buscar clientes:', error)
      setClientes([])
    } else {
      setClientes((data ?? []) as Cliente[])
    }

    setLoading(false)
  }

  const fetchHistorico = async (clienteNome: string) => {
    if (!tenantId) return

    let query = supabase
      .from('appointments')
      .select('id, unit_id, service, price, appointment_date, appointment_time, status')
      .eq('tenant_id', tenantId)
      .ilike('client_name', clienteNome)

    if (activeUnitId !== 'all') {
      query = query.eq('unit_id', activeUnitId)
    }

    const { data, error } = await query
      .order('appointment_date', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Erro ao buscar histórico:', error)
      setHistorico([])
    } else {
      setHistorico((data ?? []) as Agendamento[])
    }
  }

  // ── Filtered ───────────────────────────────────────────────────────────────

  const filtered = clientes.filter(c =>
    search === '' ||
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    (c.telefone ?? '').includes(search) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setForm(emptyForm())
    setSelected(null)
    setFeedback(null)
    setModal('create')
  }

  const openEdit = (c: Cliente) => {
    setSelected(c)
    setForm({
      nome: c.nome,
      telefone: c.telefone ?? '',
      email: c.email ?? '',
      nascimento: c.nascimento ?? '',
      observacoes: c.observacoes ?? '',
    })
    setFeedback(null)
    setModal('edit')
  }

  const openView = async (c: Cliente) => {
    setSelected(c)
    setModal('view')
    await fetchHistorico(c.nome)
  }

  const handleSubmit = async () => {
    if (!form.nome.trim()) {
      setFeedback({ type: 'error', msg: 'Nome do cliente é obrigatório.' })
      return
    }
    setSubmitting(true)
    setFeedback(null)

    const payload = {
      nome: form.nome.trim(),
      tenant_id: tenantId,
      unit_id: activeUnitId !== 'all' ? activeUnitId : null,
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      nascimento: form.nascimento || null,
      observacoes: form.observacoes.trim() || null,
    }

    if (modal === 'create') {
      const { error } = await supabase.from('clientes').insert(payload)
      if (error) { setFeedback({ type: 'error', msg: 'Erro ao criar cliente.' }); setSubmitting(false); return }
    } else if (modal === 'edit' && selected) {
      const { error } = await supabase.from('clientes').update(payload).eq('id', selected.id).eq('tenant_id', tenantId)
      if (error) { setFeedback({ type: 'error', msg: 'Erro ao atualizar cliente.' }); setSubmitting(false); return }
    }

    setSubmitting(false)
    setModal('closed')
    await fetchClientes()
  }

  const handleDelete = async () => {
    if (!selected) return
    setSubmitting(true)
    await supabase.from('clientes').delete().eq('id', selected.id).eq('tenant_id', tenantId)
    setModal('closed')
    setSubmitting(false)
    await fetchClientes()
  }

  const f = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>

      {/* Header */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Clientes</h1>
          <p style={styles.pageSubtitle}>
            {clientes.length} cadastrado{clientes.length !== 1 ? 's' : ''}
            {isPremium && activeUnitId !== 'all' ? ' na unidade selecionada' : ''}
          </p>
        </div>
        <button onClick={openCreate} style={styles.createBtn}>+ Novo Cliente</button>
      </div>

      {/* Busca */}
      <div style={styles.toolbar}>
        <input
          placeholder="🔍  Buscar por nome, telefone ou e-mail..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* Feedback */}
      {feedback && modal === 'closed' && (
        <div style={{ ...styles.feedbackBar, ...(feedback.type === 'success' ? styles.fbSuccess : styles.fbError) }}>
          {feedback.type === 'success' ? '✅' : '⚠️'} {feedback.msg}
          <button onClick={() => setFeedback(null)} style={styles.fbClose}>✕</button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div style={styles.loadingWrap}><div style={styles.spinner} /></div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>
          <span style={{ fontSize: 40 }}>👤</span>
          <p style={{ color: '#475569', marginTop: 12 }}>
            {search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}
          </p>
        </div>
      ) : (
        <div style={styles.grid}>
          {filtered.map(c => (
            <div key={c.id} style={styles.card}>
              <div style={styles.cardTop}>
                <div style={styles.avatar}>{getInitials(c.nome)}</div>
                <div style={styles.cardInfo}>
                  <p style={styles.clientNome}>{c.nome}</p>
                  {c.telefone && <p style={styles.cardDetail}>📱 {c.telefone}</p>}
                  {c.email && <p style={styles.cardDetail}>✉ {c.email}</p>}
                  {c.nascimento && <p style={styles.cardDetail}>🎂 {formatDate(c.nascimento)}</p>}
                </div>
              </div>
              {c.observacoes && (
                <p style={styles.cardObs}>📝 {c.observacoes}</p>
              )}
              <div style={styles.cardActions}>
                <button onClick={() => openView(c)} style={styles.viewBtn}>Ver histórico</button>
                <button onClick={() => openEdit(c)} style={styles.editBtn}>Editar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal Criar/Editar ── */}
      {(modal === 'create' || modal === 'edit') && (
        <div style={styles.overlay} onClick={e => { if (e.target === e.currentTarget) setModal('closed') }}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{modal === 'create' ? 'Novo Cliente' : 'Editar Cliente'}</h2>
              <button onClick={() => setModal('closed')} style={styles.modalClose}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <Field label="Nome completo *">
                <input style={styles.input} placeholder="Ex: Maria Silva" value={form.nome} onChange={e => f('nome', e.target.value)} />
              </Field>
              <Field label="Telefone">
                <input style={styles.input} placeholder="(47) 99999-9999" value={form.telefone} onChange={e => f('telefone', e.target.value)} />
              </Field>
              <Field label="E-mail">
                <input style={styles.input} type="email" placeholder="maria@email.com" value={form.email} onChange={e => f('email', e.target.value)} />
              </Field>
              <Field label="Data de nascimento">
                <input style={styles.input} type="date" value={form.nascimento} onChange={e => f('nascimento', e.target.value)} />
              </Field>
              <Field label="Observações">
                <textarea
                  style={{ ...styles.input, resize: 'vertical' as const, minHeight: 80 }}
                  placeholder="Preferências, alergias, observações..."
                  value={form.observacoes}
                  onChange={e => f('observacoes', e.target.value)}
                />
              </Field>

              {feedback && (
                <div style={{ ...styles.feedbackBar, ...(feedback.type === 'success' ? styles.fbSuccess : styles.fbError), marginTop: 0 }}>
                  {feedback.type === 'success' ? '✅' : '⚠️'} {feedback.msg}
                </div>
              )}
            </div>
            <div style={styles.modalFooter}>
              {modal === 'edit' && (
                <button onClick={handleDelete} disabled={submitting} style={styles.deleteBtn}>Excluir</button>
              )}
              <button onClick={() => setModal('closed')} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleSubmit} disabled={submitting} style={{ ...styles.confirmBtn, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Salvando...' : modal === 'create' ? 'Criar' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Ver Histórico ── */}
      {modal === 'view' && selected && (
        <div style={styles.overlay} onClick={e => { if (e.target === e.currentTarget) setModal('closed') }}>
          <div style={{ ...styles.modal, maxWidth: 520 }}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={styles.avatarLg}>{getInitials(selected.nome)}</div>
                <div>
                  <h2 style={styles.modalTitle}>{selected.nome}</h2>
                  <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                    Cliente desde {formatDate(selected.created_at)}
                  </p>
                </div>
              </div>
              <button onClick={() => setModal('closed')} style={styles.modalClose}>✕</button>
            </div>
            <div style={styles.modalBody}>
              {/* Info */}
              <div style={styles.infoGrid}>
                {selected.telefone && <InfoItem icon="📱" label="Telefone" value={selected.telefone} />}
                {selected.email && <InfoItem icon="✉" label="E-mail" value={selected.email} />}
                {selected.nascimento && <InfoItem icon="🎂" label="Nascimento" value={formatDate(selected.nascimento)} />}
                {selected.observacoes && <InfoItem icon="📝" label="Obs." value={selected.observacoes} />}
              </div>

              {/* Histórico */}
              <div>
                <p style={styles.sectionTitle}>Últimos agendamentos</p>
                {historico.length === 0 ? (
                  <p style={{ color: '#475569', fontSize: 14 }}>Nenhum agendamento encontrado.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {historico.map(a => (
                      <div key={a.id} style={styles.historicoCard}>
                        <div>
                          <p style={styles.historicoService}>{a.service}</p>
                          <p style={styles.historicoDate}>{formatDateTime(`${a.appointment_date}T${a.appointment_time || '00:00'}`)}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={styles.historicoPrice}>{formatCurrency(a.price)}</p>
                          <span style={{ ...styles.badge, backgroundColor: STATUS_COLOR[a.status] + '22', color: STATUS_COLOR[a.status] }}>
                            {STATUS_LABEL[a.status]}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => openEdit(selected)} style={styles.cancelBtn}>Editar cliente</button>
              <button onClick={() => setModal('closed')} style={styles.confirmBtn}>Fechar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>{label}</label>
      {children}
    </div>
  )
}

function InfoItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{icon} {label}</p>
      <p style={{ fontSize: 14, color: '#e2e8f0', margin: 0 }}>{value}</p>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', backgroundColor: '#0f1117', color: '#e2e8f0', fontFamily: "'DM Sans','Segoe UI',sans-serif", padding: '40px 48px' },

  pageHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  pageTitle: { fontSize: 26, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' },
  pageSubtitle: { fontSize: 14, color: '#64748b', margin: 0 },
  createBtn: { padding: '10px 20px', borderRadius: 10, background: 'linear-gradient(135deg,#2563eb,#3b82f6)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },

  toolbar: { marginBottom: 20 },
  searchInput: { width: '100%', padding: '10px 16px', borderRadius: 10, border: '1px solid #2d3748', background: '#161b27', color: '#f1f5f9', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const },

  feedbackBar: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, fontSize: 14, marginBottom: 20 },
  fbSuccess: { backgroundColor: '#10b98115', border: '1px solid #10b98130', color: '#6ee7b7' },
  fbError: { backgroundColor: '#ef444415', border: '1px solid #ef444430', color: '#f87171' },
  fbClose: { marginLeft: 'auto', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14 },

  loadingWrap: { display: 'flex', justifyContent: 'center', padding: '80px 0' },
  spinner: { width: 32, height: 32, borderRadius: '50%', border: '3px solid #1e2535', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite' },
  empty: { textAlign: 'center', padding: '80px 0' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 },
  card: { backgroundColor: '#161b27', borderRadius: 14, border: '1px solid #1e2535', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 },
  cardTop: { display: 'flex', gap: 14, alignItems: 'flex-start' },
  avatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1e2d45', border: '1px solid #2d3f5a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#60a5fa', flexShrink: 0 },
  avatarLg: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#1e2d45', border: '1px solid #2d3f5a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#60a5fa', flexShrink: 0 },
  cardInfo: { flex: 1 },
  clientNome: { fontSize: 15, fontWeight: 600, color: '#f1f5f9', margin: '0 0 4px' },
  cardDetail: { fontSize: 13, color: '#64748b', margin: '0 0 2px' },
  cardObs: { fontSize: 12, color: '#475569', margin: 0, padding: '8px 12px', backgroundColor: '#0f1117', borderRadius: 8 },
  cardActions: { display: 'flex', gap: 8, marginTop: 4 },
  viewBtn: { flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #2d3748', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer' },
  editBtn: { padding: '8px 16px', borderRadius: 8, border: '1px solid #2d3f5a', background: '#1e2d45', color: '#60a5fa', fontSize: 13, cursor: 'pointer' },

  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 },
  modal: { backgroundColor: '#161b27', border: '1px solid #1e2535', borderRadius: 20, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' as const },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 28px 0' },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 },
  modalClose: { background: 'transparent', border: 'none', color: '#64748b', fontSize: 18, cursor: 'pointer' },
  modalBody: { padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 },
  modalFooter: { display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '0 28px 24px', alignItems: 'center' },

  input: { padding: '10px 12px', backgroundColor: '#0f1117', border: '1px solid #2d3748', borderRadius: 10, color: '#f1f5f9', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' as const },

  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, backgroundColor: '#0f1117', borderRadius: 12, padding: '16px' },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: 1, margin: '0 0 12px' },

  historicoCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f1117', borderRadius: 10, padding: '12px 14px' },
  historicoService: { fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: '0 0 2px' },
  historicoDate: { fontSize: 12, color: '#64748b', margin: 0 },
  historicoPrice: { fontSize: 15, fontWeight: 700, color: '#10b981', margin: '0 0 4px' },
  badge: { display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20 },

  deleteBtn: { marginRight: 'auto', padding: '10px 18px', borderRadius: 10, border: '1px solid #ef444440', background: 'transparent', color: '#f87171', fontSize: 14, cursor: 'pointer' },
  cancelBtn: { padding: '10px 20px', borderRadius: 10, border: '1px solid #2d3748', background: 'transparent', color: '#94a3b8', fontSize: 14, cursor: 'pointer' },
  confirmBtn: { padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,#2563eb,#3b82f6)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
}
