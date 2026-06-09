import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MEDIA_BUCKET = 'barbershop-media'
type MediaFolder = 'barbers' | 'services' | 'gallery'
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

function storagePathFromUrl(url?: string | null) {
  if (!url) return null
  const cleanUrl = url.split('?')[0]
  const marker = `/${MEDIA_BUCKET}/`
  const index = cleanUrl.indexOf(marker)
  return index >= 0 ? decodeURIComponent(cleanUrl.slice(index + marker.length)) : null
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

async function loadGalleryImages(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from('tenant_gallery_images')
    .select('id, tenant_id, image_url, storage_path, position, is_cover, created_at')
    .eq('tenant_id', tenantId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    if (isMissingGalleryTable(error)) return []
    throw error
  }

  return data ?? []
}

async function normalizeGalleryPositions(tenantId: string) {
  const gallery = await loadGalleryImages(tenantId)
  await Promise.all(
    gallery.map((image: any, index: number) =>
      supabaseAdmin
        .from('tenant_gallery_images')
        .update({ position: index })
        .eq('tenant_id', tenantId)
        .eq('id', image.id)
    )
  )
  return loadGalleryImages(tenantId)
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
    gallery,
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
    loadGalleryImages(tenantId),
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
    gallery,
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

    if (body.action === 'create_gallery_images') {
      const images = Array.isArray(body.images) ? body.images : []
      if (images.length === 0) return jsonError('Nenhuma imagem enviada.', 400)

      const currentGallery = await loadGalleryImages(tenantId)
      const remaining = 20 - currentGallery.length
      if (remaining <= 0) return jsonError('Limite de 20 imagens atingido.', 400)

      const rows = images.slice(0, remaining).map((image: any, index: number) => ({
        tenant_id: tenantId,
        image_url: String(image.image_url ?? ''),
        storage_path: image.storage_path ? String(image.storage_path) : storagePathFromUrl(image.image_url),
        position: currentGallery.length + index,
        is_cover: currentGallery.length === 0 && index === 0,
      })).filter((image: any) => image.image_url)

      if (rows.length === 0) return jsonError('URLs das imagens invalidas.', 400)

      const { error } = await supabaseAdmin.from('tenant_gallery_images').insert(rows)
      if (error) {
        if (isMissingGalleryTable(error)) return jsonError('Tabela tenant_gallery_images nao encontrada. Execute o SQL da galeria no Supabase.', 500)
        return jsonError(error.message, 400)
      }

      return NextResponse.json({ ok: true, gallery: await loadGalleryImages(tenantId) })
    }

    if (body.action === 'update_gallery_order') {
      const images = Array.isArray(body.images) ? body.images : []
      const ids = images.map((image: any) => String(image.id)).filter(Boolean)
      if (ids.length === 0) return jsonError('Nenhuma imagem para ordenar.', 400)

      const { data: ownedImages, error } = await supabaseAdmin
        .from('tenant_gallery_images')
        .select('id')
        .eq('tenant_id', tenantId)
        .in('id', ids)

      if (error) {
        if (isMissingGalleryTable(error)) return jsonError('Tabela tenant_gallery_images nao encontrada. Execute o SQL da galeria no Supabase.', 500)
        return jsonError(error.message, 400)
      }

      if ((ownedImages ?? []).length !== ids.length) return jsonError('Imagem da galeria nao encontrada.', 404)

      await Promise.all(
        images.map((image: any, index: number) =>
          supabaseAdmin
            .from('tenant_gallery_images')
            .update({ position: Number.isFinite(Number(image.position)) ? Number(image.position) : index })
            .eq('tenant_id', tenantId)
            .eq('id', image.id)
        )
      )

      return NextResponse.json({ ok: true, gallery: await normalizeGalleryPositions(tenantId) })
    }

    if (body.action === 'delete_gallery_image') {
      const galleryId = String(body.gallery_id ?? '')
      if (!galleryId) return jsonError('Imagem obrigatoria.', 400)

      const { data: image, error } = await supabaseAdmin
        .from('tenant_gallery_images')
        .select('id, image_url, storage_path')
        .eq('tenant_id', tenantId)
        .eq('id', galleryId)
        .maybeSingle()

      if (error) {
        if (isMissingGalleryTable(error)) return jsonError('Tabela tenant_gallery_images nao encontrada. Execute o SQL da galeria no Supabase.', 500)
        return jsonError(error.message, 400)
      }
      if (!image) return jsonError('Imagem da galeria nao encontrada.', 404)

      const { error: deleteError } = await supabaseAdmin
        .from('tenant_gallery_images')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('id', galleryId)

      if (deleteError) return jsonError(deleteError.message, 400)

      const storagePath = image.storage_path || storagePathFromUrl(image.image_url)
      if (storagePath) await supabaseAdmin.storage.from(MEDIA_BUCKET).remove([storagePath])

      return NextResponse.json({ ok: true, gallery: await normalizeGalleryPositions(tenantId) })
    }

    if (body.action === 'set_gallery_cover') {
      const galleryId = String(body.gallery_id ?? '')
      if (!galleryId) return jsonError('Imagem obrigatoria.', 400)

      const { data: image, error } = await supabaseAdmin
        .from('tenant_gallery_images')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('id', galleryId)
        .maybeSingle()

      if (error) {
        if (isMissingGalleryTable(error)) return jsonError('Tabela tenant_gallery_images nao encontrada. Execute o SQL da galeria no Supabase.', 500)
        return jsonError(error.message, 400)
      }
      if (!image) return jsonError('Imagem da galeria nao encontrada.', 404)

      const { error: clearError } = await supabaseAdmin
        .from('tenant_gallery_images')
        .update({ is_cover: false })
        .eq('tenant_id', tenantId)

      if (clearError) return jsonError(clearError.message, 400)

      const { error: coverError } = await supabaseAdmin
        .from('tenant_gallery_images')
        .update({ is_cover: true })
        .eq('tenant_id', tenantId)
        .eq('id', galleryId)

      if (coverError) return jsonError(coverError.message, 400)

      return NextResponse.json({ ok: true, gallery: await loadGalleryImages(tenantId) })
    }

    return jsonError('Acao invalida.', 400)
  } catch (error: any) {
    return jsonError(error.message ?? 'Erro ao salvar configuracoes.', 500)
  }
}
