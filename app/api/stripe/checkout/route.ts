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

const PLANS: Record<string, string> = {
  basic:   'price_1Tb74601aYPmeBYyN3unIq5Z',
  pro:     'price_1Tb74N01aYPmeBYyN6XWcCne',
  premium: 'price_1Tb74c01aYPmeBYyw9dLWACr',
}

export async function POST(req: NextRequest) {
  try {
    const { plano, nome, email, slug } = await req.json()
    const normalizedSlug = String(slug ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    if (!plano || !email || !nome || !slug) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando.' }, { status: 400 })
    }

    if (normalizedSlug.length < 3) {
      return NextResponse.json({ error: 'O link da barbearia precisa ter pelo menos 3 caracteres.' }, { status: 400 })
    }

    const priceId = PLANS[plano]
    if (!priceId) {
      return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 })
    }

    const { data: existingTenant } = await supabaseAdmin
      .from('tenants')
      .select('email')
      .eq('slug', normalizedSlug)
      .maybeSingle()

    if (existingTenant && existingTenant.email?.toLowerCase() !== String(email).toLowerCase()) {
      return NextResponse.json({ error: 'Este link de barbearia ja esta em uso.' }, { status: 409 })
    }

    const customers = await stripe.customers.list({ email, limit: 1 })
    let customer = customers.data[0]
    if (!customer) {
      customer = await stripe.customers.create({ email, name: nome })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: 7,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/register/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      metadata: { nome, email, slug: normalizedSlug, plano },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
