import { createSign } from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type PushData = Record<string, string | number | boolean | null | undefined>

type SendPushInput = {
  tenant_id: string
  user_ids: string[]
  title: string
  body: string
  data?: PushData
  type: string
}

type DeviceToken = {
  id: string
  user_id: string
  tenant_id: string
  token: string
  platform: 'android' | 'ios'
}

type QueueRow = {
  id: string
  tenant_id: string
  user_ids: string[]
  title: string
  body: string
  data: PushData | null
  type: string
  attempts: number
  max_attempts: number
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function firebaseConfig() {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase FCM nao configurado. Defina FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.')
  }

  return { projectId, clientEmail, privateKey }
}

async function getFcmAccessToken() {
  const { clientEmail, privateKey } = firebaseConfig()
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(privateKey)
  const assertion = `${unsigned}.${base64Url(signature)}`

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const payloadResponse = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payloadResponse?.error_description || payloadResponse?.error || 'Falha ao autenticar no FCM.')
  }
  return String(payloadResponse.access_token)
}

function normalizeData(data: PushData = {}) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)]),
  )
}

function isInvalidTokenError(status: number, payload: Record<string, unknown>) {
  const text = JSON.stringify(payload).toLowerCase()
  return status === 404 || text.includes('unregistered') || text.includes('invalid_argument') || text.includes('not found')
}

async function sendFcm(token: string, title: string, body: string, data: PushData, type: string) {
  const { projectId } = firebaseConfig()
  const accessToken = await getFcmAccessToken()
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: { ...normalizeData(data), type },
        android: {
          priority: 'HIGH',
          notification: { channel_id: 'default', sound: 'default' },
        },
        apns: {
          payload: { aps: { sound: 'default' } },
        },
      },
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(String(payload?.error?.message || payload?.error || `FCM HTTP ${response.status}`))
    ;(error as Error & { invalidToken?: boolean }).invalidToken = isInvalidTokenError(response.status, payload)
    throw error
  }
  return payload
}

export async function validateTenantUser(tenantId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('tenant_users')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}


export async function enqueueTenantPush(input: Omit<SendPushInput, 'user_ids'> & { roles?: string[] }) {
  let query = supabaseAdmin
    .from('tenant_users')
    .select('user_id,role')
    .eq('tenant_id', input.tenant_id)

  if (input.roles?.length) {
    query = query.in('role', input.roles)
  }

  const { data, error } = await query
  if (error) throw error

  return enqueuePush({
    tenant_id: input.tenant_id,
    user_ids: (data ?? []).map((item) => String(item.user_id)),
    title: input.title,
    body: input.body,
    data: input.data,
    type: input.type,
  })
}
export async function enqueuePush(input: SendPushInput) {
  const userIds = [...new Set(input.user_ids.filter(Boolean))]
  if (!input.tenant_id || userIds.length === 0 || !input.title.trim() || !input.body.trim()) {
    return { queued: false, reason: 'payload_incompleto' }
  }

  const perMinuteLimit = Number(process.env.PUSH_RATE_LIMIT_PER_MINUTE || 120)
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
  const { count, error: rateLimitError } = await supabaseAdmin
    .from('push_queue')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', input.tenant_id)
    .gte('created_at', oneMinuteAgo)

  if (rateLimitError) throw rateLimitError
  if ((count ?? 0) >= perMinuteLimit) {
    return { queued: false, reason: 'rate_limited' }
  }

  const { error } = await supabaseAdmin.from('push_queue').insert({
    tenant_id: input.tenant_id,
    user_ids: userIds,
    title: input.title,
    body: input.body,
    data: input.data ?? {},
    type: input.type,
  })

  if (error) throw error
  return { queued: true }
}

async function loadTokens(row: QueueRow) {
  const { data, error } = await supabaseAdmin
    .from('device_tokens')
    .select('id,user_id,tenant_id,token,platform')
    .eq('tenant_id', row.tenant_id)
    .eq('is_active', true)
    .in('user_id', row.user_ids)

  if (error) throw error
  return (data ?? []) as DeviceToken[]
}

async function logPush(row: QueueRow, token: DeviceToken, status: 'sent' | 'failed', errorMessage?: string) {
  await supabaseAdmin.from('push_logs').insert({
    queue_id: row.id,
    user_id: token.user_id,
    tenant_id: row.tenant_id,
    device_token_id: token.id,
    title: row.title,
    status,
    error_message: errorMessage ?? null,
    type: row.type,
  })
}

export async function processPushQueue(limit = 25) {
  const { data: rows, error } = await supabaseAdmin
    .from('push_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw error

  const results: Array<{ id: string; status: string; sent?: number; failed?: number; error?: string }> = []

  for (const row of (rows ?? []) as QueueRow[]) {
    await supabaseAdmin
      .from('push_queue')
      .update({ status: 'processing', attempts: row.attempts + 1, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'pending')

    try {
      const tokens = await loadTokens(row)
      let sent = 0
      let failed = 0

      for (const token of tokens) {
        try {
          await sendFcm(token.token, row.title, row.body, row.data ?? {}, row.type)
          sent += 1
          await supabaseAdmin.from('device_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', token.id)
          await logPush(row, token, 'sent')
        } catch (sendError) {
          failed += 1
          const errorMessage = sendError instanceof Error ? sendError.message : 'Erro desconhecido no FCM.'
          if ((sendError as Error & { invalidToken?: boolean })?.invalidToken) {
            await supabaseAdmin.from('device_tokens').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', token.id)
          }
          await logPush(row, token, 'failed', errorMessage)
        }
      }

      const shouldRetry = sent === 0 && failed > 0 && row.attempts + 1 < row.max_attempts
      await supabaseAdmin
        .from('push_queue')
        .update({
          status: shouldRetry ? 'pending' : failed > 0 && sent === 0 ? 'failed' : 'sent',
          next_attempt_at: shouldRetry ? new Date(Date.now() + 60_000 * (row.attempts + 1)).toISOString() : new Date().toISOString(),
          error_message: failed > 0 && sent === 0 ? 'Todos os tokens falharam.' : null,
          processed_at: shouldRetry ? null : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)

      results.push({ id: row.id, status: shouldRetry ? 'retry' : 'done', sent, failed })
    } catch (queueError) {
      const message = queueError instanceof Error ? queueError.message : 'Erro desconhecido.'
      const shouldRetry = row.attempts + 1 < row.max_attempts
      await supabaseAdmin
        .from('push_queue')
        .update({
          status: shouldRetry ? 'pending' : 'failed',
          next_attempt_at: shouldRetry ? new Date(Date.now() + 60_000 * (row.attempts + 1)).toISOString() : new Date().toISOString(),
          error_message: message,
          updated_at: new Date().toISOString(),
          processed_at: shouldRetry ? null : new Date().toISOString(),
        })
        .eq('id', row.id)
      results.push({ id: row.id, status: shouldRetry ? 'retry' : 'failed', error: message })
    }
  }

  return { checked: rows?.length ?? 0, results }
}