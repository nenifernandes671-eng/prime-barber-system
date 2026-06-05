import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function statusFromAsaasEvent(event: string) {
  if (['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event)) {
    return 'active'
  }

  if (event === 'PAYMENT_OVERDUE') {
    return 'suspended'
  }

  if (
    [
      'PAYMENT_DELETED',
      'PAYMENT_REFUNDED',
      'PAYMENT_CHARGEBACK_REQUESTED',
      'PAYMENT_CHARGEBACK_DISPUTE',
      'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
    ].includes(event)
  ) {
    return 'cancelled'
  }

  return null
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

export async function POST(req: NextRequest) {
  try {
    const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN
    const receivedToken =
      req.headers.get('asaas-access-token') ||
      req.headers.get('access_token') ||
      req.nextUrl.searchParams.get('token')

    if (webhookToken && receivedToken !== webhookToken) {
      return unauthorized()
    }

    const payload = await req.json()
    const event = String(payload.event || '')
    const payment = payload.payment || {}
    const subscription = payload.subscription || {}
    const subscriptionId = payment.subscription || subscription.id || null
    const customerId = payment.customer || subscription.customer || payload.customer?.id || null
    const externalReference =
      payment.externalReference || subscription.externalReference || payload.externalReference || null

    console.log('Asaas webhook recebido:', {
      event,
      paymentId: payment.id,
      subscriptionId,
      customerId,
      externalReference,
    })

    const status = statusFromAsaasEvent(event)

    if (!status) {
      return NextResponse.json({ received: true, ignored: true })
    }

    const updatePayload: Record<string, any> = { status }

    if (subscriptionId) {
      updatePayload.asaas_subscription_id = subscriptionId
    }

    if (customerId) {
      updatePayload.asaas_customer_id = customerId
    }

    if (status === 'active') {
      updatePayload.trial_ends_at = nextAccessDate(payment)
    }

    let query = supabaseAdmin.from('tenants').update(updatePayload)

    if (customerId) {
      query = query.eq('asaas_customer_id', customerId)
    } else if (subscriptionId) {
      query = query.eq('asaas_subscription_id', subscriptionId)
    } else if (externalReference) {
      query = query.eq('slug', externalReference)
    } else {
      return NextResponse.json({
        received: true,
        ignored: true,
        reason: 'missing identifiers',
      })
    }

    const { error } = await query

    if (error) {
      console.error('Erro ao atualizar tenant via webhook Asaas:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('Asaas webhook error:', err)
    return NextResponse.json(
      { error: err.message || 'Erro no webhook Asaas.' },
      { status: 500 },
    )
  }
}
