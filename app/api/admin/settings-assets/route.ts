import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

async function loadAssets(tenantId: string) {
  const [{ data: barbers, error: barbersError }, { data: services, error: servicesError }] = await Promise.all([
    supabaseAdmin
      .from('barbeiros')
      .select('id,nome,avatar_url')
      .eq('tenant_id', tenantId)
      .order('nome'),
    supabaseAdmin
      .from('services')
      .select('id,name,price,photo_url')
      .eq('tenant_id', tenantId)
      .order('name'),
  ])

  if (barbersError) throw barbersError
  if (servicesError) throw servicesError

  return { barbers: barbers ?? [], services: services ?? [] }
}

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenant_id') ?? ''
    const auth = await requireAdmin(req, tenantId)
    if (auth instanceof NextResponse) return auth

    const data = await loadAssets(tenantId)
    return NextResponse.json(data)
  } catch (error: any) {
    return jsonError(error.message ?? 'Erro ao carregar configuracoes.', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const tenantId = String(body.tenant_id ?? '')
    const auth = await requireAdmin(req, tenantId)
    if (auth instanceof NextResponse) return auth

    if (body.action === 'update_barber_photo') {
      const { error } = await supabaseAdmin
        .from('barbeiros')
        .update({ avatar_url: body.avatar_url ?? null })
        .eq('id', body.barber_id)
        .eq('tenant_id', tenantId)

      if (error) return jsonError(error.message, 400)
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'update_service_photo') {
      const { error } = await supabaseAdmin
        .from('services')
        .update({ photo_url: body.photo_url ?? null })
        .eq('id', body.service_id)
        .eq('tenant_id', tenantId)

      if (error) return jsonError(error.message, 400)
      return NextResponse.json({ ok: true })
    }

    return jsonError('Acao invalida.', 400)
  } catch (error: any) {
    return jsonError(error.message ?? 'Erro ao salvar configuracoes.', 500)
  }
}
