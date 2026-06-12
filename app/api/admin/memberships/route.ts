import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  loadTenantAsaasConfig,
} from '@/lib/server/tenant-asaas'
import type { TenantAsaasConfig } from '@/lib/server/tenant-asaas'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TENANT_ASAAS_WARNING =
  'Configure o ASAAS em Configuracoes > Pagamentos para ativar cobrancas automaticas.'

const DEFAULT_MEMBERSHIP_PLANS = [
  {
    nome: 'Mensal Corte',
    descricao: 'Plano mensal para manter o cliente recorrente.',
    preco: 79.9,
    frequencia: 'mensal',
    beneficios: ['1 corte por mes', 'Prioridade no agendamento', 'Aviso de vencimento'],
    cor: '#3b82f6',
    ativo: true,
  },
  {
    nome: 'Mensal Premium',
    descricao: 'Plano mensal com corte e barba.',
    preco: 119.9,
    frequencia: 'mensal',
    beneficios: ['1 corte por mes', '1 barba por mes', 'Atendimento prioritario'],
    cor: '#f59e0b',
    ativo: true,
  },
  {
    nome: 'Mensal VIP',
    descricao: 'Plano mensal para clientes VIP.',
    preco: 169.9,
    frequencia: 'mensal',
    beneficios: ['Corte e barba', 'Produtos com desconto', 'Horario preferencial'],
    cor: '#8b5cf6',
    ativo: true,
  },
]

function todayYmd() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function normalizePlan(value?: string | null) {
  return String(value ?? '').trim().toLowerCase()
}

function isMissingMembershipAutomationTable(error: any) {
  const message = String(error?.message ?? '').toLowerCase()
  return (
    ['42P01', 'PGRST205'].includes(String(error?.code ?? '')) ||
    (message.includes('membership_subscriptions') || message.includes('membership_payments')) &&
      (message.includes('schema cache') || message.includes('does not exist'))
  )
}

function membershipTablesError() {
  return new Error(
    'Execute o SQL supabase/membership_subscriptions.sql no Supabase antes de usar a automacao.',
  )
}

function addDaysYmd(date: string, days: number) {
  const parsed = new Date(`${date}T12:00:00-03:00`)
  parsed.setDate(parsed.getDate() + days)
  return parsed.toISOString().slice(0, 10)
}

async function tenantAsaasRequest(config: TenantAsaasConfig, path: string, init: RequestInit) {

  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
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
      'Erro na integracao com o Asaas.'
    throw new Error(message)
  }

  return payload
}

async function requireAdmin(req: NextRequest, tenantId: string) {
  if (!tenantId) return jsonError('tenant_id obrigatorio.', 400)

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return jsonError('Sessao ausente.', 401)

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData.user) return jsonError('Sessao invalida.', 401)

  const { data: membership, error } = await supabaseAdmin
    .from('tenant_users')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userData.user.id)
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (!membership || !['admin', 'owner'].includes(membership.role)) return jsonError('Acesso negado.', 403)

  return { user: userData.user }
}

async function loadMembershipData(tenantId: string, planName: string) {
  const { data: existingPlans, error: plansError } = await supabaseAdmin
    .from('membership_plans')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('preco')

  if (plansError) throw plansError

  let plans = existingPlans ?? []

  if (plans.length === 0) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('membership_plans')
      .insert(DEFAULT_MEMBERSHIP_PLANS.map(plan => ({ ...plan, tenant_id: tenantId })))
      .select('*')

    if (insertError) throw insertError
    plans = (inserted ?? []).sort((a, b) => Number(a.preco) - Number(b.preco))
  }

  const { data: membersData, error: membersError } = await supabaseAdmin
    .from('memberships')
    .select('*, membership_plans(nome)')
    .eq('tenant_id', tenantId)
    .order('vencimento')

  if (membersError) throw membersError

  const today = todayYmd()
  const members = (membersData ?? []).map((member: any) => ({
    ...member,
    plano_nome: member.membership_plans?.nome ?? '-',
    status: member.status === 'ativo' && member.vencimento < today ? 'vencido' : member.status,
  }))

  const expiredIds = members
    .filter((member: any) => member.status === 'vencido' && (membersData ?? []).find((item: any) => item.id === member.id)?.status === 'ativo')
    .map((member: any) => member.id)

  if (expiredIds.length) {
    const { error } = await supabaseAdmin
      .from('memberships')
      .update({ status: 'vencido' })
      .eq('tenant_id', tenantId)
      .in('id', expiredIds)

    if (error) throw error
  }

  const { data: subscriptionsData, error: subscriptionsError } = await supabaseAdmin
    .from('membership_subscriptions')
    .select(`
      *,
      customer:memberships!membership_subscriptions_customer_id_fkey(nome,email,telefone),
      plan:membership_plans!membership_subscriptions_membership_id_fkey(nome)
    `)
    .eq('tenant_id', tenantId)
    .order('next_due_date')

  if (subscriptionsError && !isMissingMembershipAutomationTable(subscriptionsError)) {
    throw subscriptionsError
  }

  const overdueSubscriptionIds = (subscriptionsData ?? [])
    .filter((subscription: any) =>
      subscription.billing_mode === 'manual' &&
      ['active', 'pending'].includes(subscription.status) &&
      subscription.next_due_date < today &&
      (!subscription.paid_until || subscription.paid_until < today),
    )
    .map((subscription: any) => subscription.id)

  if (overdueSubscriptionIds.length) {
    const { error: overdueError } = await supabaseAdmin
      .from('membership_subscriptions')
      .update({ status: 'overdue' })
      .eq('tenant_id', tenantId)
      .in('id', overdueSubscriptionIds)

    if (overdueError) throw overdueError
  }

  const subscriptions = (subscriptionsData ?? []).map((subscription: any) => ({
    ...subscription,
    status: overdueSubscriptionIds.includes(subscription.id) ? 'overdue' : subscription.status,
    customer_name: subscription.customer?.nome ?? '-',
    customer_email: subscription.customer?.email ?? '',
    customer_phone: subscription.customer?.telefone ?? '',
    plan_name: subscription.plan?.nome ?? '-',
  }))

  const tenantAsaasConfigured = ['pro', 'premium'].includes(planName)
    ? Boolean(await loadTenantAsaasConfig(tenantId, supabaseAdmin))
    : false

  return {
    plans,
    membros: members,
    subscriptions,
    recurringAvailable: !subscriptionsError,
    tenantAsaasConfigured,
  }
}

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenant_id') ?? ''
    const auth = await requireAdmin(req, tenantId)
    if (auth instanceof NextResponse) return auth

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('plano')
      .eq('id', tenantId)
      .maybeSingle()

    if (tenantError) return jsonError(tenantError.message, 500)

    const data = await loadMembershipData(tenantId, normalizePlan(tenant?.plano))
    return NextResponse.json(data)
  } catch (error: any) {
    return jsonError(error.message ?? 'Erro ao carregar memberships.', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const tenantId = String(body.tenant_id ?? '')
    const auth = await requireAdmin(req, tenantId)
    if (auth instanceof NextResponse) return auth

    let tenantPlan = ''
    if (['create_recurring_subscription', 'mark_recurring_paid', 'cancel_recurring_subscription'].includes(body.action)) {
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .select('plano')
        .eq('id', tenantId)
        .maybeSingle()

      if (tenantError) return jsonError(tenantError.message, 500)
      tenantPlan = normalizePlan(tenant?.plano)
      if (!['pro', 'premium'].includes(tenantPlan)) {
        return jsonError('Memberships estao disponiveis apenas nos planos Pro e Premium.', 403)
      }
    }

    if (body.action === 'save_plan') {
      const payload = { ...body.payload, tenant_id: tenantId }
      const query = body.plan_id
        ? supabaseAdmin.from('membership_plans').update(payload).eq('id', body.plan_id).eq('tenant_id', tenantId)
        : supabaseAdmin.from('membership_plans').insert(payload)

      const { error } = await query
      if (error) return jsonError(error.message, 400)
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'delete_plan') {
      const { error } = await supabaseAdmin
        .from('membership_plans')
        .delete()
        .eq('id', body.plan_id)
        .eq('tenant_id', tenantId)

      if (error) return jsonError(error.message, 400)
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'save_member') {
      const payload = { ...body.payload, tenant_id: tenantId }
      const query = body.member_id
        ? supabaseAdmin.from('memberships').update(payload).eq('id', body.member_id).eq('tenant_id', tenantId)
        : supabaseAdmin.from('memberships').insert(payload)

      const { error } = await query
      if (error) return jsonError(error.message, 400)
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'delete_member') {
      const { error } = await supabaseAdmin
        .from('memberships')
        .delete()
        .eq('id', body.member_id)
        .eq('tenant_id', tenantId)

      if (error) return jsonError(error.message, 400)
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'create_recurring_subscription') {
      const billingMode = body.billing_mode === 'automatic' ? 'automatic' : 'manual'
      const customerId = String(body.customer_id ?? '')
      const membershipId = String(body.membership_id ?? '')
      const cpfCnpj = onlyDigits(String(body.cpf_cnpj ?? ''))
      const nextDueDate = String(body.next_due_date ?? '')
      const value = Number(body.value)

      if (!customerId || !membershipId) {
        return jsonError('Selecione o cliente e o plano.', 400)
      }
      if (!Number.isFinite(value) || value <= 0) return jsonError('Informe um valor valido.', 400)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate)) {
        return jsonError('Informe a data da primeira cobranca.', 400)
      }
      if (billingMode === 'automatic' && !['pro', 'premium'].includes(tenantPlan)) {
        return jsonError(
          'Cobranças automáticas via ASAAS estão disponíveis nos planos Pro e Premium.',
          403
        )
      }
      if (billingMode === 'automatic' && ![11, 14].includes(cpfCnpj.length)) {
        return jsonError('Informe um CPF ou CNPJ valido para o Asaas.', 400)
      }

      const [{ error: subscriptionsTableError }, { error: paymentsTableError }] =
        await Promise.all([
          supabaseAdmin.from('membership_subscriptions').select('id').limit(1),
          supabaseAdmin.from('membership_payments').select('id').limit(1),
        ])

      if (subscriptionsTableError || paymentsTableError) {
        const tableError = subscriptionsTableError || paymentsTableError
        if (isMissingMembershipAutomationTable(tableError)) {
          return jsonError(membershipTablesError().message, 500)
        }
        return jsonError(tableError?.message ?? 'Erro ao validar tabelas de assinaturas.', 500)
      }

      const [{ data: member, error: memberError }, { data: plan, error: planError }] =
        await Promise.all([
          supabaseAdmin
            .from('memberships')
            .select('id,nome,email,telefone')
            .eq('id', customerId)
            .eq('tenant_id', tenantId)
            .maybeSingle(),
          supabaseAdmin
            .from('membership_plans')
            .select('id,nome')
            .eq('id', membershipId)
            .eq('tenant_id', tenantId)
            .maybeSingle(),
        ])

      if (memberError || !member) return jsonError(memberError?.message ?? 'Cliente nao encontrado.', 404)
      if (planError || !plan) return jsonError(planError?.message ?? 'Plano nao encontrado.', 404)

      const { data: existing, error: existingError } = await supabaseAdmin
        .from('membership_subscriptions')
        .select('id,asaas_customer_id,status')
        .eq('tenant_id', tenantId)
        .eq('customer_id', customerId)
        .neq('status', 'cancelled')
        .maybeSingle()

      if (existingError) return jsonError(existingError.message, 500)
      if (existing) return jsonError('Este cliente ja possui uma assinatura recorrente ativa ou pendente.', 409)

      if (billingMode === 'manual') {
        const rowId = crypto.randomUUID()
        const { error: insertError } = await supabaseAdmin.from('membership_subscriptions').insert({
          id: rowId,
          tenant_id: tenantId,
          customer_id: customerId,
          membership_id: membershipId,
          billing_mode: 'manual',
          value,
          status: 'pending',
          next_due_date: nextDueDate,
        })

        if (insertError) return jsonError(insertError.message, 400)

        return NextResponse.json({
          ok: true,
          billing_mode: 'manual',
          subscription_id: rowId,
        })
      }

      const tenantAsaasConfig = await loadTenantAsaasConfig(tenantId, supabaseAdmin)
      if (!tenantAsaasConfig) return jsonError(TENANT_ASAAS_WARNING, 409)

      let asaasCustomerId: string | null = null
      const { data: previousCustomer, error: previousCustomerError } = await supabaseAdmin
        .from('membership_subscriptions')
        .select('asaas_customer_id')
        .eq('tenant_id', tenantId)
        .eq('customer_id', customerId)
        .not('asaas_customer_id', 'is', null)
        .limit(1)
        .maybeSingle()

      if (previousCustomerError) return jsonError(previousCustomerError.message, 500)
      asaasCustomerId = previousCustomer?.asaas_customer_id ?? null

      if (!asaasCustomerId) {
        const customer = await tenantAsaasRequest(tenantAsaasConfig, '/customers', {
          method: 'POST',
          body: JSON.stringify({
            name: member.nome,
            email: member.email || undefined,
            mobilePhone: onlyDigits(member.telefone || '') || undefined,
            cpfCnpj,
            externalReference: `membership-customer:${customerId}`,
          }),
        })
        asaasCustomerId = customer.id
      }

      const rowId = crypto.randomUUID()
      const { error: pendingError } = await supabaseAdmin.from('membership_subscriptions').insert({
        id: rowId,
        tenant_id: tenantId,
        customer_id: customerId,
        membership_id: membershipId,
        billing_mode: 'automatic',
        asaas_customer_id: asaasCustomerId,
        value,
        status: 'pending',
        next_due_date: nextDueDate,
      })

      if (pendingError) {
        if (isMissingMembershipAutomationTable(pendingError)) {
          return jsonError('Execute o SQL supabase/membership_subscriptions.sql antes de usar a automacao.', 500)
        }
        return jsonError(pendingError.message, 400)
      }

      let createdAsaasSubscriptionId: string | null = null

      try {
        const subscription = await tenantAsaasRequest(tenantAsaasConfig, '/subscriptions', {
          method: 'POST',
          body: JSON.stringify({
            customer: asaasCustomerId,
            billingType: 'UNDEFINED',
            value,
            nextDueDate,
            cycle: 'MONTHLY',
            description: `${plan.nome} - ${member.nome}`,
            externalReference: `membership:${rowId}`,
          }),
        })
        createdAsaasSubscriptionId = subscription.id

        const { error: updateError } = await supabaseAdmin
          .from('membership_subscriptions')
          .update({ asaas_subscription_id: subscription.id })
          .eq('id', rowId)
          .eq('tenant_id', tenantId)

        if (updateError) throw updateError

        let invoiceUrl: string | null = null
        try {
          const payments = await tenantAsaasRequest(tenantAsaasConfig, `/subscriptions/${subscription.id}/payments?limit=1`, {
            method: 'GET',
          })
          invoiceUrl = payments?.data?.[0]?.invoiceUrl ?? payments?.data?.[0]?.bankSlipUrl ?? null
        } catch (paymentError) {
          console.warn('Assinatura criada, mas a primeira cobranca ainda nao esta disponivel:', paymentError)
        }

        return NextResponse.json({
          ok: true,
          subscription_id: rowId,
          asaas_subscription_id: subscription.id,
          invoice_url: invoiceUrl,
        })
      } catch (error) {
        if (createdAsaasSubscriptionId) {
          try {
            await tenantAsaasRequest(tenantAsaasConfig, `/subscriptions/${createdAsaasSubscriptionId}`, {
              method: 'DELETE',
            })
          } catch (rollbackError) {
            console.error(
              'Falha ao cancelar assinatura Asaas apos erro de persistencia:',
              rollbackError,
            )
          }
        }
        await supabaseAdmin.from('membership_subscriptions').delete().eq('id', rowId)
        throw error
      }
    }

    if (body.action === 'mark_recurring_paid') {
      const subscriptionId = String(body.subscription_id ?? '')
      const amount = Number(body.amount)
      if (!subscriptionId) return jsonError('Assinatura obrigatoria.', 400)
      if (!Number.isFinite(amount) || amount <= 0) return jsonError('Informe um valor valido.', 400)

      const { data: subscription, error: subscriptionError } = await supabaseAdmin
        .from('membership_subscriptions')
        .select('*, customer:memberships!membership_subscriptions_customer_id_fkey(id)')
        .eq('id', subscriptionId)
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (subscriptionError || !subscription) {
        return jsonError(subscriptionError?.message ?? 'Assinatura nao encontrada.', 404)
      }

      const baseDate =
        subscription.paid_until && subscription.paid_until > todayYmd()
          ? subscription.paid_until
          : todayYmd()
      const paidUntil = addDaysYmd(baseDate, 30)

      const { error: updateError } = await supabaseAdmin
        .from('membership_subscriptions')
        .update({ status: 'active', paid_until: paidUntil, next_due_date: paidUntil })
        .eq('id', subscriptionId)
        .eq('tenant_id', tenantId)

      if (updateError) return jsonError(updateError.message, 400)

      const { error: paymentError } = await supabaseAdmin.from('membership_payments').insert({
        tenant_id: tenantId,
        subscription_id: subscriptionId,
        amount,
        status: 'paid_manual',
        due_date: subscription.next_due_date,
        paid_at: new Date().toISOString(),
      })

      if (paymentError) return jsonError(paymentError.message, 400)

      await supabaseAdmin
        .from('memberships')
        .update({ status: 'ativo', vencimento: paidUntil, valor_pago: amount })
        .eq('id', subscription.customer_id)
        .eq('tenant_id', tenantId)

      return NextResponse.json({ ok: true, paid_until: paidUntil })
    }

    if (body.action === 'cancel_recurring_subscription') {
      const subscriptionId = String(body.subscription_id ?? '')
      const { data: subscription, error } = await supabaseAdmin
        .from('membership_subscriptions')
        .select('asaas_subscription_id,customer_id,billing_mode')
        .eq('id', subscriptionId)
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (error || !subscription) return jsonError(error?.message ?? 'Assinatura nao encontrada.', 404)

      if (subscription.asaas_subscription_id) {
        const tenantAsaasConfig = await loadTenantAsaasConfig(tenantId, supabaseAdmin)
        if (!tenantAsaasConfig) return jsonError(TENANT_ASAAS_WARNING, 409)
        await tenantAsaasRequest(
          tenantAsaasConfig,
          `/subscriptions/${subscription.asaas_subscription_id}`,
          { method: 'DELETE' },
        )
      }

      await supabaseAdmin
        .from('membership_subscriptions')
        .update({ status: 'cancelled' })
        .eq('id', subscriptionId)
        .eq('tenant_id', tenantId)

      await supabaseAdmin
        .from('memberships')
        .update({ status: 'cancelado' })
        .eq('id', subscription.customer_id)
        .eq('tenant_id', tenantId)

      return NextResponse.json({ ok: true })
    }

    return jsonError('Acao invalida.', 400)
  } catch (error: any) {
    return jsonError(error.message ?? 'Erro ao salvar memberships.', 500)
  }
}
