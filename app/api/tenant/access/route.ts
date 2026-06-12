import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const noStoreHeaders = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const slug = req.nextUrl.searchParams.get('slug')?.trim().toLowerCase()

  if (!token || !slug) {
    return NextResponse.json(
      { error: 'Autenticacao e slug obrigatorios.' },
      { status: 401, headers: noStoreHeaders },
    )
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: 'Sessao invalida.' },
      { status: 401, headers: noStoreHeaders },
    )
  }

  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('slug', slug)
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
    .eq('user_id', authData.user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json(
      { error: 'Sem acesso a esta barbearia.' },
      { status: 403, headers: noStoreHeaders },
    )
  }

  return NextResponse.json({ tenant }, { headers: noStoreHeaders })
}
