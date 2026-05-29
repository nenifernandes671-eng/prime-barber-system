import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
  if (!membership || membership.role !== 'admin') return jsonError('Acesso negado.', 403)

  return { user: userData.user }
}

async function loadMembershipData(tenantId: string) {
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

  return { plans, membros: members }
}

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenant_id') ?? ''
    const auth = await requireAdmin(req, tenantId)
    if (auth instanceof NextResponse) return auth

    const data = await loadMembershipData(tenantId)
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

    return jsonError('Acao invalida.', 400)
  } catch (error: any) {
    return jsonError(error.message ?? 'Erro ao salvar memberships.', 500)
  }
}
