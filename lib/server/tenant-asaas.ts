import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type AsaasEnvironment = 'sandbox' | 'production'

export type TenantAsaasConfig = {
  apiKey: string
  baseUrl: string
  environment: AsaasEnvironment
}

export type AsaasAccount = {
  name: string
  email: string | null
}

const ASAAS_BASE_URLS: Record<AsaasEnvironment, string> = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  production: 'https://api.asaas.com/v3',
}

function encryptionKey() {
  const secret = process.env.TENANT_ASAAS_ENCRYPTION_KEY
  if (!secret || secret.length < 32) {
    throw new Error(
      'TENANT_ASAAS_ENCRYPTION_KEY deve estar configurada no servidor com pelo menos 32 caracteres.',
    )
  }
  return createHash('sha256').update(secret).digest()
}

export function encryptTenantAsaasKey(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return ['enc', 'v1', iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':')
}

export function decryptTenantAsaasKey(value: string) {
  if (!value.startsWith('enc:v1:')) {
    throw new Error('Credencial ASAAS antiga ou invalida. Salve novamente a integracao.')
  }

  const [, , ivValue, tagValue, encryptedValue] = value.split(':')
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error('Credencial ASAAS criptografada invalida.')
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivValue, 'base64'),
  )
  decipher.setAuthTag(Buffer.from(tagValue, 'base64'))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

export function asaasBaseUrl(environment: AsaasEnvironment) {
  return ASAAS_BASE_URLS[environment]
}

export function normalizeAsaasEnvironment(value: unknown): AsaasEnvironment {
  return value === 'sandbox' ? 'sandbox' : 'production'
}

export function maskAsaasKey(value: string) {
  const clean = value.trim()
  return clean.length <= 4 ? '••••' : `••••••••${clean.slice(-4)}`
}

export async function testAsaasConnection(
  apiKey: string,
  environment: AsaasEnvironment,
): Promise<AsaasAccount> {
  const response = await fetch(`${asaasBaseUrl(environment)}/myAccount`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
    },
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      payload?.errors?.[0]?.description ||
      payload?.error ||
      payload?.message ||
      'Chave ASAAS invalida ou sem permissao.'
    throw new Error(message)
  }

  return {
    name: String(payload?.name || payload?.company || payload?.commercialInfo?.name || 'Conta ASAAS'),
    email: payload?.email ? String(payload.email) : null,
  }
}

function isMissingSettingsTable(error: any) {
  const message = String(error?.message ?? '').toLowerCase()
  return (
    ['42P01', 'PGRST205'].includes(String(error?.code ?? '')) ||
    (message.includes('tenant_payment_settings') &&
      (message.includes('schema cache') || message.includes('does not exist')))
  )
}

export async function loadTenantAsaasConfig(
  tenantId: string,
  client?: SupabaseClient,
): Promise<TenantAsaasConfig | null> {
  const supabase =
    client ||
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

  const { data, error } = await supabase
    .from('tenant_payment_settings')
    .select('asaas_enabled,asaas_api_key,asaas_environment')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) {
    if (isMissingSettingsTable(error)) return null
    throw error
  }

  if (!data?.asaas_enabled || !data.asaas_api_key) return null

  const environment = normalizeAsaasEnvironment(data.asaas_environment)
  return {
    apiKey: decryptTenantAsaasKey(String(data.asaas_api_key)),
    baseUrl: asaasBaseUrl(environment),
    environment,
  }
}
