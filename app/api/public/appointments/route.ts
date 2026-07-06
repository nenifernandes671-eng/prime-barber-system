import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTenantAccess } from '@/lib/subscription-access'
import { enqueuePush } from '@/lib/server/push'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function normalizeTime(time?: string | null) {
  const match = String(time || '').match(/^(\d{2}):(\d{2})/)
  return match ? `${match[1]}:${match[2]}` : ''
}

function timeToMinutes(time?: string | null) {
  const normalized = normalizeTime(time)
  if (!normalized) return Number.NaN

  const [hours, minutes] = normalized.split(':').map(Number)
  return hours * 60 + minutes
}

function weekdayFromDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.getDay()
}

function getBusinessHourRule<T extends { weekday: number; unit_id?: string | null }>(
  hours: T[],
  date: string,
  unitId?: string | null
) {
  const weekday = weekdayFromDate(date)
  if (weekday === null) return null

  const selectedUnitId = unitId ? String(unitId) : null
  return (
    hours.find((item) => item.weekday === weekday && selectedUnitId && String(item.unit_id) === selectedUnitId) ||
    hours.find((item) => item.weekday === weekday && !item.unit_id) ||
    hours.find((item) => item.weekday === weekday) ||
    null
  )
}

function isInsideBusinessHours({
  appointmentTime,
  appointmentDate,
  duration,
  tenant,
  businessHours,
  unitId,
}: {
  appointmentTime: string
  appointmentDate: string
  duration: number
  tenant: { opening_time?: string | null; closing_time?: string | null }
  businessHours: Array<{
    weekday: number
    unit_id?: string | null
    is_open: boolean
    open_time?: string | null
    close_time?: string | null
    break_start?: string | null
    break_end?: string | null
  }>
  unitId?: string | null
}) {
  const rule = getBusinessHourRule(businessHours, appointmentDate, unitId)

  if (rule && !rule.is_open) return false

  const start = timeToMinutes(rule?.open_time || tenant.opening_time || '08:00')
  const end = timeToMinutes(rule?.close_time || tenant.closing_time || '19:00')
  const appointmentStart = timeToMinutes(appointmentTime)
  const serviceDuration = Number(duration || 30)
  const appointmentEnd = appointmentStart + serviceDuration

  if (
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    Number.isNaN(appointmentStart) ||
    !serviceDuration ||
    appointmentStart < start ||
    appointmentEnd > end
  ) {
    return false
  }

  const breakStart = timeToMinutes(rule?.break_start)
  const breakEnd = timeToMinutes(rule?.break_end)

  return (
    Number.isNaN(breakStart) ||
    Number.isNaN(breakEnd) ||
    appointmentStart >= breakEnd ||
    appointmentEnd <= breakStart
  )
}

async function getBarber(tenantId: string, barberId: string) {
  return supabaseAdmin
    .from('barbeiros')
    .select('id,nome,ativo,tenant_id,unit_id,user_id')
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
    .select('id,plano,status,subscription_status,trial_start,trial_end,trial_ends_at,opening_time,closing_time')
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
    if (!getTenantAccess(tenant).allowed) {
      return jsonError('A agenda desta barbearia esta temporariamente indisponivel.', 403)
    }
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
  } catch (error: unknown) {
    return jsonError(errorMessage(error, 'Erro ao carregar horarios.'), 500)
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
        .select('id,plano,status,subscription_status,trial_start,trial_end,trial_ends_at,opening_time,closing_time')
        .eq('id', tenantId)
        .maybeSingle(),

      supabaseAdmin
        .from('services')
        .select('id,name,price,duration,tenant_id,unit_id')
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
    if (!getTenantAccess(tenant).allowed) {
      return jsonError('A agenda desta barbearia esta temporariamente indisponivel.', 403)
    }
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

    const { data: businessHours, error: businessHoursError } = await supabaseAdmin
      .from('business_hours')
      .select('weekday,unit_id,is_open,open_time,close_time,break_start,break_end')
      .eq('tenant_id', tenantId)

    if (businessHoursError) return jsonError(businessHoursError.message, 400)

    if (!isInsideBusinessHours({
      appointmentTime,
      appointmentDate,
      duration: Number(service.duration || 30),
      tenant,
      businessHours: businessHours ?? [],
      unitId: finalUnitId,
    })) {
      return jsonError('Horario fora do funcionamento da barbearia.', 400)
    }

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

    const { data: createdAppointment, error } = await supabaseAdmin.from('appointments').insert({
      tenant_id: tenantId,
      unit_id: finalUnitId,
      client_name: clientName,
      phone,
      service: service.name,
      price: service.price,
      barber: barber.nome,
      barber_id: barber.id,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      status: 'scheduled',
      payment_status: 'pending',
    }).select('id').single()

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

    if (barber.user_id && createdAppointment?.id) {
      enqueuePush({
        tenant_id: tenantId,
        user_ids: [barber.user_id],
        title: 'Novo agendamento',
        body: `${clientName} agendou ${service.name} para ${appointmentDate} as ${appointmentTime}.`,
        type: 'appointment_created',
        data: {
          entity_id: createdAppointment.id,
          route: `/agendamento/${createdAppointment.id}`,
        },
      }).catch((pushError) => console.error('Falha ao enfileirar push de novo agendamento:', pushError))
    }

    return NextResponse.json({ ok: true, appointment_id: createdAppointment?.id ?? null })
  } catch (error: unknown) {
    return jsonError(errorMessage(error, 'Erro ao agendar.'), 500)
  }
}

