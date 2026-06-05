'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/tenant-context'
import { useTenantId } from '@/lib/useTenantId'
import {
  Camera,
  Check,
  Clock,
  Copy,
  Crown,
  ExternalLink,
  Lock,
  Upload,
  X,
} from 'lucide-react'
import { hasFeature } from '@/lib/permissions'

interface Barber {
  id: string
  nome: string
  avatar_url?: string
}

interface Service {
  id: string
  name: string
  price: number
  photo_url?: string
}

type Tab = 'barbearia' | 'landing' | 'barbeiros' | 'servicos'

const cardStyle: React.CSSProperties = {
  background:
    'radial-gradient(circle at top right, rgba(59,130,246,0.10), transparent 34%), rgba(11,18,32,0.78)',
  borderRadius: 22,
  padding: 26,
  border: '1px solid rgba(255,255,255,0.07)',
  boxShadow: '0 22px 58px rgba(0,0,0,0.18)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: 'rgba(0,0,0,0.30)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 11,
  color: '#f1f5f9',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'DM Sans, Segoe UI, sans-serif',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: '#94a3b8',
  marginBottom: 7,
}

export default function ConfiguracoesPage() {
  const pathname = usePathname()
  const slug = pathname.split('/').filter(Boolean)[0]
  const { tenant } = useTenant()
  const tenantId = useTenantId()
  const currentTenantId = tenantId || tenant?.id || null

  const [tab, setTab] = useState<Tab>('barbearia')
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [endereco, setEndereco] = useState('')
  const [openingTime, setOpeningTime] = useState('08:00')
  const [closingTime, setClosingTime] = useState('19:00')
  const [slotInterval, setSlotInterval] = useState(30)

  const [landingHeadline, setLandingHeadline] = useState('')
  const [landingDescription, setLandingDescription] = useState('')
  const [landingWhatsapp, setLandingWhatsapp] = useState('')
  const [landingInstagram, setLandingInstagram] = useState('')
  const [landingAddress, setLandingAddress] = useState('')
  const [landingPrimaryColor, setLandingPrimaryColor] = useState('#c9a84c')
  const [landingBannerUrl, setLandingBannerUrl] = useState('')
  const [savingLandingBanner, setSavingLandingBanner] = useState(false)

  const [savingInfo, setSavingInfo] = useState(false)
  const [savedInfo, setSavedInfo] = useState(false)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  const [adminName, setAdminName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingAccount, setSavingAccount] = useState(false)
  const [accountFeedback, setAccountFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  ).replace(/\/$/, '')

  const publicBookingUrl = `${appUrl}/${slug}`
  const barberLoginUrl = `${appUrl}/barber/login`

  const canUploadPhotos = !!hasFeature(tenant?.plano, 'uploads')
  const isPremium = tenant?.plano?.toLowerCase() === 'premium'

  useEffect(() => {
    if (tenant) {
      setNome(tenant.nome ?? '')
      setTelefone((tenant as any).telefone ?? '')
      setEndereco((tenant as any).endereco ?? '')
      setOpeningTime((tenant as any).opening_time ?? '08:00')
      setClosingTime((tenant as any).closing_time ?? '19:00')
      setSlotInterval((tenant as any).slot_interval ?? 30)
      setLandingHeadline((tenant as any).landing_headline ?? 'Seu estilo,\\nnosso cuidado.')
      setLandingDescription((tenant as any).landing_description ?? '')
      setLandingWhatsapp((tenant as any).landing_whatsapp ?? (tenant as any).telefone ?? '')
      setLandingInstagram((tenant as any).landing_instagram ?? '')
      setLandingAddress((tenant as any).landing_address ?? (tenant as any).endereco ?? '')
      setLandingPrimaryColor((tenant as any).landing_primary_color ?? '#c9a84c')
      setLandingBannerUrl((tenant as any).landing_banner_url ?? (tenant as any).hero_url ?? '')
    }
  }, [tenant])

  useEffect(() => {
    if (currentTenantId) fetchData()
  }, [currentTenantId])

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

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

    if (!token || !currentTenantId) {
      return { ok: false, error: 'Sessao expirada. Entre novamente.' }
    }

    const response = await fetch('/api/admin/settings-assets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, tenant_id: currentTenantId, ...payload }),
    })

    const data = await response.json().catch(() => ({}))
    return response.ok
      ? { ok: true, ...data }
      : { ok: false, error: data.error ?? 'Erro ao salvar configuracoes.' }
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
    if (!currentTenantId) {
      alert('Erro: tenant não encontrado. Recarregue a página e tente novamente.')
      return
    }

    if (openingTime >= closingTime) {
      alert('O horário de abertura precisa ser menor que o horário de fechamento.')
      return
    }

    setSavingInfo(true)

    const { error } = await supabase
      .from('tenants')
      .update({
        nome,
        telefone,
        endereco,
        opening_time: openingTime,
        closing_time: closingTime,
        slot_interval: Number(slotInterval),
        landing_headline: landingHeadline,
        landing_description: landingDescription,
        landing_whatsapp: landingWhatsapp,
        landing_instagram: landingInstagram,
        landing_address: landingAddress,
        landing_primary_color: landingPrimaryColor || '#c9a84c',
        landing_banner_url: landingBannerUrl || null,
      })
      .eq('id', currentTenantId)

    setSavingInfo(false)

    if (error) {
      alert('Erro ao salvar informações: ' + error.message)
      return
    }

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
    if (!currentTenantId || !canUploadPhotos) return

    setSaving(barberId)

    const path = `barbers/${barberId}`

    const { error: uploadError } = await supabase.storage.from('barbershop-media').upload(path, file, {
      upsert: true,
      cacheControl: '60',
      contentType: file.type || 'image/jpeg',
    })

    if (uploadError) {
      alert('Erro no upload: ' + uploadError.message)
      setSaving(null)
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('barbershop-media').getPublicUrl(path)

    const displayUrl = `${publicUrl}?v=${Date.now()}`
    const result = await saveAssetChange('update_barber_photo', {
      barber_id: barberId,
      avatar_url: displayUrl,
    })

    if (!result.ok) {
      alert('Erro ao salvar foto: ' + result.error)
      setSaving(null)
      return
    }

    setBarbers((prev) => prev.map((b) => (b.id === barberId ? { ...b, avatar_url: displayUrl } : b)))
    setSaving(null)
    setSaved(barberId)
    setTimeout(() => setSaved(null), 2000)
  }

  async function uploadServicePhoto(serviceId: string, file: File) {
    if (!currentTenantId || !canUploadPhotos) return

    setSaving(serviceId)

    const path = `services/${serviceId}`

    const { error: uploadError } = await supabase.storage.from('barbershop-media').upload(path, file, {
      upsert: true,
      cacheControl: '60',
      contentType: file.type || 'image/jpeg',
    })

    if (uploadError) {
      alert('Erro no upload: ' + uploadError.message)
      setSaving(null)
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('barbershop-media').getPublicUrl(path)

    const displayUrl = `${publicUrl}?v=${Date.now()}`
    const result = await saveAssetChange('update_service_photo', {
      service_id: serviceId,
      photo_url: displayUrl,
    })

    if (!result.ok) {
      alert('Erro ao salvar foto: ' + result.error)
      setSaving(null)
      return
    }

    setServices((prev) => prev.map((s) => (s.id === serviceId ? { ...s, photo_url: displayUrl } : s)))
    setSaving(null)
    setSaved(serviceId)
    setTimeout(() => setSaved(null), 2000)
  }

  async function removeBarberPhoto(barberId: string) {
    if (!currentTenantId) return

    const result = await saveAssetChange('update_barber_photo', {
      barber_id: barberId,
      avatar_url: null,
    })

    if (!result.ok) {
      alert('Erro ao remover foto: ' + result.error)
      return
    }

    setBarbers((prev) => prev.map((b) => (b.id === barberId ? { ...b, avatar_url: undefined } : b)))
  }

  async function removeServicePhoto(serviceId: string) {
    if (!currentTenantId) return

    const result = await saveAssetChange('update_service_photo', {
      service_id: serviceId,
      photo_url: null,
    })

    if (!result.ok) {
      alert('Erro ao remover foto: ' + result.error)
      return
    }

    setServices((prev) => prev.map((s) => (s.id === serviceId ? { ...s, photo_url: undefined } : s)))
  }


  async function uploadLandingBanner(file: File) {
    if (!currentTenantId || !isPremium) return

    setSavingLandingBanner(true)

    const path = `landing/${currentTenantId}/banner`

    const { error: uploadError } = await supabase.storage
      .from('barbershop-media')
      .upload(path, file, {
        upsert: true,
        cacheControl: '60',
        contentType: file.type || 'image/jpeg',
      })

    if (uploadError) {
      alert('Erro no upload do banner: ' + uploadError.message)
      setSavingLandingBanner(false)
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('barbershop-media').getPublicUrl(path)

    const displayUrl = `${publicUrl}?v=${Date.now()}`

    const { error } = await supabase
      .from('tenants')
      .update({ landing_banner_url: displayUrl })
      .eq('id', currentTenantId)

    setSavingLandingBanner(false)

    if (error) {
      alert('Erro ao salvar banner: ' + error.message)
      return
    }

    setLandingBannerUrl(displayUrl)
    setSavedInfo(true)
    setTimeout(() => setSavedInfo(false), 2500)
  }

  async function removeLandingBanner() {
    if (!currentTenantId || !isPremium) return

    const { error } = await supabase
      .from('tenants')
      .update({ landing_banner_url: null })
      .eq('id', currentTenantId)

    if (error) {
      alert('Erro ao remover banner: ' + error.message)
      return
    }

    setLandingBannerUrl('')
  }

  const avatarColors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']

  function getAvatarColor(name: string) {
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return avatarColors[Math.abs(hash) % avatarColors.length]
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            border: '3px solid #1e2535',
            borderTopColor: '#3b82f6',
            animation: 'spin 0.8s linear infinite',
          }}
        />

        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 980, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, color: '#f1f5f9', margin: '0 0 6px', letterSpacing: -0.7 }}>
          Configurações
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
          Gerencie dados, horários, links, fotos e conta da barbearia.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: 28,
          background: 'rgba(255,255,255,0.03)',
          padding: 5,
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.06)',
          width: 'fit-content',
        }}
      >
        {(['barbearia', 'landing', 'barbeiros', 'servicos'] as const).map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            style={{
              padding: '9px 20px',
              borderRadius: 11,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 800,
              transition: 'all 0.15s',
              background: tab === item ? 'rgba(59,130,246,0.2)' : 'transparent',
              color: tab === item ? '#60a5fa' : '#64748b',
            }}
          >
            {item === 'barbearia' ? '🏪 Barbearia' : item === 'landing' ? '🚀 Landing Premium' : item === 'barbeiros' ? '✂ Barbeiros' : '🛠 Serviços'}
          </button>
        ))}
      </div>

      {tab === 'barbearia' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <section style={cardStyle}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', margin: '0 0 18px' }}>Links de acesso</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <LinkBox
                title="Link público de agendamento"
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
          </section>

          <section style={cardStyle}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px' }}>
              Informações da barbearia
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 22px' }}>
              Esses dados aparecem na página pública e ajudam o cliente a identificar a barbearia.
            </p>

            <div style={{ display: 'grid', gap: 16 }}>
              <Field label="Nome da barbearia">
                <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Prime Barber" style={inputStyle} />
              </Field>

              <Field label="Telefone / WhatsApp">
                <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(47) 99999-9999" style={inputStyle} />
              </Field>

              <Field label="Endereço">
                <input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro" style={inputStyle} />
              </Field>
            </div>
          </section>

          <section style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 13,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(59,130,246,0.14)',
                  color: '#60a5fa',
                }}
              >
                <Clock size={18} />
              </div>

              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Horário de funcionamento</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                  Esses horários serão usados na página pública de agendamento.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
              <Field label="Horário de abertura">
                <input type="time" value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} style={inputStyle} />
              </Field>

              <Field label="Horário de fechamento">
                <input type="time" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} style={inputStyle} />
              </Field>

              <Field label="Intervalo dos horários">
                <select
                  value={slotInterval}
                  onChange={(e) => setSlotInterval(Number(e.target.value))}
                  style={inputStyle}
                >
                  <option value={15}>15 minutos</option>
                  <option value={30}>30 minutos</option>
                  <option value={45}>45 minutos</option>
                  <option value={60}>60 minutos</option>
                </select>
              </Field>
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 14,
                background: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.16)',
                color: '#93c5fd',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              Exemplo: abrindo às <strong>{openingTime}</strong>, fechando às <strong>{closingTime}</strong> e usando intervalo de{' '}
              <strong>{slotInterval} min</strong>, o sistema vai gerar os horários automaticamente para o cliente escolher.
            </div>

            <button
              onClick={saveInfo}
              disabled={savingInfo}
              style={{
                width: '100%',
                marginTop: 18,
                padding: '13px',
                borderRadius: 12,
                border: 'none',
                background: savedInfo ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#2563eb,#3b82f6)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {savedInfo ? (
                <>
                  <Check size={16} /> Salvo!
                </>
              ) : savingInfo ? (
                'Salvando...'
              ) : (
                'Salvar informações e horários'
              )}
            </button>
          </section>

          <section style={cardStyle}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px' }}>Minha conta</h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 22px' }}>
              Altere o nome do administrador ou redefina sua senha de acesso.
            </p>

            <div style={{ display: 'grid', gap: 16 }}>
              <Field label="Nome do usuário">
                <input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Seu nome" style={inputStyle} />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Nova senha">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Confirmar senha">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    style={inputStyle}
                  />
                </Field>
              </div>

              {accountFeedback && (
                <div
                  style={{
                    padding: '11px 13px',
                    borderRadius: 10,
                    fontSize: 13,
                    background: accountFeedback.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                    border: `1px solid ${
                      accountFeedback.type === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'
                    }`,
                    color: accountFeedback.type === 'success' ? '#6ee7b7' : '#f87171',
                  }}
                >
                  {accountFeedback.msg}
                </div>
              )}

              <button
                onClick={saveAccount}
                disabled={savingAccount}
                style={{
                  padding: '13px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg,#0f766e,#14b8a6)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {savingAccount ? 'Salvando...' : 'Salvar conta'}
              </button>
            </div>
          </section>
        </div>
      )}


      {tab === 'landing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {!isPremium && (
            <UpgradeBanner text="A Landing Page Premium personalizada é exclusiva do plano Premium." />
          )}

          <section style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 13,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(201,168,76,0.14)',
                  color: '#e8c96a',
                }}
              >
                <Crown size={18} />
              </div>

              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>
                  Landing Page Premium
                </h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                  Personalize a página pública da barbearia com texto, banner, cor, WhatsApp e Instagram.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <Field label="Título principal">
                <textarea
                  value={landingHeadline}
                  onChange={(e) => setLandingHeadline(e.target.value)}
                  placeholder="Seu estilo,\nnosso cuidado."
                  disabled={!isPremium}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 86 }}
                />
              </Field>

              <Field label="Descrição principal">
                <textarea
                  value={landingDescription}
                  onChange={(e) => setLandingDescription(e.target.value)}
                  placeholder="Agende seu horário e viva uma experiência premium."
                  disabled={!isPremium}
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 104 }}
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="WhatsApp da landing">
                  <input
                    value={landingWhatsapp}
                    onChange={(e) => setLandingWhatsapp(e.target.value)}
                    placeholder="(47) 99999-9999"
                    disabled={!isPremium}
                    style={inputStyle}
                  />
                </Field>

                <Field label="Instagram">
                  <input
                    value={landingInstagram}
                    onChange={(e) => setLandingInstagram(e.target.value)}
                    placeholder="@barbearia ou link completo"
                    disabled={!isPremium}
                    style={inputStyle}
                  />
                </Field>
              </div>

              <Field label="Endereço exibido no rodapé">
                <input
                  value={landingAddress}
                  onChange={(e) => setLandingAddress(e.target.value)}
                  placeholder="Rua, número, bairro, cidade"
                  disabled={!isPremium}
                  style={inputStyle}
                />
              </Field>

              <Field label="Cor principal da landing">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={landingPrimaryColor}
                    onChange={(e) => setLandingPrimaryColor(e.target.value)}
                    disabled={!isPremium}
                    style={{ width: 54, height: 44, border: 'none', background: 'transparent', cursor: 'pointer' }}
                  />

                  <input
                    value={landingPrimaryColor}
                    onChange={(e) => setLandingPrimaryColor(e.target.value)}
                    disabled={!isPremium}
                    placeholder="#c9a84c"
                    style={inputStyle}
                  />
                </div>
              </Field>
            </div>

            <button
              onClick={saveInfo}
              disabled={savingInfo || !isPremium}
              style={{
                width: '100%',
                marginTop: 18,
                padding: '13px',
                borderRadius: 12,
                border: 'none',
                background: savedInfo ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#c9a84c,#e8c96a)',
                color: '#0a0a0a',
                fontSize: 14,
                fontWeight: 900,
                cursor: isPremium ? 'pointer' : 'not-allowed',
                opacity: isPremium ? 1 : 0.5,
              }}
            >
              {savedInfo ? 'Landing salva!' : savingInfo ? 'Salvando...' : 'Salvar Landing Premium'}
            </button>
          </section>

          <section style={cardStyle}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px' }}>
              Banner principal
            </h2>

            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 18px' }}>
              Imagem grande do topo da página pública. Recomendado: 1600x900 ou maior.
            </p>

            <div
              style={{
                height: 240,
                borderRadius: 18,
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(0,0,0,0.28)',
                display: 'grid',
                placeItems: 'center',
                marginBottom: 16,
              }}
            >
              {landingBannerUrl ? (
                <img src={landingBannerUrl} alt="Banner da landing" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ textAlign: 'center', color: '#64748b' }}>
                  <Camera size={34} />
                  <p style={{ margin: '10px 0 0', fontSize: 13 }}>Nenhum banner cadastrado</p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <label
                style={{
                  padding: '11px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(201,168,76,0.3)',
                  background: 'rgba(201,168,76,0.1)',
                  color: '#e8c96a',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: isPremium ? 'pointer' : 'not-allowed',
                  opacity: isPremium ? 1 : 0.5,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                <Upload size={14} />
                {savingLandingBanner ? 'Enviando...' : 'Enviar banner'}
                <input
                  type="file"
                  accept="image/*"
                  disabled={!isPremium || savingLandingBanner}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadLandingBanner(file)
                    e.currentTarget.value = ''
                  }}
                  style={{ display: 'none' }}
                />
              </label>

              {landingBannerUrl && (
                <button
                  onClick={removeLandingBanner}
                  disabled={!isPremium}
                  style={{
                    padding: '11px 16px',
                    borderRadius: 10,
                    border: '1px solid rgba(239,68,68,0.25)',
                    background: 'rgba(239,68,68,0.08)',
                    color: '#f87171',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: isPremium ? 'pointer' : 'not-allowed',
                  }}
                >
                  Remover banner
                </button>
              )}

              <a
                href={publicBookingUrl}
                target="_blank"
                style={{
                  padding: '11px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(59,130,246,0.25)',
                  background: 'rgba(59,130,246,0.08)',
                  color: '#60a5fa',
                  fontSize: 13,
                  fontWeight: 800,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                <ExternalLink size={14} />
                Ver landing
              </a>
            </div>
          </section>
        </div>
      )}

      {tab === 'barbeiros' && (
        <div>
          {!canUploadPhotos && <UpgradeBanner text="Faça upgrade para adicionar fotos dos barbeiros e deixar sua página mais profissional." />}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {barbers.length === 0 ? (
              <p style={{ color: '#475569', textAlign: 'center', padding: '40px 0' }}>Nenhum barbeiro cadastrado ainda.</p>
            ) : (
              barbers.map((barber) => {
                const color = getAvatarColor(barber.nome)
                const isLoading = saving === barber.id
                const isSaved = saved === barber.id

                return (
                  <div key={barber.id} style={listItemStyle}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      {barber.avatar_url ? (
                        <img src={barber.avatar_url} alt={barber.nome} style={avatarImageStyle} />
                      ) : (
                        <div style={{ ...avatarFallbackStyle, background: `${color}22`, border: `2px solid ${color}44`, color }}>
                          {barber.nome[0]?.toUpperCase()}
                        </div>
                      )}

                      {canUploadPhotos && (
                        <div style={cameraBadgeStyle}>
                          <Camera size={11} style={{ color: '#60a5fa' }} />
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9', margin: '0 0 4px' }}>{barber.nome}</p>
                      <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>{barber.avatar_url ? '✅ Foto cadastrada' : '📷 Sem foto'}</p>
                    </div>

                    <AssetActions
                      canUpload={canUploadPhotos}
                      isSaved={isSaved}
                      isLoading={isLoading}
                      hasImage={Boolean(barber.avatar_url)}
                      onRemove={() => removeBarberPhoto(barber.id)}
                      onUpload={(file) => uploadBarberPhoto(barber.id, file)}
                    />
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {tab === 'servicos' && (
        <div>
          {!canUploadPhotos && <UpgradeBanner text="Faça upgrade para adicionar fotos dos cortes e aumentar suas conversões." />}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {services.length === 0 ? (
              <p style={{ color: '#475569', textAlign: 'center', padding: '40px 0' }}>Nenhum serviço cadastrado ainda.</p>
            ) : (
              services.map((service) => {
                const isLoading = saving === service.id
                const isSaved = saved === service.id

                return (
                  <div key={service.id} style={listItemStyle}>
                    <div style={serviceThumbStyle}>
                      {service.photo_url ? (
                        <img src={service.photo_url} alt={service.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 26 }}>✂</span>
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9', margin: '0 0 4px' }}>{service.name}</p>
                      <p style={{ fontSize: 13, color: '#10b981', fontWeight: 800, margin: '0 0 2px' }}>
                        R$ {Number(service.price || 0).toFixed(2)}
                      </p>
                      <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>{service.photo_url ? '✅ Foto cadastrada' : '📷 Sem foto'}</p>
                    </div>

                    <AssetActions
                      canUpload={canUploadPhotos}
                      isSaved={isSaved}
                      isLoading={isLoading}
                      hasImage={Boolean(service.photo_url)}
                      onRemove={() => removeServicePhoto(service.id)}
                      onUpload={(file) => uploadServicePhoto(service.id, file)}
                    />
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function UpgradeBanner({ text }: { text: string }) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg,rgba(139,92,246,0.15),rgba(59,130,246,0.1))',
        border: '1px solid rgba(139,92,246,0.3)',
        borderRadius: 16,
        padding: '20px 24px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <Crown size={28} style={{ color: '#a78bfa', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', margin: '0 0 4px' }}>Recurso exclusivo do Plano Pro</p>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>{text}</p>
      </div>
      <a
        href="/pricing"
        style={{
          padding: '10px 20px',
          borderRadius: 10,
          background: 'linear-gradient(135deg,#7c3aed,#8b5cf6)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 800,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Fazer upgrade →
      </a>
    </div>
  )
}

function AssetActions({
  canUpload,
  isSaved,
  isLoading,
  hasImage,
  onRemove,
  onUpload,
}: {
  canUpload: boolean
  isSaved: boolean
  isLoading: boolean
  hasImage: boolean
  onRemove: () => void
  onUpload: (file: File) => void
}) {
  if (!canUpload) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 8,
          background: 'rgba(139,92,246,0.1)',
          border: '1px solid rgba(139,92,246,0.2)',
        }}
      >
        <Lock size={13} style={{ color: '#a78bfa' }} />
        <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700 }}>Pro</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {isSaved && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontSize: 13, fontWeight: 700 }}>
          <Check size={15} /> Salvo!
        </div>
      )}

      {isLoading && (
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: '2px solid #1e2535',
            borderTopColor: '#3b82f6',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      )}

      <label
        style={{
          padding: '9px 16px',
          borderRadius: 9,
          border: '1px solid rgba(59,130,246,0.3)',
          background: 'rgba(59,130,246,0.1)',
          color: '#60a5fa',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Upload size={14} />
        {hasImage ? 'Trocar' : 'Adicionar'}
        <input
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
          }}
        />
      </label>

      {hasImage && (
        <button
          onClick={onRemove}
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            border: '1px solid rgba(239,68,68,0.3)',
            background: 'rgba(239,68,68,0.1)',
            color: '#f87171',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={15} />
        </button>
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
    <div
      style={{
        padding: 16,
        borderRadius: 14,
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <p style={{ margin: '0 0 4px', color: '#f1f5f9', fontSize: 14, fontWeight: 800 }}>{title}</p>
          <p style={{ margin: 0, color: '#64748b', fontSize: 12, lineHeight: 1.5 }}>{description}</p>
        </div>
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          style={{ color: '#60a5fa', padding: 6, borderRadius: 8, background: 'rgba(59,130,246,0.1)', display: 'inline-flex' }}
        >
          <ExternalLink size={15} />
        </a>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          readOnly
          value={value}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '10px 12px',
            background: 'rgba(15,23,42,0.75)',
            border: '1px solid rgba(148,163,184,0.14)',
            borderRadius: 10,
            color: '#cbd5e1',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={onCopy}
          style={{
            padding: '10px 13px',
            borderRadius: 10,
            border: '1px solid rgba(59,130,246,0.25)',
            background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.12)',
            color: copied ? '#6ee7b7' : '#93c5fd',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}

const listItemStyle: React.CSSProperties = {
  background: 'rgba(11,18,32,0.72)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 16,
  padding: '20px 24px',
  display: 'flex',
  alignItems: 'center',
  gap: 20,
}

const avatarImageStyle: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: '50%',
  objectFit: 'cover',
  border: '2px solid rgba(255,255,255,0.1)',
}

const avatarFallbackStyle: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 22,
  fontWeight: 900,
}

const cameraBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: -2,
  right: -2,
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: '#1e2535',
  border: '2px solid rgba(255,255,255,0.1)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const serviceThumbStyle: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 12,
  overflow: 'hidden',
  flexShrink: 0,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
