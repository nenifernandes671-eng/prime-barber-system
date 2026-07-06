import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateTenantUser } from '@/lib/server/push'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function normalizePlatform(value: unknown) {
  const platform = String(value || '').toLowerCase()
  return platform === 'ios' || platform === 'android' ? platform : null
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return jsonError('Login obrigatorio.', 401)

    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.getUser(token)
    if (sessionError || !sessionData.user) return jsonError('Sessao invalida.', 401)

    const body = await req.json()
    const tenantId = String(body.tenant_id || '').trim()
    const deviceToken = String(body.token || '').trim()
    const platform = normalizePlatform(body.platform)
    const bodyUserId = String(body.user_id || sessionData.user.id)

    if (!tenantId || !deviceToken || !platform) {
      return jsonError('tenant_id, token e platform sao obrigatorios.', 400)
    }

    if (bodyUserId !== sessionData.user.id) {
      return jsonError('Usuario invalido para este token.', 403)
    }

    const allowed = await validateTenantUser(tenantId, sessionData.user.id)
    if (!allowed) return jsonError('Sem acesso a esta barbearia.', 403)

    const now = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('device_tokens')
      .upsert(
        {
          tenant_id: tenantId,
          user_id: sessionData.user.id,
          token: deviceToken,
          platform,
          is_active: true,
          last_used_at: now,
          updated_at: now,
        },
        { onConflict: 'tenant_id,user_id,token' },
      )
      .select('id')
      .single()

    if (error) return jsonError(error.message, 400)
    return NextResponse.json({ ok: true, id: data.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao registrar device token.'
    return jsonError(message, 500)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return jsonError('Login obrigatorio.', 401)

    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.getUser(token)
    if (sessionError || !sessionData.user) return jsonError('Sessao invalida.', 401)

    const body = await req.json().catch(() => ({}))
    const deviceToken = String(body.token || '').trim()
    if (!deviceToken) return jsonError('Token obrigatorio.', 400)

    const { error } = await supabaseAdmin
      .from('device_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', sessionData.user.id)
      .eq('token', deviceToken)

    if (error) return jsonError(error.message, 400)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao desativar device token.'
    return jsonError(message, 500)
  }
}