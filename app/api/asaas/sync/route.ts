import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const DEFAULT_ASAAS_BASE_URL = 'https://api.asaas.com/v3'

function asaasBaseUrl() {
  return (process.env.ASAAS_BASE_URL || DEFAULT_ASAAS_BASE_URL).replace(/\/$/, '')
}

async function asaasGet(path: string) {
  const apiKey = process.env.ASAAS_API_KEY

  if (!apiKey) {
    throw new Error('ASAAS_API_KEY nao configurada.')
  }

  const response = await fetch(`${asaasBaseUrl()}${path}`, {
    headers: {
      access_token: apiKey,
    },
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      payload?.errors?.[0]?.description ||
      payload?.error ||
      payload?.message ||
      'Erro ao consultar pagamentos Asaas.'

    throw new Error(message)
  }

  return payload
}

function nextAccessDate(payment: any) {
  const baseDate =
    payment?.paymentDate ||
    payment?.clientPaymentDate ||
    payment?.confirmedDate ||
    payment?.dueDate

  const date = baseDate ? new Date(`${baseDate}T00:00:00`) : new Date()
  date.setMonth(date.getMonth() + 1)
  return date.toISOString()
}

function isPaid(payment: any) {
  const status = String(payment?.status || '').toUpperCase()
  return ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(status)
}

function paymentStillGrantsAccess(payment: any) {
  return new Date(nextAccessDate(payment)).getTime() > Date.now()
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

    if (!token) {
      return NextResponse.json({ error: 'Login obrigatorio.' }, { status: 401 })
    }

    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.getUser(token)

    if (sessionError || !sessionData.user) {
      return NextResponse.json({ error: 'Sessao invalida.' }, { status: 401 })
    }

    const { slug } = await req.json()
    const normalizedSlug = String(slug || '').trim().toLowerCase()

    if (!normalizedSlug) {
      return NextResponse.json({ error: 'Slug obrigatorio.' }, { status: 400 })
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, slug, asaas_customer_id')
      .eq('slug', normalizedSlug)
      .maybeSingle()

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Barbearia nao encontrada.' }, { status: 404 })
    }

    const { data: membership } = await supabaseAdmin
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', tenant.id)
      .eq('user_id', sessionData.user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'Sem acesso a esta barbearia.' }, { status: 403 })
    }

    const searches: string[] = []

    if (tenant.asaas_customer_id) {
      searches.push(`/payments?customer=${encodeURIComponent(tenant.asaas_customer_id)}&limit=20`)
    }

    searches.push(`/payments?externalReference=${encodeURIComponent(normalizedSlug)}&limit=20`)

    let paidPayment: any = null

    for (const path of searches) {
      const result = await asaasGet(path)
      const payments = Array.isArray(result?.data) ? result.data : []
      paidPayment = payments.find((payment: any) => {
        const reference = String(payment?.externalReference || '')
        const sameReference = !reference || reference === normalizedSlug
        return sameReference && isPaid(payment) && paymentStillGrantsAccess(payment)
      })

      if (paidPayment) break
    }

    if (!paidPayment) {
      return NextResponse.json({ active: false, message: 'Pagamento ainda nao confirmado no Asaas.' })
    }

    const updatePayload: Record<string, any> = {
      status: 'active',
      subscription_status: 'active',
      trial_ends_at: nextAccessDate(paidPayment),
    }

    if (paidPayment.customer) {
      updatePayload.asaas_customer_id = paidPayment.customer
    }

    if (paidPayment.subscription) {
      updatePayload.asaas_subscription_id = paidPayment.subscription
    }

    const { error: updateError } = await supabaseAdmin
      .from('tenants')
      .update(updatePayload)
      .eq('id', tenant.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ active: true })
  } catch (err: any) {
    console.error('Asaas sync error:', err)
    return NextResponse.json(
      { error: err.message || 'Erro ao sincronizar pagamento Asaas.' },
      { status: 500 },
    )
  }
}
