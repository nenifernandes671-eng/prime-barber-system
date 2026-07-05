/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSaasAsaasConfig } from '@/lib/server/saas-asaas'
import { getTenantAccess } from '@/lib/subscription-access'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
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

function normalizePlan(value: unknown) {
  const plan = String(value || '').trim().toLowerCase()
  return ['basic', 'pro', 'premium'].includes(plan) ? plan : 'basic'
}

function normalizeAction(value: unknown) {
  return String(value || 'status').trim().toLowerCase()
}

function dateOnly(value?: string | null) {
  return value ? String(value).slice(0, 10) : null
}

function onlyDigits(value?: string | null) {
  return String(value || '').replace(/\D/g, '')
}

function todayYmd() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function paymentLink(payment: any) {
  return (
    payment?.invoiceUrl ||
    payment?.bankSlipUrl ||
    payment?.transactionReceiptUrl ||
    payment?.paymentLink ||
    null
  )
}

function paymentMethod(payment: any) {
  const billingType = String(payment?.billingType || '').toUpperCase()
  if (billingType === 'PIX') return 'PIX'
  if (billingType === 'BOLETO') return 'Boleto'
  if (billingType === 'CREDIT_CARD') return 'Cartão'
  if (billingType === 'DEBIT_CARD') return 'Débito'
  return billingType || 'Indefinido'
}

async function asaasRequest(path: string, init: RequestInit = {}) {
  const config = await getSaasAsaasConfig()
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      access_token: config.apiKey,
      ...(init.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      payload?.errors?.[0]?.description ||
      payload?.error ||
      payload?.message ||
      'Erro ao consultar assinatura no Asaas.'
    throw new Error(message)
  }

  return payload
}

async function authenticate(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) {
    return {
      response: NextResponse.json(
        { error: 'Login obrigatorio.' },
        { status: 401, headers: noStoreHeaders },
      ),
    }
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) {
    return {
      response: NextResponse.json(
        { error: 'Sessao invalida.' },
        { status: 401, headers: noStoreHeaders },
      ),
    }
  }

  return { user: data.user }
}

async function loadTenantForUser(userId: string, slug: string) {
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (tenantError || !tenant) {
    return {
      response: NextResponse.json(
        { error: 'Barbearia nao encontrada.' },
        { status: 404, headers: noStoreHeaders },
      ),
    }
  }

  const { data: membership } = await supabaseAdmin
    .from('tenant_users')
    .select('role')
    .eq('tenant_id', tenant.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) {
    return {
      response: NextResponse.json(
        { error: 'Sem acesso a esta barbearia.' },
        { status: 403, headers: noStoreHeaders },
      ),
    }
  }

  return { tenant, role: membership.role }
}

async function listSubscriptionPayments(subscriptionId?: string | null) {
  if (!subscriptionId) return []
  const response = await asaasRequest(
    `/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=100`,
  )
  return Array.isArray(response?.data) ? response.data : []
}

async function ensureAsaasCustomer(tenant: any) {
  if (tenant.asaas_customer_id) return tenant.asaas_customer_id
  if (!tenant.email) throw new Error('E-mail do tenant obrigatorio para criar cliente no Asaas.')
  if (!tenant.cpf_cnpj) throw new Error('Cadastre o CPF ou CNPJ da barbearia em "Minha barbearia" antes de gerar cobranças.')

  const search = await asaasRequest(`/customers?email=${encodeURIComponent(tenant.email)}&limit=1`)
  const existingCustomer = Array.isArray(search?.data) ? search.data[0] : null
  const customerId = existingCustomer?.id || (await asaasRequest('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: tenant.nome || tenant.name || tenant.slug,
      email: tenant.email,
      mobilePhone: onlyDigits(tenant.telefone || tenant.phone) || undefined,
      cpfCnpj: tenant.cpf_cnpj,
      externalReference: tenant.slug,
    }),
  }))?.id

  if (!customerId) throw new Error('Asaas nao retornou o cliente da cobranca.')

  await supabaseAdmin
    .from('tenants')
    .update({ asaas_customer_id: customerId })
    .eq('id', tenant.id)

  return customerId
}

function billingTypeForAction(action: string) {
  if (action === 'generate_pix') return 'PIX'
  if (action === 'generate_boleto') return 'BOLETO'
  return 'UNDEFINED'
}

async function createChargeForAction(action: string, tenant: any) {
  const plan = normalizePlan(tenant.plano)
  const value = planPrices()[plan as keyof ReturnType<typeof planPrices>]
  if (!value) throw new Error('Valor do plano invalido para gerar cobranca.')

  const customerId = await ensureAsaasCustomer(tenant)
  return asaasRequest('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: customerId,
      billingType: billingTypeForAction(action),
      value,
      dueDate: todayYmd(),
      description: `Plano KorteBarber ${plan.toUpperCase()}`,
      externalReference: `saas-plan:${tenant.slug}:${plan}`,
    }),
  })
}

async function resolveChargePayment(action: string, tenant: any) {
  const payments = await listSubscriptionPayments(tenant.asaas_subscription_id)
  const desiredBillingType = billingTypeForAction(action)
  const pendingPayment = payments.find((item: any) =>
    ['PENDING', 'OVERDUE'].includes(String(item.status || '').toUpperCase()),
  )

  if (
    pendingPayment &&
    (desiredBillingType === 'UNDEFINED' ||
      String(pendingPayment.billingType || '').toUpperCase() === desiredBillingType)
  ) {
    return pendingPayment
  }

  return createChargeForAction(action, tenant)
}

async function buildPayload(tenant: any) {
  const access = getTenantAccess(tenant)
  const plan = normalizePlan(tenant.plano)
  let payments: any[] = []
  let subscription: any = null

  if (tenant.asaas_subscription_id) {
    try {
      payments = await listSubscriptionPayments(tenant.asaas_subscription_id)
    } catch (error) {
      console.warn('[ASAAS SaaS] Falha ao listar pagamentos:', error)
    }

    try {
      subscription = await asaasRequest(`/subscriptions/${encodeURIComponent(tenant.asaas_subscription_id)}`)
    } catch (error) {
      console.warn('[ASAAS SaaS] Falha ao carregar assinatura:', error)
    }
  }

  const sortedPayments = [...payments].sort((a, b) =>
    String(b.dateCreated || b.dueDate || '').localeCompare(String(a.dateCreated || a.dueDate || '')),
  )
  const lastPaid = sortedPayments.find((payment) =>
    ['RECEIVED', 'CONFIRMED'].includes(String(payment.status || '').toUpperCase()),
  )
  const nextPayment =
    sortedPayments.find((payment) =>
      ['PENDING', 'OVERDUE'].includes(String(payment.status || '').toUpperCase()),
    ) || sortedPayments[0]
  const value = Number(subscription?.value ?? nextPayment?.value ?? planPrices()[plan as keyof ReturnType<typeof planPrices>] ?? 0)

  return {
    active: access.allowed,
    status: tenant.subscription_status || tenant.status || 'pending',
    message: access.allowed ? 'Acesso ativo.' : 'Aguardando confirmacao do webhook Asaas.',
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.nome || tenant.name || tenant.slug,
      plan,
    },
    subscription: {
      plan,
      status: tenant.subscription_status || tenant.status || 'pending',
      value,
      nextDueDate: dateOnly(nextPayment?.dueDate || subscription?.nextDueDate || tenant.next_due_date || tenant.trial_ends_at),
      lastPayment: dateOnly(lastPaid?.paymentDate || lastPaid?.clientPaymentDate || lastPaid?.confirmedDate),
      paymentMethod: paymentMethod(nextPayment),
      renewalDate: dateOnly(subscription?.nextDueDate || nextPayment?.dueDate || tenant.trial_ends_at),
      paymentLink: paymentLink(nextPayment),
      asaasCustomerId: tenant.asaas_customer_id || subscription?.customer || null,
      asaasSubscriptionId: tenant.asaas_subscription_id || subscription?.id || null,
    },
    history: sortedPayments.map((payment) => ({
      id: String(payment.id),
      date: dateOnly(payment.paymentDate || payment.clientPaymentDate || payment.confirmedDate || payment.dueDate || payment.dateCreated),
      amount: Number(payment.value || payment.netValue || 0),
      status: String(payment.status || '').toLowerCase(),
      method: paymentMethod(payment),
      description: payment.description || `Plano KorteBarber ${plan.toUpperCase()}`,
      chargeLink: paymentLink(payment),
      receiptUrl: payment.transactionReceiptUrl || null,
      dueDate: dateOnly(payment.dueDate),
    })),
  }
}

async function getPixPayload(paymentId?: string | null) {
  if (!paymentId) return null
  try {
    return await asaasRequest(`/payments/${encodeURIComponent(paymentId)}/pixQrCode`)
  } catch (error) {
    console.warn('[ASAAS SaaS] Pix indisponivel para pagamento:', paymentId, error)
    return null
  }
}

async function handleAction(action: string, tenant: any) {
  if (action === 'cancel_subscription') {
    if (!tenant.asaas_subscription_id) throw new Error('Assinatura Asaas nao encontrada.')
    await asaasRequest(`/subscriptions/${encodeURIComponent(tenant.asaas_subscription_id)}`, {
      method: 'DELETE',
    })
    await supabaseAdmin
      .from('tenants')
      .update({ status: 'cancelled', subscription_status: 'cancelled' })
      .eq('id', tenant.id)
    return { ok: true }
  }

  const chargeActions = ['generate_pix', 'copy_pix', 'generate_boleto', 'open_payment_link', 'resend_charge', 'update_card', 'update_payment_method']
  if (!chargeActions.includes(action)) return { ok: true }

  const payment = await resolveChargePayment(action, tenant)

  if (['generate_pix', 'copy_pix'].includes(action)) {
    const pix = await getPixPayload(payment?.id)
    return {
      ok: true,
      paymentLink: paymentLink(payment),
      pixCode: pix?.payload || pix?.encodedImage || null,
      pixQrCode: pix?.encodedImage || null,
    }
  }

  if (['generate_boleto', 'open_payment_link', 'resend_charge', 'update_card', 'update_payment_method'].includes(action)) {
    return {
      ok: true,
      paymentLink: paymentLink(payment),
      message: 'Use o link de cobrança para concluir ou atualizar o pagamento com segurança pelo Asaas.',
    }
  }

  return { ok: true }
}

async function respond(req: NextRequest, body?: Record<string, any>) {
  const auth = await authenticate(req)
  if (auth.response) return auth.response

  const slug =
    String(body?.slug || req.nextUrl.searchParams.get('slug') || '')
      .trim()
      .toLowerCase()

  if (!slug) {
    return NextResponse.json(
      { error: 'Slug obrigatorio.' },
      { status: 400, headers: noStoreHeaders },
    )
  }

  const tenantResult = await loadTenantForUser(auth.user!.id, slug)
  if (tenantResult.response) return tenantResult.response

  const tenant = tenantResult.tenant
  const action = normalizeAction(
    body?.action || req.nextUrl.searchParams.get('action'),
  )

  if (action !== 'status') {
    const actionResult = await handleAction(action, tenant)

    const { data: reloaded } = await supabaseAdmin
      .from('tenants')
      .select(`
        id,
        slug,
        nome,
        email,
        telefone,
        plano,
        status,
        cpf_cnpj,
        asaas_customer_id,
        asaas_subscription_id
      `)
      .eq('id', tenant.id)
      .maybeSingle()

    const finalTenant = reloaded || tenant

    console.log('TENANT ASAAS DEBUG:', {
      id: finalTenant.id,
      cpf_cnpj: finalTenant.cpf_cnpj,
      email: finalTenant.email,
    })

    const payload = await buildPayload(finalTenant)

    return NextResponse.json(
      { ...payload, action: actionResult },
      { headers: noStoreHeaders },
    )
  }

  console.log('TENANT ASAAS DEBUG:', {
    id: tenant.id,
    cpf_cnpj: tenant.cpf_cnpj,
    email: tenant.email,
  })

  return NextResponse.json(await buildPayload(tenant), {
    headers: noStoreHeaders,
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    return await respond(req, body)
  } catch (err: any) {
    console.error('Asaas sync status error:', err)
    return NextResponse.json(
      { error: err.message || 'Erro ao consultar status da assinatura.' },
      { status: 500, headers: noStoreHeaders },
    )
  }

}

