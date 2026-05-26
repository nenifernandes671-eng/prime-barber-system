import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function subscriptionEndDate(subscription: Stripe.Subscription | null | undefined) {
  const rawEnd = (subscription as any)?.current_period_end || (subscription as any)?.trial_end
  return rawEnd ? new Date(rawEnd * 1000).toISOString() : null
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook signature error:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { nome, email, slug, plano } = session.metadata ?? {}

    if (!nome || !email || !slug) {
      console.error('Metadata faltando no webhook')
      return NextResponse.json({ error: 'Metadata missing' }, { status: 400 })
    }

    try {
      const subscription = session.subscription
        ? await stripe.subscriptions.retrieve(session.subscription as string)
        : null
      const accessEndsAt = subscriptionEndDate(subscription)
      const tenantStatus = subscription?.status === 'trialing' ? 'trial' : 'active'
      // 1. Verifica se o tenant já existe
      const { data: existingTenant } = await supabaseAdmin
        .from('tenants').select('id').eq('slug', slug).maybeSingle()

      let tenantId = existingTenant?.id

      if (!tenantId) {
        // 2. Cria o tenant
        const { data: newTenant, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .insert({
            slug, nome, email,
            plano: plano ?? 'basic',
            status: tenantStatus,
            trial_ends_at: accessEndsAt,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
          })
          .select('id').single()

        if (tenantError) throw tenantError
        tenantId = newTenant.id
      } else {
        await supabaseAdmin.from('tenants').update({
          status: tenantStatus,
          plano: plano ?? 'basic',
          trial_ends_at: accessEndsAt,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
        }).eq('id', tenantId)
      }

      // 3. Verifica se usuário já existe
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      let existingUser = existingUsers?.users?.find(u => u.email === email)
      let userId: string | undefined

      if (existingUser) {
        // Usuário já existe — só vincula ao tenant
        userId = existingUser.id
        console.log(`👤 Usuário já existe: ${email}`)
      } else {
        // 4. Cria novo usuário
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          password: `Sys_${Date.now()}_${crypto.randomUUID()}`,
          user_metadata: { nome, slug, password_set: false },
        })

        if (authError) {
          if (authError.message.includes('already been registered')) {
            // Webhook duplicado — busca o usuário criado na chamada anterior
            const { data: retryUsers } = await supabaseAdmin.auth.admin.listUsers()
            existingUser = retryUsers?.users?.find(u => u.email === email)
            userId = existingUser?.id
          } else {
            throw authError
          }
        } else {
          userId = authUser?.user?.id
        }
      }

      if (userId) {
        // 5. Vincula usuário ao tenant
        await supabaseAdmin.from('tenant_users').upsert({
          tenant_id: tenantId,
          user_id: userId,
          role: 'admin',
        }, { onConflict: 'tenant_id,user_id' })

        // 6. Gera link — invite para novo, recovery para existente
        // Volta magiclink
const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
  type: 'magiclink',
  email,
  options: {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/set-password`,
  },
})

        if (linkError) {
          console.error('Erro ao gerar link:', linkError)
        } else {
          const magicLink = linkData?.properties?.action_link
          if (magicLink) {
            await sendWelcomeEmail({ email, nome, slug, magicLink })
          }
        }
      }

      console.log(`✅ Tenant criado/atualizado: ${slug} (${email})`)

    } catch (err: any) {
      console.error('Erro ao criar tenant:', err)
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    await supabaseAdmin.from('tenants').update({ status: 'cancelled' }).eq('stripe_subscription_id', subscription.id)
    console.log(`❌ Assinatura cancelada: ${subscription.id}`)
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription
    const stripeStatus = subscription.status
    const status = stripeStatus === 'trialing'
      ? 'trial'
      : stripeStatus === 'active'
      ? 'active'
      : stripeStatus === 'canceled'
      ? 'cancelled'
      : 'suspended'

    await supabaseAdmin
      .from('tenants')
      .update({
        status,
        trial_ends_at: subscriptionEndDate(subscription),
      })
      .eq('stripe_subscription_id', subscription.id)
  }

  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice
    const subscriptionId = (invoice as any).subscription as string | undefined

    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      await supabaseAdmin
        .from('tenants')
        .update({
          status: subscription.status === 'trialing' ? 'trial' : 'active',
          trial_ends_at: subscriptionEndDate(subscription),
        })
        .eq('stripe_subscription_id', subscription.id)
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice
    await supabaseAdmin.from('tenants').update({ status: 'suspended' }).eq('stripe_customer_id', invoice.customer as string)
    console.log(`⚠️ Pagamento falhou: ${invoice.customer}`)
  }

  return NextResponse.json({ received: true })
}

async function sendWelcomeEmail({
  email, nome, slug, magicLink
}: {
  email: string
  nome: string
  slug: string
  magicLink: string
}) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY

  if (!RESEND_API_KEY) {
    console.log(`\n🔗 LINK para ${email}:\n${magicLink}\n`)
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'NexBarber <onboarding@resend.dev>',
      to: email,
      subject: `Sua barbearia ${nome} esta pronta no NexBarber`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0a0a0a;color:#f1f5f9;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#1e3a5f,#1e2535);padding:32px 36px;text-align:center;">
            <div style="font-size:40px;margin-bottom:8px;">✂</div>
            <h1 style="margin:0;font-size:24px;color:#fff;">Bem-vindo ao NexBarber!</h1>
          </div>
          <div style="padding:32px 36px;">
            <p style="color:#94a3b8;font-size:16px;margin:0 0 24px;">Olá, <strong style="color:#f1f5f9">${nome}</strong>!</p>
            <p style="color:#94a3b8;font-size:15px;margin:0 0 24px;line-height:1.6;">
              Sua barbearia foi criada com sucesso. Clique no botão abaixo para definir sua senha e acessar o painel:
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${magicLink}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;text-decoration:none;border-radius:12px;font-size:16px;font-weight:700;box-shadow:0 4px 20px rgba(37,99,235,0.4);">
                Definir senha e entrar →
              </a>
            </div>
            <p style="color:#475569;font-size:13px;margin:0 0 8px;">
              Seu painel: <a href="${process.env.NEXT_PUBLIC_APP_URL}/${slug}/admin" style="color:#3b82f6;">${process.env.NEXT_PUBLIC_APP_URL}/${slug}/admin</a>
            </p>
            <p style="color:#334155;font-size:12px;margin:24px 0 0;">
              Este link expira em 24 horas. Se não foi você, ignore este email.
            </p>
          </div>
        </div>
      `,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Erro ao enviar email via Resend:', err)
  } else {
    console.log(`📧 Email enviado para ${email}`)
  }
}
