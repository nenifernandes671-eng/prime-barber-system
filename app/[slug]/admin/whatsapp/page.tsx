'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Bell, CalendarDays, CheckCircle2, Lock, MessageCircle, Phone, Save, Send, Users, XCircle } from 'lucide-react'

type Feedback = { type: 'success' | 'error'; text: string } | null

interface Tenant {
  id: string
  plano?: string | null
}

interface Appointment {
  id: string
  client_name: string
  phone: string | null
  service: string
  appointment_date: string
  appointment_time: string
  status: string
}

interface Settings {
  id?: string
  tenant_id: string
  active: boolean
  whatsapp_number: string | null
  inactive_days: number
  cooldown_days: number
  inactive_message: string
  appointment_reminder_active: boolean
  reminder_hours_before: number
  reminder_message: string
}

interface LogRow {
  id: string
  client_name: string | null
  phone: string
  campaign_type: string
  message: string | null
  status: string
  sent_at: string
}

interface InactiveClient {
  name: string
  phone: string
  lastDate: string
  days: number
}

const defaultInactiveMessage = `Olá {{nome}} 👋

Sentimos sua falta.

Você não agenda conosco há {{dias}} dias.

Agende seu horário:
{{link_agendamento}}`

const defaultReminderMessage = `Olá {{nome}} 👋

Lembrando que você possui um horário agendado em {{data}} às {{hora}}.

Esperamos você!`

function isAllowed(plan?: string | null) {
  const p = String(plan || 'basic').toLowerCase()
  return p === 'pro' || p === 'premium'
}

function onlyNumbers(value?: string | null) {
  return String(value || '').replace(/\D/g, '')
}

function normalizePhone(phone?: string | null) {
  const n = onlyNumbers(phone)
  if (!n) return ''
  if (n.startsWith('55') && n.length >= 12) return n
  if (n.length >= 10 && n.length <= 11) return `55${n}`
  return n
}

function maskPhone(value?: string | null) {
  const n = onlyNumbers(value)
  if (!n) return ''
  if (n.length <= 2) return n
  if (n.length <= 4) return `+${n.slice(0, 2)} ${n.slice(2)}`
  if (n.length <= 6) return `+${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4)}`
  return `+${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 9)}-${n.slice(9, 13)}`
}

function fmtDate(date?: string | null) {
  if (!date) return '—'
  return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR')
}

function fmtDateTime(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR')
}

function daysSince(date: string) {
  const last = new Date(`${date}T12:00:00`).getTime()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime()
  return Math.max(0, Math.floor((today - last) / 86400000))
}

function appointmentTimeMs(a: Appointment) {
  return new Date(`${a.appointment_date}T${String(a.appointment_time || '00:00').slice(0, 5)}:00`).getTime()
}

function fillTemplate(message: string, vars: Record<string, string | number>) {
  return message
    .replaceAll('{{nome}}', String(vars.nome ?? ''))
    .replaceAll('{{dias}}', String(vars.dias ?? ''))
    .replaceAll('{{data}}', String(vars.data ?? ''))
    .replaceAll('{{hora}}', String(vars.hora ?? ''))
    .replaceAll('{{servico}}', String(vars.servico ?? ''))
    .replaceAll('{{link_agendamento}}', String(vars.link_agendamento ?? ''))
}

export default function WhatsAppPage() {
  const pathname = usePathname()
  const slug = pathname.split('/').filter(Boolean)[0]

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('id, plano')
          .eq('slug', slug)
          .maybeSingle()

        if (!tenantData) return
        setTenant(tenantData)

        const { data: settingsData } = await supabase
          .from('whatsapp_settings')
          .select('*')
          .eq('tenant_id', tenantData.id)
          .maybeSingle()

        setSettings(
          settingsData || {
            tenant_id: tenantData.id,
            active: false,
            whatsapp_number: '',
            inactive_days: 20,
            cooldown_days: 30,
            inactive_message: defaultInactiveMessage,
            appointment_reminder_active: false,
            reminder_hours_before: 24,
            reminder_message: defaultReminderMessage,
          }
        )

        const { data: appointmentRows } = await supabase
          .from('appointments')
          .select('id, client_name, phone, service, appointment_date, appointment_time, status')
          .eq('tenant_id', tenantData.id)
          .not('phone', 'is', null)
          .order('appointment_date', { ascending: false })

        setAppointments((appointmentRows || []) as Appointment[])

        const { data: logRows } = await supabase
          .from('whatsapp_logs')
          .select('*')
          .eq('tenant_id', tenantData.id)
          .order('sent_at', { ascending: false })
          .limit(10)

        setLogs((logRows || []) as LogRow[])
      } finally {
        setLoading(false)
      }
    }

    if (slug) load()
  }, [slug])

  const allowed = isAllowed(tenant?.plano)
  const bookingLink = typeof window !== 'undefined' ? `${window.location.origin}/${slug}` : `/${slug}`

  const inactiveClients = useMemo(() => {
    if (!settings) return []
    const map = new Map<string, InactiveClient>()

    appointments
      .filter((a) => a.phone && a.status !== 'cancelled')
      .forEach((a) => {
        const phone = normalizePhone(a.phone)
        if (!phone) return
        const current = map.get(phone)
        if (!current || new Date(a.appointment_date) > new Date(current.lastDate)) {
          map.set(phone, { name: a.client_name, phone, lastDate: a.appointment_date, days: daysSince(a.appointment_date) })
        }
      })

    return Array.from(map.values())
      .filter((client) => client.days >= Number(settings.inactive_days || 20))
      .sort((a, b) => b.days - a.days)
  }, [appointments, settings])

  const reminderAppointments = useMemo(() => {
    if (!settings?.appointment_reminder_active) return []
    const now = Date.now()
    const limit = now + Number(settings.reminder_hours_before || 24) * 60 * 60 * 1000

    return appointments
      .filter((a) => {
        const ms = appointmentTimeMs(a)
        return a.phone && a.status !== 'cancelled' && ms >= now && ms <= limit
      })
      .sort((a, b) => appointmentTimeMs(a) - appointmentTimeMs(b))
  }, [appointments, settings])

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function saveSettings() {
    if (!tenant?.id || !settings) return
    if (!allowed) {
      setFeedback({ type: 'error', text: 'WhatsApp disponível apenas no plano Pro ou Premium.' })
      return
    }

    setSaving(true)
    setFeedback(null)

    const payload = {
      tenant_id: tenant.id,
      active: settings.active,
      whatsapp_number: onlyNumbers(settings.whatsapp_number),
      inactive_days: Number(settings.inactive_days || 20),
      cooldown_days: Number(settings.cooldown_days || 30),
      inactive_message: settings.inactive_message || defaultInactiveMessage,
      appointment_reminder_active: settings.appointment_reminder_active,
      reminder_hours_before: Number(settings.reminder_hours_before || 24),
      reminder_message: settings.reminder_message || defaultReminderMessage,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('whatsapp_settings')
      .upsert(payload, { onConflict: 'tenant_id' })
      .select('*')
      .single()

    if (error) {
      setFeedback({ type: 'error', text: error.message })
      setSaving(false)
      return
    }

    setSettings(data as Settings)
    setFeedback({ type: 'success', text: 'Configurações salvas.' })
    setSaving(false)
  }

  async function openWhatsApp(input: { phone: string; name: string; message: string; type: string }) {
    if (!tenant?.id) return
    const phone = normalizePhone(input.phone)
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(input.message)}`
    window.open(url, '_blank')

    await supabase.from('whatsapp_logs').insert({
      tenant_id: tenant.id,
      client_name: input.name,
      phone,
      campaign_type: input.type,
      message: input.message,
      status: 'manual_opened',
      sent_at: new Date().toISOString(),
    })

    const { data } = await supabase
      .from('whatsapp_logs')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('sent_at', { ascending: false })
      .limit(10)

    setLogs((data || []) as LogRow[])
  }

  function insertVariable(variable: string, field: 'inactive_message' | 'reminder_message') {
    if (!settings) return
    update(field, `${settings[field] || ''} ${variable}`.trim())
  }

  if (loading) {
    return <div className="wa-loading"><div /><p>Carregando WhatsApp...</p><style>{css}</style></div>
  }

  if (!settings || !tenant) {
    return <div className="wa-page"><style>{css}</style><div className="empty-card">Tenant não encontrado.</div></div>
  }

  return (
    <div className="wa-page">
      <style>{css}</style>

      <header className="wa-header">
        <div>
          <p className="eyebrow">WhatsApp semi-automático</p>
          <h1>WhatsApp</h1>
          <span>O sistema encontra clientes e abre o WhatsApp com a mensagem pronta. O dono só confirma o envio.</span>
        </div>
        <button className="save-btn" onClick={saveSettings} disabled={saving || !allowed}><Save size={17} />{saving ? 'Salvando...' : 'Salvar configurações'}</button>
      </header>

      {!allowed && (
        <div className="locked-card">
          <div className="locked-icon"><Lock size={24} /></div>
          <div><strong>Disponível no plano Pro ou Premium</strong><span>Reativação de clientes e lembretes via WhatsApp.</span></div>
          <a href="/pricing">Fazer upgrade</a>
        </div>
      )}

      {feedback && <div className={`feedback ${feedback.type}`}>{feedback.type === 'success' ? <CheckCircle2 size={17} /> : <XCircle size={17} />}<p>{feedback.text}</p><button onClick={() => setFeedback(null)}>×</button></div>}

      <section className="stats-grid">
        <StatCard icon={<Users size={22} />} label="Clientes inativos" value={String(inactiveClients.length)} color="#f59e0b" />
        <StatCard icon={<Bell size={22} />} label="Lembretes pendentes" value={String(reminderAppointments.length)} color="#3b82f6" />
        <StatCard icon={<Send size={22} />} label="Abertos no WhatsApp" value={String(logs.length)} color="#22c55e" />
        <StatCard icon={<MessageCircle size={22} />} label="Modo atual" value="Manual" color="#8b5cf6" />
      </section>

      <section className="main-grid">
        <div className="premium-card settings-card">
          <div className="section-head"><div><h2>Status e número</h2><p>Número da barbearia usado como referência interna.</p></div><span className={`status-pill ${settings.active ? 'on' : 'off'}`}>{settings.active ? 'Ativo' : 'Desativado'}</span></div>
          <label className="switch-line"><span><strong>Ativar WhatsApp inteligente</strong><small>Libera botões de envio no painel.</small></span><input type="checkbox" checked={settings.active} disabled={!allowed} onChange={(e) => update('active', e.target.checked)} /></label>
          <label className="field">Número da barbearia<div className="input-icon"><Phone size={17} /><input value={settings.whatsapp_number ? maskPhone(settings.whatsapp_number) : ''} disabled={!allowed} onChange={(e) => update('whatsapp_number', onlyNumbers(e.target.value))} placeholder="+55 47 99999-9999" /></div><small>Use país + DDD + número.</small></label>
          <div className="info-box"><SmartphoneIcon /><span>Por enquanto não envia sozinho: abre o WhatsApp com texto pronto. Depois trocamos para Meta API.</span></div>
        </div>

        <div className="premium-card settings-card">
          <div className="section-head"><div><h2>Mensagem de reativação</h2><p>Para clientes que não voltam há alguns dias.</p></div></div>
          <div className="two-grid"><label className="field">Dias sem visitar<input type="number" min={1} disabled={!allowed} value={settings.inactive_days} onChange={(e) => update('inactive_days', Number(e.target.value))} /></label><label className="field">Reenviar após<input type="number" min={1} disabled={!allowed} value={settings.cooldown_days} onChange={(e) => update('cooldown_days', Number(e.target.value))} /></label></div>
          <label className="field">Mensagem<textarea disabled={!allowed} value={settings.inactive_message} onChange={(e) => update('inactive_message', e.target.value)} rows={8} /></label>
          <VariableButtons disabled={!allowed} onInsert={(v) => insertVariable(v, 'inactive_message')} />
        </div>
      </section>

      <section className="premium-card action-card">
        <div className="section-head"><div><h2>Clientes para chamar hoje</h2><p>Calculado pela última visita registrada em agendamentos.</p></div><Users size={20} /></div>
        {inactiveClients.length === 0 ? <EmptyState title="Nenhum cliente inativo" text={`Clientes com ${settings.inactive_days}+ dias sem voltar aparecerão aqui.`} /> : (
          <div className="client-list">
            {inactiveClients.map((client) => {
              const message = fillTemplate(settings.inactive_message, { nome: client.name, dias: client.days, link_agendamento: bookingLink })
              return <ClientRow key={client.phone} name={client.name} subtitle={`${maskPhone(client.phone)} · ${client.days} dias sem voltar · última visita ${fmtDate(client.lastDate)}`} disabled={!allowed || !settings.active} onClick={() => openWhatsApp({ phone: client.phone, name: client.name, message, type: 'inactive_client' })} />
            })}
          </div>
        )}
      </section>

      <section className="main-grid second">
        <div className="premium-card settings-card">
          <div className="section-head"><div><h2>Lembrete de agendamento</h2><p>Mostra clientes com horário próximo.</p></div></div>
          <label className="switch-line"><span><strong>Ativar lembretes</strong><small>Lista agendamentos próximos para chamar.</small></span><input type="checkbox" checked={settings.appointment_reminder_active} disabled={!allowed} onChange={(e) => update('appointment_reminder_active', e.target.checked)} /></label>
          <label className="field">Horas antes do horário<input type="number" min={1} disabled={!allowed} value={settings.reminder_hours_before} onChange={(e) => update('reminder_hours_before', Number(e.target.value))} /></label>
          <label className="field">Mensagem<textarea disabled={!allowed} value={settings.reminder_message} onChange={(e) => update('reminder_message', e.target.value)} rows={7} /></label>
          <VariableButtons disabled={!allowed} onInsert={(v) => insertVariable(v, 'reminder_message')} />
        </div>

        <div className="premium-card settings-card">
          <div className="section-head"><div><h2>Lembretes para enviar</h2><p>Agendamentos dentro das próximas {settings.reminder_hours_before} horas.</p></div><CalendarDays size={20} /></div>
          {!settings.appointment_reminder_active ? <EmptyState title="Lembrete desativado" text="Ative para listar horários próximos." /> : reminderAppointments.length === 0 ? <EmptyState title="Nenhum lembrete pendente" text="Agendamentos próximos aparecerão aqui." /> : (
            <div className="client-list compact">
              {reminderAppointments.map((a) => {
                const hora = String(a.appointment_time || '').slice(0, 5)
                const message = fillTemplate(settings.reminder_message, { nome: a.client_name, data: fmtDate(a.appointment_date), hora, servico: a.service, link_agendamento: bookingLink })
                return <ClientRow key={a.id} name={a.client_name} subtitle={`${fmtDate(a.appointment_date)} às ${hora} · ${a.service}`} disabled={!allowed || !settings.active} onClick={() => openWhatsApp({ phone: normalizePhone(a.phone), name: a.client_name, message, type: 'appointment_reminder' })} />
              })}
            </div>
          )}
        </div>
      </section>

      <section className="premium-card logs-card full">
        <div className="section-head"><div><h2>Histórico recente</h2><p>Registros de botões abertos no WhatsApp.</p></div></div>
        {logs.length === 0 ? <EmptyState title="Nenhum envio aberto ainda" text="Quando clicar em Enviar WhatsApp, aparecerá aqui." /> : <div className="logs-list">{logs.map((log) => <div key={log.id} className="log-row"><div className="log-icon"><MessageCircle size={17} /></div><div><strong>{log.client_name || 'Cliente'}</strong><span>{log.phone} · {log.campaign_type}</span><small>{fmtDateTime(log.sent_at)}</small></div><i>{log.status}</i></div>)}</div>}
      </section>
    </div>
  )
}

function SmartphoneIcon() {
  return <Phone size={18} />
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><MessageCircle size={42} /><strong>{title}</strong><span>{text}</span></div>
}

function ClientRow({ name, subtitle, disabled, onClick }: { name: string; subtitle: string; disabled?: boolean; onClick: () => void }) {
  return <div className="client-row"><div className="client-avatar">{name.slice(0, 2).toUpperCase()}</div><div><strong>{name}</strong><span>{subtitle}</span></div><button disabled={disabled} onClick={onClick}><MessageCircle size={15} />Enviar WhatsApp</button></div>
}

function VariableButtons({ onInsert, disabled }: { onInsert: (value: string) => void; disabled?: boolean }) {
  const variables = ['{{nome}}', '{{dias}}', '{{data}}', '{{hora}}', '{{servico}}', '{{link_agendamento}}']
  return <div className="variables">{variables.map((v) => <button key={v} type="button" disabled={disabled} onClick={() => onInsert(v)}>{v}</button>)}</div>
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return <div className="stat-card"><div className="stat-icon" style={{ color, background: `${color}18`, borderColor: `${color}35` }}>{icon}</div><span>{label}</span><strong>{value}</strong></div>
}

const css = `
.wa-page{min-height:100vh;color:#f8fafc;font-family:'Inter','DM Sans','Segoe UI',sans-serif}.wa-loading{min-height:60vh;display:grid;place-items:center;color:#94a3b8}.wa-loading div{width:36px;height:36px;border-radius:999px;border:3px solid #1e293b;border-top-color:#22c55e;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.wa-header{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:18px;padding:24px;border-radius:24px;background:radial-gradient(circle at top right,rgba(34,197,94,.18),transparent 34%),linear-gradient(135deg,rgba(15,23,42,.96),rgba(8,13,28,.88));border:1px solid rgba(148,163,184,.11)}.eyebrow{margin:0 0 6px;color:#86efac;text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:950}.wa-header h1{margin:0;font-size:38px;font-weight:950;letter-spacing:-.06em}.wa-header span{display:block;margin-top:7px;color:#94a3b8;font-size:14px}.save-btn{min-height:48px;border:0;border-radius:16px;padding:0 18px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;display:inline-flex;align-items:center;gap:8px;font-weight:950;cursor:pointer}.save-btn:disabled{opacity:.5;cursor:not-allowed}.locked-card,.feedback,.premium-card,.stat-card{background:radial-gradient(circle at top right,rgba(59,130,246,.12),transparent 32%),linear-gradient(145deg,rgba(15,23,42,.94),rgba(8,13,28,.97));border:1px solid rgba(148,163,184,.12);box-shadow:0 24px 60px rgba(0,0,0,.20)}.locked-card{margin-bottom:18px;padding:18px;border-radius:20px;display:flex;align-items:center;gap:14px}.locked-icon{width:46px;height:46px;border-radius:16px;display:grid;place-items:center;background:rgba(245,158,11,.15);color:#fbbf24;flex-shrink:0}.locked-card div:nth-child(2){flex:1}.locked-card strong{display:block;font-size:15px}.locked-card span{display:block;margin-top:4px;color:#94a3b8;font-size:13px}.locked-card a{min-height:40px;border-radius:13px;padding:0 14px;display:inline-flex;align-items:center;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#111827;text-decoration:none;font-size:13px;font-weight:950}.feedback{margin-bottom:18px;padding:13px 15px;border-radius:15px;display:flex;align-items:center;gap:10px}.feedback.success{color:#6ee7b7}.feedback.error{color:#fca5a5}.feedback p{margin:0;flex:1;font-size:13px;font-weight:800}.feedback button{border:0;background:transparent;color:inherit;cursor:pointer;font-size:22px}.stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:18px}.stat-card{min-height:128px;border-radius:22px;padding:18px}.stat-icon{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;border:1px solid;margin-bottom:12px}.stat-card span{display:block;color:#94a3b8;font-size:12px;font-weight:800}.stat-card strong{display:block;margin-top:4px;font-size:25px;font-weight:950}.main-grid{display:grid;grid-template-columns:.85fr 1.15fr;gap:16px;margin-bottom:16px}.main-grid.second{grid-template-columns:1.08fr .92fr}.premium-card{border-radius:24px}.settings-card,.logs-card,.action-card{padding:20px}.logs-card.full,.action-card{margin-bottom:16px}.section-head{display:flex;justify-content:space-between;gap:12px;margin-bottom:18px}.section-head h2{margin:0;font-size:18px;font-weight:950}.section-head p{margin:5px 0 0;color:#94a3b8;font-size:13px}.status-pill{height:30px;border-radius:999px;padding:0 10px;display:inline-flex;align-items:center;font-size:11px;font-weight:950}.status-pill.on{color:#6ee7b7;background:rgba(16,185,129,.12)}.status-pill.off{color:#fca5a5;background:rgba(239,68,68,.12)}.switch-line{margin-bottom:16px;padding:14px;border-radius:16px;background:rgba(2,6,23,.36);border:1px solid rgba(148,163,184,.10);display:flex;justify-content:space-between;gap:14px;align-items:center}.switch-line strong{display:block;font-size:14px}.switch-line small,.field small{display:block;margin-top:4px;color:#64748b;font-size:12px}.switch-line input{width:20px;height:20px;accent-color:#22c55e}.field{display:grid;gap:8px;color:#cbd5e1;font-size:13px;font-weight:850;margin-bottom:14px}.field input,.field textarea{width:100%;border-radius:14px;border:1px solid rgba(148,163,184,.14);background:rgba(2,6,23,.54);color:#f8fafc;outline:none;padding:12px 14px;font-size:14px;resize:vertical}.input-icon{position:relative}.input-icon svg{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:#64748b}.input-icon input{padding-left:42px}.two-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.info-box{padding:13px 14px;border-radius:16px;border:1px solid rgba(34,197,94,.18);background:rgba(34,197,94,.07);color:#bbf7d0;display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.45}.variables{display:flex;gap:8px;flex-wrap:wrap}.variables button{border:1px solid rgba(59,130,246,.22);background:rgba(37,99,235,.10);color:#93c5fd;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:850;cursor:pointer}.variables button:disabled{opacity:.4;cursor:not-allowed}.empty-state{min-height:230px;display:grid;place-items:center;text-align:center;color:#64748b}.empty-state svg{color:#334155}.empty-state strong{display:block;color:#cbd5e1;font-size:17px}.empty-state span{max-width:340px;color:#64748b;font-size:13px}.client-list,.logs-list{display:grid;gap:10px}.client-list.compact{max-height:520px;overflow-y:auto;padding-right:3px}.client-row{display:grid;grid-template-columns:44px 1fr auto;gap:12px;align-items:center;padding:13px;border-radius:17px;background:rgba(2,6,23,.36);border:1px solid rgba(148,163,184,.08)}.client-avatar{width:44px;height:44px;border-radius:15px;display:grid;place-items:center;background:rgba(34,197,94,.12);color:#86efac;font-size:13px;font-weight:950}.client-row strong{display:block;font-size:14px}.client-row span{display:block;margin-top:3px;color:#94a3b8;font-size:12px}.client-row button{min-height:38px;border:0;border-radius:13px;padding:0 13px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:950;cursor:pointer;white-space:nowrap}.client-row button:disabled{opacity:.45;cursor:not-allowed}.log-row{display:grid;grid-template-columns:38px 1fr auto;gap:10px;align-items:center;padding:12px;border-radius:16px;background:rgba(2,6,23,.36);border:1px solid rgba(148,163,184,.08)}.log-icon{width:38px;height:38px;border-radius:14px;display:grid;place-items:center;background:rgba(34,197,94,.12);color:#86efac}.log-row strong{display:block;font-size:13px}.log-row span{display:block;margin-top:2px;color:#94a3b8;font-size:12px}.log-row small{display:block;margin-top:2px;color:#64748b;font-size:11px}.log-row i{font-style:normal;font-size:11px;font-weight:950;color:#93c5fd}.empty-card{border-radius:20px;padding:24px;background:rgba(15,23,42,.9);border:1px solid rgba(148,163,184,.12)}@media(max-width:1100px){.stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.main-grid,.main-grid.second{grid-template-columns:1fr}.wa-header{flex-direction:column;align-items:flex-start}.save-btn{width:100%;justify-content:center}.locked-card{flex-direction:column;align-items:flex-start}.locked-card a{width:100%;justify-content:center}}@media(max-width:640px){.stats-grid,.two-grid{grid-template-columns:1fr}.wa-header h1{font-size:30px}.section-head{flex-direction:column}.client-row{grid-template-columns:44px 1fr}.client-row button{grid-column:1/-1;justify-content:center}.log-row{grid-template-columns:38px 1fr}.log-row i{grid-column:2}}
`
