'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/tenant-context'
import { useTenantId } from '@/lib/useTenantId'
import { Camera, Lock, Upload, X, Check, Crown, Copy, ExternalLink } from 'lucide-react'
import { hasFeature } from '@/lib/permissions'

interface Barber { id: string; nome: string; avatar_url?: string }
interface Service { id: string; name: string; price: number; photo_url?: string }

export default function ConfiguracoesPage() {
  const pathname = usePathname()
  const slug = pathname.split('/').filter(Boolean)[0]
  const { tenant } = useTenant()
  const tenantId = useTenantId()
  const currentTenantId = tenantId || tenant?.id || null

  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [tab, setTab] = useState<'barbeiros' | 'servicos' | 'barbearia'>('barbearia')

  // Dados da barbearia
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [endereco, setEndereco] = useState('')
  const [savingInfo, setSavingInfo] = useState(false)
  const [savedInfo, setSavedInfo] = useState(false)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [adminName, setAdminName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingAccount, setSavingAccount] = useState(false)
  const [accountFeedback, setAccountFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '')
  const publicBookingUrl = `${appUrl}/${slug}`
  const barberLoginUrl = `${appUrl}/barber/login`


const canUploadPhotos = hasFeature(
  tenant?.plano,
  'uploads'
)

  useEffect(() => {
    if (tenant) {
      setNome(tenant.nome ?? '')
      setTelefone((tenant as any).telefone ?? '')
      setEndereco((tenant as any).endereco ?? '')
    }
  }, [tenant])

  useEffect(() => {
    if (currentTenantId) fetchData()
  }, [currentTenantId])

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setAdminName((user?.user_metadata?.nome as string) || '')
    }
    loadUser()
  }, [])

  async function getAuthToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }

  async function saveAssetChange(action: string, payload: Record<string, unknown>) {
    const token = await getAuthToken()
    if (!token || !currentTenantId) return { ok: false, error: 'Sessao expirada. Entre novamente.' }

    const response = await fetch('/api/admin/settings-assets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, tenant_id: currentTenantId, ...payload }),
    })
    const data = await response.json().catch(() => ({}))
    return response.ok ? { ok: true, ...data } : { ok: false, error: data.error ?? 'Erro ao salvar configuracoes.' }
  }

  async function fetchData() {
    if (!currentTenantId) return
    setLoading(true)
    const token = await getAuthToken()
    if (!token) {
      setBarbers([])
      setServices([])
      setLoading(false)
      return
    }

    const response = await fetch(`/api/admin/settings-assets?tenant_id=${encodeURIComponent(currentTenantId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json().catch(() => ({}))
    if (response.ok) {
      setBarbers(data.barbers ?? [])
      setServices(data.services ?? [])
    } else {
      console.error(data.error ?? 'Erro ao carregar configuracoes.')
      setBarbers([])
      setServices([])
    }
    setLoading(false)
  }

  async function saveInfo() {
    if (!tenant) return
    setSavingInfo(true)
    await supabase.from('tenants').update({ nome, telefone, endereco }).eq('id', tenant.id)
    setSavingInfo(false)
    setSavedInfo(true)
    setTimeout(() => setSavedInfo(false), 2500)
  }

  async function copyLink(key: string, value: string) {
    await navigator.clipboard.writeText(value)
    setCopiedLink(key)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  async function saveAccount() {
    setAccountFeedback(null)

    if (newPassword && newPassword.length < 6) {
      setAccountFeedback({ type: 'error', msg: 'A senha precisa ter pelo menos 6 caracteres.' })
      return
    }

    if (newPassword && newPassword !== confirmPassword) {
      setAccountFeedback({ type: 'error', msg: 'As senhas nao conferem.' })
      return
    }

    setSavingAccount(true)

    const updates: { data?: { nome: string }; password?: string } = {
      data: { nome: adminName.trim() },
    }

    if (newPassword) updates.password = newPassword

    const { error } = await supabase.auth.updateUser(updates)

    setSavingAccount(false)

    if (error) {
      setAccountFeedback({ type: 'error', msg: error.message })
      return
    }

    setNewPassword('')
    setConfirmPassword('')
    setAccountFeedback({ type: 'success', msg: 'Dados da conta atualizados.' })
  }

  async function uploadBarberPhoto(barberId: string, file: File) {
    if (!currentTenantId) return
    if (!canUploadPhotos) return
    setSaving(barberId)
    const ext = file.name.split('.').pop()
    const path = `barbers/${barberId}.${ext}`
    const { error: upErr } = await supabase.storage.from('barbershop-media').upload(path, file, { upsert: true })
    if (upErr) { alert('Erro no upload: ' + upErr.message); setSaving(null); return }
    const { data: { publicUrl } } = supabase.storage.from('barbershop-media').getPublicUrl(path)
    const result = await saveAssetChange('update_barber_photo', { barber_id: barberId, avatar_url: publicUrl })
    if (!result.ok) { alert('Erro ao salvar foto: ' + result.error); setSaving(null); return }
    setBarbers(prev => prev.map(b => b.id === barberId ? { ...b, avatar_url: publicUrl } : b))
    setSaving(null)
    setSaved(barberId)
    setTimeout(() => setSaved(null), 2000)
  }

  async function uploadServicePhoto(serviceId: string, file: File) {
    if (!currentTenantId) return
    if (!canUploadPhotos) return
    setSaving(serviceId)
    const ext = file.name.split('.').pop()
    const path = `services/${serviceId}.${ext}`
    const { error: upErr } = await supabase.storage.from('barbershop-media').upload(path, file, { upsert: true })
    if (upErr) { alert('Erro no upload: ' + upErr.message); setSaving(null); return }
    const { data: { publicUrl } } = supabase.storage.from('barbershop-media').getPublicUrl(path)
    const result = await saveAssetChange('update_service_photo', { service_id: serviceId, photo_url: publicUrl })
    if (!result.ok) { alert('Erro ao salvar foto: ' + result.error); setSaving(null); return }
    setServices(prev => prev.map(s => s.id === serviceId ? { ...s, photo_url: publicUrl } : s))
    setSaving(null)
    setSaved(serviceId)
    setTimeout(() => setSaved(null), 2000)
  }

  async function removeBarberPhoto(barberId: string) {
    if (!currentTenantId) return
    const result = await saveAssetChange('update_barber_photo', { barber_id: barberId, avatar_url: null })
    if (!result.ok) { alert('Erro ao remover foto: ' + result.error); return }
    setBarbers(prev => prev.map(b => b.id === barberId ? { ...b, avatar_url: undefined } : b))
  }

  async function removeServicePhoto(serviceId: string) {
    if (!currentTenantId) return
    const result = await saveAssetChange('update_service_photo', { service_id: serviceId, photo_url: null })
    if (!result.ok) { alert('Erro ao remover foto: ' + result.error); return }
    setServices(prev => prev.map(s => s.id === serviceId ? { ...s, photo_url: undefined } : s))
  }

  const AVATAR_COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444']
  function getAvatarColor(name: string) {
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
      <div style={{ width:32, height:32, borderRadius:'50%', border:'3px solid #1e2535', borderTopColor:'#3b82f6', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ maxWidth:800, fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ marginBottom:32 }}>
        <h1 style={{ fontSize:28, fontWeight:800, color:'#f1f5f9', margin:'0 0 6px', letterSpacing:-0.5 }}>Configurações</h1>
        <p style={{ fontSize:14, color:'#64748b', margin:0 }}>Gerencie as informações da sua barbearia</p>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:32, background:'rgba(255,255,255,0.03)', padding:4, borderRadius:12, border:'1px solid rgba(255,255,255,0.06)', width:'fit-content' }}>
        {(['barbearia','barbeiros','servicos'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding:'8px 20px', borderRadius:9, border:'none', cursor:'pointer', fontSize:13, fontWeight:600, transition:'all 0.15s', background: tab===t ? 'rgba(59,130,246,0.2)' : 'transparent', color: tab===t ? '#60a5fa' : '#64748b' }}>
            {t === 'barbearia' ? '🏪 Barbearia' : t === 'barbeiros' ? '✂ Barbeiros' : '🛠 Serviços'}
          </button>
        ))}
      </div>

      {/* ── TAB BARBEARIA ── */}
      {tab === 'barbearia' && (
        <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
          <div style={{ background:'rgba(11,18,32,0.72)', borderRadius:20, padding:28, border:'1px solid rgba(255,255,255,0.06)' }}>
            <h2 style={{ fontSize:16, fontWeight:700, color:'#f1f5f9', margin:'0 0 18px' }}>Links de acesso</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <LinkBox
                title="Link publico de agendamento"
                description="Envie este link para os clientes ou coloque na bio do Instagram."
                value={publicBookingUrl}
                copied={copiedLink === 'booking'}
                onCopy={() => copyLink('booking', publicBookingUrl)}
              />
              <LinkBox
                title="Login dos barbeiros"
                description="Envie este link para os barbeiros acessarem o painel deles."
                value={barberLoginUrl}
                copied={copiedLink === 'barber'}
                onCopy={() => copyLink('barber', barberLoginUrl)}
              />
            </div>
          </div>

          <div style={{ background:'rgba(11,18,32,0.72)', borderRadius:20, padding:28, border:'1px solid rgba(255,255,255,0.06)' }}>
          <h2 style={{ fontSize:16, fontWeight:700, color:'#f1f5f9', margin:'0 0 24px' }}>Informações da barbearia</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {[
              { label:'Nome da barbearia', value:nome, setter:setNome, placeholder:'Ex: Prime Barber' },
              { label:'Telefone / WhatsApp', value:telefone, setter:setTelefone, placeholder:'(47) 99999-9999' },
              { label:'Endereço', value:endereco, setter:setEndereco, placeholder:'Rua, número, bairro' },
            ].map(({ label, value, setter, placeholder }) => (
              <div key={label}>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#94a3b8', marginBottom:6 }}>{label}</label>
                <input value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} style={{ width:'100%', padding:'12px 14px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, color:'#f1f5f9', fontSize:14, outline:'none', boxSizing:'border-box', fontFamily:'DM Sans,sans-serif' }} />
              </div>
            ))}
            <button onClick={saveInfo} disabled={savingInfo} style={{ padding:'12px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#2563eb,#3b82f6)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {savedInfo ? <><Check size={16} /> Salvo!</> : savingInfo ? 'Salvando...' : 'Salvar informações'}
            </button>
          </div>
          </div>
        </div>
      )}

      {/* ── TAB BARBEIROS ── */}
      {tab === 'barbearia' && (
          <div style={{ background:'rgba(11,18,32,0.72)', borderRadius:20, padding:28, border:'1px solid rgba(255,255,255,0.06)' }}>
            <h2 style={{ fontSize:16, fontWeight:700, color:'#f1f5f9', margin:'0 0 8px' }}>Minha conta</h2>
            <p style={{ fontSize:13, color:'#64748b', margin:'0 0 22px' }}>Altere o nome do administrador ou redefina sua senha de acesso.</p>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#94a3b8', marginBottom:6 }}>Nome do usuario</label>
                <input value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Seu nome" style={{ width:'100%', padding:'12px 14px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, color:'#f1f5f9', fontSize:14, outline:'none', boxSizing:'border-box', fontFamily:'DM Sans,sans-serif' }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#94a3b8', marginBottom:6 }}>Nova senha</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimo 6 caracteres" style={{ width:'100%', padding:'12px 14px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, color:'#f1f5f9', fontSize:14, outline:'none', boxSizing:'border-box', fontFamily:'DM Sans,sans-serif' }} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#94a3b8', marginBottom:6 }}>Confirmar senha</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha" style={{ width:'100%', padding:'12px 14px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, color:'#f1f5f9', fontSize:14, outline:'none', boxSizing:'border-box', fontFamily:'DM Sans,sans-serif' }} />
                </div>
              </div>
              {accountFeedback && (
                <div style={{ padding:'11px 13px', borderRadius:10, fontSize:13, background: accountFeedback.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', border:`1px solid ${accountFeedback.type === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, color: accountFeedback.type === 'success' ? '#6ee7b7' : '#f87171' }}>
                  {accountFeedback.msg}
                </div>
              )}
              <button onClick={saveAccount} disabled={savingAccount} style={{ padding:'12px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#0f766e,#14b8a6)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {savingAccount ? 'Salvando...' : 'Salvar conta'}
              </button>
            </div>
          </div>
      )}

      {tab === 'barbeiros' && (
        <div>
          {/* Pro banner */}
          {!canUploadPhotos && (
            <div style={{ background:'linear-gradient(135deg,rgba(139,92,246,0.15),rgba(59,130,246,0.1))', border:'1px solid rgba(139,92,246,0.3)', borderRadius:16, padding:'20px 24px', marginBottom:24, display:'flex', alignItems:'center', gap:16 }}>
              <Crown size={28} style={{ color:'#a78bfa', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <p style={{ fontSize:14, fontWeight:700, color:'#f1f5f9', margin:'0 0 4px' }}>Recurso exclusivo do Plano Pro</p>
                <p style={{ fontSize:13, color:'#64748b', margin:0 }}>Faça upgrade para adicionar fotos dos barbeiros e deixar sua página mais profissional.</p>
              </div>
              <a href="/pricing" style={{ padding:'10px 20px', borderRadius:10, background:'linear-gradient(135deg,#7c3aed,#8b5cf6)', color:'#fff', fontSize:13, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>
                Fazer upgrade →
              </a>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {barbers.length === 0 ? (
              <p style={{ color:'#475569', textAlign:'center', padding:'40px 0' }}>Nenhum barbeiro cadastrado ainda.</p>
            ) : barbers.map(barber => {
              const color = getAvatarColor(barber.nome)
              const isLoading = saving === barber.id
              const isSaved = saved === barber.id
              return (
                <div key={barber.id} style={{ background:'rgba(11,18,32,0.72)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:16, padding:'20px 24px', display:'flex', alignItems:'center', gap:20 }}>
                  {/* Avatar atual */}
                  <div style={{ position:'relative', flexShrink:0 }}>
                    {barber.avatar_url ? (
                      <img src={barber.avatar_url} alt={barber.nome} style={{ width:64, height:64, borderRadius:'50%', objectFit:'cover', border:'2px solid rgba(255,255,255,0.1)' }} />
                    ) : (
                      <div style={{ width:64, height:64, borderRadius:'50%', background:`${color}22`, border:`2px solid ${color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:800, color }}>
                        {barber.nome[0].toUpperCase()}
                      </div>
                    )}
                    {canUploadPhotos && (
                      <div style={{ position:'absolute', bottom:-2, right:-2, width:22, height:22, borderRadius:'50%', background:'#1e2535', border:'2px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <Camera size={11} style={{ color:'#60a5fa' }} />
                      </div>
                    )}
                  </div>

                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:15, fontWeight:700, color:'#f1f5f9', margin:'0 0 4px' }}>{barber.nome}</p>
                    <p style={{ fontSize:12, color:'#475569', margin:0 }}>
                      {barber.avatar_url ? '✅ Foto cadastrada' : '📷 Sem foto'}
                    </p>
                  </div>

                  {/* Upload actions */}
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    {!canUploadPhotos ? (
                      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.2)' }}>
                        <Lock size={13} style={{ color:'#a78bfa' }} />
                        <span style={{ fontSize:12, color:'#a78bfa', fontWeight:600 }}>Pro</span>
                      </div>
                    ) : (
                      <>
                        {isSaved && (
                          <div style={{ display:'flex', alignItems:'center', gap:6, color:'#10b981', fontSize:13, fontWeight:600 }}>
                            <Check size={15} /> Salvo!
                          </div>
                        )}
                        {isLoading && (
                          <div style={{ width:20, height:20, borderRadius:'50%', border:'2px solid #1e2535', borderTopColor:'#3b82f6', animation:'spin 0.8s linear infinite' }} />
                        )}
                        <label style={{ padding:'9px 16px', borderRadius:9, border:'1px solid rgba(59,130,246,0.3)', background:'rgba(59,130,246,0.1)', color:'#60a5fa', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                          <Upload size={14} />
                          {barber.avatar_url ? 'Trocar' : 'Adicionar'}
                          <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if(f) uploadBarberPhoto(barber.id, f) }} />
                        </label>
                        {barber.avatar_url && (
                          <button onClick={() => removeBarberPhoto(barber.id)} style={{ width:34, height:34, borderRadius:8, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.1)', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <X size={15} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TAB SERVIÇOS ── */}
      {tab === 'servicos' && (
        <div>
          {!canUploadPhotos && (
            <div style={{ background:'linear-gradient(135deg,rgba(139,92,246,0.15),rgba(59,130,246,0.1))', border:'1px solid rgba(139,92,246,0.3)', borderRadius:16, padding:'20px 24px', marginBottom:24, display:'flex', alignItems:'center', gap:16 }}>
              <Crown size={28} style={{ color:'#a78bfa', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <p style={{ fontSize:14, fontWeight:700, color:'#f1f5f9', margin:'0 0 4px' }}>Recurso exclusivo do Plano Pro</p>
                <p style={{ fontSize:13, color:'#64748b', margin:0 }}>Faça upgrade para adicionar fotos dos cortes e aumentar suas conversões.</p>
              </div>
              <a href="/pricing" style={{ padding:'10px 20px', borderRadius:10, background:'linear-gradient(135deg,#7c3aed,#8b5cf6)', color:'#fff', fontSize:13, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>
                Fazer upgrade →
              </a>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {services.length === 0 ? (
              <p style={{ color:'#475569', textAlign:'center', padding:'40px 0' }}>Nenhum serviço cadastrado ainda.</p>
            ) : services.map(service => {
              const isLoading = saving === service.id
              const isSaved = saved === service.id
              return (
                <div key={service.id} style={{ background:'rgba(11,18,32,0.72)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:16, padding:'20px 24px', display:'flex', alignItems:'center', gap:20 }}>
                  {/* Thumb */}
                  <div style={{ width:64, height:64, borderRadius:12, overflow:'hidden', flexShrink:0, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {service.photo_url ? (
                      <img src={service.photo_url} alt={service.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    ) : (
                      <span style={{ fontSize:26 }}>✂</span>
                    )}
                  </div>

                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:15, fontWeight:700, color:'#f1f5f9', margin:'0 0 4px' }}>{service.name}</p>
                    <p style={{ fontSize:13, color:'#10b981', fontWeight:600, margin:'0 0 2px' }}>R$ {service.price?.toFixed(2)}</p>
                    <p style={{ fontSize:12, color:'#475569', margin:0 }}>
                      {service.photo_url ? '✅ Foto cadastrada' : '📷 Sem foto'}
                    </p>
                  </div>

                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    {!canUploadPhotos ? (
                      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.2)' }}>
                        <Lock size={13} style={{ color:'#a78bfa' }} />
                        <span style={{ fontSize:12, color:'#a78bfa', fontWeight:600 }}>Pro</span>
                      </div>
                    ) : (
                      <>
                        {isSaved && (
                          <div style={{ display:'flex', alignItems:'center', gap:6, color:'#10b981', fontSize:13, fontWeight:600 }}>
                            <Check size={15} /> Salvo!
                          </div>
                        )}
                        {isLoading && (
                          <div style={{ width:20, height:20, borderRadius:'50%', border:'2px solid #1e2535', borderTopColor:'#3b82f6', animation:'spin 0.8s linear infinite' }} />
                        )}
                        <label style={{ padding:'9px 16px', borderRadius:9, border:'1px solid rgba(59,130,246,0.3)', background:'rgba(59,130,246,0.1)', color:'#60a5fa', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                          <Upload size={14} />
                          {service.photo_url ? 'Trocar' : 'Adicionar'}
                          <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if(f) uploadServicePhoto(service.id, f) }} />
                        </label>
                        {service.photo_url && (
                          <button onClick={() => removeServicePhoto(service.id)} style={{ width:34, height:34, borderRadius:8, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.1)', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <X size={15} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function LinkBox({
  title,
  description,
  value,
  copied,
  onCopy,
}: {
  title: string
  description: string
  value: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div style={{ padding:16, borderRadius:14, background:'rgba(0,0,0,0.25)', border:'1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start', marginBottom:10 }}>
        <div>
          <p style={{ margin:'0 0 4px', color:'#f1f5f9', fontSize:14, fontWeight:700 }}>{title}</p>
          <p style={{ margin:0, color:'#64748b', fontSize:12, lineHeight:1.5 }}>{description}</p>
        </div>
        <a href={value} target="_blank" rel="noreferrer" style={{ color:'#60a5fa', padding:6, borderRadius:8, background:'rgba(59,130,246,0.1)', display:'inline-flex' }}>
          <ExternalLink size={15} />
        </a>
      </div>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <input readOnly value={value} style={{ flex:1, minWidth:0, padding:'10px 12px', background:'rgba(15,23,42,0.75)', border:'1px solid rgba(148,163,184,0.14)', borderRadius:10, color:'#cbd5e1', fontSize:13, outline:'none' }} />
        <button onClick={onCopy} style={{ padding:'10px 13px', borderRadius:10, border:'1px solid rgba(59,130,246,0.25)', background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.12)', color: copied ? '#6ee7b7' : '#93c5fd', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}
