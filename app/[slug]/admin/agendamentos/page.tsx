'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantId } from '@/lib/useTenantId'
import { useIsMobile } from '@/lib/useIsMobile'

interface Appointment {
  id: string
  client_name: string
  phone: string
  service: string
  price: number
  barber: string
  appointment_date: string
  appointment_time: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'scheduled' | 'finished'
  notes?: string
}

interface Barber {
  id: string
  nome: string
}

type ModalState = 'closed' | 'create' | 'edit'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente', confirmed: 'Confirmado', completed: 'Concluído',
  cancelled: 'Cancelado', scheduled: 'Agendado', finished: 'Finalizado',
}
const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#3b82f6', completed: '#10b981',
  cancelled: '#ef4444', scheduled: '#8b5cf6', finished: '#10b981',
}
const MOBILE_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirm.',
  completed: 'Concl.',
  cancelled: 'Cancel.',
  scheduled: 'Agend.',
  finished: 'Final.',
}
const FILTERS = ['todos', 'scheduled', 'pending', 'confirmed', 'completed', 'finished', 'cancelled'] as const
type Filter = typeof FILTERS[number]

function formatCurrency(v: number) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function formatDate(date: string, time?: string) {
  if (!date) return '—'
  return new Date(date + 'T' + (time || '00:00')).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
const emptyForm = () => ({
  barber: '', client_name: '', phone: '', service: '',
  price: '', appointment_date: '', appointment_time: '',
  status: 'scheduled' as Appointment['status'], notes: '',
})

export default function AdminAgendamentos() {
  const isMobile = useIsMobile()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('todos')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>('closed')
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [submitting, setSubmitting] = useState(false)
  const tenantId = useTenantId()

  useEffect(() => { if (tenantId) fetchAll() }, [tenantId])

  const fetchAll = async () => {
  if (!tenantId) return
  setLoading(true)
  const [{ data: appts }, { data: barbs }] = await Promise.all([
    supabase.from('appointments').select('*')
      .eq('tenant_id', tenantId)
      .order('appointment_date', { ascending: false }),
    supabase.from('barbeiros').select('id, nome')
      .eq('tenant_id', tenantId)
      .eq('ativo', true),
  ])
  setAppointments(appts ?? [])
  setBarbers(barbs ?? [])
  setLoading(false)
}

  const filtered = appointments.filter(a => {
    const matchFilter = filter === 'todos' || a.status === filter
    const matchSearch = search === '' ||
      a.client_name.toLowerCase().includes(search.toLowerCase()) ||
      a.service.toLowerCase().includes(search.toLowerCase()) ||
      (a.phone ?? '').includes(search)
    return matchFilter && matchSearch
  })

  // ── Stats corrigidos ──
  const today = new Date().toISOString().split('T')[0]

const todayCount = appointments.filter(a =>
  a.appointment_date === today &&
  a.status !== 'cancelled'
).length

  const pendingCount = appointments.filter(a =>
    a.status === 'pending' || a.status === 'scheduled'
  ).length

  const monthRevenue = appointments
    .filter(a =>
      (a.status === 'completed' || a.status === 'finished' || a.status === 'scheduled') &&
      new Date(a.appointment_date).getMonth() === new Date().getMonth() &&
      new Date(a.appointment_date).getFullYear() === new Date().getFullYear()
    )
    .reduce((s, a) => s + (a.price || 0), 0)

  const openCreate = () => { setForm(emptyForm()); setSelected(null); setModal('create') }
  const openEdit = (a: Appointment) => {
    setSelected(a)
    setForm({
      barber: a.barber || '', client_name: a.client_name, phone: a.phone || '',
      service: a.service, price: String(a.price),
      appointment_date: a.appointment_date, appointment_time: a.appointment_time,
      status: a.status, notes: a.notes || '',
    })
    setModal('edit')
  }

  const handleSubmit = async () => {
    if (!form.client_name || !form.service || !form.appointment_date || !form.appointment_time) {
      alert('Preencha os campos obrigatórios.'); return
    }
    setSubmitting(true)
    const payload = {
  tenant_id: tenantId,
  client_name: form.client_name.trim(),
  phone: form.phone.trim(),
  service: form.service.trim(),
  barber: form.barber,
  price: parseFloat(form.price) || 0,
  appointment_date: form.appointment_date,
  appointment_time: form.appointment_time,
  status: form.status,
  notes: form.notes.trim(),
}
    if (modal === 'create') {
      const { error } = await supabase.from('appointments').insert(payload)
      if (error) { alert('Erro ao criar.'); setSubmitting(false); return }
    } else if (modal === 'edit' && selected) {
      const { error } = await supabase.from('appointments').update(payload).eq('id', selected.id).eq('tenant_id', tenantId)
      if (error) { alert('Erro ao atualizar.'); setSubmitting(false); return }
    }
    setSubmitting(false); setModal('closed'); await fetchAll()
  }

  const handleDelete = async () => {
    if (!selected || !confirm('Deseja excluir este agendamento?')) return
    await supabase.from('appointments').delete().eq('id', selected.id).eq('tenant_id', tenantId)
    setModal('closed'); await fetchAll()
  }

  const f = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div style={styles.root}>
      <div style={{ ...styles.pageHeader, ...(isMobile ? styles.mobilePageHeader : {}) }}>
        <div>
          <h1 style={{ ...styles.pageTitle, fontSize: isMobile ? 26 : styles.pageTitle.fontSize }}>Agendamentos</h1>
          <p style={styles.pageSubtitle}>{appointments.length} total</p>
        </div>
        <button onClick={openCreate} style={{ ...styles.createBtn, width: isMobile ? '100%' : undefined }}>+ Novo Agendamento</button>
      </div>

      {/* Stats */}
      <div style={{ ...styles.statsGrid, gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : styles.statsGrid.gridTemplateColumns, gap: isMobile ? 10 : styles.statsGrid.gap }}>
        <StatCard icon="📅" label="Hoje" value={String(todayCount)} color="#3b82f6" />
        <StatCard icon="⏳" label="Pendentes / Agendados" value={String(pendingCount)} color="#f59e0b" />
        <StatCard icon="💰" label="Receita do mês" value={formatCurrency(monthRevenue)} color="#10b981" />
        <StatCard icon="✂️" label="Barbeiros ativos" value={String(barbers.length)} color="#8b5cf6" />
      </div>

      {/* Filtros */}
      <div style={{ ...styles.toolbar, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : styles.toolbar.alignItems }}>
        <div style={{ ...styles.filters, flexWrap: isMobile ? 'wrap' : styles.filters.flexWrap, gap: isMobile ? 6 : styles.filters.gap }}>
          {FILTERS.map(flt => (
            <button key={flt} onClick={() => setFilter(flt)}
              style={{ ...styles.filterBtn, ...(isMobile ? styles.filterBtnMobile : {}), ...(filter === flt ? styles.filterActive : {}) }}>
              {flt === 'todos' ? 'Todos' : isMobile ? MOBILE_STATUS_LABEL[flt] : STATUS_LABEL[flt]}
            </button>
          ))}
        </div>
        <input placeholder="🔍 Buscar cliente, serviço..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ ...styles.searchInput, marginLeft: isMobile ? 0 : styles.searchInput.marginLeft, width: isMobile ? '100%' : undefined, minWidth: isMobile ? 0 : styles.searchInput.minWidth }} />
      </div>

      {/* Lista */}
      {loading ? (
        <div style={styles.loadingWrap}><div style={styles.spinner} /></div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>
          <span style={{ fontSize: 40 }}>🗓</span>
          <p style={{ color: '#475569', marginTop: 12 }}>Nenhum agendamento encontrado.</p>
        </div>
      ) : (
        <div style={styles.list}>
          {filtered.map(a => (
            <div key={a.id} style={{ ...styles.card, borderRadius: isMobile ? 12 : styles.card.borderRadius }} onClick={() => openEdit(a)}>
              <div style={{ ...styles.cardAccent, backgroundColor: STATUS_COLOR[a.status] ?? '#64748b' }} />
              <div style={{ ...styles.cardBody, padding: isMobile ? '14px 12px' : styles.cardBody.padding }}>
                <div style={{ ...styles.cardMain, flexDirection: isMobile ? 'column' : 'row' }}>
                  <div>
                    <p style={styles.clientName}>{a.client_name}</p>
                    <p style={styles.cardSub}>{a.service}{a.barber ? ` · ${a.barber}` : ''}</p>
                    {a.phone && <p style={styles.cardPhone}>📱 {a.phone}</p>}
                  </div>
                  <div style={{ ...styles.cardRight, textAlign: isMobile ? 'left' : styles.cardRight.textAlign, width: isMobile ? '100%' : undefined }}>
                    <p style={styles.cardPrice}>{formatCurrency(a.price)}</p>
                    <p style={styles.cardTime}>{formatDate(a.appointment_date, a.appointment_time)}</p>
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', alignItems: isMobile ? 'center' : 'flex-end', gap: 6, flexWrap: 'wrap' }}>
  <span style={{ ...styles.badge, backgroundColor: (STATUS_COLOR[a.status] ?? '#64748b') + '22', color: STATUS_COLOR[a.status] ?? '#94a3b8' }}>
    {STATUS_LABEL[a.status] ?? a.status}
  </span>
  {(a.status === 'scheduled' || a.status === 'confirmed' || a.status === 'pending') && (
    <button
      onClick={async (e) => {
        e.stopPropagation()
        await supabase.from('appointments').update({ status: 'finished', payment_status: 'paid' }).eq('id', a.id).eq('tenant_id', tenantId)
        fetchAll()
      }}
      style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
    >
      ✓ Finalizar
    </button>
  )}
</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal !== 'closed' && (
        <div style={styles.overlay} onClick={e => { if (e.target === e.currentTarget) setModal('closed') }}>
          <div style={{ ...styles.modal, maxWidth: isMobile ? '100%' : styles.modal.maxWidth, borderRadius: isMobile ? 14 : styles.modal.borderRadius }}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{modal === 'create' ? 'Novo Agendamento' : 'Editar Agendamento'}</h2>
              <button onClick={() => setModal('closed')} style={styles.modalClose}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <div style={{ ...styles.formGrid, gridTemplateColumns: isMobile ? '1fr' : styles.formGrid.gridTemplateColumns }}>
                <Field label="Cliente *"><input style={styles.input} value={form.client_name} onChange={e => f('client_name', e.target.value)} /></Field>
                <Field label="Telefone"><input style={styles.input} value={form.phone} onChange={e => f('phone', e.target.value)} /></Field>
                <Field label="Serviço *"><input style={styles.input} value={form.service} onChange={e => f('service', e.target.value)} /></Field>
                <Field label="Preço"><input style={styles.input} type="number" value={form.price} onChange={e => f('price', e.target.value)} /></Field>
                <Field label="Data *"><input style={styles.input} type="date" value={form.appointment_date} onChange={e => f('appointment_date', e.target.value)} /></Field>
                <Field label="Hora *"><input style={styles.input} type="time" value={form.appointment_time} onChange={e => f('appointment_time', e.target.value)} /></Field>
                <Field label="Barbeiro">
                  <select style={styles.input} value={form.barber} onChange={e => f('barber', e.target.value)}>
                    <option value="">Selecionar barbeiro</option>
                    {barbers.map(b => <option key={b.id} value={b.nome}>{b.nome}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select style={styles.input} value={form.status} onChange={e => f('status', e.target.value as Appointment['status'])}>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
              </div>
            </div>
            <div style={{ ...styles.modalFooter, flexWrap: 'wrap', justifyContent: isMobile ? 'stretch' : styles.modalFooter.justifyContent }}>
              {modal === 'edit' && <button onClick={handleDelete} style={styles.deleteBtn}>Excluir</button>}
              <button onClick={() => setModal('closed')} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleSubmit} disabled={submitting} style={{ ...styles.confirmBtn, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Salvando...' : modal === 'create' ? 'Criar' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div style={{ backgroundColor: '#161b27', borderRadius: 14, padding: 20, border: '1px solid #1e2535', borderTop: `3px solid ${color}` }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <p style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: '8px 0 2px' }}>{value}</p>
      <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{label}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: { color: '#e2e8f0', fontFamily: "'DM Sans','Segoe UI',sans-serif" },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  mobilePageHeader: { flexDirection: 'column', alignItems: 'stretch', gap: 14, marginBottom: 20 },
  pageTitle: { fontSize: 28, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' },
  pageSubtitle: { color: '#64748b', fontSize: 14, margin: 0 },
  createBtn: { padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 },
  toolbar: { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' as const, alignItems: 'center' },
  filters: { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  filterBtn: { padding: '6px 14px', borderRadius: 20, border: '1px solid #2d3748', background: 'transparent', color: '#64748b', fontSize: 13, cursor: 'pointer' },
  filterBtnMobile: { flex: '0 0 auto', padding: '7px 10px', fontSize: 12, whiteSpace: 'nowrap' },
  filterActive: { backgroundColor: '#1e2d45', borderColor: '#3b82f6', color: '#60a5fa' },
  searchInput: { marginLeft: 'auto', padding: '8px 14px', borderRadius: 10, border: '1px solid #2d3748', background: '#161b27', color: '#f1f5f9', fontSize: 14, outline: 'none', minWidth: 220 },
  loadingWrap: { display: 'flex', justifyContent: 'center', padding: 80 },
  spinner: { width: 32, height: 32, borderRadius: '50%', border: '3px solid #1e2535', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite' },
  empty: { textAlign: 'center', padding: 80 },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { display: 'flex', backgroundColor: '#161b27', borderRadius: 14, border: '1px solid #1e2535', overflow: 'hidden', cursor: 'pointer' },
  cardAccent: { width: 4, flexShrink: 0 },
  cardBody: { flex: 1, padding: '16px 20px' },
  cardMain: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  clientName: { fontSize: 16, fontWeight: 600, color: '#f1f5f9', margin: '0 0 2px' },
  cardSub: { fontSize: 13, color: '#64748b', margin: '0 0 4px' },
  cardPhone: { fontSize: 12, color: '#475569', margin: 0 },
  cardRight: { textAlign: 'right', flexShrink: 0 },
  cardPrice: { fontSize: 17, fontWeight: 700, color: '#10b981', margin: '0 0 2px' },
  cardTime: { fontSize: 13, color: '#94a3b8', margin: '0 0 6px' },
  badge: { display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20 },
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 },
  modal: { backgroundColor: '#161b27', border: '1px solid #1e2535', borderRadius: 20, width: '100%', maxWidth: 560, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' as const },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 28px 0' },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 },
  modalClose: { background: 'transparent', border: 'none', color: '#64748b', fontSize: 18, cursor: 'pointer' },
  modalBody: { padding: '20px 28px' },
  modalFooter: { display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '0 28px 24px', alignItems: 'center' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  input: { padding: '10px 12px', backgroundColor: '#0f1117', border: '1px solid #2d3748', borderRadius: 10, color: '#f1f5f9', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  deleteBtn: { marginRight: 'auto', padding: '10px 18px', borderRadius: 10, border: '1px solid #ef444440', background: 'transparent', color: '#f87171', fontSize: 14, cursor: 'pointer' },
  cancelBtn: { padding: '10px 20px', borderRadius: 10, border: '1px solid #2d3748', background: 'transparent', color: '#94a3b8', fontSize: 14, cursor: 'pointer' },
  confirmBtn: { padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,#2563eb,#3b82f6)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
}
