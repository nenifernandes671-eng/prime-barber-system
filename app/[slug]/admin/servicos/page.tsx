'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantId } from '@/lib/useTenantId'
import { useTenant } from '@/lib/tenant-context'

interface Service {
  id: string
  name: string
  price: number
  duration: number
  created_at: string
  unit_id?: string | null
}

interface Unit {
  id: string
  name: string
  active: boolean
}

const emptyForm = () => ({ name: '', price: '', duration: '', unit_id: '' })

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function AdminServicos() {
  const [services, setServices] = useState<Service[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'closed' | 'create' | 'edit'>('closed')
  const [selected, setSelected] = useState<Service | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [search, setSearch] = useState('')
  const tenantId = useTenantId()
  const { isPremium } = useTenant()

  useEffect(() => { if (tenantId) fetchServices() }, [tenantId, isPremium])

  const fetchServices = async () => {
    if (!tenantId) return

    setLoading(true)

    const unitsRequest = isPremium
      ? supabase
          .from('units')
          .select('id, name, active')
          .eq('tenant_id', tenantId)
          .eq('active', true)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null })

    const [
      { data: servicesData, error: servicesError },
      { data: unitsData, error: unitsError },
    ] = await Promise.all([
      supabase
        .from('services')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name'),

      unitsRequest,
    ])

    if (servicesError) {
      console.error('Erro ao buscar serviços:', servicesError)
      setServices([])
    } else {
      setServices((servicesData ?? []) as Service[])
    }

    if (unitsError) {
      console.error('Erro ao buscar unidades:', unitsError)
      setUnits([])
    } else {
      setUnits((unitsData ?? []) as Unit[])
    }

    setLoading(false)
  }

  const filtered = services.filter(s =>
    search === '' || s.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalRevenue = services.reduce((s, v) => s + (v.price || 0), 0)
  const avgDuration = services.length ? Math.round(services.reduce((s, v) => s + (v.duration || 0), 0) / services.length) : 0

  function getUnitName(unitId?: string | null) {
    if (!unitId) return 'Todas as unidades'
    return units.find((unit) => unit.id === unitId)?.name || 'Unidade removida'
  }

  const openCreate = () => { setForm(emptyForm()); setSelected(null); setFeedback(null); setModal('create') }
  const openEdit = (s: Service) => {
    setSelected(s)
    setForm({ name: s.name, price: String(s.price), duration: String(s.duration), unit_id: s.unit_id || '' })
    setFeedback(null)
    setModal('edit')
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { setFeedback({ type: 'error', msg: 'Nome do serviço é obrigatório.' }); return }
    setSubmitting(true); setFeedback(null)

    const payload = {
  tenant_id: tenantId,
  name: form.name.trim(),
  price: parseFloat(form.price) || 0,
  duration: parseInt(form.duration) || 0,
  unit_id: isPremium ? form.unit_id || null : null,
}

    if (modal === 'create') {
      const { error } = await supabase.from('services').insert(payload)
      if (error) { setFeedback({ type: 'error', msg: 'Erro ao criar serviço.' }); setSubmitting(false); return }
    } else if (selected) {
      const { error } = await supabase.from('services').update(payload).eq('id', selected.id).eq('tenant_id', tenantId)
      if (error) { setFeedback({ type: 'error', msg: 'Erro ao atualizar serviço.' }); setSubmitting(false); return }
    }

    setSubmitting(false); setModal('closed'); await fetchServices()
  }

  const handleDelete = async () => {
    if (!selected) return
    setSubmitting(true)
    await supabase.from('services').delete().eq('id', selected.id).eq('tenant_id', tenantId)
    setModal('closed'); setSubmitting(false); await fetchServices()
  }

  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div style={styles.root}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Serviços</h1>
          <p style={styles.pageSubtitle}>{services.length} serviço{services.length !== 1 ? 's' : ''} cadastrado{services.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openCreate} style={styles.createBtn}>+ Novo Serviço</button>
      </div>

      {/* Stats */}
      <div style={styles.statsGrid}>
        <StatCard icon="✂️" label="Total de serviços" value={String(services.length)} color="#3b82f6" />
        <StatCard icon="💰" label="Ticket médio" value={services.length ? formatCurrency(totalRevenue / services.length) : 'R$ 0,00'} color="#10b981" />
        <StatCard icon="⏱" label="Duração média" value={`${avgDuration} min`} color="#8b5cf6" />
        <StatCard icon="🏆" label="Mais caro" value={services.length ? formatCurrency(Math.max(...services.map(s => s.price))) : 'R$ 0,00'} color="#f59e0b" />
        {isPremium && <StatCard icon="🏢" label="Unidades ativas" value={String(units.length)} color="#06b6d4" />}
      </div>

      {/* Busca */}
      <div style={{ marginBottom: 20 }}>
        <input
          placeholder="🔍  Buscar serviço..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div style={styles.loadingWrap}><div style={styles.spinner} /></div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>
          <span style={{ fontSize: 40 }}>✂️</span>
          <p style={{ color: '#475569', marginTop: 12 }}>Nenhum serviço encontrado.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {filtered.map(s => (
            <div key={s.id} style={styles.card}>
              <div style={styles.cardTop}>
                <div style={styles.serviceIcon}>✂</div>
                <div style={{ flex: 1 }}>
                  <p style={styles.serviceName}>{s.name}</p>
                  <p style={styles.serviceDuration}>⏱ {s.duration} minutos</p>
                  {isPremium && <p style={styles.serviceUnit}>🏢 {getUnitName(s.unit_id)}</p>}
                </div>
                <p style={styles.servicePrice}>{formatCurrency(s.price)}</p>
              </div>
              <button onClick={() => openEdit(s)} style={styles.editBtn}>Editar</button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal !== 'closed' && (
        <div style={styles.overlay} onClick={e => { if (e.target === e.currentTarget) setModal('closed') }}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{modal === 'create' ? 'Novo Serviço' : 'Editar Serviço'}</h2>
              <button onClick={() => setModal('closed')} style={styles.modalClose}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <Field label="Nome do serviço *">
                <input style={styles.input} placeholder="Ex: Corte + Barba" value={form.name} onChange={e => f('name', e.target.value)} />
              </Field>
              <Field label="Preço (R$)">
                <input style={styles.input} type="number" placeholder="0.00" value={form.price} onChange={e => f('price', e.target.value)} />
              </Field>
              <Field label="Duração (minutos)">
                <input style={styles.input} type="number" placeholder="Ex: 30" value={form.duration} onChange={e => f('duration', e.target.value)} />
              </Field>

              {isPremium && (
                <Field label="Unidade">
                  <select style={styles.input} value={form.unit_id} onChange={e => f('unit_id', e.target.value)}>
                    <option value="">Todas as unidades</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {feedback && (
                <div style={{ ...styles.feedbackBar, ...(feedback.type === 'success' ? styles.fbSuccess : styles.fbError) }}>
                  {feedback.type === 'success' ? '✅' : '⚠️'} {feedback.msg}
                </div>
              )}
            </div>
            <div style={styles.modalFooter}>
              {modal === 'edit' && <button onClick={handleDelete} disabled={submitting} style={styles.deleteBtn}>Excluir</button>}
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
    <div style={{ ...styles.statCard, borderTop: `3px solid ${color}` }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <p style={styles.statValue}>{value}</p>
      <p style={styles.statLabel}>{label}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>{label}</label>
      {children}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', backgroundColor: '#0f1117', color: '#e2e8f0', fontFamily: "'DM Sans','Segoe UI',sans-serif", padding: '40px 48px' },
  pageHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  pageTitle: { fontSize: 26, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' },
  pageSubtitle: { fontSize: 14, color: '#64748b', margin: 0 },
  createBtn: { padding: '10px 20px', borderRadius: 10, background: 'linear-gradient(135deg,#2563eb,#3b82f6)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16, marginBottom: 28 },
  statCard: { backgroundColor: '#161b27', borderRadius: 14, padding: '20px 20px 16px', border: '1px solid #1e2535' },
  statValue: { fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: '8px 0 2px' },
  statLabel: { fontSize: 12, color: '#64748b', margin: 0 },
  searchInput: { width: '100%', padding: '10px 16px', borderRadius: 10, border: '1px solid #2d3748', background: '#161b27', color: '#f1f5f9', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const },
  loadingWrap: { display: 'flex', justifyContent: 'center', padding: '80px 0' },
  spinner: { width: 32, height: 32, borderRadius: '50%', border: '3px solid #1e2535', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite' },
  empty: { textAlign: 'center', padding: '80px 0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 },
  card: { backgroundColor: '#161b27', borderRadius: 14, border: '1px solid #1e2535', padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 },
  cardTop: { display: 'flex', alignItems: 'center', gap: 14 },
  serviceIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1e2d45', border: '1px solid #2d3f5a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  serviceName: { fontSize: 15, fontWeight: 600, color: '#f1f5f9', margin: '0 0 4px' },
  serviceDuration: { fontSize: 13, color: '#64748b', margin: 0 },
  serviceUnit: { fontSize: 12, color: '#38bdf8', margin: '4px 0 0', fontWeight: 700 },
  servicePrice: { fontSize: 18, fontWeight: 700, color: '#10b981', flexShrink: 0 },
  editBtn: { padding: '8px', borderRadius: 8, border: '1px solid #2d3f5a', background: '#1e2d45', color: '#60a5fa', fontSize: 13, cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 },
  modal: { backgroundColor: '#161b27', border: '1px solid #1e2535', borderRadius: 20, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 28px 0' },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 },
  modalClose: { background: 'transparent', border: 'none', color: '#64748b', fontSize: 18, cursor: 'pointer' },
  modalBody: { padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 },
  modalFooter: { display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '0 28px 24px', alignItems: 'center' },
  input: { padding: '10px 12px', backgroundColor: '#0f1117', border: '1px solid #2d3748', borderRadius: 10, color: '#f1f5f9', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  feedbackBar: { padding: '12px 16px', borderRadius: 10, fontSize: 14 },
  fbSuccess: { backgroundColor: '#10b98115', border: '1px solid #10b98130', color: '#6ee7b7' },
  fbError: { backgroundColor: '#ef444415', border: '1px solid #ef444430', color: '#f87171' },
  deleteBtn: { marginRight: 'auto', padding: '10px 18px', borderRadius: 10, border: '1px solid #ef444440', background: 'transparent', color: '#f87171', fontSize: 14, cursor: 'pointer' },
  cancelBtn: { padding: '10px 20px', borderRadius: 10, border: '1px solid #2d3748', background: 'transparent', color: '#94a3b8', fontSize: 14, cursor: 'pointer' },
  confirmBtn: { padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,#2563eb,#3b82f6)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
}
