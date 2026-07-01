'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getTenantAccess } from '@/lib/subscription-access'

interface Service { id: string; name: string; price: number; duration: number; description?: string; photo_url?: string; unit_id?: string | null }
interface Barber  { id: string; nome: string; avatar_url?: string; unit_id?: string | null }
interface Unit { id: string; tenant_id: string; name: string; address?: string | null; phone?: string | null; active: boolean }
interface BusinessHour { id?: string; tenant_id: string; unit_id?: string | null; weekday: number; is_open: boolean; open_time: string; close_time: string; break_start?: string | null; break_end?: string | null }
interface LandingTestimonial { name: string; text: string; rating: number }
interface LandingDifferential { title: string; description: string; icon: string }
interface Tenant {
  id: string
  nome: string
  telefone?: string
  plano?: string
  hero_url?: string
  status?: string
  trial_ends_at?: string
  opening_time?: string
  closing_time?: string
  slot_interval?: number
  endereco?: string
  landing_headline?: string
  landing_description?: string
  landing_whatsapp?: string
  landing_instagram?: string
  landing_address?: string
  landing_primary_color?: string
  landing_banner_url?: string
  landing_logo_url?: string
  landing_about_title?: string
  landing_about_text?: string
  landing_about_image_url?: string
  landing_testimonials?: LandingTestimonial[]
  landing_differentials?: LandingDifferential[]
  landing_years_experience?: string
  landing_appointments_count?: string
  landing_clients_count?: string
  landing_average_rating?: string
}
interface GalleryImage { id: string; image_url: string; position: number; is_cover?: boolean; created_at?: string }

function normalizeTime(time?: string | null) {
  const match = String(time || '').match(/^(\d{2}):(\d{2})/)
  return match ? `${match[1]}:${match[2]}` : ''
}

function timeToMinutes(time?: string | null) {
  const normalized = normalizeTime(time)
  if (!normalized) return Number.NaN

  const [hours, minutes] = normalized.split(':').map(Number)
  return hours * 60 + minutes
}

function minutesToTime(total: number) {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function weekdayFromDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.getDay()
}

function getBusinessHourRule(hours: BusinessHour[], date: string, unitId?: string | null) {
  const weekday = weekdayFromDate(date)
  if (weekday === null) return null
  const selectedUnitId = unitId ? String(unitId) : null
  return (
    hours.find(item => item.weekday === weekday && selectedUnitId && String(item.unit_id) === selectedUnitId) ||
    hours.find(item => item.weekday === weekday && !item.unit_id) ||
    hours.find(item => item.weekday === weekday) ||
    null
  )
}

function generateTimes(tenant: Tenant | null, hours: BusinessHour[], date: string, duration?: number, unitId?: string | null) {
  const rule = date ? getBusinessHourRule(hours, date, unitId) : null
  if (rule && !rule.is_open) return []

  const start = timeToMinutes(normalizeTime(rule?.open_time) || tenant?.opening_time || '08:00')
  const end = timeToMinutes(normalizeTime(rule?.close_time) || tenant?.closing_time || '19:00')
  const breakStart = timeToMinutes(normalizeTime(rule?.break_start))
  const breakEnd = timeToMinutes(normalizeTime(rule?.break_end))
  const step = Number(tenant?.slot_interval || 30)
  const serviceDuration = Number(duration || step)

  if (!step || step < 5 || start >= end) return []

  const times: string[] = []

  for (let current = start; current + serviceDuration <= end; current += step) {
    const finishesAt = current + serviceDuration
    const overlapsBreak = !Number.isNaN(breakStart) && !Number.isNaN(breakEnd) && current < breakEnd && finishesAt > breakStart
    if (!overlapsBreak) times.push(minutesToTime(current))
  }

  return times
}
const GOLD = '#c9a84c'
const GOLD2 = '#e8c96a'
const DARK = '#0a0a0a'
const DEFAULT_HERO = 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1600&q=80&auto=format&fit=crop'

function getInitial(name: string) { return (name ?? '?')[0].toUpperCase() }
const AVATAR_COLORS = ['#c9a84c','#b8973a','#d4b84a','#e6c866','#a07830']
function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const SERVICE_ICONS: Record<string, string> = {
  corte: 'C', barba: 'B', sobrancelha: 'S', platinado: 'P', hidratacao: 'H', combo: '+',
}
function getServiceIcon(name: string) {
  const l = name.toLowerCase()
  for (const [k, v] of Object.entries(SERVICE_ICONS)) if (l.includes(k)) return v
  return 'C'
}

export default function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)

  const [tenant, setTenant]     = useState<Tenant | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers]   = useState<Barber[]>([])
  const [tenantGallery, setTenantGallery] = useState<GalleryImage[]>([])
  const [units, setUnits]       = useState<Unit[]>([])
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([])
  const [bookedTimes, setBookedTimes] = useState<string[]>([])
  const [mobileNav, setMobileNav] = useState(false)
  const [showAppReturn] = useState(() => {
    if (typeof window === 'undefined') return false
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    const fromApp = new URLSearchParams(window.location.search).get('from') === 'app'
    return Boolean(standalone || fromApp)
  })
  const [tenantChecked, setTenantChecked] = useState(false)

  const [selectedUnit, setSelectedUnit]       = useState<Unit | null>(null)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedBarber, setSelectedBarber]   = useState<Barber | null>(null)
  const [selectedDate, setSelectedDate]       = useState('')
  const [selectedTime, setSelectedTime]       = useState('')
  const [clientName, setClientName]           = useState('')
  const [clientPhone, setClientPhone]         = useState('')
  const [submitting, setSubmitting]           = useState(false)
  const [success, setSuccess]                 = useState(false)
  const [error, setError]                     = useState('')
  const [lightboxIndex, setLightboxIndex]     = useState<number | null>(null)

  const normalizedPlan = tenant?.plano?.toLowerCase()
  const isPro = normalizedPlan === 'pro' || normalizedPlan === 'premium'
  const isPremium = normalizedPlan === 'premium'
  const allTimes = generateTimes(tenant, businessHours, selectedDate, selectedService?.duration, selectedUnit?.id ?? null)
  const availableTimes = allTimes.filter(t => !bookedTimes.includes(t))
  const hasMultipleUnits = isPremium && units.length > 1
  const filteredBarbers = isPremium && selectedUnit
    ? barbers.filter((barber) => !barber.unit_id || barber.unit_id === selectedUnit.id)
    : barbers
  const filteredServices = isPremium && selectedUnit
    ? services.filter((service) => !service.unit_id || service.unit_id === selectedUnit.id)
    : services
  const primaryColor = (isPro && tenant?.landing_primary_color) || GOLD
  const heroImage = (isPro && tenant?.landing_banner_url) || tenant?.hero_url || DEFAULT_HERO
  const landingHeadline = (isPro && tenant?.landing_headline) || 'Seu estilo,\nnosso cuidado.'
  const landingDescription =
    (isPro && tenant?.landing_description) ||
    `Agende seu horário e viva a experiência ${tenant?.nome ?? slug.toUpperCase()}. Profissionais especializados, ambiente premium.`
  const landingWhatsapp = (isPro && tenant?.landing_whatsapp) || tenant?.telefone || ''
  const landingInstagram = (isPro && tenant?.landing_instagram) || ''
  const landingAddress = (isPro && tenant?.landing_address) || tenant?.endereco || ''
  const landingLogoUrl = (isPro && tenant?.landing_logo_url) || ''

  useEffect(() => {
    async function load() {
      setTenantChecked(false)
      const { data: t } = await supabase.from('tenants').select('*').eq('slug', slug).maybeSingle()
      if (!t) {
        setTenant(null)
        setServices([])
        setBarbers([])
        setTenantGallery([])
        setUnits([])
        setBusinessHours([])
        setTenantChecked(true)
        return
      }
      setTenant(t)
      const { data: unitRows } = t.plano === 'premium'
        ? await supabase
            .from('units')
            .select('id, tenant_id, name, address, phone, active')
            .eq('tenant_id', t.id)
            .eq('active', true)
            .order('created_at', { ascending: true })
        : { data: [] }

      const activeUnits = (unitRows ?? []) as Unit[]
      setUnits(activeUnits)
      setSelectedUnit(t.plano === 'premium' && activeUnits.length === 1 ? activeUnits[0] : null)

      const { data: hoursRows } = await supabase
        .from('business_hours')
        .select('*')
        .eq('tenant_id', t.id)
        .order('weekday', { ascending: true })
      setBusinessHours(((hoursRows ?? []) as BusinessHour[]).map((row) => ({
        ...row,
        open_time: normalizeTime(row.open_time) || '08:00',
        close_time: normalizeTime(row.close_time) || '19:00',
        break_start: normalizeTime(row.break_start) || null,
        break_end: normalizeTime(row.break_end) || null,
      })))

      const response = await fetch(`/api/public/tenant-assets?tenant_id=${encodeURIComponent(t.id)}`)
      const assets = await response.json().catch(() => ({}))
      if (response.ok) {
        setServices(assets.services ?? [])
        setBarbers(assets.barbers ?? [])
        setTenantGallery(assets.gallery ?? [])
      } else {
        const { data: sv } = await supabase.from('services').select('*').eq('tenant_id', t.id).order('price')
        const { data: br } = await supabase.from('barbeiros').select('*').eq('tenant_id', t.id).eq('ativo', true)
        setServices(sv ?? [])
        setBarbers(br ?? [])
        setTenantGallery([])
      }
      setTenantChecked(true)
    }
    load()
  }, [slug])

  async function fetchTimes(date: string, barber: Barber) {
    if (!tenant) return
    const params = new URLSearchParams({
      tenant_id: tenant.id,
      barber_id: barber.id,
      date,
      ...(isPremium && selectedUnit?.id ? { unit_id: selectedUnit.id } : {}),
    })
    const response = await fetch(`/api/public/appointments?${params.toString()}`)
    const payload = await response.json().catch(() => ({}))
    setBookedTimes(response.ok ? (payload.bookedTimes ?? []) : [])
  }

  function handleUnitChange(unitId: string) {
    const unit = units.find((item) => item.id === unitId) || null

    setSelectedUnit(unit)
    setSelectedService(null)
    setSelectedBarber(null)
    setSelectedDate('')
    setSelectedTime('')
    setBookedTimes([])
  }

  function handleDateChange(date: string) {
    setSelectedDate(date); setSelectedTime(''); setBookedTimes([])
    if (date && selectedBarber) fetchTimes(date, selectedBarber)
  }

  function handleBarberChange(barber: Barber) {
    if (isPremium && !selectedUnit && barber.unit_id) {
      const barberUnit = units.find((unit) => unit.id === barber.unit_id)
      if (barberUnit) setSelectedUnit(barberUnit)
    }

    setSelectedBarber(barber); setSelectedTime(''); setBookedTimes([])
    if (selectedDate) fetchTimes(selectedDate, barber)
  }

  async function handleSubmit() {
    if (!clientName || !clientPhone || !selectedService || !selectedBarber || !selectedDate || !selectedTime || (hasMultipleUnits && !selectedUnit)) {
      setError('Por favor, preencha todos os campos.'); return
    }
    setSubmitting(true); setError('')
    const response = await fetch('/api/public/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: tenant!.id,
        unit_id: isPremium ? selectedUnit?.id || selectedBarber.unit_id || selectedService.unit_id || null : null,
        service_id: selectedService.id,
        barber_id: selectedBarber.id,
        client_name: clientName,
        phone: clientPhone,
        appointment_date: selectedDate,
        appointment_time: selectedTime,
      }),
    })
    const payload = await response.json().catch(() => ({}))
    setSubmitting(false)
    if (!response.ok) {
      setError(payload.error ?? 'Erro ao agendar. Tente novamente.')
      if (response.status === 409) {
        setSelectedTime('')
        fetchTimes(selectedDate, selectedBarber)
      }
      return
    }
    setSuccess(true)
  }

  const tenantName = tenant?.nome ?? slug.toUpperCase()
  const todayStr = new Date().toISOString().split('T')[0]
  const access = getTenantAccess(tenant)

  if (!tenantChecked) {
    return (
      <div style={{ minHeight: '100vh', background: DARK, color: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Outfit','Segoe UI',sans-serif" }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', border: '3px solid rgba(201,168,76,0.2)', borderTopColor: GOLD, animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div style={{ minHeight: '100vh', background: DARK, color: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Outfit','Segoe UI',sans-serif" }}>
        <div style={{ width: '100%', maxWidth: 460, background: '#111', border: `1px solid rgba(201,168,76,0.25)`, borderRadius: 20, padding: '34px 28px', textAlign: 'center', boxShadow: '0 24px 70px rgba(0,0,0,0.35)' }}>
          <div style={{ width: 52, height: 52, margin: '0 auto 16px', borderRadius: 14, background: `linear-gradient(135deg,${GOLD},${GOLD2})`, color: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900 }}>✂</div>
          <h1 style={{ fontSize: 24, margin: '0 0 10px', fontWeight: 900 }}>Barbearia nao encontrada</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, margin: '0 0 22px' }}>
            O link acessado nao existe ou ainda nao foi configurado.
          </p>
          <Link href="/app" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 22px', borderRadius: 10, background: `linear-gradient(135deg,${GOLD},${GOLD2})`, color: DARK, textDecoration: 'none', fontWeight: 800, fontSize: 13 }}>
            Voltar para KorteBarber
          </Link>
        </div>
      </div>
    )
  }

  if (tenant && !access.allowed) {
    return (
      <div style={{ minHeight: '100vh', background: DARK, color: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Outfit','Segoe UI',sans-serif" }}>
        <div style={{ width: '100%', maxWidth: 460, background: '#111', border: `1px solid rgba(201,168,76,0.25)`, borderRadius: 20, padding: '34px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>🔒</div>
          <h1 style={{ fontSize: 24, margin: '0 0 10px', fontWeight: 900 }}>{tenantName}</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            O agendamento online desta barbearia está temporariamente indisponível.
          </p>
        </div>
      </div>
    )
  }

  if (success) return (
    <div style={{ minHeight:'100vh', background:DARK, display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:"'Outfit','Segoe UI',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Outfit:wght@300;400;500;600;700&display=swap');`}</style>
      <div style={{ maxWidth:440, width:'100%', background:'#111', border:`1px solid rgba(201,168,76,0.25)`, borderRadius:20, padding:'40px 32px', textAlign:'center' }}>
        <div style={{ fontSize:50, marginBottom:12 }}>✂</div>
        <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:900, color:'#f1f5f9', margin:'0 0 20px' }}>Agendamento confirmado!</h2>
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, overflow:'hidden', marginBottom:20 }}>
          {[
            ['Cliente',clientName],
            ...(isPremium ? [['Unidade',selectedUnit?.name || 'Unidade principal']] : []),
            ['Serviço',selectedService?.name],
            ['Barbeiro',selectedBarber?.nome],
            ['Data',new Date(selectedDate+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})],
            ['Horário',selectedTime],
          ].map(([l,v])=>(
            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'11px 16px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ color:'#64748b', fontSize:13 }}>{l}</span>
              <span style={{ color:'#f1f5f9', fontSize:13, fontWeight:600 }}>{v}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', padding:'11px 16px' }}>
            <span style={{ color:'#64748b', fontSize:13 }}>Valor</span>
            <span style={{ color:primaryColor, fontSize:16, fontWeight:800 }}>R$ {selectedService?.price?.toFixed(2)}</span>
          </div>
        </div>
        <p style={{ color:'#94a3b8', fontSize:13, margin:'0 0 20px' }}>Até breve! 👋</p>
        <button onClick={()=>{setSuccess(false);setClientName('');setClientPhone('');setSelectedService(null);setSelectedBarber(null);setSelectedDate('');setSelectedTime('');setSelectedUnit(isPremium && units.length === 1 ? units[0] : null)}}
          style={{ padding:'12px 28px', borderRadius:10, border:'none', background:`linear-gradient(135deg,${primaryColor},${GOLD2})`, color:DARK, fontWeight:700, fontSize:14, cursor:'pointer' }}>
          Fazer outro agendamento
        </button>
      </div>
    </div>
  )

  const whatsappDigits = landingWhatsapp.replace(/\D/g, '')
  const whatsappHref = whatsappDigits ? `https://wa.me/55${whatsappDigits}` : ''
  const operatingHours = `${tenant?.opening_time || '08:00'} às ${tenant?.closing_time || '19:00'}`
  const fallbackImages = [
    'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=900&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=900&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=900&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1517832606299-7ae9b720a186?w=900&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1582984563026-3d78053964ff?w=900&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519500528352-2d1460418d41?w=900&q=80&auto=format&fit=crop',
  ]
  const uploadedGalleryImages = [...tenantGallery]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((image, index) => ({ src: image.image_url, alt: `Trabalho ${index + 1}` }))
  const galleryImages = (
    uploadedGalleryImages.length > 0
      ? uploadedGalleryImages
      : [
          ...filteredServices.filter((service) => service.photo_url).map((service) => ({ src: service.photo_url!, alt: service.name })),
          ...filteredBarbers.filter((barber) => barber.avatar_url).map((barber) => ({ src: barber.avatar_url!, alt: barber.nome })),
          ...fallbackImages.map((src, index) => ({ src, alt: `Trabalho ${index + 1}` })),
        ]
  ).slice(0, 12)
  const lightboxImage = lightboxIndex !== null ? galleryImages[lightboxIndex] : null
  const defaultTestimonials: LandingTestimonial[] = [
    { text: 'Ambiente top, atendimento impecável e corte sempre fica do jeito que eu gosto.', name: 'Rafael Costa', rating: 5 },
    { text: 'Profissionais incríveis, atenção nos mínimos detalhes.', name: 'Lucas Almeida', rating: 5 },
    { text: 'Melhor barbearia da região, não abro mão.', name: 'João Victor', rating: 5 },
    { text: 'Agendamento fácil e pontualidade que faz diferença.', name: 'Matheus Silva', rating: 5 },
  ]
  const defaultDifferentials: LandingDifferential[] = [
    { icon: '✂', title: 'Profissionais experientes', description: 'Especialistas preparados para cuidar do seu estilo.' },
    { icon: '★', title: 'Produtos premium', description: 'Produtos selecionados para um acabamento superior.' },
    { icon: '◆', title: 'Ambiente climatizado', description: 'Conforto e cuidado em cada detalhe.' },
    { icon: '✦', title: 'Atendimento personalizado', description: 'Uma experiência pensada para você.' },
  ]
  const reviews = isPro && Array.isArray(tenant?.landing_testimonials) && tenant.landing_testimonials.length
    ? tenant.landing_testimonials
    : defaultTestimonials
  const differentials = isPro && Array.isArray(tenant?.landing_differentials) && tenant.landing_differentials.length
    ? tenant.landing_differentials
    : defaultDifferentials
  const aboutTitle = (isPro && tenant?.landing_about_title) || 'Mais que uma barbearia, um estilo de vida.'
  const aboutText = (isPro && tenant?.landing_about_text) ||
    `A ${tenantName} nasceu para entregar mais que cortes. Aqui, cada detalhe é pensado para proporcionar uma experiência única, unindo técnica, atendimento premium e um ambiente feito para você relaxar e sair ainda melhor.`
  const aboutImage = (isPro && tenant?.landing_about_image_url) || galleryImages[0]?.src || fallbackImages[0]
  const publicStats = [
    ['✂', (isPro && tenant?.landing_years_experience) || '+5 anos', 'De experiência'],
    ['◆', (isPro && tenant?.landing_appointments_count) || '+5.000', 'Atendimentos realizados'],
    ['●', (isPro && tenant?.landing_clients_count) || '+1.200', 'Clientes satisfeitos'],
    ['★', (isPro && tenant?.landing_average_rating) || '4.9', 'Avaliação média'],
  ]

  return (
    <div style={{ minHeight:'100vh', background:'#060503', color:'#f8f1df', fontFamily:"'Outfit','Segoe UI',sans-serif", overflowX:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Outfit:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;}
        ::selection{background:#c9a84c30;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:#c9a84c40;border-radius:4px;}
        input[type="date"]::-webkit-calendar-picker-indicator{cursor:pointer;}
        .nav-link{color:#e2d9c8;text-decoration:none;font-size:14px;font-weight:500;letter-spacing:0.5px;transition:color 0.2s;position:relative;padding-bottom:4px;}
        .nav-link:hover{color:#c9a84c;}
        .nav-link.active::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:#c9a84c;border-radius:2px;}
        .app-return{display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;border-radius:10px;border:1px solid rgba(201,168,76,0.35);color:#e8c96a;text-decoration:none;font-size:12px;font-weight:800;letter-spacing:.4px;background:rgba(201,168,76,0.08);white-space:nowrap;}
        .sv-card{cursor:pointer;transition:all 0.2s;border:1.5px solid #e8e0d0;}
        .sv-card:hover{border-color:#c9a84c;box-shadow:0 8px 32px rgba(201,168,76,0.15);transform:translateY(-3px);}
        .sv-card.sel{border-color:#c9a84c!important;box-shadow:0 8px 32px rgba(201,168,76,0.2);}
        .br-card{cursor:pointer;transition:all 0.2s;border:1.5px solid #e8e0d0;}
        .br-card:hover{border-color:#c9a84c;transform:translateY(-3px);}
        .br-card.sel{border-color:#c9a84c!important;}
        .t-btn{cursor:pointer;transition:all 0.15s;border:1.5px solid #e5e7eb;background:#fff;color:#374151;font-family:'Outfit',sans-serif;font-size:13px;}
        .t-btn:hover:not(:disabled){border-color:#c9a84c;color:#c9a84c;}
        .t-btn.sel{background:#c9a84c!important;color:#fff!important;border-color:#c9a84c!important;font-weight:700;}
        .t-btn:disabled{opacity:0.3;cursor:not-allowed;text-decoration:line-through;}
        .gold-btn{transition:all 0.2s;cursor:pointer;}
        .gold-btn:hover{transform:translateY(-2px);filter:brightness(1.08);}
        .gold-btn:disabled{opacity:0.5;transform:none!important;cursor:not-allowed;}
        .book-select{width:100%;padding:13px 14px;border:1px solid rgba(255,255,255,0.12);border-radius:10px;font-size:14px;color:#f8f1df;outline:none;background:rgba(255,255,255,0.06);font-family:'Outfit',sans-serif;transition:border-color 0.2s;}
        .book-select option{background:#111;color:#fff;}
        .book-select:focus{border-color:#e8c96a;box-shadow:0 0 0 4px rgba(201,168,76,0.12);}
        .book-input{width:100%;padding:13px 14px;border:1px solid rgba(255,255,255,0.12);border-radius:10px;font-size:14px;color:#f8f1df;outline:none;background:rgba(255,255,255,0.06);font-family:'Outfit',sans-serif;transition:border-color 0.2s;box-sizing:border-box;color-scheme:dark;}
        .book-input::placeholder{color:#8b857a;}
        .book-input:focus{border-color:#e8c96a;box-shadow:0 0 0 4px rgba(201,168,76,0.12);}
        .premium-card{border:1px solid rgba(232,201,106,0.28);background:linear-gradient(145deg,rgba(255,255,255,0.065),rgba(255,255,255,0.025));border-radius:14px;box-shadow:0 18px 52px rgba(0,0,0,0.28);}
        .gallery-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;}
        .gallery-item{height:160px;border-radius:12px;overflow:hidden;border:1px solid rgba(232,201,106,0.24);background:#17140f;position:relative;cursor:pointer;box-shadow:0 18px 44px rgba(0,0,0,0.24);}
        .gallery-item:after{content:'Ver foto';position:absolute;inset:auto 10px 10px 10px;padding:9px 10px;border-radius:999px;background:rgba(5,5,5,0.72);border:1px solid rgba(232,201,106,0.34);color:#e8c96a;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:1.4px;text-align:center;opacity:0;transform:translateY(8px);transition:opacity .25s,transform .25s;}
        .gallery-item img{width:100%;height:100%;object-fit:cover;filter:brightness(0.82);transition:transform .25s,filter .25s;}
        .gallery-item:hover img{transform:scale(1.06);filter:brightness(1);}
        .gallery-item:hover:after{opacity:1;transform:translateY(0);}
        .lightbox-backdrop{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,0.88);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:32px;}
        .lightbox-image{max-width:min(1120px,92vw);max-height:82vh;object-fit:contain;border-radius:18px;border:1px solid rgba(232,201,106,0.32);box-shadow:0 35px 90px rgba(0,0,0,0.55);}
        .lightbox-button{position:absolute;border:1px solid rgba(232,201,106,0.34);background:rgba(12,10,7,0.72);color:#e8c96a;border-radius:999px;width:46px;height:46px;display:grid;place-items:center;cursor:pointer;font-size:24px;font-weight:800;}
        .lightbox-close{top:24px;right:24px;}
        .lightbox-prev{left:28px;}
        .lightbox-next{right:28px;}
        .review-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
        .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
        .about-grid-premium{display:grid;grid-template-columns:minmax(0,1fr) 420px 250px;gap:28px;align-items:center;}
        @media(max-width:960px){.gallery-grid{grid-template-columns:repeat(3,1fr)}.review-grid,.stat-grid{grid-template-columns:repeat(2,1fr)}.about-grid-premium{grid-template-columns:1fr!important;}}
        @media(max-width:600px){.gallery-grid{grid-template-columns:repeat(2,1fr)}.review-grid,.stat-grid{grid-template-columns:1fr}.gallery-item{height:140px}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);}}
        @keyframes spin{to{transform:rotate(360deg);}}
        .anim{animation:fadeUp 0.6s ease both;}
        @media(max-width:960px){
          .hero-grid{grid-template-columns:1fr!important;}
          .booking-float{position:relative!important;top:auto!important;right:auto!important;margin:0 auto!important;max-width:480px;}
          .nav-links{display:none!important;}
          .mob-btn{display:flex!important;}
          .app-return{font-size:11px;padding:7px 10px;}
          .hero-text{padding:80px 24px 32px!important;}
          .hero-wrap{flex-direction:column!important;padding:0 0 40px!important;}
          .services-layout{grid-template-columns:1fr!important;gap:28px!important;}
          .services-copy{max-width:420px!important;}
        }
        @media(max-width:600px){
          nav .gold-btn{display:none!important;}
          .sv-grid{grid-template-columns:repeat(2,1fr)!important;}
          .br-grid{grid-template-columns:repeat(2,1fr)!important;}
          .t-grid{grid-template-columns:repeat(3,1fr)!important;}
          .trust-bar{flex-wrap:wrap;gap:14px!important;}
          .hero-title-txt{font-size:38px!important;}
          .hero-stat-row{gap:16px!important;}
          .service-card-body{padding:12px!important;}
          .service-card-title{font-size:13px!important;line-height:1.25!important;}
          .service-card-desc{font-size:11px!important;line-height:1.45!important;}
        }
        @media(max-width:380px){
          .sv-grid{grid-template-columns:1fr!important;}
          .br-grid{grid-template-columns:1fr!important;}
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:100, background:'rgba(10,10,10,0.96)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(201,168,76,0.15)' }}>
        <div style={{ maxWidth:1280, margin:'0 auto', padding:'0 32px', height:68, display:'flex', alignItems:'center', justifyContent:'space-between', gap:20 }}>
          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
            {landingLogoUrl ? (
              <img src={landingLogoUrl} alt={`Logo ${tenantName}`} style={{ width:42, height:42, borderRadius:10, objectFit:'contain' }} />
            ) : (
              <div style={{ width:38, height:38, borderRadius:10, background:`linear-gradient(135deg,${primaryColor},${GOLD2})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:DARK, fontWeight:900, boxShadow:`0 4px 16px rgba(201,168,76,0.3)` }}>✂</div>
            )}
            <div>
              <p style={{ margin:0, fontSize:16, fontWeight:800, color:'#f1f5f9', letterSpacing:1.5, fontFamily:"'Playfair Display',serif", textTransform:'uppercase' }}>{tenantName}</p>
              <p style={{ margin:0, fontSize:9, color:primaryColor, letterSpacing:3, textTransform:'uppercase' }}>Barbearia</p>
            </div>
          </div>

          {showAppReturn && <Link href="/app" className="app-return">← Voltar</Link>}

          {/* Links */}
          <div className="nav-links" style={{ display:'flex', gap:32, alignItems:'center' }}>
            <a href="#inicio" className="nav-link active">Início</a>
            <a href="#servicos" className="nav-link">Serviços</a>
            <a href="#barbeiros" className="nav-link">Barbeiros</a>
            <a href="#sobre" className="nav-link">Sobre</a>
            <a href="#contato" className="nav-link">Contato</a>
          </div>

          {/* CTA */}
          <a href="#agendar" className="gold-btn" style={{ padding:'11px 24px', borderRadius:8, background:`linear-gradient(135deg,${primaryColor},${GOLD2})`, color:'#fff', fontWeight:700, fontSize:14, textDecoration:'none', flexShrink:0, boxShadow:`0 4px 20px rgba(201,168,76,0.3)`, letterSpacing:0.5 }}>
            Agendar Horário
          </a>

          {/* Mobile menu btn */}
          <button className="mob-btn" onClick={()=>setMobileNav(v=>!v)} style={{ display:'none', background:'none', border:'none', color:'#f1f5f9', fontSize:24, cursor:'pointer', flexShrink:0 }}>
            {mobileNav ? '✕' : '☰'}
          </button>
        </div>

        {mobileNav && (
          <div style={{ padding:'12px 24px 20px', borderTop:'1px solid rgba(255,255,255,0.05)', display:'flex', flexDirection:'column', gap:2, background:'rgba(10,10,10,0.98)' }}>
            {[['#inicio','Início'],['#servicos','Serviços'],['#barbeiros','Barbeiros'],['#agendar','Agendar']].map(([href,label])=>(
              <a key={href} href={href} onClick={()=>setMobileNav(false)} style={{ color:'#94a3b8', textDecoration:'none', padding:'11px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', fontSize:15 }}>{label}</a>
            ))}
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section id="inicio" style={{ position:'relative', minHeight:'100vh', overflow:'hidden' }}>
        {/* Background image */}
        <div style={{ position:'absolute', inset:0, backgroundImage:`url(${heroImage})`, backgroundSize:'cover', backgroundPosition:'center top', filter:'brightness(0.45)' }} />
        {/* Gradient overlay */}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to right, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 55%, rgba(0,0,0,0.1) 100%)' }} />

        <div className="hero-wrap" style={{ position:'relative', zIndex:2, maxWidth:1280, margin:'0 auto', padding:'0 32px', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'space-between', gap:48, paddingTop:68 }}>

          {/* Hero text */}
          <div className="hero-text anim" style={{ maxWidth:560, padding:'60px 0' }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(201,168,76,0.15)', border:'1px solid rgba(201,168,76,0.3)', borderRadius:999, padding:'6px 14px', marginBottom:24 }}>
              <span style={{ color:primaryColor, fontSize:12 }}>★★★★★</span>
              <span style={{ color:'#d4c9b0', fontSize:12 }}>Referência em qualidade</span>
            </div>

            <h1 className="hero-title-txt" style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(44px,5.5vw,72px)', fontWeight:900, lineHeight:1.05, color:'#fff', margin:'0 0 20px', whiteSpace:'pre-line' }}>
              {landingHeadline.includes('\\n') ? landingHeadline.replace(/\\n/g, '\n') : landingHeadline}
            </h1>

            <p style={{ fontSize:17, color:'#c8bfad', lineHeight:1.7, fontWeight:300, margin:'0 0 36px', maxWidth:460 }}>
              {landingDescription}
            </p>

            <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:44 }}>
              <a href="#agendar" className="gold-btn" style={{ padding:'14px 30px', borderRadius:9, background:`linear-gradient(135deg,${primaryColor},${GOLD2})`, color:'#fff', fontWeight:700, fontSize:15, textDecoration:'none', boxShadow:`0 6px 24px rgba(201,168,76,0.35)`, display:'flex', alignItems:'center', gap:8 }}>
                📅 Agendar Horário
              </a>
              <a href="#servicos" style={{ padding:'14px 30px', borderRadius:9, border:'1px solid rgba(255,255,255,0.25)', color:'#fff', fontSize:15, textDecoration:'none', background:'rgba(255,255,255,0.05)', fontWeight:500, backdropFilter:'blur(8px)' }}>
                Nossos Serviços
              </a>
            </div>

            {/* Stats */}
            <div className="hero-stat-row" style={{ display:'flex', gap:28, paddingTop:20, borderTop:'1px solid rgba(255,255,255,0.1)' }}>
              {differentials.slice(0, 3).map((item) => (
                <div key={item.title} style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:20 }}>{item.icon || '✦'}</span>
                  <div>
                    <p style={{ margin:0, fontSize:13, fontWeight:700, color:primaryColor, letterSpacing:0.3 }}>{item.title}</p>
                    <p style={{ margin:0, fontSize:11, color:'#8a7d68' }}>{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── BOOKING CARD ── */}
          <div id="agendar" className="booking-float" style={{ background:'linear-gradient(145deg, rgba(17,16,13,0.94), rgba(7,6,4,0.86))', border:'1px solid rgba(232,201,106,0.32)', backdropFilter:'blur(22px)', borderRadius:22, width:400, flexShrink:0, boxShadow:'0 32px 80px rgba(0,0,0,0.5)', overflow:'hidden' }}>
            <div style={{ padding:'22px 26px 18px', borderBottom:'1px solid rgba(232,201,106,0.2)' }}>
              <h3 style={{ fontSize:20, fontWeight:800, color:'#fff', margin:'0 0 4px', fontFamily:"'Playfair Display',serif" }}>Agende seu horário</h3>
              <p style={{ fontSize:13, color:'#9ca3af', margin:0 }}>Rápido, fácil e online</p>
              <p style={{ fontSize:12, color:'#b8973a', margin:'8px 0 0', fontWeight:700 }}>Funcionamento: {tenant?.opening_time || '08:00'} às {tenant?.closing_time || '19:00'}</p>
            </div>

            <div style={{ padding:'20px 26px', display:'flex', flexDirection:'column', gap:13 }}>
              {hasMultipleUnits && (
                <div>
                  <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:'#6b7280', marginBottom:7, letterSpacing:0.3 }}>
                    <span style={{ color:primaryColor }}>🏢</span> Selecione a unidade
                  </label>
                  <select className="book-select" value={selectedUnit?.id ?? ''} onChange={e=>handleUnitChange(e.target.value)}>
                    <option value="">Escolha uma unidade</option>
                    {units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                  </select>
                </div>
              )}

              {/* Serviço */}
              <div>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:'#d7d0c3', marginBottom:7, letterSpacing:0.3 }}>
                  <span style={{ color:primaryColor }}>✂</span> Selecione o serviço
                </label>
                <select
                  className="book-select"
                  value={selectedService?.id??''}
                  disabled={hasMultipleUnits && !selectedUnit}
                  onChange={e=>setSelectedService(filteredServices.find(s=>s.id===e.target.value)??null)}
                >
                  <option value="">{hasMultipleUnits && !selectedUnit ? 'Escolha a unidade primeiro' : 'Escolha um serviço'}</option>
                  {filteredServices.map(s=><option key={s.id} value={s.id}>{s.name} — R$ {s.price?.toFixed(2)}</option>)}
                </select>
              </div>

              {/* Barbeiro */}
              <div>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:'#d7d0c3', marginBottom:7, letterSpacing:0.3 }}>
                  <span style={{ color:primaryColor }}>👤</span> Selecione o barbeiro
                </label>
                <select
                  className="book-select"
                  value={selectedBarber?.id??''}
                  disabled={hasMultipleUnits && !selectedUnit}
                  onChange={e=>{const b=filteredBarbers.find(x=>x.id===e.target.value);if(b)handleBarberChange(b)}}
                >
                  <option value="">{hasMultipleUnits && !selectedUnit ? 'Escolha a unidade primeiro' : 'Escolha um barbeiro'}</option>
                  {filteredBarbers.map(b=><option key={b.id} value={b.id}>{b.nome}</option>)}
                </select>
              </div>

              {/* Data */}
              <div>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:'#d7d0c3', marginBottom:7, letterSpacing:0.3 }}>
                  <span style={{ color:primaryColor }}>📅</span> Selecione a data
                </label>
                <input type="date" className="book-input" value={selectedDate} min={todayStr} onChange={e=>handleDateChange(e.target.value)} />
              </div>

              {/* Horário */}
              <div>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:'#d7d0c3', marginBottom:7, letterSpacing:0.3 }}>
                  <span style={{ color:primaryColor }}>🕐</span> Selecione o horário
                </label>
                {selectedDate && selectedBarber ? (
                  availableTimes.length === 0 ? (
                    <p style={{ color:'#ef4444', fontSize:13, margin:0 }}>Sem horários nesta data.</p>
                  ) : (
                    <div className="t-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
                      {allTimes.map(t=>(
                        <button key={t} className={`t-btn${selectedTime===t?' sel':''}`} disabled={bookedTimes.includes(t)} onClick={()=>setSelectedTime(t)} style={{ padding:'9px 4px', borderRadius:7 }}>{t}</button>
                      ))}
                    </div>
                  )
                ) : (
                  <div style={{ padding:'11px 14px', border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.04)', borderRadius:10, color:'#8b857a', fontSize:14 }}>
                    Selecione barbeiro e data
                  </div>
                )}
              </div>

              {/* Nome e phone — aparecem após selecionar horário */}
              {selectedTime && (
                <>
                  <div>
                    <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#d7d0c3', marginBottom:7 }}>👤 Seu nome</label>
                    <input className="book-input" placeholder="Nome completo" value={clientName} onChange={e=>setClientName(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#d7d0c3', marginBottom:7 }}>📱 WhatsApp</label>
                    <input className="book-input" placeholder="(47) 99999-9999" value={clientPhone} onChange={e=>setClientPhone(e.target.value)} />
                  </div>
                </>
              )}

              {error && <p style={{ color:'#ef4444', fontSize:13, margin:0 }}>{error}</p>}

              <button className="gold-btn" onClick={handleSubmit} disabled={submitting||!selectedService||!selectedBarber||!selectedDate||!selectedTime||!clientName||!clientPhone||(hasMultipleUnits&&!selectedUnit)}
                style={{ padding:'14px', borderRadius:10, border:'none', background:`linear-gradient(135deg,${primaryColor},${GOLD2})`, color:'#fff', fontSize:15, fontWeight:700, width:'100%', boxShadow:`0 4px 20px rgba(201,168,76,0.3)`, marginTop:2, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {submitting ? (
                  <><div style={{ width:16, height:16, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', animation:'spin 0.8s linear infinite' }} /> Agendando...</>
                ) : 'Ver horários disponíveis →'}
              </button>

              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <span style={{ fontSize:12 }}>🔒</span>
                <span style={{ color:'#9ca3af', fontSize:11 }}>Seus dados estão protegidos</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <div className="trust-bar" style={{ background:'#1a1a1a', padding:'20px 32px', display:'flex', justifyContent:'center', gap:40, flexWrap:'wrap', borderBottom:`3px solid ${primaryColor}` }}>
        {differentials.slice(0, 4).map((item) => (
          <div key={item.title} style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:18 }}>{item.icon || '✦'}</span>
            <span style={{ color:'#94a3b8', fontSize:13, fontWeight:500 }}>{item.title}</span>
          </div>
        ))}
      </div>

      {/* ── SERVIÇOS ── */}
      <section id="servicos" style={{ padding:'80px 32px', background:'#060503', borderTop:'1px solid rgba(232,201,106,0.14)' }}>
        <div className="services-layout" style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'260px 1fr', gap:60, alignItems:'start' }}>
          <div className="services-copy">
            <p style={{ fontSize:11, fontWeight:700, letterSpacing:3, color:primaryColor, textTransform:'uppercase', margin:'0 0 12px' }}>NOSSOS SERVIÇOS</p>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(26px,3.5vw,38px)', fontWeight:900, color:'#fff', lineHeight:1.2, margin:'0 0 20px' }}>Escolha o serviço ideal para você</h2>
            <a href="#agendar" className="gold-btn" style={{ display:'inline-block', padding:'12px 24px', borderRadius:8, background:'transparent', border:'1px solid rgba(232,201,106,0.55)', color:primaryColor, fontSize:13, fontWeight:600, textDecoration:'none', letterSpacing:0.3 }}>
              Ver todos os serviços →
            </a>
          </div>
          <div className="sv-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:18 }}>
            {filteredServices.length === 0 ? (
              <p style={{ color:'#9ca3af', gridColumn:'span 4' }}>Nenhum serviço cadastrado.</p>
            ) : filteredServices.map(sv=>(
              <div key={sv.id} className={`sv-card${selectedService?.id===sv.id?' sel':''}`} onClick={()=>setSelectedService(sv)} style={{ background:'linear-gradient(145deg,rgba(255,255,255,0.065),rgba(255,255,255,0.025))', border:'1px solid rgba(232,201,106,0.28)', borderRadius:14, overflow:'hidden' }}>
                {isPro && sv.photo_url ? (
                  <img src={sv.photo_url} alt={sv.name} style={{ width:'100%', height:130, objectFit:'cover', display:'block' }} />
                ) : (
                  <div style={{ width:'100%', height:100, background:'#17140f', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(201,168,76,0.12)', border:'1px solid rgba(232,201,106,0.28)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, color:primaryColor }}>
                      {getServiceIcon(sv.name)}
                    </div>
                  </div>
                )}
                <div className="service-card-body" style={{ padding:'16px 18px' }}>
                  <h4 className="service-card-title" style={{ fontSize:15, fontWeight:700, color:'#fff', margin:'0 0 4px' }}>{sv.name}</h4>
                  <p className="service-card-desc" style={{ fontSize:12, color:'#b8b2a7', margin:'0 0 8px', lineHeight:1.5 }}>{sv.description || 'Atendimento premium e acabamento perfeito.'}</p>
                  {sv.duration && <p style={{ fontSize:11, color:'#9ca3af', margin:'0 0 6px' }}>⏱ {sv.duration} min</p>}
                  <p style={{ fontSize:20, fontWeight:800, color:primaryColor, margin:0, fontFamily:"'Playfair Display',serif" }}>R$ {sv.price?.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding:'72px 32px', background:'#060503', borderTop:'1px solid rgba(232,201,106,0.14)' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:20, marginBottom:22, flexWrap:'wrap' }}>
            <div>
              <p style={{ fontSize:11, fontWeight:800, letterSpacing:3, color:primaryColor, textTransform:'uppercase', margin:'0 0 8px' }}>ÚLTIMOS TRABALHOS</p>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(26px,3.5vw,38px)', fontWeight:900, color:'#fff', margin:0 }}>Confira alguns dos nossos cortes</h2>
            </div>
            <a href="#agendar" className="gold-btn" style={{ display:'inline-flex', padding:'12px 20px', borderRadius:8, background:'transparent', border:'1px solid rgba(232,201,106,0.55)', color:primaryColor, fontSize:13, fontWeight:700, textDecoration:'none' }}>
              Ver mais trabalhos →
            </a>
          </div>
          <div className="gallery-grid">
            {galleryImages.map((image, index) => (
              <button
                type="button"
                className="gallery-item"
                key={`${image.src}-${index}`}
                onClick={() => setLightboxIndex(index)}
                style={{ padding: 0 }}
                aria-label={`Abrir foto ${index + 1}`}
              >
                <img src={image.src} alt={image.alt} />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── BARBEIROS ── */}
      {filteredBarbers.length > 0 && (
        <section id="barbeiros" style={{ padding:'80px 32px', background:'#060503', borderTop:'1px solid rgba(232,201,106,0.14)' }}>
          <div style={{ maxWidth:1100, margin:'0 auto' }}>
            <p style={{ fontSize:11, fontWeight:700, letterSpacing:3, color:primaryColor, textTransform:'uppercase', margin:'0 0 10px' }}>NOSSA EQUIPE</p>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(26px,3.5vw,38px)', fontWeight:900, color:'#fff', margin:'0 0 36px' }}>Barbeiros Profissionais</h2>
            <div className="br-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:20 }}>
              {filteredBarbers.map(b=>{
                const color = getAvatarColor(b.nome)
                return (
                  <div key={b.id} className={`br-card${selectedBarber?.id===b.id?' sel':''}`} onClick={()=>handleBarberChange(b)} style={{ background:'linear-gradient(145deg,rgba(255,255,255,0.065),rgba(255,255,255,0.025))', border:'1px solid rgba(232,201,106,0.28)', borderRadius:14, overflow:'hidden', textAlign:'center' }}>
                    {isPro && b.avatar_url ? (
                      <img src={b.avatar_url} alt={b.nome} style={{ width:'100%', height:180, objectFit:'cover', display:'block' }} />
                    ) : (
                      <div style={{ width:'100%', height:120, background:'#17140f', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <div style={{ width:70, height:70, borderRadius:'50%', background:`${color}22`, border:`3px solid ${color}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontWeight:800, color, fontFamily:"'Playfair Display',serif" }}>
                          {getInitial(b.nome)}
                        </div>
                      </div>
                    )}
                    <div style={{ padding:'16px' }}>
                      <h4 style={{ fontSize:16, fontWeight:700, color:'#fff', margin:'0 0 4px' }}>{b.nome}</h4>
                      <p style={{ fontSize:12, color:'#b8b2a7', margin:'0 0 8px' }}>Barbeiro Profissional</p>
                      <p style={{ fontSize:14, color:primaryColor, margin:0, letterSpacing:3 }}>★★★★★</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      <section style={{ padding:'72px 32px', background:'#060503', borderTop:'1px solid rgba(232,201,106,0.14)' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <p style={{ fontSize:11, fontWeight:800, letterSpacing:3, color:primaryColor, textTransform:'uppercase', margin:'0 0 8px' }}>AVALIAÇÕES</p>
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(26px,3.5vw,38px)', fontWeight:900, color:'#fff', margin:'0 0 24px' }}>O que nossos clientes dizem</h2>
          <div className="review-grid">
            {reviews.map((review, index) => (
              <article key={`${review.name}-${index}`} className="premium-card" style={{ padding:'22px' }}>
                <div style={{ color:primaryColor, letterSpacing:2, marginBottom:14 }}>
                  {'★'.repeat(Math.max(1, Math.min(5, Number(review.rating) || 5)))}
                </div>
                <p style={{ color:'#d7d0c3', fontSize:14, lineHeight:1.65, margin:'0 0 18px' }}>“{review.text}”</p>
                <p style={{ color:'#fff', fontWeight:800, margin:0 }}>— {review.name}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="sobre" style={{ padding:'72px 32px', background:'#060503', borderTop:'1px solid rgba(232,201,106,0.14)' }}>
        <div className="about-grid-premium" style={{ maxWidth:1100, margin:'0 auto' }}>
          <div>
            <p style={{ fontSize:11, fontWeight:800, letterSpacing:3, color:primaryColor, textTransform:'uppercase', margin:'0 0 8px' }}>SOBRE NÓS</p>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(28px,3.5vw,42px)', fontWeight:900, color:'#fff', margin:'0 0 18px', lineHeight:1.05 }}>{aboutTitle}</h2>
            <p style={{ color:'#d7d0c3', fontSize:15, lineHeight:1.75, margin:0 }}>{aboutText}</p>
          </div>
          <img src={aboutImage} alt={`Ambiente ${tenantName}`} style={{ width:'100%', height:250, objectFit:'cover', borderRadius:14, border:'1px solid rgba(232,201,106,0.24)', filter:'brightness(0.82)' }} />
          <div style={{ display:'grid', gap:14 }}>
            {differentials.slice(0, 4).map((item) => (
              <div key={item.title} className="premium-card" style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', color:'#f8f1df' }}>
                <span style={{ width:32, height:32, borderRadius:10, display:'grid', placeItems:'center', background:'rgba(201,168,76,0.12)', color:primaryColor }}>{item.icon || '✦'}</span>
                <div>
                  <strong style={{ display:'block' }}>{item.title}</strong>
                  {item.description && <small style={{ color:'#9f9789' }}>{item.description}</small>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding:'28px 32px 72px', background:'#060503' }}>
        <div className="stat-grid" style={{ maxWidth:1100, margin:'0 auto' }}>
          {publicStats.map(([icon, value, label]) => (
            <div key={label} className="premium-card" style={{ padding:'22px', display:'flex', alignItems:'center', gap:16 }}>
              <span style={{ width:42, height:42, borderRadius:12, display:'grid', placeItems:'center', border:'1px solid rgba(232,201,106,0.28)', background:'rgba(201,168,76,0.1)', color:primaryColor }}>{icon}</span>
              <div>
                <strong style={{ display:'block', color:primaryColor, fontSize:26, lineHeight:1 }}>{value}</strong>
                <small style={{ color:'#d7d0c3' }}>{label}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES (fundo escuro) ── */}
      <section style={{ padding:'72px 32px', background:'#1a1a1a' }}>
        <div style={{ maxWidth:960, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:32 }}>
          {[
            { icon:'📅', title:'Agendamento Online', desc:'Agende seu horário quando quiser, 24h por dia, pelo celular ou computador.' },
            { icon:'⏰', title:'Lembretes', desc:'Receba lembretes automáticos do seu agendamento via WhatsApp.' },
            { icon:'💳', title:'Pagamento Facilitado', desc:'Diversas formas de pagamento para sua comodidade.' },
          ].map(f=>(
            <div key={f.title} style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
              <div style={{ width:48, height:48, borderRadius:12, background:'rgba(201,168,76,0.1)', border:`1px solid rgba(201,168,76,0.2)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{f.icon}</div>
              <div>
                <p style={{ margin:'0 0 6px', fontSize:15, fontWeight:700, color:'#f1f5f9' }}>{f.title}</p>
                <p style={{ margin:0, fontSize:13, color:'#64748b', lineHeight:1.6 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer id="contato" style={{ background:'#111', borderTop:`3px solid ${primaryColor}`, padding:'36px 32px 20px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:20, marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {landingLogoUrl ? (
              <img src={landingLogoUrl} alt={`Logo ${tenantName}`} style={{ width:40, height:40, borderRadius:9, objectFit:'contain' }} />
            ) : (
              <div style={{ width:36, height:36, borderRadius:9, background:`linear-gradient(135deg,${primaryColor},${GOLD2})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:DARK, fontWeight:900 }}>✂</div>
            )}
            <div>
              <p style={{ margin:0, fontSize:15, fontWeight:800, color:'#f1f5f9', fontFamily:"'Playfair Display',serif", letterSpacing:1, textTransform:'uppercase' }}>{tenantName}</p>
              <p style={{ margin:0, fontSize:9, color:primaryColor, letterSpacing:2.5, textTransform:'uppercase' }}>Barbearia</p>
            </div>
          </div>
          <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
            {[['#inicio','Início'],['#servicos','Serviços'],['#barbeiros','Barbeiros'],['#agendar','Agendar']].map(([href,label])=>(
              <a key={href} href={href} style={{ color:'#64748b', textDecoration:'none', fontSize:13, transition:'color 0.2s' }}>{label}</a>
            ))}
            {landingInstagram && (
              <a href={landingInstagram.startsWith('http') ? landingInstagram : `https://instagram.com/${landingInstagram.replace('@','')}`} target="_blank" style={{ color:'#64748b', textDecoration:'none', fontSize:13 }}>Instagram</a>
            )}
          </div>
          {landingWhatsapp && (
            <a href={`https://wa.me/55${landingWhatsapp.replace(/\D/g,'')}`} target="_blank" style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px', borderRadius:8, background:'rgba(37,211,102,0.1)', border:'1px solid rgba(37,211,102,0.2)', color:'#25d366', fontSize:13, fontWeight:600, textDecoration:'none' }}>
              💬 {landingWhatsapp}
            </a>
          )}
        </div>
        <div style={{ maxWidth:1100, margin:'0 auto', paddingTop:16, borderTop:'1px solid rgba(255,255,255,0.04)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <div>
            <p style={{ color:'#334155', fontSize:12, margin:0 }}>© {new Date().getFullYear()} {tenantName} · Todos os direitos reservados</p>
            {landingAddress && <p style={{ color:'#475569', fontSize:12, margin:'5px 0 0' }}>📍 {landingAddress}</p>}
          </div>
          <div style={{ display:'flex', gap:16 }}>
            {landingWhatsapp && (
              <a href={`https://wa.me/55${landingWhatsapp.replace(/\D/g,'')}`} target="_blank" style={{ color:'#334155', textDecoration:'none', fontSize:20 }}>💬</a>
            )}
          </div>
        </div>
      </footer>

      {/* WhatsApp FAB */}
      {landingWhatsapp && (
        <a href={`https://wa.me/55${landingWhatsapp.replace(/\D/g,'')}`} target="_blank" className="gold-btn" style={{ position:'fixed', bottom:24, right:24, width:54, height:54, borderRadius:'50%', background:'#25d366', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, textDecoration:'none', boxShadow:'0 4px 24px rgba(37,211,102,0.45)', zIndex:50 }}>
          💬
        </a>
      )}
      {lightboxImage && (
        <div className="lightbox-backdrop" onClick={() => setLightboxIndex(null)}>
          <button
            type="button"
            className="lightbox-button lightbox-close"
            onClick={(event) => {
              event.stopPropagation()
              setLightboxIndex(null)
            }}
            aria-label="Fechar galeria"
          >
            ×
          </button>

          {galleryImages.length > 1 && (
            <>
              <button
                type="button"
                className="lightbox-button lightbox-prev"
                onClick={(event) => {
                  event.stopPropagation()
                  setLightboxIndex((current) => (current === null ? 0 : (current - 1 + galleryImages.length) % galleryImages.length))
                }}
                aria-label="Imagem anterior"
              >
                ‹
              </button>
              <button
                type="button"
                className="lightbox-button lightbox-next"
                onClick={(event) => {
                  event.stopPropagation()
                  setLightboxIndex((current) => (current === null ? 0 : (current + 1) % galleryImages.length))
                }}
                aria-label="Proxima imagem"
              >
                ›
              </button>
            </>
          )}

          <img
            src={lightboxImage.src}
            alt={lightboxImage.alt}
            className="lightbox-image"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
