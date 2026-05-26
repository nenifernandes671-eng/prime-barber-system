import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

    if (!token) {
      return NextResponse.json({ error: 'Login obrigatorio.' }, { status: 401 })
    }

    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.getUser(token)

    if (sessionError || !sessionData.user) {
      return NextResponse.json({ error: 'Sessao invalida.' }, { status: 401 })
    }

    const body = await req.json()
    const barberId = String(body.barber_id || '')
    const tenantId = String(body.tenant_id || '')
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')

    if (!barberId || !tenantId || !email) {
      return NextResponse.json(
        { error: 'Barbeiro, barbearia e e-mail sao obrigatorios.' },
        { status: 400 }
      )
    }

    if (password && password.length < 6) {
      return NextResponse.json(
        { error: 'A nova senha deve ter ao menos 6 caracteres.' },
        { status: 400 }
      )
    }

    const { data: membership } = await supabaseAdmin
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', sessionData.user.id)
      .maybeSingle()

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json(
        { error: 'Voce nao tem permissao para alterar este barbeiro.' },
        { status: 403 }
      )
    }

    const { data: barber, error: barberError } = await supabaseAdmin
      .from('barbeiros')
      .select('id, user_id, nome, email, tenant_id')
      .eq('id', barberId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (barberError || !barber) {
      return NextResponse.json({ error: 'Barbeiro nao encontrado.' }, { status: 404 })
    }

    let userId = barber.user_id as string | null

    if (userId) {
      const updatePayload: {
        email: string
        email_confirm: boolean
        password?: string
        user_metadata: Record<string, string>
      } = {
        email,
        email_confirm: true,
        user_metadata: {
          role: 'barber',
          tenant_id: tenantId,
          nome: barber.nome,
        },
      }

      if (password) {
        updatePayload.password = password
      }

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, updatePayload)

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 })
      }
    } else {
      if (!password) {
        return NextResponse.json(
          { error: 'Este barbeiro ainda nao tem login. Informe uma nova senha para criar o acesso.' },
          { status: 400 }
        )
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: 'barber',
          tenant_id: tenantId,
          nome: barber.nome,
        },
      })

      if (authError || !authData.user) {
        return NextResponse.json({ error: authError?.message || 'Erro ao criar login.' }, { status: 400 })
      }

      userId = authData.user.id
    }

    const { error: dbError } = await supabaseAdmin
      .from('barbeiros')
      .update({ email, user_id: userId })
      .eq('id', barberId)
      .eq('tenant_id', tenantId)

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }

    let commissionQuery = supabaseAdmin
      .from('barbers')
      .update({ email, name: barber.nome })
      .eq('tenant_id', tenantId)

    if (barber.email) {
      commissionQuery = commissionQuery.or(`email.eq.${barber.email},name.eq.${barber.nome}`)
    } else {
      commissionQuery = commissionQuery.eq('name', barber.nome)
    }

    await commissionQuery

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
