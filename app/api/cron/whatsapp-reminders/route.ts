import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantAccess } from '@/lib/subscription-access'
import { normalizeBrazilPhone, sendWhatsAppTemplate } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface AppointmentReminder {
  id: string
  tenant_id: string
  client_name: string
  phone: string | null
  service: string
  barber: string
  appointment_date: string
  appointment_time: string
  status: string
}

interface ReminderTenant {
  id: string
  plano: string | null
  status: string | null
  trial_ends_at: string | null
}

function saoPauloDate(daysToAdd = 0) {
  const date = new Date()
  date.setDate(date.getDate() + daysToAdd)

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function appointmentDateTime(date: string, time: string) {
  return new Date(`${date}T${String(time).slice(0, 5)}:00-03:00`)
}

function formatReminderDate(date: string) {
  return new Date(`${date}T12:00:00-03:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')

  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = saoPauloDate(0)
  const tomorrow = saoPauloDate(1)

  const { data, error } = await supabaseAdmin
    .from('appointments')
    .select('id, tenant_id, client_name, phone, service, barber, appointment_date, appointment_time, status')
    .in('status', ['scheduled', 'confirmed', 'pending'])
    .is('whatsapp_reminder_sent_at', null)
    .gte('appointment_date', today)
    .lte('appointment_date', tomorrow)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const appointments = (data ?? []) as AppointmentReminder[]
  const tenantIds = [...new Set(appointments.map((appointment) => appointment.tenant_id))]
  const { data: tenants, error: tenantsError } = await supabaseAdmin
    .from('tenants')
    .select('id, plano, status, trial_ends_at')
    .in('id', tenantIds)

  if (tenantsError) {
    return NextResponse.json({ error: tenantsError.message }, { status: 500 })
  }

  const tenantsById = new Map((tenants ?? []).map((tenant: ReminderTenant) => [tenant.id, tenant]))
  const now = Date.now()
  const minMs = now + 45 * 60 * 1000
  const maxMs = now + 75 * 60 * 1000
  const templateName = process.env.WHATSAPP_REMINDER_TEMPLATE || 'appointment_reminder'
  const candidates = appointments.filter((appointment) => {
    const tenant = tenantsById.get(appointment.tenant_id)
    const hasReminderFeature = tenant?.plano === 'pro' || tenant?.plano === 'premium'
    const hasAccess = getTenantAccess(tenant).allowed
    const appointmentMs = appointmentDateTime(appointment.appointment_date, appointment.appointment_time).getTime()

    return hasReminderFeature && hasAccess && appointmentMs >= minMs && appointmentMs <= maxMs
  })

  const results = []

  for (const appointment of candidates) {
    const to = normalizeBrazilPhone(appointment.phone)

    if (!to) {
      const message = 'Telefone invalido para WhatsApp.'
      await supabaseAdmin
        .from('appointments')
        .update({ whatsapp_reminder_error: message })
        .eq('id', appointment.id)
        .eq('tenant_id', appointment.tenant_id)

      results.push({ id: appointment.id, sent: false, error: message })
      continue
    }

    try {
      await sendWhatsAppTemplate({
        to,
        templateName,
        params: [
          { type: 'text', text: appointment.client_name },
          { type: 'text', text: formatReminderDate(appointment.appointment_date) },
          { type: 'text', text: String(appointment.appointment_time).slice(0, 5) },
          { type: 'text', text: appointment.barber },
          { type: 'text', text: appointment.service },
        ],
      })

      await supabaseAdmin
        .from('appointments')
        .update({
          whatsapp_reminder_sent_at: new Date().toISOString(),
          whatsapp_reminder_error: null,
        })
        .eq('id', appointment.id)
        .eq('tenant_id', appointment.tenant_id)

      results.push({ id: appointment.id, sent: true })
    } catch (err: any) {
      const message = err?.message || 'Erro ao enviar WhatsApp.'
      await supabaseAdmin
        .from('appointments')
        .update({ whatsapp_reminder_error: message })
        .eq('id', appointment.id)
        .eq('tenant_id', appointment.tenant_id)

      results.push({ id: appointment.id, sent: false, error: message })
    }
  }

  return NextResponse.json({
    checked: appointments.length,
    proOrPremiumCandidates: candidates.length,
    results,
  })
}
