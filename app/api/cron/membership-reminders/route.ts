import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const resendApiKey = process.env.RESEND_API_KEY
const emailFrom = process.env.EMAIL_FROM || 'NexBarber <noreply@nexbarber.com.br>'

const admin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

function todayYmd() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!resendApiKey) return { skipped: true }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to,
      subject,
      html,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text)
  }

  return response.json()
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!admin) {
    return NextResponse.json({ error: 'Supabase admin is not configured' }, { status: 500 })
  }

  const today = todayYmd()
  const { data, error } = await admin
    .from('memberships')
    .select('id, nome, email, telefone, vencimento, valor_pago, tenant_id, status, membership_plans(nome)')
    .eq('status', 'ativo')
    .lte('vencimento', today)
    .not('email', 'is', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const sent: string[] = []
  const failed: Array<{ id: string; error: string }> = []

  for (const member of data ?? []) {
    const email = String(member.email || '').trim()
    if (!email) continue

    const planName = (member.membership_plans as { nome?: string } | null)?.nome || 'assinatura'
    const subject = 'Sua assinatura venceu'
    const html = `
      <div style="font-family:Arial,sans-serif;background:#0b1020;color:#f8fafc;padding:28px;border-radius:16px">
        <h1 style="margin:0 0 12px;font-size:24px">Assinatura vencida</h1>
        <p style="color:#cbd5e1;line-height:1.6">Ola, ${member.nome}.</p>
        <p style="color:#cbd5e1;line-height:1.6">
          Seu plano <strong>${planName}</strong> venceu em <strong>${new Date(`${member.vencimento}T00:00:00`).toLocaleDateString('pt-BR')}</strong>.
        </p>
        <p style="color:#cbd5e1;line-height:1.6">
          Entre em contato com a barbearia para renovar sua assinatura e continuar aproveitando seus beneficios.
        </p>
      </div>
    `

    try {
      await sendEmail(email, subject, html)
      await admin.from('memberships').update({ status: 'vencido' }).eq('id', member.id)
      sent.push(member.id)
    } catch (err) {
      failed.push({ id: member.id, error: err instanceof Error ? err.message : 'Erro desconhecido' })
    }
  }

  return NextResponse.json({
    ok: true,
    checked: data?.length ?? 0,
    sent: sent.length,
    failed,
  })
}
