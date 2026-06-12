import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizePlan } from '@/lib/permissions'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Testimonial = {
  name: string
  text: string
  rating: number
}

type Differential = {
  title: string
  description: string
  icon: string
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

async function requireAdmin(req: NextRequest, tenantId: string) {
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

  return userData.user
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? '').trim().slice(0, maxLength)
}

function cleanTestimonials(value: unknown): Testimonial[] {
  if (!Array.isArray(value)) return []

  return value.slice(0, 12).flatMap((item) => {
    const name = cleanText(item?.name, 80)
    const text = cleanText(item?.text, 500)
    const rating = Math.max(1, Math.min(5, Number(item?.rating) || 5))
    return name && text ? [{ name, text, rating }] : []
  })
}

function cleanDifferentials(value: unknown): Differential[] {
  if (!Array.isArray(value)) return []

  return value.slice(0, 12).flatMap((item) => {
    const title = cleanText(item?.title, 80)
    const description = cleanText(item?.description, 240)
    const icon = cleanText(item?.icon, 12) || '✦'
    return title ? [{ title, description, icon }] : []
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const tenantId = cleanText(body.tenant_id, 80)
    if (!tenantId) return jsonError('tenant_id obrigatorio.', 400)

    const auth = await requireAdmin(req, tenantId)
    if (auth instanceof NextResponse) return auth

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('plano')
      .eq('id', tenantId)
      .maybeSingle()

    if (tenantError) return jsonError(tenantError.message, 500)
    if (!tenant) return jsonError('Tenant nao encontrado.', 404)
    if (!['pro', 'premium'].includes(normalizePlan(tenant.plano))) {
      return jsonError('A personalizacao da pagina publica esta disponivel nos planos Pro e Premium.', 403)
    }

    const payload = {
      landing_headline: cleanText(body.landing_headline, 180) || null,
      landing_description: cleanText(body.landing_description, 600) || null,
      landing_whatsapp: cleanText(body.landing_whatsapp, 40) || null,
      landing_instagram: cleanText(body.landing_instagram, 180) || null,
      landing_address: cleanText(body.landing_address, 240) || null,
      landing_primary_color: /^#[0-9a-f]{6}$/i.test(String(body.landing_primary_color ?? ''))
        ? body.landing_primary_color
        : '#c9a84c',
      landing_banner_url: cleanText(body.landing_banner_url, 1200) || null,
      landing_logo_url: cleanText(body.landing_logo_url, 1200) || null,
      landing_about_title: cleanText(body.landing_about_title, 180) || null,
      landing_about_text: cleanText(body.landing_about_text, 1200) || null,
      landing_about_image_url: cleanText(body.landing_about_image_url, 1200) || null,
      landing_testimonials: cleanTestimonials(body.landing_testimonials),
      landing_differentials: cleanDifferentials(body.landing_differentials),
      landing_years_experience: cleanText(body.landing_years_experience, 30) || null,
      landing_appointments_count: cleanText(body.landing_appointments_count, 30) || null,
      landing_clients_count: cleanText(body.landing_clients_count, 30) || null,
      landing_average_rating: cleanText(body.landing_average_rating, 30) || null,
    }

    const { error } = await supabaseAdmin
      .from('tenants')
      .update(payload)
      .eq('id', tenantId)

    if (error) return jsonError(error.message, 400)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return jsonError(error?.message ?? 'Erro ao salvar pagina publica.', 500)
  }
}
