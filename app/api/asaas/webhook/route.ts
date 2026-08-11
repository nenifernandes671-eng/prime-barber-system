/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enqueueTenantPush } from '@/lib/server/push'
import { getBillingExpirationDate, normalizeBillingCycle, type BillingCycle } from '@/lib/saas-billing'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function saasSubscriptionStatusFromEvent(event: string) {
  if (['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_RESTORED'].includes(event)) {
    return 'active'
  }

  if (event === 'PAYMENT_OVERDUE') {
    return 'overdue'
  }

  if (['PAYMENT_CREATED', 'SUBSCRIPTION_CREATED', 'SUBSCRIPTION_UPDATED'].includes(event)) {
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

function dateOnly(value?: string | null) {
  if (!value) return null
  return String(value).slice(0, 10)
}

function dateFromYmd(value?: string | null) {
  const ymd = dateOnly(value)
  return ymd ? new Date(`${ymd}T12:00:00-03:00`) : null
}

function nextAccessDate(
  payment: any,
  billingCycle: BillingCycle,
  tenant: { paid_until?: string | null; trial_end?: string | null; trial_ends_at?: string | null },
) {
  const now = new Date()
  const paidUntil = dateFromYmd(tenant.paid_until)
  const trialEnd = dateFromYmd(tenant.trial_ends_at || tenant.trial_end)
  const paymentBase = dateFromYmd(
    payment?.paymentDate ||
      payment?.clientPaymentDate ||
      payment?.confirmedDate ||
      payment?.dueDate,
  )

  const baseDate =
    paidUntil && paidUntil > now
      ? paidUntil
      : trialEnd && trialEnd > now
        ? trialEnd
        : paymentBase || now

  return getBillingExpirationDate(baseDate, billingCycle).toISOString()
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

function parseSaasPlanReference(reference?: string | null) {
  const match = String(reference ?? '').match(
    /^saas-plan:([a-z0-9-]+):(basic|pro|premium)(?::(monthly|quarterly|yearly))?$/i,
  )

  return match
    ? {
        slug: match[1].toLowerCase(),
        plan: match[2].toLowerCase(),
        billingCycle: match[3] ? normalizeBillingCycle(match[3]) : null,
      }
    : null
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
  const planReference = parseSaasPlanReference(externalReference)
  const tenantSlug = planReference?.slug || externalReference

  if (tenantSlug) {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('id, asaas_customer_id, asaas_subscription_id, billing_cycle, plano, paid_until, trial_end, trial_ends_at')
      .eq('slug', tenantSlug)
      .maybeSingle()

    if (error) throw error
    if (data) return { ...data, pendingPlan: planReference?.plan || null }
  }

  if (subscriptionId) {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('id, asaas_customer_id, asaas_subscription_id, billing_cycle, plano, paid_until, trial_end, trial_ends_at')
      .eq('asaas_subscription_id', subscriptionId)
      .maybeSingle()

    if (error) throw error
    if (data) return { ...data, pendingPlan: planReference?.plan || null }
  }

  return null
}


function clientPaymentIdFromReference(reference?: string | null) {
  const match = String(reference ?? '').match(/^client-payment:([0-9a-f-]{36})$/i)
  return match?.[1] ?? null
}

function clientPaymentStatusFromEvent(event: string) {
  if (['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_RESTORED'].includes(event)) {
    return 'paid'
  }
  if (event === 'PAYMENT_OVERDUE') return 'overdue'
  if (['PAYMENT_DELETED', 'PAYMENT_REFUNDED'].includes(event)) return 'cancelled'
  if (event === 'PAYMENT_CREATED') return 'waiting_payment'
  return event.replace(/^PAYMENT_/, '').toLowerCase()
}

async function processClientPaymentEvent({
  event,
  payment,
  externalReference,
}: {
  event: string
  payment: any
  externalReference?: string | null
}) {
  const clientPaymentId = clientPaymentIdFromReference(externalReference)
  if (!clientPaymentId) return false

  const { data: clientPayment, error } = await supabaseAdmin
    .from('client_payments')
    .select('*')
    .eq('id', clientPaymentId)
    .maybeSingle()

  if (error) throw error
  if (!clientPayment) return false

  const paid = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_RESTORED'].includes(event)
  const status = clientPaymentStatusFromEvent(event)
  const paidAt = paid ? new Date().toISOString() : null

  await supabaseAdmin
    .from('client_payments')
    .update({
      status,
      provider: 'asaas',
      provider_payment_id: payment?.id ? String(payment.id) : clientPayment.provider_payment_id,
      paid_at: paidAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientPayment.id)

  if (clientPayment.appointment_id) {
    await supabaseAdmin
      .from('appointments')
      .update({
        payment_status: paid ? 'paid' : status,
        paid,
        asaas_payment_id: payment?.id ? String(payment.id) : clientPayment.provider_payment_id,
      })
      .eq('id', clientPayment.appointment_id)
      .eq('tenant_id', clientPayment.tenant_id)
  }

  if (clientPayment.membership_subscription_id) {
    await supabaseAdmin
      .from('membership_subscriptions')
      .update({
        status: paid ? 'active' : status,
        ...(paid ? { paid_until: addDaysYmd(dateOnly(payment?.paymentDate) || new Date().toISOString().slice(0, 10), 30) } : {}),
      })
      .eq('id', clientPayment.membership_subscription_id)
      .eq('tenant_id', clientPayment.tenant_id)
  }

  if (paid) {
    enqueueTenantPush({
      tenant_id: clientPayment.tenant_id,
      roles: ['owner', 'admin'],
      title: 'Pagamento recebido',
      body: clientPayment.appointment_id
        ? 'Um agendamento foi pago pelo app cliente.'
        : 'Uma assinatura foi paga pelo app cliente.',
      type: 'client_payment_approved',
      data: {
        entity_id: clientPayment.appointment_id || clientPayment.membership_subscription_id,
        route: clientPayment.appointment_id ? '/agendamentos' : '/assinaturas',
      },
    }).catch((pushError) => console.error('Falha ao enfileirar push de pagamento do cliente:', pushError))
  }

  return true
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
      ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_RESTORED'].includes(event)
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
          paid_at: ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_RESTORED'].includes(event)
            ? new Date().toISOString()
            : null,
        },
        { onConflict: 'asaas_payment_id' },
      )

    if (paymentError) throw paymentError
  }

  if (['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_RESTORED'].includes(event)) {
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

    enqueueTenantPush({
      tenant_id: membershipSubscription.tenant_id,
      roles: ['owner', 'admin'],
      title: 'Pagamento aprovado',
      body: 'Uma assinatura de cliente teve pagamento aprovado.',
      type: 'membership_payment_approved',
      data: { entity_id: membershipSubscription.id, route: '/assinatura/' + membershipSubscription.id },
    }).catch((pushError) => console.error('Falha ao enfileirar push de pagamento aprovado:', pushError))
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

    enqueueTenantPush({
      tenant_id: membershipSubscription.tenant_id,
      roles: ['owner', 'admin'],
      title: 'Cobranca vencida',
      body: 'Uma cobranca de assinatura venceu.',
      type: 'membership_payment_overdue',
      data: { entity_id: membershipSubscription.id, route: '/assinatura/' + membershipSubscription.id },
    }).catch((pushError) => console.error('Falha ao enfileirar push de cobranca vencida:', pushError))
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
  } else if (['SUBSCRIPTION_CREATED', 'SUBSCRIPTION_UPDATED'].includes(event)) {
    await supabaseAdmin
      .from('membership_subscriptions')
      .update({
        asaas_subscription_id: subscriptionId || membershipSubscription.asaas_subscription_id,
        asaas_customer_id: customerId || membershipSubscription.asaas_customer_id,
      })
      .eq('id', membershipSubscription.id)
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

  const planReference = parseSaasPlanReference(externalReference)
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
    const billingCycle = planReference?.billingCycle ?? normalizeBillingCycle(tenant.billing_cycle)

    updatePayload.status = 'active'
    updatePayload.billing_cycle = billingCycle
    updatePayload.paid_until = nextAccessDate(payment, billingCycle, tenant)
    if (tenant.pendingPlan) {
      updatePayload.plano = tenant.pendingPlan
    }
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
  let logContext: Record<string, unknown> = {}

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
    logContext = {
      event,
      paymentId: payment.id,
      subscriptionId,
      customerId,
      externalReference,
    }

    console.log('Asaas webhook recebido:', {
      event,
      paymentId: payment.id,
      subscriptionId,
      customerId,
      externalReference,
    })


    const clientPaymentHandled = await processClientPaymentEvent({
      event,
      payment,
      externalReference,
    })

    if (clientPaymentHandled) {
      return NextResponse.json({ received: true, clientPayment: true })
    }
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
    console.error('[ASAAS_WEBHOOK_ERROR]', {
      ...logContext,
      error: err?.message || err,
    })
    return NextResponse.json(
      { error: err.message || 'Erro no webhook Asaas.' },
      { status: 500 },
    )
  }
}

