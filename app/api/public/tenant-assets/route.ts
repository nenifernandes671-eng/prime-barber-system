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

function isMissingGalleryTable(error: any) {
  const message = String(error?.message ?? '')
  return error?.code === '42P01' || error?.code === 'PGRST205' || message.includes('tenant_gallery_images')
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

async function loadGalleryImages(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from('tenant_gallery_images')
    .select('id, image_url, position, is_cover, created_at')
    .eq('tenant_id', tenantId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    if (isMissingGalleryTable(error)) return []
    throw error
  }

  return data ?? []
}

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenant_id') ?? ''
    if (!tenantId) return jsonError('tenant_id obrigatorio.', 400)

    const [
      { data: barbers, error: barbersError },
      { data: services, error: servicesError },
      barberFiles,
      serviceFiles,
      gallery,
    ] = await Promise.all([
      supabaseAdmin
        .from('barbeiros')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('ativo', true)
        .order('nome'),
      supabaseAdmin
        .from('services')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('price'),
      listMedia('barbers'),
      listMedia('services'),
      loadGalleryImages(tenantId),
    ])

    if (barbersError) return jsonError(barbersError.message, 400)
    if (servicesError) return jsonError(servicesError.message, 400)

    return NextResponse.json({
      barbers: (barbers ?? []).map((barber: any) => ({
        ...barber,
        avatar_url: barber.avatar_url ?? mediaUrl('barbers', findMedia(barberFiles, String(barber.id))),
      })),
      services: (services ?? []).map((service: any) => ({
        ...service,
        photo_url: service.photo_url ?? mediaUrl('services', findMedia(serviceFiles, String(service.id))),
      })),
      gallery,
    })
  } catch (error: any) {
    return jsonError(error.message ?? 'Erro ao carregar dados publicos.', 500)
  }
}
