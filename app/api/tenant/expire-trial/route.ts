import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

    if (!token) {
      return NextResponse.json({ error: 'Login obrigatorio.' }, { status: 401 })
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Sessao invalida.' }, { status: 401 })
    }

    const { slug } = await req.json()
    const normalizedSlug = String(slug || '').trim().toLowerCase()

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, status, subscription_status, trial_end, trial_ends_at')
      .eq('slug', normalizedSlug)
      .maybeSingle()

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Barbearia nao encontrada.' }, { status: 404 })
    }

    const { data: membership } = await supabaseAdmin
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', tenant.id)
      .eq('user_id', authData.user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'Sem acesso a esta barbearia.' }, { status: 403 })
    }

    const trialEnd = tenant.trial_end || tenant.trial_ends_at
    const isTrial =
      tenant.subscription_status === 'trialing' ||
      (!tenant.subscription_status && tenant.status === 'trial')
    const isExpired = Boolean(trialEnd && new Date(trialEnd).getTime() <= Date.now())

    if (!isTrial || !isExpired) {
      return NextResponse.json({ expired: false })
    }

    const { error: updateError } = await supabaseAdmin
      .from('tenants')
      .update({
        status: 'trial_expired',
        subscription_status: 'trial_expired',
      })
      .eq('id', tenant.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ expired: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao encerrar teste gratuito.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
