'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTenantId } from '@/lib/useTenantId'
import { useTenant } from '@/lib/tenant-context'
import { getMaxBarbers } from '@/lib/permissions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Barber {
  id: string
  nome: string
  email: string
  telefone?: string
  ativo: boolean
  created_at: string
  user_id: string
}

type ModalState = 'closed' | 'create' | 'confirm-deactivate' | 'edit-access'

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminBarbeiros() {
  const router = useRouter()
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>('closed')
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const tenantId = useTenantId()
  const { tenant } = useTenant()
  const maxBarbers = getMaxBarbers(tenant?.plano)

const reachedLimit =
  barbers.length >= maxBarbers

  // Form state
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [senha, setSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [accessEmail, setAccessEmail] = useState('')
  const [accessPassword, setAccessPassword] = useState('')
  const [showAccessPassword, setShowAccessPassword] = useState(false)
  

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => { if (tenantId) fetchBarbers() }, [tenantId])

  const fetchBarbers = async () => {
  if (!tenantId) return
  setLoading(true)
  const { data, error } = await supabase
    .from('barbeiros')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (!error) setBarbers(data ?? [])
  setLoading(false)
}
  // ── Criar barbeiro ─────────────────────────────────────────────────────────
  // Usa a service role via API Route para criar o usuário no Auth
  // sem fazer logout do admin atual.

  const handleCreate = async () => {
    if (!nome.trim() || !email.trim() || !senha.trim()) {
      setFeedback({ type: 'error', msg: 'Nome, e-mail e senha são obrigatórios.' })
      return
    }
    if (senha.length < 6) {
      setFeedback({ type: 'error', msg: 'A senha deve ter ao menos 6 caracteres.' })
      return
    }

    setSubmitting(true)
    setFeedback(null)

    try {
      // Chama a API Route que usa service role para criar o usuário
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        setFeedback({ type: 'error', msg: 'Sessão expirada. Entre novamente.' })
        setSubmitting(false)
        return
      }

      const res = await fetch('/api/admin/criar-barbeiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
  nome: nome.trim(),
  email: email.trim(),
  senha,
  telefone: telefone.trim(),
  tenant_id: tenantId,
}),
      })

      const json = await res.json()

      if (!res.ok) {
        setFeedback({ type: 'error', msg: json.error ?? 'Erro ao criar barbeiro.' })
        setSubmitting(false)
        return
      }

      setFeedback({ type: 'success', msg: `Barbeiro "${nome}" criado com sucesso!` })
      resetForm()
      setModal('closed')
      await fetchBarbers()
    } catch {
      setFeedback({ type: 'error', msg: 'Erro de conexão. Tente novamente.' })
    }

    setSubmitting(false)
  }

  // ── Ativar / Desativar ─────────────────────────────────────────────────────

  const handleToggleActive = async (barber: Barber) => {
    if (barber.ativo) {
      setSelectedBarber(barber)
      setModal('confirm-deactivate')
      return
    }
    // Reativar direto
    await supabase.from('barbeiros').update({ ativo: true }).eq('id', barber.id).eq('tenant_id', tenantId)
    setFeedback({ type: 'success', msg: `${barber.nome} reativado.` })
    await fetchBarbers()
  }

  const confirmDeactivate = async () => {
    if (!selectedBarber) return
    setSubmitting(true)
    await supabase.from('barbeiros').update({ ativo: false }).eq('id', selectedBarber.id).eq('tenant_id', tenantId)
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

  const resetForm = () => {
    setNome(''); setEmail(''); setSenha(''); setTelefone(''); setShowSenha(false)
    setFeedback(null)
  }

  const openCreate = () => { resetForm(); setModal('create') }

  // ── Render ─────────────────────────────────────────────────────────────────

  const active = barbers.filter(b => b.ativo)
  const inactive = barbers.filter(b => !b.ativo)

  return (
    <div style={styles.root}>

      {/* Header */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Barbeiros</h1>
          <p style={styles.pageSubtitle}>{active.length} ativo{active.length !== 1 ? 's' : ''} · {inactive.length} inativo{inactive.length !== 1 ? 's' : ''}</p>
        </div>
        <button
  onClick={openCreate}
  disabled={reachedLimit}
  style={{
    ...styles.createBtn,
    opacity: reachedLimit ? 0.5 : 1,
    cursor: reachedLimit ? 'not-allowed' : 'pointer',
  }}
>
  Novo barbeiro
</button>

{reachedLimit && (
  <p
    style={{
      color: '#f59e0b',
      fontSize: 13,
      marginTop: 8,
    }}
  >
    Limite do plano atingido.
    Faça upgrade para adicionar mais barbeiros.
  </p>
)}
      </div>

      {/* Feedback global */}
      {feedback && (
        <div style={{ ...styles.feedbackBar, ...(feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError) }}>
          {feedback.type === 'success' ? '✅' : '⚠️'} {feedback.msg}
          <button onClick={() => setFeedback(null)} style={styles.feedbackClose}>✕</button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Carregando barbeiros...</p>
        </div>
      ) : barbers.length === 0 ? (
        <div style={styles.empty}>
          <span style={styles.emptyIcon}>✂️</span>
          <p style={styles.emptyText}>Nenhum barbeiro cadastrado ainda.</p>
          <button onClick={openCreate} style={styles.emptyBtn}>Criar primeiro barbeiro</button>
        </div>
      ) : (
        <div style={styles.list}>
          {barbers.map(b => (
            <BarberRow key={b.id} barber={b} onToggle={handleToggleActive} onEditAccess={openEditAccess} />
          ))}
        </div>
      )}

      {/* ── Modal Criar ── */}
      {modal === 'create' && (
        <Overlay onClose={() => setModal('closed')}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Novo Barbeiro</h2>
              <button onClick={() => setModal('closed')} style={styles.modalClose}>✕</button>
            </div>

            <div style={styles.modalBody}>
              <Field label="Nome completo" icon="👤">
                <input style={styles.input} placeholder="Ex: João Silva" value={nome} onChange={e => setNome(e.target.value)} />
              </Field>
              <Field label="E-mail" icon="✉">
                <input style={styles.input} type="email" placeholder="joao@barbearia.com" value={email} onChange={e => setEmail(e.target.value)} />
              </Field>
              <Field label="Telefone (opcional)" icon="📱">
                <input style={styles.input} placeholder="(47) 99999-9999" value={telefone} onChange={e => setTelefone(e.target.value)} />
              </Field>
              <Field label="Senha de acesso" icon="🔒">
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...styles.input, paddingRight: 44 }}
                    type={showSenha ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                  />
                  <button onClick={() => setShowSenha(v => !v)} style={styles.eyeBtn}>{showSenha ? '🙈' : '👁'}</button>
                </div>
              </Field>

              {feedback && modal === 'create' && (
                <div style={{ ...styles.feedbackBar, ...(feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError), marginTop: 0 }}>
                  {feedback.type === 'success' ? '✅' : '⚠️'} {feedback.msg}
                </div>
              )}

              <div style={styles.modalHint}>
                💡 O barbeiro usará este e-mail e senha para acessar o painel em <strong style={{ color: '#93c5fd' }}>/barber/login</strong>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setModal('closed')} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleCreate} disabled={submitting} style={{ ...styles.confirmBtn, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Criando...' : 'Criar Barbeiro'}
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {/* ── Modal Confirmar Desativação ── */}
      {modal === 'confirm-deactivate' && selectedBarber && (
        <Overlay onClose={() => setModal('closed')}>
          <div style={{ ...styles.modal, maxWidth: 380 }}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Desativar barbeiro?</h2>
              <button onClick={() => setModal('closed')} style={styles.modalClose}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <p style={styles.confirmText}>
                <strong style={{ color: '#f1f5f9' }}>{selectedBarber.nome}</strong> não conseguirá mais fazer login até ser reativado.
              </p>
              <p style={{ ...styles.confirmText, color: '#64748b', fontSize: 13 }}>
                Os agendamentos dele continuarão registrados normalmente.
              </p>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setModal('closed')} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={confirmDeactivate} disabled={submitting} style={{ ...styles.dangerBtn, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Desativando...' : 'Sim, desativar'}
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {/* ── Modal Editar Acesso ── */}
      {modal === 'edit-access' && selectedBarber && (
        <Overlay onClose={() => setModal('closed')}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Acesso do barbeiro</h2>
              <button onClick={() => setModal('closed')} style={styles.modalClose}>✕</button>
            </div>

            <div style={styles.modalBody}>
              <p style={styles.confirmText}>
                Atualize o e-mail ou defina uma nova senha para <strong style={{ color: '#f1f5f9' }}>{selectedBarber.nome}</strong>.
              </p>

              <Field label="E-mail de login" icon="✉">
                <input
                  style={styles.input}
                  type="email"
                  placeholder="barbeiro@email.com"
                  value={accessEmail}
                  onChange={e => setAccessEmail(e.target.value)}
                />
              </Field>

              <Field label="Nova senha (opcional)" icon="🔒">
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...styles.input, paddingRight: 44 }}
                    type={showAccessPassword ? 'text' : 'password'}
                    placeholder="Deixe em branco para manter a atual"
                    value={accessPassword}
                    onChange={e => setAccessPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccessPassword(v => !v)}
                    style={styles.eyeBtn}
                  >
                    {showAccessPassword ? '🙈' : '👁'}
                  </button>
                </div>
              </Field>

              <div style={styles.modalHint}>
                Se o barbeiro esqueceu a senha, coloque uma nova aqui e envie para ele acessar em <strong style={{ color: '#93c5fd' }}>/barber/login</strong>.
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setModal('closed')} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleSaveAccess} disabled={submitting} style={{ ...styles.confirmBtn, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Salvando...' : 'Salvar acesso'}
              </button>
            </div>
          </div>
        </Overlay>
      )}

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BarberRow({ barber, onToggle, onEditAccess }: { barber: Barber; onToggle: (b: Barber) => void; onEditAccess: (b: Barber) => void }) {
  const initials = barber.nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const since = new Date(barber.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })

  return (
    <div style={{ ...styles.row, opacity: barber.ativo ? 1 : 0.55 }}>
      <div style={styles.avatar}>{initials}</div>
      <div style={styles.rowInfo}>
        <p style={styles.rowName}>{barber.nome}</p>
        <p style={styles.rowEmail}>{barber.email}{barber.telefone ? ` · ${barber.telefone}` : ''}</p>
      </div>
      <div style={styles.rowMeta}>
        <span style={{ ...styles.badge, ...(barber.ativo ? styles.badgeActive : styles.badgeInactive) }}>
          {barber.ativo ? 'Ativo' : 'Inativo'}
        </span>
        <p style={styles.rowSince}>desde {since}</p>
      </div>
      <button
        onClick={() => onEditAccess(barber)}
        style={styles.accessBtn}
      >
        Acesso
      </button>
      <button
        onClick={() => onToggle(barber)}
        style={{ ...styles.toggleBtn, ...(barber.ativo ? styles.toggleDeactivate : styles.toggleActivate) }}
      >
        {barber.ativo ? 'Desativar' : 'Reativar'}
      </button>
    </div>
  )
}

function Field({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={styles.field}>
      <label style={styles.fieldLabel}>{icon} {label}</label>
      {children}
    </div>
  )
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      {children}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    backgroundColor: '#0f1117',
    color: '#e2e8f0',
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    padding: '40px 48px',
  },

  pageHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  pageTitle: { fontSize: 26, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' },
  pageSubtitle: { fontSize: 14, color: '#64748b', margin: 0 },
  createBtn: {
    padding: '10px 20px', borderRadius: 10,
    background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
    border: 'none', color: '#fff', fontSize: 14,
    fontWeight: 600, cursor: 'pointer',
  },

  feedbackBar: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 16px', borderRadius: 10,
    fontSize: 14, marginBottom: 24, position: 'relative',
  },
  feedbackSuccess: { backgroundColor: '#10b98115', border: '1px solid #10b98130', color: '#6ee7b7' },
  feedbackError: { backgroundColor: '#ef444415', border: '1px solid #ef444430', color: '#f87171' },
  feedbackClose: {
    marginLeft: 'auto', background: 'transparent', border: 'none',
    color: 'inherit', cursor: 'pointer', fontSize: 14, padding: 0,
  },

  loadingWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0' },
  spinner: {
    width: 32, height: 32, borderRadius: '50%',
    border: '3px solid #1e2535', borderTopColor: '#3b82f6',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { color: '#475569', marginTop: 14, fontSize: 14 },

  empty: { textAlign: 'center', padding: '80px 0' },
  emptyIcon: { fontSize: 48, display: 'block', marginBottom: 16 },
  emptyText: { color: '#475569', fontSize: 15, marginBottom: 20 },
  emptyBtn: {
    padding: '10px 24px', borderRadius: 10,
    background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
    border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer',
  },

  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  row: {
    display: 'flex', alignItems: 'center', gap: 16,
    backgroundColor: '#161b27', border: '1px solid #1e2535',
    borderRadius: 14, padding: '16px 20px',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#1e2d45', border: '1px solid #2d3f5a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 15, fontWeight: 700, color: '#60a5fa', flexShrink: 0,
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: 600, color: '#f1f5f9', margin: '0 0 2px' },
  rowEmail: { fontSize: 13, color: '#64748b', margin: 0 },
  rowMeta: { textAlign: 'right' },
  rowSince: { fontSize: 12, color: '#475569', margin: '4px 0 0' },
  badge: {
    display: 'inline-block', fontSize: 11, fontWeight: 600,
    padding: '3px 10px', borderRadius: 20,
  },
  badgeActive: { backgroundColor: '#10b98120', color: '#6ee7b7' },
  badgeInactive: { backgroundColor: '#64748b20', color: '#94a3b8' },
  toggleBtn: {
    padding: '8px 16px', borderRadius: 8, border: '1px solid',
    fontSize: 13, fontWeight: 500, cursor: 'pointer', flexShrink: 0,
    background: 'transparent',
  },
  toggleDeactivate: { borderColor: '#ef444440', color: '#f87171' },
  toggleActivate: { borderColor: '#10b98140', color: '#6ee7b7' },
  accessBtn: {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid #2d3748',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    flexShrink: 0,
    background: '#0f172a',
    color: '#93c5fd',
  },

  // Modal
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 50, padding: 24,
  },
  modal: {
    backgroundColor: '#161b27', border: '1px solid #1e2535',
    borderRadius: 20, width: '100%', maxWidth: 480,
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '24px 28px 0',
  },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 },
  modalClose: {
    background: 'transparent', border: 'none',
    color: '#64748b', fontSize: 18, cursor: 'pointer', padding: 4,
  },
  modalBody: { padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 },
  modalFooter: {
    display: 'flex', gap: 10, justifyContent: 'flex-end',
    padding: '0 28px 24px',
  },
  modalHint: {
    backgroundColor: '#1e2d4520', border: '1px solid #2d3f5a',
    borderRadius: 10, padding: '12px 14px',
    fontSize: 13, color: '#64748b', lineHeight: 1.6,
  },

  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: 600, color: '#94a3b8' },
  input: {
    width: '100%', padding: '11px 14px',
    backgroundColor: '#0f1117', border: '1px solid #2d3748',
    borderRadius: 10, color: '#f1f5f9', fontSize: 14,
    outline: 'none', boxSizing: 'border-box',
  },
  eyeBtn: {
    position: 'absolute', right: 12, top: '50%',
    transform: 'translateY(-50%)',
    background: 'transparent', border: 'none',
    cursor: 'pointer', fontSize: 16, padding: 4,
  },

  cancelBtn: {
    padding: '10px 20px', borderRadius: 10,
    border: '1px solid #2d3748', background: 'transparent',
    color: '#94a3b8', fontSize: 14, cursor: 'pointer',
  },
  confirmBtn: {
    padding: '10px 22px', borderRadius: 10,
    background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
    border: 'none', color: '#fff', fontSize: 14,
    fontWeight: 600, cursor: 'pointer',
  },
  dangerBtn: {
    padding: '10px 22px', borderRadius: 10,
    background: 'linear-gradient(135deg, #dc2626, #ef4444)',
    border: 'none', color: '#fff', fontSize: 14,
    fontWeight: 600, cursor: 'pointer',
  },

  confirmText: { fontSize: 15, color: '#cbd5e1', margin: 0, lineHeight: 1.6 },
}
