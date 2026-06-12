import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function saasSubscriptionStatusFromEvent(event: string) {
  if (['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event)) {
    return 'active'
  }

  if (event === 'PAYMENT_OVERDUE') {
    return 'overdue'
  }

  if (event === 'PAYMENT_CREATED') {
    return 'pending'
  }

  if (
    [
      'SUBSCRIPTION_DELETED',
      'SUBSCRIPTION_INACTIVATED',
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

function dateOnly(value?: string | null) {
  if (!value) return null
  return String(value).slice(0, 10)
}

function addDaysYmd(value: string, days: number) {
  const date = new Date(`${value}T12:00:00-03:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function membershipIdFromReference(reference?: string | null) {
  const match = String(reference ?? '').match(/^membership:([0-9a-f-]{36})$/i)
  return match?.[1] ?? null
}

function isMembershipReference(reference?: string | null) {
  return /^membership(?:-customer)?:/i.test(String(reference ?? ''))
}

function isMissingMembershipAutomationTable(error: any) {
  const message = String(error?.message ?? '').toLowerCase()
  return (
    ['42P01', 'PGRST205'].includes(String(error?.code ?? '')) ||
    ((message.includes('membership_subscriptions') ||
      message.includes('membership_payments')) &&
      (message.includes('schema cache') || message.includes('does not exist')))
  )
}

async function findMembershipSubscription(
  subscriptionId?: string | null,
  externalReference?: string | null,
) {
  const referenceId = membershipIdFromReference(externalReference)

  if (referenceId) {
    const { data, error } = await supabaseAdmin
      .from('membership_subscriptions')
      .select('*')
      .eq('id', referenceId)
      .maybeSingle()
    if (error) {
      if (isMissingMembershipAutomationTable(error)) return null
      throw error
    }
    if (data) return data
  }

  if (subscriptionId) {
    const { data, error } = await supabaseAdmin
      .from('membership_subscriptions')
      .select('*')
      .eq('asaas_subscription_id', subscriptionId)
      .maybeSingle()
    if (error) {
      if (isMissingMembershipAutomationTable(error)) return null
      throw error
    }
    if (data) return data
  }

  return null
}

async function findSaasTenant(
  subscriptionId?: string | null,
  externalReference?: string | null,
) {
  if (isMembershipReference(externalReference)) return null

  if (externalReference) {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('id, asaas_customer_id, asaas_subscription_id')
      .eq('slug', externalReference)
      .maybeSingle()

    if (error) throw error
    if (data) return data
  }

  if (subscriptionId) {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('id, asaas_customer_id, asaas_subscription_id')
      .eq('asaas_subscription_id', subscriptionId)
      .maybeSingle()

    if (error) throw error
    if (data) return data
  }

  return null
}

async function processMembershipEvent({
  event,
  payment,
  subscriptionId,
  customerId,
  externalReference,
}: {
  event: string
  payment: any
  subscriptionId?: string | null
  customerId?: string | null
  externalReference?: string | null
}) {
  let membershipSubscription
  try {
    membershipSubscription = await findMembershipSubscription(
      subscriptionId,
      externalReference,
    )
  } catch (error: any) {
    if (isMissingMembershipAutomationTable(error)) return false
    throw error
  }

  if (!membershipSubscription) return false
  if (membershipSubscription.billing_mode === 'manual') return false

  const paymentId = payment?.id ? String(payment.id) : null
  const dueDate = dateOnly(payment?.dueDate)
  const amount = Number(payment?.value ?? payment?.netValue ?? membershipSubscription.value ?? 0)
  let paymentAlreadyPaid = false

  if (paymentId) {
    const { data: existingPayment, error: existingPaymentError } = await supabaseAdmin
      .from('membership_payments')
      .select('status')
      .eq('asaas_payment_id', paymentId)
      .maybeSingle()

    if (existingPaymentError) throw existingPaymentError
    paymentAlreadyPaid = existingPayment?.status === 'paid'

    const paymentStatus =
      ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event)
        ? 'paid'
        : event === 'PAYMENT_OVERDUE'
          ? 'overdue'
          : event.replace(/^PAYMENT_/, '').toLowerCase()

    const { error: paymentError } = await supabaseAdmin
      .from('membership_payments')
      .upsert(
        {
          tenant_id: membershipSubscription.tenant_id,
          subscription_id: membershipSubscription.id,
          asaas_payment_id: paymentId,
          amount,
          status: paymentStatus,
          due_date: dueDate,
          paid_at: ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event)
            ? new Date().toISOString()
            : null,
        },
        { onConflict: 'asaas_payment_id' },
      )

    if (paymentError) throw paymentError
  }

  if (['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event)) {
    if (paymentAlreadyPaid) {
      return true
    }

    const paymentBase =
      dateOnly(payment?.paymentDate) ||
      dateOnly(payment?.clientPaymentDate) ||
      dateOnly(payment?.confirmedDate) ||
      dueDate ||
      new Date().toISOString().slice(0, 10)
    const currentPaidUntil = dateOnly(membershipSubscription.paid_until)
    const baseDate =
      currentPaidUntil && currentPaidUntil > paymentBase ? currentPaidUntil : paymentBase
    const paidUntil = addDaysYmd(baseDate, 30)

    const { error: subscriptionError } = await supabaseAdmin
      .from('membership_subscriptions')
      .update({
        status: 'active',
        paid_until: paidUntil,
        next_due_date: paidUntil,
        asaas_subscription_id: subscriptionId || membershipSubscription.asaas_subscription_id,
        asaas_customer_id: customerId || membershipSubscription.asaas_customer_id,
      })
      .eq('id', membershipSubscription.id)

    if (subscriptionError) throw subscriptionError

    await supabaseAdmin
      .from('memberships')
      .update({ status: 'ativo', vencimento: paidUntil, valor_pago: amount })
      .eq('id', membershipSubscription.customer_id)
      .eq('tenant_id', membershipSubscription.tenant_id)
  } else if (event === 'PAYMENT_OVERDUE') {
    await supabaseAdmin
      .from('membership_subscriptions')
      .update({ status: 'overdue', next_due_date: dueDate || membershipSubscription.next_due_date })
      .eq('id', membershipSubscription.id)

    await supabaseAdmin
      .from('memberships')
      .update({ status: 'vencido' })
      .eq('id', membershipSubscription.customer_id)
      .eq('tenant_id', membershipSubscription.tenant_id)
  } else if (['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED'].includes(event)) {
    await supabaseAdmin
      .from('membership_subscriptions')
      .update({ status: 'cancelled' })
      .eq('id', membershipSubscription.id)

    await supabaseAdmin
      .from('memberships')
      .update({ status: 'cancelado' })
      .eq('id', membershipSubscription.customer_id)
      .eq('tenant_id', membershipSubscription.tenant_id)
  }

  return true
}

async function processSaasBillingEvent({
  event,
  payment,
  subscriptionId,
  customerId,
  externalReference,
}: {
  event: string
  payment: any
  subscriptionId?: string | null
  customerId?: string | null
  externalReference?: string | null
}) {
  const subscriptionStatus = saasSubscriptionStatusFromEvent(event)
  if (!subscriptionStatus) return false

  const tenant = await findSaasTenant(subscriptionId, externalReference)
  if (!tenant) return false

  const updatePayload: Record<string, any> = { subscription_status: subscriptionStatus }

  if (subscriptionId) {
    updatePayload.asaas_subscription_id = subscriptionId
  }

  if (customerId) {
    updatePayload.asaas_customer_id = customerId
  }

  if (subscriptionStatus === 'active') {
    updatePayload.status = 'active'
    updatePayload.trial_ends_at = nextAccessDate(payment)
  } else if (subscriptionStatus === 'overdue') {
    updatePayload.status = 'suspended'
  } else if (subscriptionStatus === 'cancelled') {
    updatePayload.status = 'cancelled'
  }

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .update(updatePayload)
    .eq('id', tenant.id)
    .select('id')

  if (error) {
    throw error
  }

  return Boolean(data?.length)
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

    const membershipHandled = await processMembershipEvent({
      event,
      payment,
      subscriptionId,
      customerId,
      externalReference,
    })

    if (membershipHandled) {
      return NextResponse.json({ received: true, membership: true })
    }

    const saasHandled = await processSaasBillingEvent({
      event,
      payment,
      subscriptionId,
      customerId,
      externalReference,
    })

    if (saasHandled) {
      return NextResponse.json({ received: true, saas: true })
    }

    return NextResponse.json({ received: true, ignored: true })
  } catch (err: any) {
    console.error('Asaas webhook error:', err)
    return NextResponse.json(
      { error: err.message || 'Erro no webhook Asaas.' },
      { status: 500 },
    )
  }
}
