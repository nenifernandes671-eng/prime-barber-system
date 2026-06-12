import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const DEFAULT_APP_URL = 'https://kortebarber.com.br'
const DEFAULT_ASAAS_BASE_URL = 'https://api.asaas.com/v3'
const noStoreHeaders = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
}

export const dynamic = 'force-dynamic'

function planPrices() {
  return {
    basic: Number(process.env.ASAAS_PLAN_BASIC || 39),
    pro: Number(process.env.ASAAS_PLAN_PRO || 69),
    premium: Number(process.env.ASAAS_PLAN_PREMIUM || 189),
  }
}

function asaasBaseUrl() {
  return (process.env.ASAAS_BASE_URL || DEFAULT_ASAAS_BASE_URL).replace(/\/$/, '')
}

function appBaseUrl(req: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL

  try {
    const url = new URL(configured)
    if (url.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
      return configured.replace(/\/$/, '')
    }
  } catch {
    // Production falls back to the canonical public URL.
  }

  const requestOrigin = req.nextUrl.origin
  return requestOrigin.startsWith('https://')
    ? requestOrigin.replace(/\/$/, '')
    : DEFAULT_APP_URL
}

async function asaasRequest(path: string, init: RequestInit = {}) {
  const apiKey = process.env.ASAAS_API_KEY

  if (!apiKey) {
    throw new Error('ASAAS_API_KEY nao configurada.')
  }

  const response = await fetch(`${asaasBaseUrl()}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
      ...(init.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      payload?.errors?.[0]?.description ||
      payload?.error ||
      payload?.message ||
      'Erro ao gerar renovacao no Asaas.'
    throw new Error(message)
  }

  return payload
}

async function resolveCustomer(tenant: any) {
  if (tenant.asaas_customer_id) {
    return tenant.asaas_customer_id
  }

  const search = await asaasRequest(
    `/customers?email=${encodeURIComponent(tenant.email)}&limit=1`,
  )
  const existingCustomer = Array.isArray(search?.data) ? search.data[0] : null

  if (existingCustomer?.id) {
    return existingCustomer.id
  }

  const customer = await asaasRequest('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: tenant.nome,
      email: tenant.email,
      mobilePhone: tenant.telefone || undefined,
      externalReference: tenant.slug,
    }),
  })

  if (!customer?.id) {
    throw new Error('Asaas nao retornou o cliente da renovacao.')
  }

  return customer.id
}

async function resolveFirstPayment(subscriptionId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const payments = await asaasRequest(
      `/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=1`,
    )
    const payment = Array.isArray(payments?.data) ? payments.data[0] : null

    if (payment) {
      return payment
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  return null
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

    if (!token) {
      return NextResponse.json(
        { error: 'Login obrigatorio.' },
        { status: 401, headers: noStoreHeaders },
      )
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'Sessao invalida.' },
        { status: 401, headers: noStoreHeaders },
      )
    }

    const body = await req.json().catch(() => ({}))
    const slug = String(body.slug || '').trim().toLowerCase()

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug obrigatorio.' },
        { status: 400, headers: noStoreHeaders },
      )
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id,slug,nome,email,telefone,plano,asaas_customer_id')
      .eq('slug', slug)
      .maybeSingle()

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: 'Barbearia nao encontrada.' },
        { status: 404, headers: noStoreHeaders },
      )
    }

    const { data: membership } = await supabaseAdmin
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', tenant.id)
      .eq('user_id', authData.user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json(
        { error: 'Sem acesso a esta barbearia.' },
        { status: 403, headers: noStoreHeaders },
      )
    }

    const plan = String(tenant.plano || '').toLowerCase() as keyof ReturnType<typeof planPrices>
    const value = planPrices()[plan]

    if (!value || !['basic', 'pro', 'premium'].includes(plan)) {
      return NextResponse.json(
        { error: 'O plano atual do tenant e invalido.' },
        { status: 400, headers: noStoreHeaders },
      )
    }

    const customerId = await resolveCustomer(tenant)
    const appUrl = appBaseUrl(req)
    const subscription = await asaasRequest('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        customer: customerId,
        billingType: 'UNDEFINED',
        value,
        cycle: 'MONTHLY',
        nextDueDate: new Date().toISOString().slice(0, 10),
        description: `Renovacao mensal do plano KorteBarber ${plan.toUpperCase()}`,
        externalReference: tenant.slug,
        callback: {
          successUrl: `${appUrl}/register/success?slug=${encodeURIComponent(tenant.slug)}`,
          autoRedirect: true,
        },
      }),
    })

    const subscriptionId = subscription?.id || null

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Asaas nao retornou a assinatura da renovacao.' },
        { status: 502, headers: noStoreHeaders },
      )
    }

    const { error: updateError } = await supabaseAdmin
      .from('tenants')
      .update({
        asaas_customer_id: customerId,
        asaas_subscription_id: subscriptionId,
      })
      .eq('id', tenant.id)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500, headers: noStoreHeaders },
      )
    }

    const payment = await resolveFirstPayment(subscriptionId)
    const paymentUrl =
      payment?.invoiceUrl ||
      payment?.bankSlipUrl ||
      payment?.transactionReceiptUrl ||
      null

    if (!paymentUrl) {
      return NextResponse.json(
        { error: 'Asaas criou a assinatura, mas nao retornou a URL da primeira cobranca.' },
        { status: 502, headers: noStoreHeaders },
      )
    }

    return NextResponse.json(
      { url: paymentUrl, plan, value },
      { headers: noStoreHeaders },
    )
  } catch (error: any) {
    console.error('Asaas renewal error:', error)
    return NextResponse.json(
      { error: error?.message || 'Erro ao iniciar renovacao.' },
      { status: 500, headers: noStoreHeaders },
    )
  }
}
