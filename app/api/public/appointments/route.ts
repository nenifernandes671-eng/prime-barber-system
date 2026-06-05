import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function normalizeTime(time: string) {
  return time.slice(0, 5)
}

async function getBarber(tenantId: string, barberId: string) {
  return supabaseAdmin
    .from('barbeiros')
    .select('id,nome,ativo,tenant_id,unit_id')
    .eq('tenant_id', tenantId)
    .eq('id', barberId)
    .maybeSingle()
}

async function getUnit(tenantId: string, unitId: string) {
  if (!unitId) return { data: null, error: null }

  return supabaseAdmin
    .from('units')
    .select('id,tenant_id,active')
    .eq('tenant_id', tenantId)
    .eq('id', unitId)
    .maybeSingle()
}

async function getTenantPlan(tenantId: string) {
  return supabaseAdmin
    .from('tenants')
    .select('id,plano,status,trial_ends_at')
    .eq('id', tenantId)
    .maybeSingle()
}

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenant_id') ?? ''
    const barberId = req.nextUrl.searchParams.get('barber_id') ?? ''
    const requestedUnitId = req.nextUrl.searchParams.get('unit_id') ?? ''
    const date = req.nextUrl.searchParams.get('date') ?? ''

    if (!tenantId || !barberId || !date) {
      return jsonError('tenant_id, barber_id e date sao obrigatorios.', 400)
    }

    const [
      { data: tenant, error: tenantError },
      { data: barber, error: barberError },
    ] = await Promise.all([
      getTenantPlan(tenantId),
      getBarber(tenantId, barberId),
    ])

    if (tenantError) return jsonError(tenantError.message, 400)
    if (barberError) return jsonError(barberError.message, 400)
    if (!tenant) return jsonError('Barbearia nao encontrada.', 404)
    if (!barber || !barber.ativo) return jsonError('Barbeiro nao encontrado.', 404)

    const unitId = tenant.plano === 'premium' ? requestedUnitId : ''

    if (unitId) {
      const { data: unit, error: unitError } = await getUnit(tenantId, unitId)

      if (unitError) return jsonError(unitError.message, 400)
      if (!unit || !unit.active) return jsonError('Unidade nao encontrada.', 404)

      if (barber.unit_id && barber.unit_id !== unitId) {
        return jsonError('Barbeiro nao pertence a esta unidade.', 400)
      }
    }

    let query = supabaseAdmin
      .from('appointments')
      .select('appointment_time')
      .eq('tenant_id', tenantId)
      .eq('appointment_date', date)
      .eq('barber', barber.nome)
      .neq('status', 'cancelled')

    if (unitId) {
      query = query.eq('unit_id', unitId)
    }

    const { data, error } = await query

    if (error) return jsonError(error.message, 400)

    return NextResponse.json({
      bookedTimes: (data ?? [])
        .map((item: { appointment_time?: string | null }) =>
          item.appointment_time ? normalizeTime(item.appointment_time) : null
        )
        .filter(Boolean),
    })
  } catch (error: any) {
    return jsonError(error.message ?? 'Erro ao carregar horarios.', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const tenantId = String(body.tenant_id ?? '')
    const unitId = String(body.unit_id ?? '')
    const serviceId = String(body.service_id ?? '')
    const barberId = String(body.barber_id ?? '')
    const clientName = String(body.client_name ?? '').trim()
    const phone = String(body.phone ?? '').trim()
    const appointmentDate = String(body.appointment_date ?? '')
    const appointmentTime = normalizeTime(String(body.appointment_time ?? ''))

    if (
      !tenantId ||
      !serviceId ||
      !barberId ||
      !clientName ||
      !phone ||
      !appointmentDate ||
      !appointmentTime
    ) {
      return jsonError('Preencha todos os campos.', 400)
    }

    const [
      { data: tenant, error: tenantError },
      { data: service, error: serviceError },
      { data: barber, error: barberError },
      { data: unit, error: unitError },
    ] = await Promise.all([
      supabaseAdmin
        .from('tenants')
        .select('id,plano,status,trial_ends_at')
        .eq('id', tenantId)
        .maybeSingle(),

      supabaseAdmin
        .from('services')
        .select('id,name,price,tenant_id,unit_id')
        .eq('tenant_id', tenantId)
        .eq('id', serviceId)
        .maybeSingle(),

      getBarber(tenantId, barberId),

      unitId ? getUnit(tenantId, unitId) : Promise.resolve({ data: null, error: null }),
    ])

    if (tenantError) return jsonError(tenantError.message, 400)
    if (serviceError) return jsonError(serviceError.message, 400)
    if (barberError) return jsonError(barberError.message, 400)
    if (unitError) return jsonError(unitError.message, 400)

    if (!tenant) return jsonError('Barbearia nao encontrada.', 404)
    if (!service) return jsonError('Servico nao encontrado.', 404)
    if (!barber || !barber.ativo) return jsonError('Barbeiro nao encontrado.', 404)

    const isPremium = tenant.plano === 'premium'
    const activeUnitId = isPremium ? unitId : ''

    if (activeUnitId && (!unit || !unit.active)) {
      return jsonError('Unidade nao encontrada.', 404)
    }

    if (activeUnitId && barber.unit_id && barber.unit_id !== activeUnitId) {
      return jsonError('Barbeiro nao pertence a esta unidade.', 400)
    }

    if (activeUnitId && service.unit_id && service.unit_id !== activeUnitId) {
      return jsonError('Servico nao pertence a esta unidade.', 400)
    }

    const finalUnitId = isPremium
      ? activeUnitId || barber.unit_id || service.unit_id || null
      : null

    let existingQuery = supabaseAdmin
      .from('appointments')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('appointment_date', appointmentDate)
      .eq('appointment_time', appointmentTime)
      .eq('barber', barber.nome)
      .neq('status', 'cancelled')
      .limit(1)

    if (finalUnitId) {
      existingQuery = existingQuery.eq('unit_id', finalUnitId)
    }

    const { data: existing, error: existingError } = await existingQuery

    if (existingError) return jsonError(existingError.message, 400)

    if ((existing ?? []).length > 0) {
      return jsonError('Esse horario acabou de ser ocupado. Escolha outro horario.', 409)
    }

    const { error } = await supabaseAdmin.from('appointments').insert({
      tenant_id: tenantId,
      unit_id: finalUnitId,
      client_name: clientName,
      phone,
      service: service.name,
      price: service.price,
      barber: barber.nome,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      status: 'scheduled',
      payment_status: 'pending',
    })

    if (error) {
      const status =
        error.code === '23505' || /duplicate|unique/i.test(error.message)
          ? 409
          : 400

      return jsonError(
        status === 409
          ? 'Esse horario acabou de ser ocupado. Escolha outro horario.'
          : error.message,
        status
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return jsonError(error.message ?? 'Erro ao agendar.', 500)
  }
}
