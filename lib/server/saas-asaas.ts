import {
  asaasBaseUrl,
  testAsaasConnection,
  type AsaasEnvironment,
} from '@/lib/server/tenant-asaas'

export type SaasAsaasConfig = {
  apiKey: string
  baseUrl: string
  environment: AsaasEnvironment
}

let validatedConfig: Promise<SaasAsaasConfig> | null = null

function cleanApiKey(value?: string) {
  const clean = String(value || '').trim()
  return clean.startsWith('\\$') ? clean.slice(1) : clean
}

function environmentFromBaseUrl(value?: string): AsaasEnvironment {
  return String(value || '').toLowerCase().includes('sandbox')
    ? 'sandbox'
    : 'production'
}

function safeKeyFingerprint(apiKey: string) {
  if (apiKey.length < 10) return `length:${apiKey.length}`
  return `${apiKey.slice(0, 5)}...${apiKey.slice(-4)}`
}

async function validateSaasAsaasConfig(): Promise<SaasAsaasConfig> {
  const apiKey = cleanApiKey(process.env.ASAAS_API_KEY)
  const environment = environmentFromBaseUrl(process.env.ASAAS_BASE_URL)
  const baseUrl = asaasBaseUrl(environment)

  if (!apiKey) {
    throw new Error('ASAAS_API_KEY nao configurada.')
  }

  console.info('[ASAAS SaaS] Configuracao utilizada', {
    environment,
    baseUrl,
    keyFingerprint: safeKeyFingerprint(apiKey),
  })

  try {
    await testAsaasConnection(apiKey, environment)
  } catch (error) {
    const alternateEnvironment =
      environment === 'production' ? 'sandbox' : 'production'

    try {
      await testAsaasConnection(apiKey, alternateEnvironment)
    } catch {
      throw error
    }

    throw new Error(
      `ASAAS_API_KEY pertence ao ambiente ${alternateEnvironment}, mas ASAAS_BASE_URL esta configurada para ${environment}. Corrija as variaveis e faca um novo deploy.`,
    )
  }

  return {
    apiKey,
    baseUrl,
    environment,
  }
}

export function getSaasAsaasConfig() {
  if (!validatedConfig) {
    validatedConfig = validateSaasAsaasConfig().catch((error) => {
      validatedConfig = null
      throw error
    })
  }

  return validatedConfig
}
