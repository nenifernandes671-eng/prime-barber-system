import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

    if (!token) {
      return NextResponse.json(
        { error: 'Login obrigatorio.' },
        { status: 401, headers: noStoreHeaders },
      )
    }

    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.getUser(token)

    if (sessionError || !sessionData.user) {
      return NextResponse.json(
        { error: 'Sessao invalida.' },
        { status: 401, headers: noStoreHeaders },
      )
    }

    const { slug } = await req.json()
    const normalizedSlug = String(slug || '').trim().toLowerCase()

    if (!normalizedSlug) {
      return NextResponse.json(
        { error: 'Slug obrigatorio.' },
        { status: 400, headers: noStoreHeaders },
      )
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, status, subscription_status, trial_start, trial_end, trial_ends_at')
      .eq('slug', normalizedSlug)
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
      .eq('user_id', sessionData.user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json(
        { error: 'Sem acesso a esta barbearia.' },
        { status: 403, headers: noStoreHeaders },
      )
    }

    const access = getTenantAccess(tenant)

    return NextResponse.json(
      {
        active: access.allowed,
        status: tenant.subscription_status || tenant.status,
        message: access.allowed
          ? 'Acesso ativo.'
          : 'Aguardando confirmacao do webhook Asaas.',
      },
      { headers: noStoreHeaders },
    )
  } catch (err: any) {
    console.error('Asaas sync status error:', err)
    return NextResponse.json(
      { error: err.message || 'Erro ao consultar status da assinatura.' },
      { status: 500, headers: noStoreHeaders },
    )
  }
}
