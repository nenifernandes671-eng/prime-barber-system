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
    <div className="kb-light-root kb-services-page" style={styles.root}>
      <div style={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={styles.headerIcon}>🔧</div>
          <div>
            <p style={styles.kicker}>Catálogo</p>
            <h1 style={styles.pageTitle}>Serviços</h1>
            <p style={styles.pageSubtitle}>
              Serviços com preços, duração e destaque visual · {services.length} serviço{services.length !== 1 ? 's' : ''} cadastrado{services.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={openCreate} style={styles.createBtn}>+ Novo Serviço</button>
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
              <div style={styles.serviceIcon} />
              <div>
                <p style={styles.serviceName}>{s.name}</p>
                <p style={styles.serviceDuration}>{s.duration} min</p>
                {isPremium && <p style={styles.serviceUnit}>{getUnitName(s.unit_id)}</p>}
              </div>
              <p style={styles.servicePrice}>{formatCurrency(s.price)}</p>
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
  root: {
    minHeight: '100vh',
    color: '#e2e8f0',
    fontFamily: "'DM Sans','Segoe UI',sans-serif",
    padding: '44px 52px 72px',
    background:
      'radial-gradient(circle at 84% 10%, rgba(37,99,235,0.14), transparent 34%), radial-gradient(circle at 12% 18%, rgba(59,130,246,0.10), transparent 30%), linear-gradient(135deg,#020617 0%,#050816 48%,#09051a 100%)',
  },

  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
    marginBottom: 30,
  },
  headerIcon: {
    width: 62,
    height: 62,
    borderRadius: 18,
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(135deg,#2563eb,#3b82f6)',
    boxShadow: '0 18px 38px rgba(37,99,235,0.26)',
    fontSize: 25,
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

  statsGrid: { display: 'none' },
  statCard: { display: 'none' },
  statValue: {},
  statLabel: {},

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

  loadingWrap: { display: 'flex', justifyContent: 'center', padding: '90px 0' },
  spinner: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    border: '3px solid rgba(30,41,59,0.9)',
    borderTopColor: '#3b82f6',
    animation: 'spin 0.8s linear infinite',
  },
  empty: {
    textAlign: 'center',
    padding: '80px 0',
    borderRadius: 24,
    border: '1px solid rgba(148,163,184,0.10)',
    background: 'linear-gradient(145deg,rgba(15,23,42,0.76),rgba(8,13,28,0.66))',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 22,
  },
  card: {
    minHeight: 190,
    background:
      'radial-gradient(circle at top right, rgba(59,130,246,0.10), transparent 34%), linear-gradient(145deg,rgba(15,23,42,0.84),rgba(8,13,28,0.76))',
    borderRadius: 22,
    border: '1px solid rgba(148,163,184,0.12)',
    padding: 26,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: 14,
    boxShadow: '0 24px 70px rgba(0,0,0,0.22)',
  },
  cardTop: { display: 'flex', alignItems: 'center', gap: 14 },

  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
    boxShadow: '0 18px 34px rgba(37,99,235,0.22)',
  },
  serviceName: {
    fontSize: 17,
    fontWeight: 950,
    color: '#f8fafc',
    margin: '4px 0 10px',
  },
  serviceDuration: {
    fontSize: 13,
    color: '#94a3b8',
    margin: 0,
  },
  serviceUnit: {
    fontSize: 12,
    color: '#38bdf8',
    margin: '8px 0 0',
    fontWeight: 800,
  },
  servicePrice: {
    fontSize: 25,
    fontWeight: 950,
    color: '#f8fafc',
    margin: '8px 0 0',
    letterSpacing: -0.6,
  },
  editBtn: {
    alignSelf: 'flex-start',
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid rgba(96,165,250,0.20)',
    background: 'rgba(59,130,246,0.08)',
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },

  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(2,6,23,0.72)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    padding: 24,
  },
  modal: {
    background: 'linear-gradient(145deg,rgba(15,23,42,0.98),rgba(8,13,28,0.98))',
    border: '1px solid rgba(148,163,184,0.14)',
    borderRadius: 24,
    width: '100%',
    maxWidth: 460,
    boxShadow: '0 34px 110px rgba(0,0,0,0.64)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '26px 30px 0',
  },
  modalTitle: { fontSize: 20, fontWeight: 950, color: '#f8fafc', margin: 0 },
  modalClose: {
    background: 'rgba(15,23,42,0.8)',
    border: '1px solid rgba(148,163,184,0.14)',
    color: '#94a3b8',
    fontSize: 16,
    cursor: 'pointer',
    width: 34,
    height: 34,
    borderRadius: 12,
  },
  modalBody: {
    padding: '22px 30px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  modalFooter: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
    padding: '0 30px 28px',
    alignItems: 'center',
  },
  input: {
    padding: '12px 13px',
    backgroundColor: 'rgba(2,6,23,0.48)',
    border: '1px solid rgba(148,163,184,0.16)',
    borderRadius: 12,
    color: '#f1f5f9',
    fontSize: 14,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  feedbackBar: { padding: '12px 16px', borderRadius: 12, fontSize: 14 },
  fbSuccess: { backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.28)', color: '#6ee7b7' },
  fbError: { backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.28)', color: '#f87171' },

  deleteBtn: {
    marginRight: 'auto',
    padding: '10px 18px',
    borderRadius: 12,
    border: '1px solid rgba(239,68,68,0.28)',
    background: 'rgba(239,68,68,0.08)',
    color: '#f87171',
    fontSize: 14,
    cursor: 'pointer',
    fontWeight: 800,
  },
  cancelBtn: {
    padding: '10px 20px',
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,0.16)',
    background: 'rgba(15,23,42,0.62)',
    color: '#94a3b8',
    fontSize: 14,
    cursor: 'pointer',
    fontWeight: 800,
  },
  confirmBtn: {
    padding: '10px 22px',
    borderRadius: 12,
    background: 'linear-gradient(135deg,#2563eb,#3b82f6)',
    border: 'none',
    color: '#fff',
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 14px 30px rgba(37,99,235,0.22)',
  },
}
