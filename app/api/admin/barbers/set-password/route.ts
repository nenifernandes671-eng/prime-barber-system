import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return jsonError('Login obrigatorio.', 401)

    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.getUser(token)
    if (sessionError || !sessionData.user) return jsonError('Sessao invalida.', 401)

    const body = await req.json().catch(() => ({}))
    const barberId = String(body.barberId ?? '').trim()
    const newPassword = String(body.newPassword ?? '')

    if (!barberId || !newPassword) {
      return jsonError('barberId e newPassword sao obrigatorios.', 400)
    }
    if (newPassword.length < 8) {
      return jsonError('A senha precisa ter pelo menos 8 caracteres.', 400)
    }

    const { data: barber, error: barberError } = await supabaseAdmin
      .from('barbeiros')
      .select('id, tenant_id, user_id, nome')
      .eq('id', barberId)
      .maybeSingle()

    if (barberError) return jsonError(barberError.message, 400)
    if (!barber) return jsonError('Barbeiro nao encontrado.', 404)
    if (!barber.user_id) return jsonError('Este barbeiro nao possui login vinculado.', 400)

    const { data: callerMembership, error: membershipError } = await supabaseAdmin
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', barber.tenant_id)
      .eq('user_id', sessionData.user.id)
      .maybeSingle()

    if (membershipError) return jsonError(membershipError.message, 400)
    const role = String(callerMembership?.role ?? '').toLowerCase()
    if (!callerMembership || !['owner', 'admin', 'dono'].includes(role)) {
      return jsonError('Sem permissao para redefinir a senha deste barbeiro.', 403)
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      barber.user_id,
      { password: newPassword },
    )

    if (updateError) return jsonError(updateError.message, 400)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao redefinir senha.'
    return jsonError(message, 500)
  }
}