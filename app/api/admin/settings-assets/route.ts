import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MEDIA_BUCKET = 'barbershop-media'
type MediaFolder = 'barbers' | 'services'
type StorageFile = { name: string; updated_at?: string | null; created_at?: string | null }

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function publicMediaUrl(path: string) {
  return supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
}

async function listMedia(folder: MediaFolder) {
  const { data, error } = await supabaseAdmin.storage.from(MEDIA_BUCKET).list(folder, { limit: 1000 })
  if (error) return []
  return (data ?? []) as StorageFile[]
}

function findMedia(files: StorageFile[], id: string) {
  return files.find(file => file.name === id) ?? files.find(file => file.name.startsWith(`${id}.`)) ?? null
}

function mediaUrl(folder: MediaFolder, file: StorageFile | null) {
  if (!file) return null
  const version = file.updated_at || file.created_at || ''
  const url = publicMediaUrl(`${folder}/${file.name}`)
  return version ? `${url}?v=${encodeURIComponent(version)}` : url
}

async function removeMedia(folder: MediaFolder, id: string) {
  const files = await listMedia(folder)
  const paths = files
    .filter(file => file.name === id || file.name.startsWith(`${id}.`))
    .map(file => `${folder}/${file.name}`)

  if (paths.length > 0) {
    await supabaseAdmin.storage.from(MEDIA_BUCKET).remove(paths)
  }
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
  if (!membership || !['admin', 'owner'].includes(membership.role)) return jsonError('Acesso negado.', 403)

  return { user: userData.user }
}

async function loadAssets(tenantId: string) {
  const [
    { data: barbers, error: barbersError },
    { data: services, error: servicesError },
    barberFiles,
    serviceFiles,
  ] = await Promise.all([
    supabaseAdmin
      .from('barbeiros')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('nome'),
    supabaseAdmin
      .from('services')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name'),
    listMedia('barbers'),
    listMedia('services'),
  ])

  if (barbersError) throw barbersError
  if (servicesError) throw servicesError

  return {
    barbers: (barbers ?? []).map((barber: any) => ({
      ...barber,
      avatar_url: barber.avatar_url ?? mediaUrl('barbers', findMedia(barberFiles, String(barber.id))),
    })),
    services: (services ?? []).map((service: any) => ({
      ...service,
      photo_url: service.photo_url ?? mediaUrl('services', findMedia(serviceFiles, String(service.id))),
    })),
  }
}

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenant_id') ?? ''
    const auth = await requireAdmin(req, tenantId)
    if (auth instanceof NextResponse) return auth

    const data = await loadAssets(tenantId)
    return NextResponse.json(data)
  } catch (error: any) {
    return jsonError(error.message ?? 'Erro ao carregar configuracoes.', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const tenantId = String(body.tenant_id ?? '')
    const auth = await requireAdmin(req, tenantId)
    if (auth instanceof NextResponse) return auth

    if (body.action === 'update_barber_photo') {
      const { data, error } = await supabaseAdmin
        .from('barbeiros')
        .select('id')
        .eq('id', body.barber_id)
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (error) return jsonError(error.message, 400)
      if (!data) return jsonError('Barbeiro nao encontrado.', 404)
      if (body.avatar_url === null) await removeMedia('barbers', String(body.barber_id))
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'update_service_photo') {
      const { data, error } = await supabaseAdmin
        .from('services')
        .select('id')
        .eq('id', body.service_id)
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (error) return jsonError(error.message, 400)
      if (!data) return jsonError('Servico nao encontrado.', 404)
      if (body.photo_url === null) await removeMedia('services', String(body.service_id))
      return NextResponse.json({ ok: true })
    }

    return jsonError('Acao invalida.', 400)
  } catch (error: any) {
    return jsonError(error.message ?? 'Erro ao salvar configuracoes.', 500)
  }
}
