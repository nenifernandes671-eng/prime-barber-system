import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizeBillingCycle } from '@/lib/saas-billing'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function normalizeSlug(slug: string) {
  return slug
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

async function findAuthUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase()

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 100,
    })

    if (error) {
      throw error
    }

    const user = data.users.find((item) => item.email?.toLowerCase() === normalizedEmail)
    if (user) return user
    if (data.users.length < 100) return null
  }

  return null
}

async function ensureOwnerUser(input: {
  email: string
  password: string
  nome: string
  slug: string
  marketingOptIn?: boolean
}) {
  const existingUser = await findAuthUserByEmail(input.email)

  if (existingUser) {
    throw new Error('Ja existe uma conta com este email. Entre com sua senha atual.')
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      nome: input.nome,
      slug: input.slug,
      role: 'admin',
      password_set: true,
      marketing_opt_in: Boolean(input.marketingOptIn),
    },
  })

  if (error || !data.user) {
    throw new Error(error?.message || 'Nao foi possivel criar o usuario administrador.')
  }

  return data.user.id
}

export async function POST(req: NextRequest) {
  try {
    const {
      plano,
      billingCycle,
      nome,
      email,
      cpfCnpj,
      telefone,
      cep,
      endereco,
      numero,
      bairro,
      slug,
      password,
      confirmPassword,
      nomeBarbearia,
      acceptedTerms,
      marketingOptIn,
    } = await req.json()
    const barbershopNameClean = String(nomeBarbearia ?? '').trim()
    const isQuickRegistration = Boolean(barbershopNameClean)
    const baseSlug = normalizeSlug(String(slug ?? barbershopNameClean))
    let normalizedSlug = baseSlug
    const document = onlyDigits(String(cpfCnpj ?? ''))
    const phone = onlyDigits(String(telefone ?? ''))
    const postalCode = onlyDigits(String(cep ?? ''))
    const planKey = String(plano ?? '').toLowerCase()
    const cycle = normalizeBillingCycle(billingCycle)
    const emailClean = String(email ?? '').trim().toLowerCase()
    const nameClean = String(nome ?? '').trim()
    const passwordValue = String(password ?? '')
    const confirmPasswordValue = String(confirmPassword ?? '')

    if (isQuickRegistration && !acceptedTerms) {
      return NextResponse.json({ error: 'Aceite os Termos de Uso e a Politica de Privacidade.' }, { status: 400 })
    }

    if (
      !planKey ||
      !nameClean ||
      !emailClean ||
      !phone ||
      (isQuickRegistration && !barbershopNameClean) ||
      !normalizedSlug ||
      !passwordValue ||
      !confirmPasswordValue
    ) {
      return NextResponse.json({ error: 'Campos obrigatorios faltando.' }, { status: 400 })
    }

    if (![11, 14].includes(document.length)) {
      return NextResponse.json({ error: 'Informe um CPF ou CNPJ valido.' }, { status: 400 })
    }

    if (![10, 11].includes(phone.length)) {
      return NextResponse.json({ error: 'Informe um telefone valido com DDD.' }, { status: 400 })
    }

    if (!isQuickRegistration && postalCode.length !== 8) {
      return NextResponse.json({ error: 'Informe um CEP valido.' }, { status: 400 })
    }

    if (normalizedSlug.length < 3) {
      return NextResponse.json({ error: 'O link da barbearia precisa ter pelo menos 3 caracteres.' }, { status: 400 })
    }

    if (passwordValue.length < 8) {
      return NextResponse.json({ error: 'A senha precisa ter pelo menos 8 caracteres.' }, { status: 400 })
    }

    if (passwordValue !== confirmPasswordValue) {
      return NextResponse.json({ error: 'As senhas nao conferem.' }, { status: 400 })
    }

    if (!['basic', 'pro', 'premium'].includes(planKey)) {
      return NextResponse.json({ error: 'Plano invalido.' }, { status: 400 })
    }

    if (await findAuthUserByEmail(emailClean)) {
      return NextResponse.json(
        { error: 'Ja existe uma conta com este email. Entre com sua senha atual.' },
        { status: 409 },
      )
    }

    const { data: existingTenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('slug', normalizedSlug)
      .maybeSingle()

    if (existingTenant && !isQuickRegistration) {
      return NextResponse.json({ error: 'Este link de barbearia ja esta em uso.' }, { status: 409 })
    }

    if (existingTenant) {
      normalizedSlug = `${baseSlug}-${Date.now().toString().slice(-6)}`
    }

    const trialStart = new Date()
    const trialEnd = addDays(trialStart, 30)

    const tenantPayload: Record<string, any> = {
  nome: barbershopNameClean || nameClean,
  email: emailClean,
  slug: normalizedSlug,
      plano: planKey,
      billing_cycle: cycle,
  status: 'trial',
  subscription_status: 'trial',
  trial_start: trialStart.toISOString(),
  trial_end: trialEnd.toISOString(),
  trial_ends_at: trialEnd.toISOString(),
}

    if (document) tenantPayload.cpf_cnpj = document
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert(tenantPayload)
      .select('id')
      .single()

    if (tenantError || !tenant?.id) {
      return NextResponse.json(
        { error: tenantError?.message || 'Nao foi possivel criar a barbearia.' },
        { status: 500 },
      )
    }

    const ownerUserId = await ensureOwnerUser({
      email: emailClean,
      password: passwordValue,
      nome: nameClean,
      slug: normalizedSlug,
      marketingOptIn: Boolean(marketingOptIn),
    })

    const { data: existingMembership } = await supabaseAdmin
      .from('tenant_users')
      .select('tenant_id')
      .eq('tenant_id', tenant.id)
      .eq('user_id', ownerUserId)
      .maybeSingle()

    if (!existingMembership) {
      const { error: membershipError } = await supabaseAdmin
        .from('tenant_users')
        .insert({
          tenant_id: tenant.id,
          user_id: ownerUserId,
          role: 'admin',
        })

      if (membershipError) {
        return NextResponse.json(
          { error: membershipError.message || 'Nao foi possivel vincular o administrador.' },
          { status: 500 },
        )
      }
    }

    return NextResponse.json({
      created: true,
      slug: normalizedSlug,
      trialEndsAt: trialEnd.toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao criar conta.'
    console.error('Trial registration error:', err)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
