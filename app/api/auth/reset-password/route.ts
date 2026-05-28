import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function resolveAppUrl(req: NextRequest) {
  const forwardedHost = req.headers.get('x-forwarded-host')
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https'
  const host = forwardedHost || req.headers.get('host')
  const requestOrigin = host ? `${forwardedProto}://${host}` : new URL(req.url).origin
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL

  if (requestOrigin && !requestOrigin.includes('localhost')) {
    return requestOrigin
  }

  if (configuredAppUrl && !configuredAppUrl.includes('localhost')) {
    return configuredAppUrl
  }

  return 'https://www.nexbarber.com.br'
}

export async function POST(req: NextRequest) {
  try {
    const { email, slug } = await req.json()
    const cleanEmail = String(email ?? '').trim().toLowerCase()
    const cleanSlug = String(slug ?? '').trim().toLowerCase()

    if (!cleanEmail || !cleanSlug) {
      return NextResponse.json({ error: 'E-mail e barbearia sao obrigatorios.' }, { status: 400 })
    }

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('nome, slug, email')
      .eq('slug', cleanSlug)
      .maybeSingle()

    // Always return a neutral success to avoid revealing account ownership.
    if (!tenant || tenant.email?.toLowerCase() !== cleanEmail) {
      return NextResponse.json({ ok: true })
    }

    const appUrl = resolveAppUrl(req)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: cleanEmail,
      options: {
        redirectTo: `${appUrl}/set-password`,
      },
    })

    if (linkError) {
      console.error('Erro ao gerar link de redefinicao:', linkError)
      return NextResponse.json({ error: 'Nao foi possivel gerar o link de redefinicao.' }, { status: 500 })
    }

    const resetLink = linkData?.properties?.action_link
    if (!resetLink) {
      return NextResponse.json({ error: 'Link de redefinicao nao foi gerado.' }, { status: 500 })
    }

    await sendResetEmail({
      email: cleanEmail,
      nome: tenant.nome || tenant.slug,
      resetLink,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Reset password error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao enviar redefinicao.' }, { status: 500 })
  }
}

async function sendResetEmail({
  email,
  nome,
  resetLink,
}: {
  email: string
  nome: string
  resetLink: string
}) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY

  if (!RESEND_API_KEY) {
    console.log(`\nLINK de redefinicao para ${email}:\n${resetLink}\n`)
    return
  }

  const safeName = escapeHtml(nome)
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'NexBarber <onboarding@resend.dev>',
      to: email,
      subject: 'Redefina sua senha no NexBarber',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#07101f;color:#f8fafc;border-radius:18px;overflow:hidden;">
          <div style="padding:30px 34px;background:linear-gradient(135deg,#0f172a,#111827);border-bottom:1px solid rgba(255,255,255,0.08);">
            <p style="margin:0 0 10px;color:#e0b84a;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:700;">NexBarber</p>
            <h1 style="margin:0;color:#ffffff;font-size:26px;">Redefinir senha</h1>
          </div>
          <div style="padding:30px 34px;">
            <p style="margin:0 0 16px;color:#cbd5e1;font-size:16px;">Ola, <strong style="color:#fff">${safeName}</strong>.</p>
            <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
              Recebemos uma solicitacao para redefinir a senha do painel admin da sua barbearia.
            </p>
            <a href="${resetLink}" style="display:inline-block;background:#e0b84a;color:#050816;text-decoration:none;border-radius:12px;padding:14px 22px;font-weight:800;font-size:15px;">
              Criar nova senha
            </a>
            <p style="margin:24px 0 0;color:#64748b;font-size:12px;line-height:1.6;">
              Se voce nao pediu essa alteracao, ignore este e-mail.
            </p>
          </div>
        </div>
      `,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Erro ao enviar reset via Resend:', err)
    throw new Error('Falha ao enviar e-mail de redefinicao.')
  }
}
