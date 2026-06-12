import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { normalizeCompensationType } from '@/lib/barber-compensation'
import { getPlanFlags } from '@/lib/permissions'

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
      compensation_type,
      commission_percentage,
      fixed_salary_amount,
      chair_rental_amount,
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

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('plano')
      .eq('id', tenant_id)
      .maybeSingle()

    const { isProOrPremium } = getPlanFlags(tenant?.plano)
    const compensationType = isProOrPremium
      ? normalizeCompensationType(compensation_type)
      : 'commission'
    const commissionPercentage = Math.max(0, Math.min(100, Number(commission_percentage || 0)))
    const fixedSalaryAmount = Math.max(0, Number(fixed_salary_amount || 0))
    const chairRentalAmount = Math.max(0, Number(chair_rental_amount || 0))

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
        compensation_type: compensationType,
        commission_percentage: commissionPercentage,
        fixed_salary_amount: fixedSalaryAmount,
        chair_rental_amount: chairRentalAmount,
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
