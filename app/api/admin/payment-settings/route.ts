import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  decryptTenantAsaasKey,
  encryptTenantAsaasKey,
  maskAsaasKey,
  normalizeAsaasEnvironment,
  testAsaasConnection,
} from '@/lib/server/tenant-asaas'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

async function requireAdmin(req: NextRequest, tenantId: string) {
  if (!tenantId) return jsonError('tenant_id obrigatorio.', 400)

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return jsonError('Sessao ausente.', 401)

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData.user) return jsonError('Sessao invalida.', 401)

  const { data: membership, error } = await supabaseAdmin
    .from('tenant_users')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userData.user.id)
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (!membership || !['admin', 'owner'].includes(membership.role)) {
    return jsonError('Acesso negado.', 403)
  }

  return { user: userData.user }
}

async function getSettings(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from('tenant_payment_settings')
    .select(
      'asaas_enabled,asaas_api_key,asaas_environment,asaas_account_name,asaas_account_email,connection_status,last_tested_at',
    )
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw error
  return data
}

function publicSettings(settings: any) {
  if (!settings) {
    return {
      configured: false,
      enabled: false,
      environment: 'production',
      maskedKey: null,
      accountName: null,
      accountEmail: null,
      connectionStatus: 'not_tested',
      lastTestedAt: null,
    }
  }

  let maskedKey = ''
  if (settings.asaas_api_key) {
    try {
      maskedKey = maskAsaasKey(decryptTenantAsaasKey(String(settings.asaas_api_key)))
    } catch {
      maskedKey = '••••••••'
    }
  }

  return {
    configured: Boolean(settings.asaas_enabled && settings.asaas_api_key),
    enabled: Boolean(settings.asaas_enabled),
    environment: normalizeAsaasEnvironment(settings.asaas_environment),
    maskedKey,
    accountName: settings.asaas_account_name || null,
    accountEmail: settings.asaas_account_email || null,
    connectionStatus: settings.connection_status || 'not_tested',
    lastTestedAt: settings.last_tested_at || null,
  }
}

export async function GET(req: NextRequest) {
  try {
    const tenantId =
      req.nextUrl.searchParams.get('tenant_id') ??
      req.headers.get('x-tenant-id') ??
      ''
    const auth = await requireAdmin(req, tenantId)
    if (auth instanceof NextResponse) return auth

    return NextResponse.json({
      settings: publicSettings(await getSettings(tenantId)),
    })
  } catch (error: any) {
    return jsonError(error.message ?? 'Erro ao carregar configuracao ASAAS.', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const tenantId = String(body.tenant_id ?? body.tenantId ?? '')
    const auth = await requireAdmin(req, tenantId)
    if (auth instanceof NextResponse) return auth

    if (body.action === 'remove') {
      const { error } = await supabaseAdmin
        .from('tenant_payment_settings')
        .delete()
        .eq('tenant_id', tenantId)

      if (error) return jsonError(error.message, 400)
      return NextResponse.json({ ok: true, settings: publicSettings(null) })
    }

    const environment = normalizeAsaasEnvironment(body.environment)
    const existing = await getSettings(tenantId)
    const suppliedKey = String(body.api_key ?? body.apiKey ?? '').trim()
    let apiKey = suppliedKey

    if (!apiKey && existing?.asaas_api_key) {
      apiKey = decryptTenantAsaasKey(String(existing.asaas_api_key))
    }
    if (!apiKey) return jsonError('Informe a chave API ASAAS.', 400)

    const account = await testAsaasConnection(apiKey, environment)
    const testedAt = new Date().toISOString()

    if (body.action === 'test') {
      return NextResponse.json({
        ok: true,
        account: {
          name: account.name,
          email: account.email,
        },
        connectionStatus: 'active',
        testedAt,
      })
    }

    if (body.action === 'save') {
      const { error } = await supabaseAdmin.from('tenant_payment_settings').upsert(
        {
          tenant_id: tenantId,
          asaas_enabled: true,
          asaas_api_key: encryptTenantAsaasKey(apiKey),
          asaas_environment: environment,
          asaas_base_url:
            environment === 'sandbox'
              ? 'https://api-sandbox.asaas.com/v3'
              : 'https://api.asaas.com/v3',
          asaas_account_name: account.name,
          asaas_account_email: account.email,
          connection_status: 'active',
          last_tested_at: testedAt,
        },
        { onConflict: 'tenant_id' },
      )

      if (error) return jsonError(error.message, 400)
      return NextResponse.json({
        ok: true,
        settings: publicSettings(await getSettings(tenantId)),
      })
    }

    return jsonError('Acao invalida.', 400)
  } catch (error: any) {
    return jsonError(error.message ?? 'Erro ao configurar ASAAS.', 500)
  }
}
