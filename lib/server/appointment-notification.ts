import { createClient } from '@supabase/supabase-js'
import { enqueuePush, processPushQueue } from '@/lib/server/push'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const emailFrom = process.env.EMAIL_FROM || 'KorteBarber <noreply@kortebarber.com.br>'

type AppointmentNotificationInput = {
  id: string | number
  tenant_id: string
  client_name: string
  service: string
  barber: string
  barber_user_id?: string | null
  appointment_date: string
  appointment_time: string
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

async function sendEmail(to: string[], subject: string, html: string) {
  if (!process.env.RESEND_API_KEY || to.length === 0) {
    return { skipped: true }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: emailFrom, to, subject, html }),
  })

  if (!response.ok) {
    throw new Error(`Resend HTTP ${response.status}: ${await response.text()}`)
  }

  return response.json()
}

async function recipientEmails(tenantId: string, barberUserId?: string | null) {
  const { data: tenantUsers, error } = await supabaseAdmin
    .from('tenant_users')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .in('role', ['owner', 'admin'])

  if (error) throw error

  const userIds = [...new Set([
    ...(tenantUsers ?? []).map((item) => String(item.user_id)),
    barberUserId ? String(barberUserId) : '',
  ].filter(Boolean))]

  const emails: string[] = []
  for (const userId of userIds) {
    const result = await supabaseAdmin.auth.admin.getUserById(userId)
    if (!result.error && result.data.user?.email) emails.push(result.data.user.email)
  }
  return [...new Set(emails)]
}

export async function notifyAppointmentCreated(appointment: AppointmentNotificationInput) {
  const title = 'Novo agendamento'
  const body = `${appointment.client_name} agendou ${appointment.service} com ${appointment.barber} para ${appointment.appointment_date} as ${appointment.appointment_time}.`
  const emails = await recipientEmails(appointment.tenant_id, appointment.barber_user_id)
  const email = await sendEmail(
    emails,
    `Novo agendamento - ${appointment.client_name}`,
    `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.6">
      <h2>Novo agendamento</h2>
      <p><strong>${escapeHtml(appointment.client_name)}</strong> agendou <strong>${escapeHtml(appointment.service)}</strong>.</p>
      <p>Barbeiro: <strong>${escapeHtml(appointment.barber)}</strong><br />
      Data: <strong>${escapeHtml(appointment.appointment_date)}</strong><br />
      Horário: <strong>${escapeHtml(appointment.appointment_time)}</strong></p>
    </div>`,
  )

  const ownerUserIds = (await supabaseAdmin
    .from('tenant_users')
    .select('user_id')
    .eq('tenant_id', appointment.tenant_id)
    .in('role', ['owner', 'admin'])).data ?? []
  const userIds = [...new Set([
    appointment.barber_user_id,
    ...ownerUserIds.map((item) => String(item.user_id)),
  ].filter(Boolean).map(String))]
  const push = await enqueuePush({
    tenant_id: appointment.tenant_id,
    user_ids: userIds,
    title,
    body,
    type: 'appointment_created',
    data: { entity_id: appointment.id, route: `/agendamento/${appointment.id}` },
  })
  if (push.queued) await processPushQueue(25)

  return { email: { sent: emails.length > 0 && !email.skipped, recipients: emails.length }, push }
}

