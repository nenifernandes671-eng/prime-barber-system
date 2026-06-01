'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import { getTenantAccess } from '@/lib/subscription-access'

interface Service { id: string; name: string; price: number; duration: number; description?: string; photo_url?: string }
interface Barber  { id: string; nome: string; avatar_url?: string }
interface Tenant  { id: string; nome: string; telefone?: string; plano?: string; hero_url?: string; status?: string; trial_ends_at?: string; opening_time?: string; closing_time?: string; slot_interval?: number }

function timeToMinutes(time?: string) {
  const [hours, minutes] = String(time || '08:00').split(':').map(Number)
  return (hours || 0) * 60 + (minutes || 0)
}

function minutesToTime(total: number) {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function generateTimes(openingTime?: string, closingTime?: string, interval?: number) {
  const start = timeToMinutes(openingTime || '08:00')
  const end = timeToMinutes(closingTime || '19:00')
  const step = Number(interval || 30)

  if (!step || step < 5 || start >= end) return []

  const times: string[] = []

  for (let current = start; current < end; current += step) {
    times.push(minutesToTime(current))
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
  corte: '✂', barba: '🪒', sobrancelha: '✨', platinado: '💈', hidratação: '💧', combo: '💈',
}
function getServiceIcon(name: string) {
  const l = name.toLowerCase()
  for (const [k, v] of Object.entries(SERVICE_ICONS)) if (l.includes(k)) return v
  return '✂'
}

export default function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)

  const [tenant, setTenant]     = useState<Tenant | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers]   = useState<Barber[]>([])
  const [bookedTimes, setBookedTimes] = useState<string[]>([])
  const [mobileNav, setMobileNav] = useState(false)
  const [showAppReturn, setShowAppReturn] = useState(false)
  const [tenantChecked, setTenantChecked] = useState(false)

  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedBarber, setSelectedBarber]   = useState<Barber | null>(null)
  const [selectedDate, setSelectedDate]       = useState('')
  const [selectedTime, setSelectedTime]       = useState('')
  const [clientName, setClientName]           = useState('')
  const [clientPhone, setClientPhone]         = useState('')
  const [submitting, setSubmitting]           = useState(false)
  const [success, setSuccess]                 = useState(false)
  const [error, setError]                     = useState('')

  const isPro = tenant?.plano === 'pro' || tenant?.plano === 'premium'
  const allTimes = generateTimes(tenant?.opening_time, tenant?.closing_time, tenant?.slot_interval)
  const availableTimes = allTimes.filter(t => !bookedTimes.includes(t))
  const heroImage = tenant?.hero_url || DEFAULT_HERO

  useEffect(() => {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    const fromApp = new URLSearchParams(window.location.search).get('from') === 'app'
    setShowAppReturn(Boolean(standalone || fromApp))
  }, [])

  useEffect(() => {
    async function load() {
      setTenantChecked(false)
      const { data: t } = await supabase.from('tenants').select('*').eq('slug', slug).maybeSingle()
      if (!t) {
        setTenant(null)
        setServices([])
        setBarbers([])
        setTenantChecked(true)
        return
      }
      setTenant(t)
      const response = await fetch(`/api/public/tenant-assets?tenant_id=${encodeURIComponent(t.id)}`)
      const assets = await response.json().catch(() => ({}))
      if (response.ok) {
        setServices(assets.services ?? [])
        setBarbers(assets.barbers ?? [])
      } else {
        const { data: sv } = await supabase.from('services').select('*').eq('tenant_id', t.id).order('price')
        const { data: br } = await supabase.from('barbeiros').select('*').eq('tenant_id', t.id).eq('ativo', true)
        setServices(sv ?? [])
        setBarbers(br ?? [])
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
    })
    const response = await fetch(`/api/public/appointments?${params.toString()}`)
    const payload = await response.json().catch(() => ({}))
    setBookedTimes(response.ok ? (payload.bookedTimes ?? []) : [])
  }

  function handleDateChange(date: string) {
    setSelectedDate(date); setSelectedTime(''); setBookedTimes([])
    if (date && selectedBarber) fetchTimes(date, selectedBarber)
  }

  function handleBarberChange(barber: Barber) {
    setSelectedBarber(barber); setSelectedTime(''); setBookedTimes([])
    if (selectedDate) fetchTimes(selectedDate, barber)
  }

  async function handleSubmit() {
    if (!clientName || !clientPhone || !selectedService || !selectedBarber || !selectedDate || !selectedTime) {
      setError('Por favor, preencha todos os campos.'); return
    }
    setSubmitting(true); setError('')
    const response = await fetch('/api/public/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: tenant!.id,
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
          <a href="/app" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 22px', borderRadius: 10, background: `linear-gradient(135deg,${GOLD},${GOLD2})`, color: DARK, textDecoration: 'none', fontWeight: 800, fontSize: 13 }}>
            Voltar para NexBarber
          </a>
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
          {[['Cliente',clientName],['Serviço',selectedService?.name],['Barbeiro',selectedBarber?.nome],['Data',new Date(selectedDate+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})],['Horário',selectedTime]].map(([l,v])=>(
            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'11px 16px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ color:'#64748b', fontSize:13 }}>{l}</span>
              <span style={{ color:'#f1f5f9', fontSize:13, fontWeight:600 }}>{v}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', padding:'11px 16px' }}>
            <span style={{ color:'#64748b', fontSize:13 }}>Valor</span>
            <span style={{ color:GOLD, fontSize:16, fontWeight:800 }}>R$ {selectedService?.price?.toFixed(2)}</span>
          </div>
        </div>
        <p style={{ color:'#94a3b8', fontSize:13, margin:'0 0 20px' }}>Até breve! 👋</p>
        <button onClick={()=>{setSuccess(false);setClientName('');setClientPhone('');setSelectedService(null);setSelectedBarber(null);setSelectedDate('');setSelectedTime('')}}
          style={{ padding:'12px 28px', borderRadius:10, border:'none', background:`linear-gradient(135deg,${GOLD},${GOLD2})`, color:DARK, fontWeight:700, fontSize:14, cursor:'pointer' }}>
          Fazer outro agendamento
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#fff', color:'#1a1a1a', fontFamily:"'Outfit','Segoe UI',sans-serif", overflowX:'hidden' }}>
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
        .book-select{width:100%;padding:13px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;color:#374151;outline:none;background:#fff;font-family:'Outfit',sans-serif;transition:border-color 0.2s;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23c9a84c' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;}
        .book-select:focus{border-color:#c9a84c;}
        .book-input{width:100%;padding:13px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;color:#374151;outline:none;background:#fff;font-family:'Outfit',sans-serif;transition:border-color 0.2s;box-sizing:border-box;}
        .book-input:focus{border-color:#c9a84c;}
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
            <div style={{ width:38, height:38, borderRadius:10, background:`linear-gradient(135deg,${GOLD},${GOLD2})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:DARK, fontWeight:900, boxShadow:`0 4px 16px rgba(201,168,76,0.3)` }}>✂</div>
            <div>
              <p style={{ margin:0, fontSize:16, fontWeight:800, color:'#f1f5f9', letterSpacing:1.5, fontFamily:"'Playfair Display',serif", textTransform:'uppercase' }}>{tenantName}</p>
              <p style={{ margin:0, fontSize:9, color:GOLD, letterSpacing:3, textTransform:'uppercase' }}>Barbearia</p>
            </div>
          </div>

          {showAppReturn && <a href="/app" className="app-return">← Voltar</a>}

          {/* Links */}
          <div className="nav-links" style={{ display:'flex', gap:32, alignItems:'center' }}>
            <a href="#inicio" className="nav-link active">Início</a>
            <a href="#servicos" className="nav-link">Serviços</a>
            <a href="#barbeiros" className="nav-link">Barbeiros</a>
            <a href="#sobre" className="nav-link">Sobre</a>
            <a href="#contato" className="nav-link">Contato</a>
          </div>

          {/* CTA */}
          <a href="#agendar" className="gold-btn" style={{ padding:'11px 24px', borderRadius:8, background:`linear-gradient(135deg,${GOLD},${GOLD2})`, color:'#fff', fontWeight:700, fontSize:14, textDecoration:'none', flexShrink:0, boxShadow:`0 4px 20px rgba(201,168,76,0.3)`, letterSpacing:0.5 }}>
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
              <span style={{ color:GOLD, fontSize:12 }}>★★★★★</span>
              <span style={{ color:'#d4c9b0', fontSize:12 }}>Referência em qualidade</span>
            </div>

            <h1 className="hero-title-txt" style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(44px,5.5vw,72px)', fontWeight:900, lineHeight:1.05, color:'#fff', margin:'0 0 20px' }}>
              Seu estilo,<br />
              <span style={{ color:GOLD, fontStyle:'italic' }}>nosso cuidado.</span>
            </h1>

            <p style={{ fontSize:17, color:'#c8bfad', lineHeight:1.7, fontWeight:300, margin:'0 0 36px', maxWidth:460 }}>
              Agende seu horário e viva a experiência {tenantName}. Profissionais especializados, ambiente premium.
            </p>

            <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:44 }}>
              <a href="#agendar" className="gold-btn" style={{ padding:'14px 30px', borderRadius:9, background:`linear-gradient(135deg,${GOLD},${GOLD2})`, color:'#fff', fontWeight:700, fontSize:15, textDecoration:'none', boxShadow:`0 6px 24px rgba(201,168,76,0.35)`, display:'flex', alignItems:'center', gap:8 }}>
                📅 Agendar Horário
              </a>
              <a href="#servicos" style={{ padding:'14px 30px', borderRadius:9, border:'1px solid rgba(255,255,255,0.25)', color:'#fff', fontSize:15, textDecoration:'none', background:'rgba(255,255,255,0.05)', fontWeight:500, backdropFilter:'blur(8px)' }}>
                Nossos Serviços
              </a>
            </div>

            {/* Stats */}
            <div className="hero-stat-row" style={{ display:'flex', gap:28, paddingTop:20, borderTop:'1px solid rgba(255,255,255,0.1)' }}>
              {[['✂','Profissionais','Especializados'],['⭐','Produtos','Premium'],['🛡','Ambiente','Exclusivo']].map(([icon,t1,t2])=>(
                <div key={t1} style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:20 }}>{icon}</span>
                  <div>
                    <p style={{ margin:0, fontSize:13, fontWeight:700, color:GOLD, letterSpacing:0.3 }}>{t1}</p>
                    <p style={{ margin:0, fontSize:11, color:'#8a7d68' }}>{t2}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── BOOKING CARD ── */}
          <div id="agendar" className="booking-float" style={{ background:'#fff', borderRadius:16, width:380, flexShrink:0, boxShadow:'0 32px 80px rgba(0,0,0,0.5)', overflow:'hidden' }}>
            <div style={{ padding:'22px 26px 18px', borderBottom:'3px solid #f0e8d0' }}>
              <h3 style={{ fontSize:20, fontWeight:800, color:'#1a1a1a', margin:'0 0 4px', fontFamily:"'Playfair Display',serif" }}>Agende seu horário</h3>
              <p style={{ fontSize:13, color:'#9ca3af', margin:0 }}>Rápido, fácil e online</p>
              <p style={{ fontSize:12, color:'#b8973a', margin:'8px 0 0', fontWeight:700 }}>Funcionamento: {tenant?.opening_time || '08:00'} às {tenant?.closing_time || '19:00'}</p>
            </div>

            <div style={{ padding:'20px 26px', display:'flex', flexDirection:'column', gap:13 }}>
              {/* Serviço */}
              <div>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:'#6b7280', marginBottom:7, letterSpacing:0.3 }}>
                  <span style={{ color:GOLD }}>✂</span> Selecione o serviço
                </label>
                <select className="book-select" value={selectedService?.id??''} onChange={e=>setSelectedService(services.find(s=>s.id===e.target.value)??null)}>
                  <option value="">Escolha um serviço</option>
                  {services.map(s=><option key={s.id} value={s.id}>{s.name} — R$ {s.price?.toFixed(2)}</option>)}
                </select>
              </div>

              {/* Barbeiro */}
              <div>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:'#6b7280', marginBottom:7, letterSpacing:0.3 }}>
                  <span style={{ color:GOLD }}>👤</span> Selecione o barbeiro
                </label>
                <select className="book-select" value={selectedBarber?.id??''} onChange={e=>{const b=barbers.find(x=>x.id===e.target.value);if(b)handleBarberChange(b)}}>
                  <option value="">Escolha um barbeiro</option>
                  {barbers.map(b=><option key={b.id} value={b.id}>{b.nome}</option>)}
                </select>
              </div>

              {/* Data */}
              <div>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:'#6b7280', marginBottom:7, letterSpacing:0.3 }}>
                  <span style={{ color:GOLD }}>📅</span> Selecione a data
                </label>
                <input type="date" className="book-input" value={selectedDate} min={todayStr} onChange={e=>handleDateChange(e.target.value)} style={{ color: selectedDate?'#374151':'#9ca3af' }} />
              </div>

              {/* Horário */}
              <div>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:'#6b7280', marginBottom:7, letterSpacing:0.3 }}>
                  <span style={{ color:GOLD }}>🕐</span> Selecione o horário
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
                  <div style={{ padding:'11px 14px', border:'1.5px solid #e5e7eb', borderRadius:10, color:'#c4c4c4', fontSize:14 }}>
                    Selecione barbeiro e data
                  </div>
                )}
              </div>

              {/* Nome e phone — aparecem após selecionar horário */}
              {selectedTime && (
                <>
                  <div>
                    <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#6b7280', marginBottom:7 }}>👤 Seu nome</label>
                    <input className="book-input" placeholder="Nome completo" value={clientName} onChange={e=>setClientName(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#6b7280', marginBottom:7 }}>📱 WhatsApp</label>
                    <input className="book-input" placeholder="(47) 99999-9999" value={clientPhone} onChange={e=>setClientPhone(e.target.value)} />
                  </div>
                </>
              )}

              {error && <p style={{ color:'#ef4444', fontSize:13, margin:0 }}>{error}</p>}

              <button className="gold-btn" onClick={handleSubmit} disabled={submitting||!selectedService||!selectedBarber||!selectedDate||!selectedTime||!clientName||!clientPhone}
                style={{ padding:'14px', borderRadius:10, border:'none', background:`linear-gradient(135deg,${GOLD},${GOLD2})`, color:'#fff', fontSize:15, fontWeight:700, width:'100%', boxShadow:`0 4px 20px rgba(201,168,76,0.3)`, marginTop:2, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
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
      <div className="trust-bar" style={{ background:'#1a1a1a', padding:'20px 32px', display:'flex', justifyContent:'center', gap:40, flexWrap:'wrap', borderBottom:`3px solid ${GOLD}` }}>
        {[['✂','Profissionais Especializados'],['⭐','Produtos Premium'],['🛡','Ambiente Exclusivo'],['⚡','Atendimento Rápido']].map(([icon,text])=>(
          <div key={text} style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:18 }}>{icon}</span>
            <span style={{ color:'#94a3b8', fontSize:13, fontWeight:500 }}>{text}</span>
          </div>
        ))}
      </div>

      {/* ── SERVIÇOS (fundo claro) ── */}
      <section id="servicos" style={{ padding:'80px 32px', background:'#f8f4ee' }}>
        <div className="services-layout" style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'260px 1fr', gap:60, alignItems:'start' }}>
          <div className="services-copy">
            <p style={{ fontSize:11, fontWeight:700, letterSpacing:3, color:GOLD, textTransform:'uppercase', margin:'0 0 12px' }}>NOSSOS SERVIÇOS</p>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(26px,3.5vw,38px)', fontWeight:900, color:'#1a1a1a', lineHeight:1.2, margin:'0 0 20px' }}>Escolha o serviço ideal para você</h2>
            <a href="#agendar" className="gold-btn" style={{ display:'inline-block', padding:'12px 24px', borderRadius:8, background:'transparent', border:`1.5px solid #1a1a1a`, color:'#1a1a1a', fontSize:13, fontWeight:600, textDecoration:'none', letterSpacing:0.3 }}>
              Ver todos os serviços →
            </a>
          </div>
          <div className="sv-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:18 }}>
            {services.length === 0 ? (
              <p style={{ color:'#9ca3af', gridColumn:'span 4' }}>Nenhum serviço cadastrado.</p>
            ) : services.map(sv=>(
              <div key={sv.id} className={`sv-card${selectedService?.id===sv.id?' sel':''}`} onClick={()=>setSelectedService(sv)} style={{ background:'#fff', borderRadius:14, overflow:'hidden' }}>
                {isPro && sv.photo_url ? (
                  <img src={sv.photo_url} alt={sv.name} style={{ width:'100%', height:130, objectFit:'cover', display:'block' }} />
                ) : (
                  <div style={{ width:'100%', height:100, background:'#f0ebe0', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <div style={{ width:56, height:56, borderRadius:'50%', background:'#1a1a1a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, color:'#fff' }}>
                      {getServiceIcon(sv.name)}
                    </div>
                  </div>
                )}
                <div className="service-card-body" style={{ padding:'16px 18px' }}>
                  <h4 className="service-card-title" style={{ fontSize:15, fontWeight:700, color:'#1a1a1a', margin:'0 0 4px' }}>{sv.name}</h4>
                  <p className="service-card-desc" style={{ fontSize:12, color:'#6b7280', margin:'0 0 8px', lineHeight:1.5 }}>{sv.description || 'Atendimento premium e acabamento perfeito.'}</p>
                  {sv.duration && <p style={{ fontSize:11, color:'#9ca3af', margin:'0 0 6px' }}>⏱ {sv.duration} min</p>}
                  <p style={{ fontSize:20, fontWeight:800, color:GOLD, margin:0, fontFamily:"'Playfair Display',serif" }}>R$ {sv.price?.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BARBEIROS ── */}
      {barbers.length > 0 && (
        <section id="barbeiros" style={{ padding:'80px 32px', background:'#fff' }}>
          <div style={{ maxWidth:1100, margin:'0 auto' }}>
            <p style={{ fontSize:11, fontWeight:700, letterSpacing:3, color:GOLD, textTransform:'uppercase', margin:'0 0 10px' }}>NOSSA EQUIPE</p>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(26px,3.5vw,38px)', fontWeight:900, color:'#1a1a1a', margin:'0 0 36px' }}>Barbeiros Profissionais</h2>
            <div className="br-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:20 }}>
              {barbers.map(b=>{
                const color = getAvatarColor(b.nome)
                return (
                  <div key={b.id} className={`br-card${selectedBarber?.id===b.id?' sel':''}`} onClick={()=>handleBarberChange(b)} style={{ background:'#f8f4ee', borderRadius:14, overflow:'hidden', textAlign:'center' }}>
                    {isPro && b.avatar_url ? (
                      <img src={b.avatar_url} alt={b.nome} style={{ width:'100%', height:180, objectFit:'cover', display:'block' }} />
                    ) : (
                      <div style={{ width:'100%', height:120, background:'#ede8de', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <div style={{ width:70, height:70, borderRadius:'50%', background:`${color}22`, border:`3px solid ${color}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontWeight:800, color, fontFamily:"'Playfair Display',serif" }}>
                          {getInitial(b.nome)}
                        </div>
                      </div>
                    )}
                    <div style={{ padding:'16px' }}>
                      <h4 style={{ fontSize:16, fontWeight:700, color:'#1a1a1a', margin:'0 0 4px' }}>{b.nome}</h4>
                      <p style={{ fontSize:12, color:'#6b7280', margin:'0 0 8px' }}>Barbeiro Profissional</p>
                      <p style={{ fontSize:14, color:GOLD, margin:0, letterSpacing:3 }}>★★★★★</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── FEATURES (fundo escuro) ── */}
      <section id="sobre" style={{ padding:'72px 32px', background:'#1a1a1a' }}>
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
      <footer id="contato" style={{ background:'#111', borderTop:`3px solid ${GOLD}`, padding:'36px 32px 20px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:20, marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:9, background:`linear-gradient(135deg,${GOLD},${GOLD2})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:DARK, fontWeight:900 }}>✂</div>
            <div>
              <p style={{ margin:0, fontSize:15, fontWeight:800, color:'#f1f5f9', fontFamily:"'Playfair Display',serif", letterSpacing:1, textTransform:'uppercase' }}>{tenantName}</p>
              <p style={{ margin:0, fontSize:9, color:GOLD, letterSpacing:2.5, textTransform:'uppercase' }}>Barbearia</p>
            </div>
          </div>
          <div style={{ display:'flex', gap:24 }}>
            {[['#inicio','Início'],['#servicos','Serviços'],['#barbeiros','Barbeiros'],['#agendar','Agendar']].map(([href,label])=>(
              <a key={href} href={href} style={{ color:'#64748b', textDecoration:'none', fontSize:13, transition:'color 0.2s' }}>{label}</a>
            ))}
          </div>
          {tenant?.telefone && (
            <a href={`https://wa.me/55${tenant.telefone.replace(/\D/g,'')}`} target="_blank" style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px', borderRadius:8, background:'rgba(37,211,102,0.1)', border:'1px solid rgba(37,211,102,0.2)', color:'#25d366', fontSize:13, fontWeight:600, textDecoration:'none' }}>
              💬 {tenant.telefone}
            </a>
          )}
        </div>
        <div style={{ maxWidth:1100, margin:'0 auto', paddingTop:16, borderTop:'1px solid rgba(255,255,255,0.04)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <p style={{ color:'#334155', fontSize:12, margin:0 }}>© {new Date().getFullYear()} {tenantName} · Todos os direitos reservados</p>
          <div style={{ display:'flex', gap:16 }}>
            {tenant?.telefone && (
              <a href={`https://wa.me/55${tenant.telefone.replace(/\D/g,'')}`} target="_blank" style={{ color:'#334155', textDecoration:'none', fontSize:20 }}>💬</a>
            )}
          </div>
        </div>
      </footer>

      {/* WhatsApp FAB */}
      {tenant?.telefone && (
        <a href={`https://wa.me/55${tenant.telefone.replace(/\D/g,'')}`} target="_blank" className="gold-btn" style={{ position:'fixed', bottom:24, right:24, width:54, height:54, borderRadius:'50%', background:'#25d366', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, textDecoration:'none', boxShadow:'0 4px 24px rgba(37,211,102,0.45)', zIndex:50 }}>
          💬
        </a>
      )}
    </div>
  )
}
