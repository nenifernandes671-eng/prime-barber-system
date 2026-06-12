'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/tenant-context'
import { useTenantId } from '@/lib/useTenantId'
import {
  Camera,
  Check,
  CircleAlert,
  Clock,
  Copy,
  CreditCard,
  Crown,
  Eye,
  EyeOff,
  ExternalLink,
  GripVertical,
  Image as ImageIcon,
  Lock,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Star,
  Trash2,
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

interface GalleryImage {
  id: string
  image_url: string
  storage_path?: string | null
  position: number
  is_cover?: boolean
  created_at?: string
}

interface LandingTestimonial {
  name: string
  text: string
  rating: number
}

interface LandingDifferential {
  title: string
  description: string
  icon: string
}

type Tab = 'barbearia' | 'pagamentos' | 'landing' | 'barbeiros' | 'servicos'

interface PaymentSettings {
  configured: boolean
  enabled: boolean
  environment: 'sandbox' | 'production'
  maskedKey: string | null
  accountName: string | null
  accountEmail: string | null
  connectionStatus: 'not_tested' | 'active' | 'error'
  lastTestedAt: string | null
}

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
  const [landingLogoUrl, setLandingLogoUrl] = useState('')
  const [landingAboutTitle, setLandingAboutTitle] = useState('')
  const [landingAboutText, setLandingAboutText] = useState('')
  const [landingAboutImageUrl, setLandingAboutImageUrl] = useState('')
  const [landingTestimonials, setLandingTestimonials] = useState<LandingTestimonial[]>([])
  const [landingDifferentials, setLandingDifferentials] = useState<LandingDifferential[]>([])
  const [landingYearsExperience, setLandingYearsExperience] = useState('')
  const [landingAppointmentsCount, setLandingAppointmentsCount] = useState('')
  const [landingClientsCount, setLandingClientsCount] = useState('')
  const [landingAverageRating, setLandingAverageRating] = useState('')
  const [savingPublicAsset, setSavingPublicAsset] = useState<'logo' | 'about' | null>(null)
  const [savingLandingBanner, setSavingLandingBanner] = useState(false)
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([])
  const [savingGallery, setSavingGallery] = useState(false)
  const [draggedGalleryId, setDraggedGalleryId] = useState<string | null>(null)

  const [savingInfo, setSavingInfo] = useState(false)
  const [savedInfo, setSavedInfo] = useState(false)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  const [adminName, setAdminName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingAccount, setSavingAccount] = useState(false)
  const [accountFeedback, setAccountFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [paymentTesting, setPaymentTesting] = useState(false)
  const [paymentRemoving, setPaymentRemoving] = useState(false)
  const [asaasEnvironment, setAsaasEnvironment] = useState<'sandbox' | 'production'>('production')
  const [asaasApiKey, setAsaasApiKey] = useState('')
  const [showAsaasApiKey, setShowAsaasApiKey] = useState(false)
  const [asaasConfigured, setAsaasConfigured] = useState(false)
  const [asaasMaskedKey, setAsaasMaskedKey] = useState<string | null>(null)
  const [asaasAccountName, setAsaasAccountName] = useState<string | null>(null)
  const [asaasAccountEmail, setAsaasAccountEmail] = useState<string | null>(null)
  const [asaasConnectionStatus, setAsaasConnectionStatus] =
    useState<PaymentSettings['connectionStatus']>('not_tested')
  const [asaasLastTestedAt, setAsaasLastTestedAt] = useState<string | null>(null)
  const [paymentFeedback, setPaymentFeedback] =
    useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  ).replace(/\/$/, '')

  const publicBookingUrl = `${appUrl}/${slug}`
  const barberLoginUrl = `${appUrl}/barber/login`

  const canUploadPhotos = !!hasFeature(tenant?.plano, 'uploads')
  const canCustomizePublicPage = ['pro', 'premium'].includes(
    tenant?.plano?.toLowerCase() ?? ''
  )

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
      setLandingLogoUrl((tenant as any).landing_logo_url ?? '')
      setLandingAboutTitle((tenant as any).landing_about_title ?? '')
      setLandingAboutText((tenant as any).landing_about_text ?? '')
      setLandingAboutImageUrl((tenant as any).landing_about_image_url ?? '')
      setLandingTestimonials(
        Array.isArray((tenant as any).landing_testimonials)
          ? (tenant as any).landing_testimonials
          : []
      )
      setLandingDifferentials(
        Array.isArray((tenant as any).landing_differentials)
          ? (tenant as any).landing_differentials
          : []
      )
      setLandingYearsExperience((tenant as any).landing_years_experience ?? '')
      setLandingAppointmentsCount((tenant as any).landing_appointments_count ?? '')
      setLandingClientsCount((tenant as any).landing_clients_count ?? '')
      setLandingAverageRating((tenant as any).landing_average_rating ?? '')
    }
  }, [tenant])

  useEffect(() => {
    if (currentTenantId) fetchData()
  }, [currentTenantId])

  useEffect(() => {
    if (tab === 'pagamentos' && currentTenantId) {
      loadPaymentSettings()
    }
  }, [tab, currentTenantId])

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

  function applyPaymentSettings(settings: PaymentSettings) {
    setAsaasConfigured(settings.configured)
    setAsaasEnvironment(settings.environment)
    setAsaasMaskedKey(settings.maskedKey)
    setAsaasAccountName(settings.accountName)
    setAsaasAccountEmail(settings.accountEmail)
    setAsaasConnectionStatus(settings.connectionStatus)
    setAsaasLastTestedAt(settings.lastTestedAt)
  }

  async function paymentSettingsRequest(method: 'GET' | 'POST', payload?: Record<string, unknown>) {
    const token = await getAuthToken()
    if (!token || !currentTenantId) {
      throw new Error('Sessão ou barbearia não encontrada. Entre novamente e tente de novo.')
    }

    const response = await fetch('/api/admin/payment-settings', {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-tenant-id': currentTenantId,
      },
      body: method === 'POST' ? JSON.stringify({ tenantId: currentTenantId, ...payload }) : undefined,
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(result.error || 'Não foi possível processar a integração ASAAS.')
    }

    return result
  }

  async function loadPaymentSettings() {
    setPaymentLoading(true)
    setPaymentFeedback(null)

    try {
      const result = await paymentSettingsRequest('GET')
      applyPaymentSettings(result.settings)
    } catch (error) {
      setPaymentFeedback({
        type: 'error',
        msg: error instanceof Error ? error.message : 'Erro ao carregar a integração ASAAS.',
      })
    } finally {
      setPaymentLoading(false)
    }
  }

  async function testPaymentConnection() {
    if (!asaasApiKey.trim() && !asaasConfigured) {
      setPaymentFeedback({ type: 'error', msg: 'Informe a chave API do ASAAS para testar a conexão.' })
      return
    }

    setPaymentTesting(true)
    setPaymentFeedback(null)

    try {
      const result = await paymentSettingsRequest('POST', {
        action: 'test',
        environment: asaasEnvironment,
        apiKey: asaasApiKey.trim() || undefined,
      })

      setAsaasAccountName(result.account?.name ?? null)
      setAsaasAccountEmail(result.account?.email ?? null)
      setAsaasConnectionStatus('active')
      setAsaasLastTestedAt(new Date().toISOString())
      setPaymentFeedback({ type: 'success', msg: 'Conexão validada com sucesso. Agora você pode salvar.' })
    } catch (error) {
      setAsaasConnectionStatus('error')
      setPaymentFeedback({
        type: 'error',
        msg: error instanceof Error ? error.message : 'Não foi possível conectar ao ASAAS.',
      })
    } finally {
      setPaymentTesting(false)
    }
  }

  async function savePaymentSettings() {
    if (!asaasApiKey.trim() && !asaasConfigured) {
      setPaymentFeedback({ type: 'error', msg: 'Informe a chave API do ASAAS antes de salvar.' })
      return
    }

    setPaymentSaving(true)
    setPaymentFeedback(null)

    try {
      const result = await paymentSettingsRequest('POST', {
        action: 'save',
        environment: asaasEnvironment,
        apiKey: asaasApiKey.trim() || undefined,
      })

      applyPaymentSettings(result.settings)
      setAsaasApiKey('')
      setShowAsaasApiKey(false)
      setPaymentFeedback({ type: 'success', msg: 'Integração ASAAS salva e ativada para esta barbearia.' })
    } catch (error) {
      setPaymentFeedback({
        type: 'error',
        msg: error instanceof Error ? error.message : 'Erro ao salvar a integração ASAAS.',
      })
    } finally {
      setPaymentSaving(false)
    }
  }

  async function removePaymentSettings() {
    if (!confirm('Remover a integração ASAAS desta barbearia? As cobranças automáticas deixarão de ser criadas.')) {
      return
    }

    setPaymentRemoving(true)
    setPaymentFeedback(null)

    try {
      await paymentSettingsRequest('POST', { action: 'remove' })
      applyPaymentSettings({
        configured: false,
        enabled: false,
        environment: 'production',
        maskedKey: null,
        accountName: null,
        accountEmail: null,
        connectionStatus: 'not_tested',
        lastTestedAt: null,
      })
      setAsaasApiKey('')
      setPaymentFeedback({ type: 'success', msg: 'Integração ASAAS removida.' })
    } catch (error) {
      setPaymentFeedback({
        type: 'error',
        msg: error instanceof Error ? error.message : 'Erro ao remover a integração ASAAS.',
      })
    } finally {
      setPaymentRemoving(false)
    }
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
      setGalleryImages([])
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
      setGalleryImages(data.gallery ?? [])
    } else {
      console.error(data.error ?? 'Erro ao carregar configuracoes.')
      setBarbers([])
      setServices([])
      setGalleryImages([])
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

  async function savePublicPage() {
    if (!currentTenantId || !canCustomizePublicPage) return

    setSavingInfo(true)
    const token = await getAuthToken()

    try {
      const response = await fetch('/api/admin/public-page-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          tenant_id: currentTenantId,
          landing_headline: landingHeadline,
          landing_description: landingDescription,
          landing_whatsapp: landingWhatsapp,
          landing_instagram: landingInstagram,
          landing_address: landingAddress,
          landing_primary_color: landingPrimaryColor,
          landing_banner_url: landingBannerUrl,
          landing_logo_url: landingLogoUrl,
          landing_about_title: landingAboutTitle,
          landing_about_text: landingAboutText,
          landing_about_image_url: landingAboutImageUrl,
          landing_testimonials: landingTestimonials,
          landing_differentials: landingDifferentials,
          landing_years_experience: landingYearsExperience,
          landing_appointments_count: landingAppointmentsCount,
          landing_clients_count: landingClientsCount,
          landing_average_rating: landingAverageRating,
        }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Erro ao salvar pagina publica.')

      setSavedInfo(true)
      setTimeout(() => setSavedInfo(false), 2500)
    } catch (error: any) {
      alert(error.message || 'Erro ao salvar pagina publica.')
    } finally {
      setSavingInfo(false)
    }
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


  async function uploadPublicPageAsset(file: File, kind: 'logo' | 'about') {
    if (!currentTenantId || !canCustomizePublicPage) return

    setSavingPublicAsset(kind)
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `landing/${currentTenantId}/${kind}.${extension}`

    const { error } = await supabase.storage
      .from('barbershop-media')
      .upload(path, file, {
        upsert: true,
        cacheControl: '60',
        contentType: file.type || 'image/jpeg',
      })

    if (error) {
      alert('Erro no upload da imagem: ' + error.message)
      setSavingPublicAsset(null)
      return
    }

    const publicUrl = supabase.storage.from('barbershop-media').getPublicUrl(path).data.publicUrl
    const displayUrl = `${publicUrl}?v=${Date.now()}`

    if (kind === 'logo') setLandingLogoUrl(displayUrl)
    else setLandingAboutImageUrl(displayUrl)

    setSavingPublicAsset(null)
  }

  async function uploadLandingBanner(file: File) {
    if (!currentTenantId || !canCustomizePublicPage) return

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
    if (!currentTenantId || !canCustomizePublicPage) return

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

  function sortGallery(images: GalleryImage[]) {
    return [...images].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  }

  function isValidGalleryFile(file: File) {
    return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  }

  async function compressGalleryFile(file: File) {
    if (typeof window === 'undefined') return file

    return new Promise<File>((resolve) => {
      const image = new window.Image()
      const objectUrl = URL.createObjectURL(file)

      image.onload = () => {
        const maxSize = 1600
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')

        if (!context) {
          URL.revokeObjectURL(objectUrl)
          resolve(file)
          return
        }

        context.drawImage(image, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl)
            if (!blob) {
              resolve(file)
              return
            }

            const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]/gi, '-').toLowerCase()
            resolve(new File([blob], `${baseName || 'galeria'}.webp`, { type: 'image/webp' }))
          },
          'image/webp',
          0.84
        )
      }

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(file)
      }

      image.src = objectUrl
    })
  }

  async function uploadGalleryFiles(fileList: FileList | File[]) {
    if (!currentTenantId || savingGallery) return

    const files = Array.from(fileList).filter(isValidGalleryFile)
    if (files.length === 0) {
      alert('Envie apenas imagens JPG, PNG ou WEBP.')
      return
    }

    const remaining = 20 - galleryImages.length
    if (remaining <= 0) {
      alert('Limite de 20 imagens atingido.')
      return
    }

    const selectedFiles = files.slice(0, remaining)
    if (files.length > selectedFiles.length) {
      alert(`A galeria aceita ate 20 imagens. Vou enviar apenas ${selectedFiles.length}.`)
    }

    setSavingGallery(true)

    try {
      const uploadedImages = []

      for (const [index, file] of selectedFiles.entries()) {
        const compressed = await compressGalleryFile(file)
        const safeName = compressed.name.replace(/[^a-z0-9._-]/gi, '-').toLowerCase()
        const path = `gallery/${currentTenantId}/${Date.now()}-${index}-${safeName}`

        const { error: uploadError } = await supabase.storage
          .from('barbershop-media')
          .upload(path, compressed, {
            upsert: false,
            cacheControl: '31536000',
            contentType: compressed.type || 'image/webp',
          })

        if (uploadError) throw uploadError

        const {
          data: { publicUrl },
        } = supabase.storage.from('barbershop-media').getPublicUrl(path)

        uploadedImages.push({
          image_url: `${publicUrl}?v=${Date.now()}`,
          storage_path: path,
        })
      }

      const result = await saveAssetChange('create_gallery_images', { images: uploadedImages })
      if (!result.ok) throw new Error(String(result.error))

      setGalleryImages(sortGallery((result.gallery ?? []) as GalleryImage[]))
      setSavedInfo(true)
      setTimeout(() => setSavedInfo(false), 2500)
    } catch (error: any) {
      alert('Erro ao enviar galeria: ' + (error.message ?? 'tente novamente.'))
    } finally {
      setSavingGallery(false)
    }
  }

  async function removeGalleryImage(imageId: string) {
    if (!confirm('Remover esta imagem da galeria?')) return

    const result = await saveAssetChange('delete_gallery_image', { gallery_id: imageId })
    if (!result.ok) {
      alert('Erro ao remover imagem: ' + result.error)
      return
    }

    setGalleryImages(sortGallery((result.gallery ?? []) as GalleryImage[]))
  }

  async function setGalleryCover(imageId: string) {
    const result = await saveAssetChange('set_gallery_cover', { gallery_id: imageId })
    if (!result.ok) {
      alert('Erro ao definir capa: ' + result.error)
      return
    }

    setGalleryImages(sortGallery((result.gallery ?? []) as GalleryImage[]))
  }

  async function moveGalleryImage(targetId: string) {
    if (!draggedGalleryId || draggedGalleryId === targetId) return

    const ordered = sortGallery(galleryImages)
    const fromIndex = ordered.findIndex((image) => image.id === draggedGalleryId)
    const toIndex = ordered.findIndex((image) => image.id === targetId)
    if (fromIndex < 0 || toIndex < 0) return

    const next = [...ordered]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    const normalized = next.map((image, index) => ({ ...image, position: index }))
    setGalleryImages(normalized)
    setDraggedGalleryId(null)

    const result = await saveAssetChange('update_gallery_order', {
      images: normalized.map((image) => ({ id: image.id, position: image.position })),
    })

    if (!result.ok) {
      alert('Erro ao ordenar imagens: ' + result.error)
      fetchData()
      return
    }

    setGalleryImages(sortGallery((result.gallery ?? normalized) as GalleryImage[]))
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
        {(['barbearia', 'pagamentos', 'landing', 'barbeiros', 'servicos'] as const).map((item) => (
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
            {item === 'barbearia'
              ? 'Barbearia'
              : item === 'pagamentos'
                ? 'Pagamentos'
                : item === 'landing'
                  ? 'Página Pública'
                  : item === 'barbeiros'
                    ? 'Barbeiros'
                    : 'Serviços'}
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

      {tab === 'pagamentos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <section style={cardStyle}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 18,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 15,
                    display: 'grid',
                    placeItems: 'center',
                    background: asaasConnectionStatus === 'active' ? 'rgba(16,185,129,0.14)' : 'rgba(59,130,246,0.14)',
                    color: asaasConnectionStatus === 'active' ? '#34d399' : '#60a5fa',
                  }}
                >
                  <CreditCard size={22} />
                </div>

                <div>
                  <p style={{ margin: '0 0 4px', color: '#64748b', fontSize: 11, fontWeight: 900, letterSpacing: 1.2 }}>
                    COBRANÇAS DOS SEUS CLIENTES
                  </p>
                  <h2 style={{ margin: 0, color: '#f1f5f9', fontSize: 19, fontWeight: 900 }}>
                    Integração ASAAS
                  </h2>
                  <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>
                    Receba assinaturas recorrentes diretamente na conta ASAAS da sua barbearia.
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 12px',
                  borderRadius: 999,
                  border: `1px solid ${
                    asaasConnectionStatus === 'active' ? 'rgba(16,185,129,0.28)' : 'rgba(245,158,11,0.28)'
                  }`,
                  background: asaasConnectionStatus === 'active' ? 'rgba(16,185,129,0.10)' : 'rgba(245,158,11,0.10)',
                  color: asaasConnectionStatus === 'active' ? '#6ee7b7' : '#fbbf24',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {asaasConnectionStatus === 'active' ? <ShieldCheck size={15} /> : <CircleAlert size={15} />}
                {asaasConnectionStatus === 'active' ? 'Conexão ativa' : 'Não configurado'}
              </div>
            </div>

            {paymentLoading ? (
              <div style={{ padding: '28px 0 4px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 9 }}>
                <RefreshCw size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                Carregando integração...
              </div>
            ) : (
              <>
                {asaasConfigured && (
                  <div
                    style={{
                      marginTop: 22,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                      gap: 12,
                    }}
                  >
                    <div style={{ padding: 15, borderRadius: 14, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <span style={{ display: 'block', color: '#64748b', fontSize: 11, fontWeight: 800, marginBottom: 6 }}>CONTA ASAAS</span>
                      <strong style={{ display: 'block', color: '#f1f5f9', fontSize: 14 }}>{asaasAccountName || 'Conta conectada'}</strong>
                      {asaasAccountEmail && <span style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginTop: 4 }}>{asaasAccountEmail}</span>}
                    </div>

                    <div style={{ padding: 15, borderRadius: 14, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <span style={{ display: 'block', color: '#64748b', fontSize: 11, fontWeight: 800, marginBottom: 6 }}>CHAVE SALVA</span>
                      <strong style={{ display: 'block', color: '#f1f5f9', fontSize: 14, fontFamily: 'monospace' }}>
                        {asaasMaskedKey || '••••••••••••'}
                      </strong>
                      {asaasLastTestedAt && (
                        <span style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                          Testada em {new Date(asaasLastTestedAt).toLocaleString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
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
                <PlugZap size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Configurar conexão</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                  A chave é criptografada no servidor e nunca volta para o navegador.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 17 }}>
              <Field label="Ambiente">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(['sandbox', 'production'] as const).map((environment) => {
                    const active = asaasEnvironment === environment
                    return (
                      <button
                        key={environment}
                        type="button"
                        onClick={() => {
                          setAsaasEnvironment(environment)
                          setPaymentFeedback(null)
                        }}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 11,
                          border: active ? '1px solid rgba(59,130,246,0.55)' : '1px solid rgba(255,255,255,0.08)',
                          background: active ? 'rgba(59,130,246,0.18)' : 'rgba(0,0,0,0.20)',
                          color: active ? '#93c5fd' : '#94a3b8',
                          cursor: 'pointer',
                          fontWeight: 800,
                        }}
                      >
                        {environment === 'sandbox' ? 'Sandbox (testes)' : 'Produção'}
                      </button>
                    )
                  })}
                </div>
              </Field>

              <Field label={asaasConfigured ? 'Nova chave API ASAAS (opcional)' : 'Chave API ASAAS'}>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showAsaasApiKey ? 'text' : 'password'}
                    value={asaasApiKey}
                    onChange={(event) => {
                      setAsaasApiKey(event.target.value)
                      setPaymentFeedback(null)
                    }}
                    autoComplete="new-password"
                    placeholder={asaasConfigured ? `Chave atual: ${asaasMaskedKey || 'configurada'}` : '$aact_...'}
                    style={{ ...inputStyle, paddingRight: 48 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAsaasApiKey((current) => !current)}
                    title={showAsaasApiKey ? 'Ocultar chave' : 'Mostrar chave'}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      right: 9,
                      transform: 'translateY(-50%)',
                      width: 34,
                      height: 34,
                      border: 'none',
                      borderRadius: 9,
                      display: 'grid',
                      placeItems: 'center',
                      background: 'transparent',
                      color: '#94a3b8',
                      cursor: 'pointer',
                    }}
                  >
                    {showAsaasApiKey ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </Field>

              <div
                style={{
                  padding: 14,
                  borderRadius: 13,
                  border: '1px solid rgba(59,130,246,0.16)',
                  background: 'rgba(59,130,246,0.07)',
                  color: '#93c5fd',
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                Use uma chave da conta ASAAS da própria barbearia. A conta global do KorteBarber continua separada e é usada somente para cobrar o plano SaaS.
              </div>

              {paymentFeedback && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 11,
                    fontSize: 13,
                    lineHeight: 1.5,
                    background: paymentFeedback.type === 'success' ? 'rgba(16,185,129,0.11)' : 'rgba(239,68,68,0.11)',
                    border: `1px solid ${
                      paymentFeedback.type === 'success' ? 'rgba(16,185,129,0.26)' : 'rgba(239,68,68,0.26)'
                    }`,
                    color: paymentFeedback.type === 'success' ? '#6ee7b7' : '#fca5a5',
                  }}
                >
                  {paymentFeedback.msg}
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <button
                  type="button"
                  onClick={testPaymentConnection}
                  disabled={paymentTesting || paymentSaving || paymentRemoving || paymentLoading}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 11,
                    border: '1px solid rgba(59,130,246,0.32)',
                    background: 'rgba(59,130,246,0.10)',
                    color: '#93c5fd',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <RefreshCw size={16} style={paymentTesting ? { animation: 'spin 0.8s linear infinite' } : undefined} />
                  {paymentTesting ? 'Testando...' : 'Testar conexão'}
                </button>

                <button
                  type="button"
                  onClick={savePaymentSettings}
                  disabled={paymentTesting || paymentSaving || paymentRemoving || paymentLoading}
                  style={{
                    padding: '12px 18px',
                    borderRadius: 11,
                    border: 'none',
                    background: 'linear-gradient(135deg,#2563eb,#3b82f6)',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {paymentSaving ? 'Validando e salvando...' : 'Salvar integração'}
                </button>

                {asaasConfigured && (
                  <button
                    type="button"
                    onClick={removePaymentSettings}
                    disabled={paymentTesting || paymentSaving || paymentRemoving || paymentLoading}
                    style={{
                      marginLeft: 'auto',
                      padding: '12px 16px',
                      borderRadius: 11,
                      border: '1px solid rgba(239,68,68,0.30)',
                      background: 'rgba(239,68,68,0.08)',
                      color: '#fca5a5',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {paymentRemoving ? 'Removendo...' : 'Remover integração'}
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}


      {tab === 'landing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {!canCustomizePublicPage && (
            <UpgradeBanner text="A personalização da Página Pública está disponível nos planos Pro e Premium." />
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
                  Página Pública
                </h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                  Personalize a página pública da barbearia sem alterar o fluxo de agendamento.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <Field label="Título principal">
                <textarea
                  value={landingHeadline}
                  onChange={(e) => setLandingHeadline(e.target.value)}
                  placeholder="Seu estilo,\nnosso cuidado."
                  disabled={!canCustomizePublicPage}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 86 }}
                />
              </Field>

              <Field label="Descrição principal">
                <textarea
                  value={landingDescription}
                  onChange={(e) => setLandingDescription(e.target.value)}
                  placeholder="Agende seu horário e viva uma experiência premium."
                  disabled={!canCustomizePublicPage}
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
                    disabled={!canCustomizePublicPage}
                    style={inputStyle}
                  />
                </Field>

                <Field label="Instagram">
                  <input
                    value={landingInstagram}
                    onChange={(e) => setLandingInstagram(e.target.value)}
                    placeholder="@barbearia ou link completo"
                    disabled={!canCustomizePublicPage}
                    style={inputStyle}
                  />
                </Field>
              </div>

              <Field label="Endereço exibido no rodapé">
                <input
                  value={landingAddress}
                  onChange={(e) => setLandingAddress(e.target.value)}
                  placeholder="Rua, número, bairro, cidade"
                  disabled={!canCustomizePublicPage}
                  style={inputStyle}
                />
              </Field>

              <Field label="Cor principal da landing">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={landingPrimaryColor}
                    onChange={(e) => setLandingPrimaryColor(e.target.value)}
                    disabled={!canCustomizePublicPage}
                    style={{ width: 54, height: 44, border: 'none', background: 'transparent', cursor: 'pointer' }}
                  />

                  <input
                    value={landingPrimaryColor}
                    onChange={(e) => setLandingPrimaryColor(e.target.value)}
                    disabled={!canCustomizePublicPage}
                    placeholder="#c9a84c"
                    style={inputStyle}
                  />
                </div>
              </Field>
            </div>

            <button
              onClick={savePublicPage}
              disabled={savingInfo || !canCustomizePublicPage}
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
                cursor: canCustomizePublicPage ? 'pointer' : 'not-allowed',
                opacity: canCustomizePublicPage ? 1 : 0.5,
              }}
            >
              {savedInfo ? 'Página salva!' : savingInfo ? 'Salvando...' : 'Salvar Página Pública'}
            </button>
          </section>

          <section style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 38, height: 38, borderRadius: 13, display: 'grid', placeItems: 'center', background: 'rgba(59,130,246,0.14)', color: '#60a5fa' }}>
                <ImageIcon size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Identidade visual</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Logo exibida no cabeçalho e rodapé da página pública.</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ width: 112, height: 112, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.24)', display: 'grid', placeItems: 'center' }}>
                {landingLogoUrl ? (
                  <img src={landingLogoUrl} alt="Logo da barbearia" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <ImageIcon size={30} color="#64748b" />
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <label style={{ padding: '11px 16px', borderRadius: 10, border: '1px solid rgba(59,130,246,0.28)', background: 'rgba(59,130,246,0.10)', color: '#60a5fa', fontSize: 13, fontWeight: 800, cursor: canCustomizePublicPage ? 'pointer' : 'not-allowed', opacity: canCustomizePublicPage ? 1 : 0.5, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <Upload size={14} />
                  {savingPublicAsset === 'logo' ? 'Enviando...' : 'Enviar logo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={!canCustomizePublicPage || savingPublicAsset !== null}
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) uploadPublicPageAsset(file, 'logo')
                      event.currentTarget.value = ''
                    }}
                    style={{ display: 'none' }}
                  />
                </label>
                {landingLogoUrl && (
                  <button type="button" onClick={() => setLandingLogoUrl('')} disabled={!canCustomizePublicPage} style={{ padding: '11px 16px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: 13, fontWeight: 800 }}>
                    Remover logo
                  </button>
                )}
              </div>
            </div>
          </section>

          <section style={cardStyle}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px' }}>Sobre nós</h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px' }}>Conte a história e a proposta da sua barbearia.</p>
            <div style={{ display: 'grid', gap: 16 }}>
              <Field label="Título">
                <input value={landingAboutTitle} onChange={(event) => setLandingAboutTitle(event.target.value)} placeholder="Mais que uma barbearia, um estilo de vida." disabled={!canCustomizePublicPage} style={inputStyle} />
              </Field>
              <Field label="Texto">
                <textarea value={landingAboutText} onChange={(event) => setLandingAboutText(event.target.value)} placeholder="Conte um pouco sobre a história e a experiência da sua barbearia." disabled={!canCustomizePublicPage} rows={5} style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }} />
              </Field>
              <Field label="Foto principal">
                <div style={{ display: 'grid', gap: 12 }}>
                  {landingAboutImageUrl && <img src={landingAboutImageUrl} alt="Foto da seção Sobre nós" style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 14 }} />}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <label style={{ padding: '11px 16px', borderRadius: 10, border: '1px solid rgba(59,130,246,0.28)', background: 'rgba(59,130,246,0.10)', color: '#60a5fa', fontSize: 13, fontWeight: 800, cursor: canCustomizePublicPage ? 'pointer' : 'not-allowed', opacity: canCustomizePublicPage ? 1 : 0.5, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      <Upload size={14} />
                      {savingPublicAsset === 'about' ? 'Enviando...' : 'Enviar foto'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={!canCustomizePublicPage || savingPublicAsset !== null}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) uploadPublicPageAsset(file, 'about')
                          event.currentTarget.value = ''
                        }}
                        style={{ display: 'none' }}
                      />
                    </label>
                    {landingAboutImageUrl && (
                      <button type="button" onClick={() => setLandingAboutImageUrl('')} disabled={!canCustomizePublicPage} style={{ padding: '11px 16px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: 13, fontWeight: 800 }}>
                        Remover foto
                      </button>
                    )}
                  </div>
                </div>
              </Field>
            </div>
          </section>

          <section style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', margin: '0 0 5px' }}>Depoimentos e avaliações</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Adicione, edite ou remova avaliações exibidas na página.</p>
              </div>
              <button type="button" disabled={!canCustomizePublicPage || landingTestimonials.length >= 12} onClick={() => setLandingTestimonials((current) => [...current, { name: '', text: '', rating: 5 }])} style={{ padding: '10px 15px', borderRadius: 10, border: '1px solid rgba(59,130,246,0.28)', background: 'rgba(59,130,246,0.12)', color: '#60a5fa', fontWeight: 800, cursor: canCustomizePublicPage ? 'pointer' : 'not-allowed' }}>
                Adicionar depoimento
              </button>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              {landingTestimonials.length === 0 && <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Sem depoimentos personalizados. A página usará os exemplos padrão.</p>}
              {landingTestimonials.map((testimonial, index) => (
                <div key={`testimonial-${index}`} style={{ padding: 16, borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.18)', display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 140px auto', gap: 10, alignItems: 'end' }}>
                    <Field label="Nome do cliente">
                      <input value={testimonial.name} disabled={!canCustomizePublicPage} onChange={(event) => setLandingTestimonials((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} style={inputStyle} />
                    </Field>
                    <Field label="Nota">
                      <select value={testimonial.rating} disabled={!canCustomizePublicPage} onChange={(event) => setLandingTestimonials((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, rating: Number(event.target.value) } : item))} style={inputStyle}>
                        {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} estrelas</option>)}
                      </select>
                    </Field>
                    <button type="button" aria-label="Remover depoimento" disabled={!canCustomizePublicPage} onClick={() => setLandingTestimonials((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={{ width: 44, height: 44, borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)', color: '#f87171', display: 'grid', placeItems: 'center' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <Field label="Depoimento">
                    <textarea value={testimonial.text} disabled={!canCustomizePublicPage} onChange={(event) => setLandingTestimonials((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                  </Field>
                </div>
              ))}
            </div>
          </section>

          <section style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', margin: '0 0 5px' }}>Diferenciais</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Destaque os principais motivos para escolher sua barbearia.</p>
              </div>
              <button type="button" disabled={!canCustomizePublicPage || landingDifferentials.length >= 12} onClick={() => setLandingDifferentials((current) => [...current, { title: '', description: '', icon: '✦' }])} style={{ padding: '10px 15px', borderRadius: 10, border: '1px solid rgba(59,130,246,0.28)', background: 'rgba(59,130,246,0.12)', color: '#60a5fa', fontWeight: 800, cursor: canCustomizePublicPage ? 'pointer' : 'not-allowed' }}>
                Adicionar diferencial
              </button>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              {landingDifferentials.length === 0 && <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Sem diferenciais personalizados. A página usará os itens padrão.</p>}
              {landingDifferentials.map((differential, index) => (
                <div key={`differential-${index}`} style={{ padding: 16, borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.18)', display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '86px minmax(0,1fr) auto', gap: 10, alignItems: 'end' }}>
                    <Field label="Ícone">
                      <input value={differential.icon} disabled={!canCustomizePublicPage} maxLength={12} onChange={(event) => setLandingDifferentials((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, icon: event.target.value } : item))} style={inputStyle} />
                    </Field>
                    <Field label="Título">
                      <input value={differential.title} disabled={!canCustomizePublicPage} onChange={(event) => setLandingDifferentials((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} style={inputStyle} />
                    </Field>
                    <button type="button" aria-label="Remover diferencial" disabled={!canCustomizePublicPage} onClick={() => setLandingDifferentials((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={{ width: 44, height: 44, borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)', color: '#f87171', display: 'grid', placeItems: 'center' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <Field label="Descrição curta">
                    <input value={differential.description} disabled={!canCustomizePublicPage} onChange={(event) => setLandingDifferentials((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} style={inputStyle} />
                  </Field>
                </div>
              ))}
            </div>
          </section>

          <section style={cardStyle}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px' }}>Estatísticas</h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px' }}>Números exibidos para reforçar experiência e confiança.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
              <Field label="Anos de experiência"><input value={landingYearsExperience} onChange={(event) => setLandingYearsExperience(event.target.value)} placeholder="+5 anos" disabled={!canCustomizePublicPage} style={inputStyle} /></Field>
              <Field label="Atendimentos realizados"><input value={landingAppointmentsCount} onChange={(event) => setLandingAppointmentsCount(event.target.value)} placeholder="+5.000" disabled={!canCustomizePublicPage} style={inputStyle} /></Field>
              <Field label="Clientes satisfeitos"><input value={landingClientsCount} onChange={(event) => setLandingClientsCount(event.target.value)} placeholder="+1.200" disabled={!canCustomizePublicPage} style={inputStyle} /></Field>
              <Field label="Avaliação média"><input value={landingAverageRating} onChange={(event) => setLandingAverageRating(event.target.value)} placeholder="4.9" disabled={!canCustomizePublicPage} style={inputStyle} /></Field>
            </div>
          </section>

          <button
            type="button"
            onClick={savePublicPage}
            disabled={savingInfo || !canCustomizePublicPage}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              border: 'none',
              background: savedInfo ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#c9a84c,#e8c96a)',
              color: '#0a0a0a',
              fontSize: 14,
              fontWeight: 900,
              cursor: canCustomizePublicPage ? 'pointer' : 'not-allowed',
              opacity: canCustomizePublicPage ? 1 : 0.5,
            }}
          >
            {savedInfo ? 'Página salva!' : savingInfo ? 'Salvando...' : 'Salvar personalização'}
          </button>

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
                  cursor: canCustomizePublicPage ? 'pointer' : 'not-allowed',
                  opacity: canCustomizePublicPage ? 1 : 0.5,
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
                  disabled={!canCustomizePublicPage || savingLandingBanner}
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
                  disabled={!canCustomizePublicPage}
                  style={{
                    padding: '11px 16px',
                    borderRadius: 10,
                    border: '1px solid rgba(239,68,68,0.25)',
                    background: 'rgba(239,68,68,0.08)',
                    color: '#f87171',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: canCustomizePublicPage ? 'pointer' : 'not-allowed',
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

          <section style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'rgba(201,168,76,0.14)',
                    color: '#e8c96a',
                    border: '1px solid rgba(201,168,76,0.22)',
                  }}
                >
                  <ImageIcon size={20} />
                </div>

                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 900, color: '#f1f5f9', margin: 0 }}>
                    Galeria de Trabalhos
                  </h2>
                  <p style={{ fontSize: 13, color: '#94a3b8', margin: '5px 0 0', maxWidth: 560 }}>
                    Mostre seus melhores cortes, barba, ambiente e trabalhos para seus clientes.
                  </p>
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 800, color: '#e8c96a', padding: '8px 12px', border: '1px solid rgba(201,168,76,0.24)', borderRadius: 999 }}>
                {galleryImages.length}/20 imagens
              </div>
            </div>

            <label
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                uploadGalleryFiles(event.dataTransfer.files)
              }}
              style={{
                minHeight: 148,
                borderRadius: 18,
                border: '1px dashed rgba(201,168,76,0.46)',
                background: 'linear-gradient(135deg, rgba(201,168,76,0.10), rgba(59,130,246,0.06))',
                display: 'grid',
                placeItems: 'center',
                textAlign: 'center',
                color: '#f8fafc',
                padding: 22,
                cursor: savingGallery || galleryImages.length >= 20 ? 'not-allowed' : 'pointer',
                opacity: savingGallery ? 0.72 : 1,
              }}
            >
              <div>
                <Upload size={28} style={{ color: '#e8c96a', marginBottom: 10 }} />
                <p style={{ margin: 0, fontSize: 15, fontWeight: 900 }}>
                  {savingGallery ? 'Enviando e comprimindo imagens...' : 'Arraste imagens aqui ou clique para enviar'}
                </p>
                <p style={{ margin: '7px 0 0', color: '#94a3b8', fontSize: 12 }}>
                  JPG, PNG ou WEBP. Compressao automatica e limite de 20 fotos.
                </p>
              </div>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={savingGallery || galleryImages.length >= 20}
                onChange={(event) => {
                  if (event.target.files?.length) uploadGalleryFiles(event.target.files)
                  event.currentTarget.value = ''
                }}
                style={{ display: 'none' }}
              />
            </label>

            {galleryImages.length === 0 ? (
              <div style={{ marginTop: 18, padding: '20px 16px', borderRadius: 16, background: 'rgba(15,23,42,0.48)', border: '1px solid rgba(148,163,184,0.12)', color: '#94a3b8', textAlign: 'center' }}>
                Nenhuma imagem cadastrada ainda. A landing usara imagens padrao ate voce enviar seus trabalhos.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: 14,
                  marginTop: 18,
                }}
              >
                {sortGallery(galleryImages).map((image, index) => (
                  <div
                    key={image.id}
                    draggable
                    onDragStart={() => setDraggedGalleryId(image.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => moveGalleryImage(image.id)}
                    style={{
                      position: 'relative',
                      height: 150,
                      overflow: 'hidden',
                      borderRadius: 16,
                      border: image.is_cover ? '1px solid rgba(232,201,106,0.78)' : '1px solid rgba(148,163,184,0.16)',
                      background: 'rgba(2,6,23,0.68)',
                      boxShadow: image.is_cover ? '0 18px 40px rgba(201,168,76,0.16)' : '0 12px 28px rgba(0,0,0,0.18)',
                    }}
                    title="Arraste para reordenar"
                  >
                    <img src={image.image_url} alt={`Trabalho ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(2,6,23,0.08), rgba(2,6,23,0.72))' }} />

                    <div style={{ position: 'absolute', top: 9, left: 9, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'rgba(2,6,23,0.72)', color: '#e8c96a', border: '1px solid rgba(255,255,255,0.12)' }}>
                        <GripVertical size={15} />
                      </span>
                      {image.is_cover && (
                        <span style={{ padding: '6px 8px', borderRadius: 999, fontSize: 11, fontWeight: 900, color: '#0a0a0a', background: '#e8c96a' }}>
                          Capa
                        </span>
                      )}
                    </div>

                    <div style={{ position: 'absolute', right: 9, bottom: 9, display: 'flex', gap: 7 }}>
                      <button
                        type="button"
                        onClick={() => setGalleryCover(image.id)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          border: '1px solid rgba(232,201,106,0.35)',
                          background: image.is_cover ? '#e8c96a' : 'rgba(2,6,23,0.72)',
                          color: image.is_cover ? '#0a0a0a' : '#e8c96a',
                          cursor: 'pointer',
                        }}
                        title="Definir como capa"
                      >
                        <Star size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeGalleryImage(image.id)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          border: '1px solid rgba(248,113,113,0.35)',
                          background: 'rgba(127,29,29,0.70)',
                          color: '#fecaca',
                          cursor: 'pointer',
                        }}
                        title="Excluir imagem"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
