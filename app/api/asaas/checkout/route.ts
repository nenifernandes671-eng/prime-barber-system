import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const DEFAULT_APP_URL = 'https://kortebarber.com.br'
const DEFAULT_ASAAS_BASE_URL = 'https://api.asaas.com/v3'

function planPrices() {
  return {
    basic: Number(process.env.ASAAS_PLAN_BASIC || 39),
    pro: Number(process.env.ASAAS_PLAN_PRO || 69),
    premium: Number(process.env.ASAAS_PLAN_PREMIUM || 189),
  }
}

function asaasBillingTypes() {
  const allowed = new Set(['CREDIT_CARD', 'PIX', 'BOLETO'])
  const configured = (process.env.ASAAS_BILLING_TYPES || 'CREDIT_CARD,PIX')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter((item) => allowed.has(item))

  return configured.length ? configured : ['CREDIT_CARD', 'PIX']
}

class AsaasApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public payload: unknown,
  ) {
    super(message)
  }
}

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

function asaasBaseUrl() {
  return (process.env.ASAAS_BASE_URL || DEFAULT_ASAAS_BASE_URL).replace(/\/$/, '')
}

function isPublicHttpsUrl(value?: string | null) {
  if (!value) return false

  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      !['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname) &&
      !url.hostname.endsWith('.local')
    )
  } catch {
    return false
  }
}

function resolveAsaasCallbackBaseUrl(req: NextRequest) {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    req.nextUrl.origin,
    DEFAULT_APP_URL,
  ]

  const publicUrl = candidates.find(isPublicHttpsUrl) || DEFAULT_APP_URL
  return publicUrl.replace(/\/$/, '')
}

async function asaasRequest(path: string, init: RequestInit) {
  const apiKey = process.env.ASAAS_API_KEY

  if (!apiKey) {
    throw new Error('ASAAS_API_KEY nao configurada.')
  }

  const response = await fetch(`${asaasBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
      ...(init.headers || {}),
    },
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      payload?.errors?.[0]?.description ||
      payload?.error ||
      payload?.message ||
      'Erro ao criar checkout Asaas.'

    throw new AsaasApiError(message, response.status, payload)
  }

  return payload
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
}) {
  const existingUser = await findAuthUserByEmail(input.email)

  if (existingUser) {
    return existingUser.id
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
    } = await req.json()
    const normalizedSlug = normalizeSlug(String(slug ?? ''))
    const document = onlyDigits(String(cpfCnpj ?? ''))
    const phone = onlyDigits(String(telefone ?? ''))
    const postalCode = onlyDigits(String(cep ?? ''))
    const planKey = String(plano ?? '').toLowerCase()
    const planValue = planPrices()[planKey as keyof ReturnType<typeof planPrices>]
    const emailClean = String(email ?? '').trim().toLowerCase()
    const nameClean = String(nome ?? '').trim()
    const passwordValue = String(password ?? '')
    const confirmPasswordValue = String(confirmPassword ?? '')

    if (
      !planKey ||
      !nameClean ||
      !emailClean ||
      !document ||
      !phone ||
      !postalCode ||
      !endereco ||
      !numero ||
      !bairro ||
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

    if (postalCode.length !== 8) {
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

    if (!planValue) {
      return NextResponse.json({ error: 'Plano invalido ou preco nao configurado.' }, { status: 400 })
    }

    const { data: existingTenant } = await supabaseAdmin
      .from('tenants')
      .select('id, email, asaas_customer_id')
      .eq('slug', normalizedSlug)
      .maybeSingle()

    if (existingTenant && existingTenant.email?.toLowerCase() !== emailClean) {
      return NextResponse.json({ error: 'Este link de barbearia ja esta em uso.' }, { status: 409 })
    }

    const appUrl = resolveAsaasCallbackBaseUrl(req)
    const trialStart = addDays(new Date(), 7)
    let asaasCustomerId = existingTenant?.asaas_customer_id || null

    if (!asaasCustomerId) {
      const customer = await asaasRequest('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: nameClean,
          email: emailClean,
          cpfCnpj: document,
          mobilePhone: phone,
          address: String(endereco).trim(),
          addressNumber: String(numero).trim(),
          postalCode,
          province: String(bairro).trim(),
        }),
      })

      asaasCustomerId = customer?.id

      if (!asaasCustomerId) {
        return NextResponse.json({ error: 'Asaas nao retornou o cliente criado.' }, { status: 502 })
      }
    }

    const checkout = await asaasRequest('/checkouts', {
      method: 'POST',
      body: JSON.stringify({
        billingTypes: asaasBillingTypes(),
        chargeTypes: ['RECURRENT'],
        minutesToExpire: 60,
        externalReference: normalizedSlug,
        callback: {
          cancelUrl: `${appUrl}/pricing`,
          expiredUrl: `${appUrl}/pricing`,
          successUrl: `${appUrl}/register/success?slug=${encodeURIComponent(normalizedSlug)}`,
        },
        items: [
          {
            name: `KorteBarber ${planKey.toUpperCase()}`,
            description: `Assinatura mensal do plano ${planKey}`,
            quantity: 1,
            value: planValue,
          },
        ],
        customer: asaasCustomerId,
        subscription: {
          cycle: 'MONTHLY',
          nextDueDate: trialStart.toISOString().slice(0, 10),
        },
      }),
    })

    const checkoutId = checkout?.id
    const checkoutUrl = checkout?.url || checkout?.link || null
    const asaasSubscriptionId =
      typeof checkout?.subscription === 'string'
        ? checkout.subscription
        : checkout?.subscription?.id || null

    if (!checkoutUrl) {
      return NextResponse.json({ error: 'Asaas nao retornou a URL do checkout.' }, { status: 502 })
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .upsert(
        {
          nome: nameClean,
          email: emailClean,
          slug: normalizedSlug,
          plano: planKey,
          status: 'suspended',
          trial_ends_at: trialStart.toISOString(),
          asaas_customer_id: asaasCustomerId,
          asaas_subscription_id: asaasSubscriptionId,
        },
        { onConflict: 'slug' },
      )
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
      url: checkoutUrl,
      checkoutId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao iniciar checkout Asaas.'
    console.error('Asaas checkout error:', err)

    if (err instanceof AsaasApiError) {
      return NextResponse.json(
        {
          error: message,
          asaasStatus: err.status,
          asaasPayload: err.payload,
        },
        { status: 400 },
      )
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
