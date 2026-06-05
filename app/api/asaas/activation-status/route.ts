import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantAccess } from '@/lib/subscription-access'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')?.trim().toLowerCase()

  if (!slug || !/^[a-z0-9-]{3,80}$/.test(slug)) {
    return NextResponse.json({ active: false, error: 'Slug invalido.' }, { status: 400 })
  }

  const { data: tenant, error } = await supabaseAdmin
    .from('tenants')
    .select('status, trial_ends_at')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ active: false, error: error.message }, { status: 500 })
  }

  const access = getTenantAccess(tenant)

  return NextResponse.json({
    active: access.allowed,
    status: tenant?.status || null,
  })
}
