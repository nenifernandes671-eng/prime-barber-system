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

    const payload: Record<string, string | null> = {
      nome: form.nome.trim(),
      tenant_id: tenantId,
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      nascimento: form.nascimento || null,
      observacoes: form.observacoes.trim() || null,
    }

    if (activeUnitId !== 'all') {
      payload.unit_id = activeUnitId
    }

    if (modal === 'create') {
      const { error } = await supabase.from('clientes').insert(payload)
      if (error) { setFeedback({ type: 'error', msg: `Erro ao criar cliente: ${error.message}` }); setSubmitting(false); return }
    } else if (modal === 'edit' && selected) {
      const { error } = await supabase.from('clientes').update(payload).eq('id', selected.id).eq('tenant_id', tenantId)
      if (error) { setFeedback({ type: 'error', msg: `Erro ao atualizar cliente: ${error.message}` }); setSubmitting(false); return }
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
    <div className="kb-light-root kb-clients-page" style={styles.root}>

      {/* Header */}
      <div style={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={styles.headerIcon}>👥</div>
          <div>
            <p style={styles.kicker}>Relacionamento</p>
            <h1 style={styles.pageTitle}>Clientes</h1>
            <p style={styles.pageSubtitle}>
              Lista SaaS limpa para acompanhar histórico e recorrência · {clientes.length} cadastrado{clientes.length !== 1 ? 's' : ''}
              {isPremium && activeUnitId !== 'all' ? ' na unidade selecionada' : ''}
            </p>
          </div>
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
          <div style={styles.tableHeader}>
            <span>Cliente</span>
            <span>Telefone</span>
            <span>E-mail</span>
            <span>Nascimento</span>
            <span style={{ textAlign: 'right' }}>Ações</span>
          </div>
          {filtered.map(c => (
            <div key={c.id} style={styles.card}>
              <div style={styles.cardTop}>
                <div style={styles.avatar}>{getInitials(c.nome)}</div>
                <div style={styles.cardInfo}>
                  <p style={styles.clientNome}>{c.nome}</p>
                  {c.observacoes && <p style={styles.cardDetail}>📝 {c.observacoes}</p>}
                </div>
              </div>

              <p style={styles.cardDetail}>{c.telefone || '—'}</p>
              <p style={styles.cardDetail}>{c.email || '—'}</p>
              <p style={styles.cardDetail}>{c.nascimento ? formatDate(c.nascimento) : '—'}</p>

              <div style={styles.cardActions}>
                <button onClick={() => openView(c)} style={styles.viewBtn}>Histórico</button>
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
  root: {
    minHeight: '100vh',
    color: '#e2e8f0',
    fontFamily: "'DM Sans','Segoe UI',sans-serif",
    padding: '44px 52px 72px',
    background:
      'radial-gradient(circle at 85% 10%, rgba(37,99,235,0.16), transparent 34%), radial-gradient(circle at 12% 12%, rgba(59,130,246,0.10), transparent 30%), linear-gradient(135deg,#020617 0%,#050816 48%,#09051a 100%)',
  },

  pageHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, marginBottom: 28 },
  headerIcon: {
    width: 62,
    height: 62,
    borderRadius: 18,
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(135deg,#2563eb,#3b82f6)',
    boxShadow: '0 18px 38px rgba(37,99,235,0.26)',
    fontSize: 26,
    flexShrink: 0,
  },
  kicker: {
    margin: '0 0 6px',
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: 2.6,
    textTransform: 'uppercase' as const,
  },
  pageTitle: {
    fontSize: 42,
    lineHeight: 1,
    fontWeight: 950,
    color: '#f8fafc',
    margin: '0 0 8px',
    letterSpacing: -1.4,
    textShadow: '0 4px 20px rgba(0,0,0,0.45)',
  },
  pageSubtitle: { fontSize: 14, color: '#94a3b8', margin: 0 },
  createBtn: {
    padding: '13px 20px',
    borderRadius: 14,
    background: 'linear-gradient(135deg,#2563eb,#3b82f6)',
    border: '1px solid rgba(147,197,253,0.22)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 18px 34px rgba(37,99,235,0.24)',
  },

  toolbar: { marginBottom: 22, display: 'flex', alignItems: 'center', gap: 12 },
  searchInput: {
    width: '100%',
    maxWidth: 560,
    padding: '15px 18px',
    borderRadius: 18,
    border: '1px solid rgba(148,163,184,0.16)',
    background: 'rgba(15,23,42,0.62)',
    color: '#f1f5f9',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 18px 45px rgba(0,0,0,0.18)',
  },

  feedbackBar: { display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 14, fontSize: 14, marginBottom: 20 },
  fbSuccess: { backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.28)', color: '#6ee7b7' },
  fbError: { backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.28)', color: '#f87171' },
  fbClose: { marginLeft: 'auto', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14 },

  loadingWrap: { display: 'flex', justifyContent: 'center', padding: '90px 0' },
  spinner: { width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(30,41,59,0.9)', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite' },
  empty: {
    textAlign: 'center',
    padding: '80px 0',
    borderRadius: 24,
    border: '1px solid rgba(148,163,184,0.10)',
    background: 'linear-gradient(145deg,rgba(15,23,42,0.76),rgba(8,13,28,0.66))',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 0,
    borderRadius: 24,
    overflow: 'hidden',
    border: '1px solid rgba(148,163,184,0.12)',
    background: 'linear-gradient(145deg,rgba(15,23,42,0.82),rgba(8,13,28,0.74))',
    boxShadow: '0 28px 80px rgba(0,0,0,0.28)',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px,1.2fr) minmax(170px,.7fr) minmax(170px,.75fr) minmax(130px,.55fr) 220px',
    gap: 18,
    padding: '16px 22px',
    borderBottom: '1px solid rgba(148,163,184,0.10)',
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: 1.3,
    textTransform: 'uppercase' as const,
  },
  card: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    border: 'none',
    borderBottom: '1px solid rgba(148,163,184,0.10)',
    padding: '20px 22px',
    display: 'grid',
    gridTemplateColumns: 'minmax(260px,1.2fr) minmax(170px,.7fr) minmax(170px,.75fr) minmax(130px,.55fr) 220px',
    gap: 18,
    alignItems: 'center',
  },
  cardTop: { display: 'flex', gap: 14, alignItems: 'center' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    background: 'linear-gradient(135deg,rgba(37,99,235,0.26),rgba(59,130,246,0.12))',
    border: '1px solid rgba(96,165,250,0.32)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 950,
    color: '#93c5fd',
    flexShrink: 0,
    boxShadow: '0 14px 28px rgba(37,99,235,0.14)',
  },
  avatarLg: {
    width: 56,
    height: 56,
    borderRadius: 18,
    background: 'linear-gradient(135deg,rgba(37,99,235,0.30),rgba(59,130,246,0.14))',
    border: '1px solid rgba(96,165,250,0.32)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    fontWeight: 950,
    color: '#93c5fd',
    flexShrink: 0,
  },
  cardInfo: { flex: 1, minWidth: 0 },
  clientNome: { fontSize: 15, fontWeight: 900, color: '#f8fafc', margin: '0 0 5px' },
  cardDetail: {
    fontSize: 13,
    color: '#94a3b8',
    margin: 0,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardObs: { fontSize: 12, color: '#64748b', margin: 0, padding: '8px 12px', backgroundColor: 'rgba(2,6,23,0.48)', borderRadius: 10, border: '1px solid rgba(148,163,184,0.08)' },
  cardActions: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 0 },
  viewBtn: { padding: '10px 13px', borderRadius: 12, border: '1px solid rgba(96,165,250,0.20)', background: 'rgba(59,130,246,0.08)', color: '#93c5fd', fontSize: 13, fontWeight: 800, cursor: 'pointer' },
  editBtn: { padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(148,163,184,0.14)', background: 'rgba(15,23,42,0.66)', color: '#cbd5e1', fontSize: 13, fontWeight: 800, cursor: 'pointer' },

  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 },
  modal: { background: 'linear-gradient(145deg,rgba(15,23,42,0.98),rgba(8,13,28,0.98))', border: '1px solid rgba(148,163,184,0.14)', borderRadius: 24, width: '100%', maxWidth: 520, boxShadow: '0 34px 110px rgba(0,0,0,0.64)', maxHeight: '90vh', overflowY: 'auto' as const },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '26px 30px 0' },
  modalTitle: { fontSize: 20, fontWeight: 950, color: '#f8fafc', margin: 0 },
  modalClose: { background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.14)', color: '#94a3b8', fontSize: 16, cursor: 'pointer', width: 34, height: 34, borderRadius: 12 },
  modalBody: { padding: '22px 30px', display: 'flex', flexDirection: 'column', gap: 16 },
  modalFooter: { display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '0 30px 28px', alignItems: 'center' },

  input: { padding: '12px 13px', backgroundColor: 'rgba(2,6,23,0.48)', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 12, color: '#f1f5f9', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' as const },

  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, backgroundColor: 'rgba(2,6,23,0.42)', borderRadius: 16, padding: '16px', border: '1px solid rgba(148,163,184,0.10)' },
  sectionTitle: { fontSize: 12, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 1.6, margin: '0 0 12px' },

  historicoCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(2,6,23,0.48)', border: '1px solid rgba(148,163,184,0.09)', borderRadius: 14, padding: '13px 14px' },
  historicoService: { fontSize: 14, fontWeight: 850, color: '#e2e8f0', margin: '0 0 2px' },
  historicoDate: { fontSize: 12, color: '#64748b', margin: 0 },
  historicoPrice: { fontSize: 15, fontWeight: 950, color: '#10b981', margin: '0 0 4px' },
  badge: { display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20 },

  deleteBtn: { marginRight: 'auto', padding: '10px 18px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.28)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: 14, cursor: 'pointer', fontWeight: 800 },
  cancelBtn: { padding: '10px 20px', borderRadius: 12, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(15,23,42,0.62)', color: '#94a3b8', fontSize: 14, cursor: 'pointer', fontWeight: 800 },
  confirmBtn: { padding: '10px 22px', borderRadius: 12, background: 'linear-gradient(135deg,#2563eb,#3b82f6)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer', boxShadow: '0 14px 30px rgba(37,99,235,0.22)' },
}
