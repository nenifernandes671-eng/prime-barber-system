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

    const {
      nome,
      email,
      senha,
      telefone,
      tenant_id,
    } = body

    if (!nome || !email || !senha || !tenant_id) {
      return NextResponse.json(
        {
          error: 'Nome, email e senha obrigatórios',
        },
        { status: 400 }
      )
    }

    const { data: membership } = await supabaseAdmin
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', tenant_id)
      .eq('user_id', sessionData.user.id)
      .maybeSingle()

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json(
        { error: 'Voce nao tem permissao para criar barbeiro nesta barbearia.' },
        { status: 403 }
      )
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
      })

    if (authError) {
      return NextResponse.json(
        {
          error: authError.message,
        },
        { status: 400 }
      )
    }

    const userId = authData.user.id

    const { error: dbError } = await supabaseAdmin
      .from('barbeiros')
      .insert({
        user_id: userId,
        nome,
        email,
        telefone,
        tenant_id,
        ativo: true,
      })

    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)

      return NextResponse.json(
        {
          error: dbError.message,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
    })

  } catch (err) {
    console.error(err)

    return NextResponse.json(
      {
        error: 'Erro interno',
      },
      { status: 500 }
    )
  }
}
